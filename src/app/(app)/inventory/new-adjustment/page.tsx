
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    addInventoryItem,
   applyInventoryAdjustments, } from "@/lib/actions/jobActions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import type { InventoryItemFormValues } from "@/lib/definitions";
import type { InventoryItem, InventoryCategory, InventoryAdjustmentItemFormValues, InventoryAdjustmentReasonValue } from "@/lib/definitions";
import { INVENTORY_CATEGORIES, INVENTORY_ADJUSTMENT_REASONS, InventoryAdjustmentItemSchema, getPaperQualityLabel, getPaperQualityUnit } from "@/lib/definitions";
import { getInventoryItems} from "@/lib/actions/jobActions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Trash2, Loader2, ArrowLeft, Search, Edit, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

type AdjustmentListItem = InventoryAdjustmentItemFormValues & { displayId: number };

const formatItemNameForDisplay = (item: InventoryItem): string => {
  if (item.type === 'Master Sheet') {
    const qualityLabel = item.paperQuality ? getPaperQualityLabel(item.paperQuality) : 'Paper';
    const unit = item.paperQuality ? getPaperQualityUnit(item.paperQuality) : null;
    let spec = '';
    if (unit === 'mm' && item.paperThicknessMm) spec = `${item.paperThicknessMm}mm`;
    else if (unit === 'gsm' && item.paperGsm) spec = `${item.paperGsm}GSM`;
    
    const size = (item.masterSheetSizeWidth && item.masterSheetSizeHeight) 
      ? `${item.masterSheetSizeWidth}x${item.masterSheetSizeHeight}in` 
      : '';
    return `${qualityLabel} ${spec} ${size}`.trim().replace(/\s\s+/g, ' ');
  }
  return item.name || "Unnamed Item";
};


export default function NewAdjustmentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<InventoryCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedItemForAdjustment, setSelectedItemForAdjustment] = useState<InventoryItem | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number | string>("");
  const [adjustmentReason, setAdjustmentReason] = useState<InventoryAdjustmentReasonValue | "">("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  const [stagedAdjustments, setStagedAdjustments] = useState<AdjustmentListItem[]>([]);
  const [nextDisplayId, setNextDisplayId] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    const items = await getInventoryItems(); // Fetches all items initially
    setAllInventory(items);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    let tempFiltered = [...allInventory];
    if (selectedCategoryFilter !== "ALL") {
      tempFiltered = tempFiltered.filter(item => {
        if (selectedCategoryFilter === 'PAPER') return item.type === 'Master Sheet';
        if (selectedCategoryFilter === 'INKS') return item.type === 'Ink';
        if (selectedCategoryFilter === 'PLASTIC_TRAY') return item.type === 'Plastic Tray';
        if (selectedCategoryFilter === 'GLASS_JAR') return item.type === 'Glass Jar';
        if (selectedCategoryFilter === 'MAGNET') return item.type === 'Magnet';
        if (selectedCategoryFilter === 'OTHER') return item.type === 'Other';
        return true;
      });
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      tempFiltered = tempFiltered.filter(item => 
        formatItemNameForDisplay(item).toLowerCase().includes(lowerQuery) ||
        item.id.toLowerCase().includes(lowerQuery) ||
        (item.locationCode && item.locationCode.toLowerCase().includes(lowerQuery))
      );
    }
    setFilteredInventory(tempFiltered);
  }, [allInventory, selectedCategoryFilter, searchQuery]);


  const handleSelectItemForAdjustment = (item: InventoryItem) => {
    setSelectedItemForAdjustment(item);
    // Clear previous adjustment inputs for this item
    setAdjustmentQuantity("");
    setAdjustmentReason("");
    setAdjustmentNotes("");
  };

  /* ──────────────────────────────────────────────────────────────── */
/* 1.  Add / stage one row                                          */
/* ──────────────────────────────────────────────────────────────── */
function typeToCategory(type: InventoryItem["type"]): InventoryCategory {
  switch (type) {
    case "Master Sheet": return "PAPER";
    case "Ink":          return "INKS";
    case "Plastic Tray": return "PLASTIC_TRAY";
    case "Glass Jar":    return "GLASS_JAR";
    case "Magnet":       return "MAGNET";
    default:             return "OTHER";
  }
}
const handleAddAdjustmentToList = async () => {
  if (!selectedItemForAdjustment) {
    toast({ title: "No Item Selected", description: "Please select an inventory item first.", variant: "destructive" });
    return;
  }

  const quantityNum = Number(adjustmentQuantity);
  if (isNaN(quantityNum) || quantityNum === 0) {
    toast({ title: "Invalid Quantity", description: "Please enter a valid non-zero quantity change.", variant: "destructive" });
    return;
  }

  if (!adjustmentReason) {
    toast({ title: "Reason Missing", description: "Please select a reason for the adjustment.", variant: "destructive" });
    return;
  }

  /* ---------------------------------------------------------------
     1️⃣  Ensure the item exists in Firestore
     --------------------------------------------------------------- */
     const { success, item } = await addInventoryItem({
          /* ---- required fields -------------------------------------- */
         category : typeToCategory(selectedItemForAdjustment.type),
      itemName : selectedItemForAdjustment.name,
      unit     : selectedItemForAdjustment.unit,
      quantity : 0,                           // stock will be added via adjustment
      
      /* ---- paper-specific optional fields ----------------------- */
      paperQuality               : selectedItemForAdjustment.paperQuality,
      paperMasterSheetSizeWidth  : selectedItemForAdjustment.masterSheetSizeWidth,
      paperMasterSheetSizeHeight : selectedItemForAdjustment.masterSheetSizeHeight,
    
      /* ---- minimal set; add more if your addInventoryItem schema
      requires them (locationCode, vendorName, etc.) -------- */
      } as InventoryItemFormValues);

  if (!success || !item) {
    toast({ title: "Error", description: "Failed to create or fetch inventory item." , variant: "destructive" });
    return;
  }

  /* ---------------------------------------------------------------
     2️⃣  Stage the adjustment with the deterministic ID
     --------------------------------------------------------------- */
  const newAdjustment: AdjustmentListItem = {
    displayId      : nextDisplayId,
    inventoryItemId: item.id,                               // ← "inv3"
    itemNameFull   : formatItemNameForDisplay(item),
    quantityChange : quantityNum,
    reason         : adjustmentReason,
    notes          : adjustmentNotes,
  };

  setStagedAdjustments(prev => [...prev, newAdjustment]);
  setNextDisplayId(prev => prev + 1);

  // Reset UI fields
  setSelectedItemForAdjustment(null);
  setAdjustmentQuantity("");
  setAdjustmentReason("");
  setAdjustmentNotes("");
  setSearchQuery("");
};

/* ──────────────────────────────────────────────────────────────── */
/* 2.  Remove staged row                                            */
/* ──────────────────────────────────────────────────────────────── */
const handleRemoveFromList = (displayId: number) => {
  setStagedAdjustments(prev => prev.filter(adj => adj.displayId !== displayId));
};

/* ──────────────────────────────────────────────────────────────── */
/* 3.  Save all staged adjustments                                  */
/* ──────────────────────────────────────────────────────────────── */
const handleSaveAllAdjustments = async () => {
  if (stagedAdjustments.length === 0) {
    toast({ title: "No Adjustments", description: "Please add items to the adjustment list before saving.", variant: "destructive" });
    return;
  }

  setIsSubmitting(true);

  // Strip UI-only fields (displayId, itemNameFull)
  const adjustmentsToSave = stagedAdjustments.map(({ displayId, itemNameFull, ...rest }) => rest);

  // 🔍 DEBUG — confirm IDs sent to server
  console.log("[UI] adjustments payload", adjustmentsToSave);

  const result = await applyInventoryAdjustments(adjustmentsToSave);
  setIsSubmitting(false);

  if (result.success) {
    toast({ title: "Success!", description: result.message });
    setStagedAdjustments([]);
    setNextDisplayId(1);
    fetchItems();            // refresh inventory list
    router.push("/inventory");
  } else {
    toast({
      title      : "Error Saving Adjustments",
      description: result.message + (result.errors ? ` Details: ${result.errors.map(e => e.message).join(", ")}` : ""),
      variant    : "destructive",
      duration   : 7000,
    });
  }
};


  return (
    <div className="space-y-6">
      <Button variant="outline" asChild className="mb-4 font-body">
        <Link href="/inventory">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inventory Categories
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <Edit className="mr-3 h-6 w-6 text-primary"/>Make Inventory Adjustments
          </CardTitle>
          <CardDescription className="font-body">
            Select items and specify changes to their stock levels. Add multiple adjustments before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Item Selection Section */}
          <div className="p-4 border rounded-lg bg-card shadow-sm space-y-4">
            <h3 className="font-semibold font-headline text-lg">1. Select Item for Adjustment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={selectedCategoryFilter} onValueChange={(val) => setSelectedCategoryFilter(val as InventoryCategory | "ALL")}>
                <SelectTrigger className="font-body h-11">
                  <SelectValue placeholder="Filter by Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="font-body">All Categories</SelectItem>
                  {INVENTORY_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value} className="font-body">{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search item by name, ID, location..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="font-body h-11 pl-10"
                />
              </div>
            </div>
            <ScrollArea className="h-[250px] border rounded-md">
              {filteredInventory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-body">Item Details</TableHead>
                      <TableHead className="font-body text-right">Current Stock</TableHead>
                      <TableHead className="font-body text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map(item => (
                      <TableRow 
                        key={item.id} 
                        className={selectedItemForAdjustment?.id === item.id ? "bg-secondary" : "cursor-pointer hover:bg-muted/50"}
                        onClick={() => handleSelectItemForAdjustment(item)}
                      >
                        <TableCell className="font-body">
                          {formatItemNameForDisplay(item)}
                          <div className="text-xs text-muted-foreground">ID: {item.id} {item.locationCode && `| Loc: ${item.locationCode}`}</div>
                        </TableCell>
                        <TableCell className="font-body text-right">{item.availableStock?.toLocaleString() ?? 0} {item.unit}</TableCell>
                        <TableCell className="font-body text-center">
                          <Button 
                            variant={selectedItemForAdjustment?.id === item.id ? "default" : "outline"} 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); handleSelectItemForAdjustment(item); }}
                          >
                            {selectedItemForAdjustment?.id === item.id ? "Selected" : "Select"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-center text-muted-foreground font-body">No inventory items match your filters.</div>
              )}
            </ScrollArea>
          </div>

          {/* Adjustment Details Section - Appears when an item is selected */}
          {selectedItemForAdjustment && (
            <div className="p-4 border rounded-lg bg-card shadow-sm space-y-4">
              <h3 className="font-semibold font-headline text-lg">2. Enter Adjustment for: <span className="text-primary">{formatItemNameForDisplay(selectedItemForAdjustment)}</span></h3>
              <p className="text-sm text-muted-foreground font-body">Current Stock: {selectedItemForAdjustment.availableStock?.toLocaleString() ?? 0} {selectedItemForAdjustment.unit}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adjQty">Quantity Change (+/-)</Label>
                  <Input 
                    id="adjQty"
                    type="number" 
                    placeholder="e.g., -10 or 50" 
                    value={adjustmentQuantity}
                    onChange={(e) => setAdjustmentQuantity(e.target.value)}
                    className="font-body h-11"
                  />
                  {Number(adjustmentQuantity) < 0 && (selectedItemForAdjustment.availableStock || 0) + Number(adjustmentQuantity) < 0 && (
                    <p className="text-xs text-destructive mt-1 flex items-center">
                        <AlertTriangle className="h-3 w-3 mr-1" /> This will result in negative stock.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="adjReason">Reason for Adjustment</Label>
                  <Select value={adjustmentReason} onValueChange={(val) => setAdjustmentReason(val as InventoryAdjustmentReasonValue)}>
                    <SelectTrigger id="adjReason" className="font-body h-11">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_ADJUSTMENT_REASONS.map(reason => (
                        <SelectItem key={reason.value} value={reason.value} className="font-body">{reason.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="adjNotes">Notes (Optional)</Label>
                <Textarea 
                    id="adjNotes"
                    placeholder="e.g., Found during quarterly stock take, Damaged in transit" 
                    value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    className="font-body"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddAdjustmentToList}>
                  <PlusCircle className="mr-2 h-4 w-4"/> Add to Adjustment List
                </Button>
              </div>
            </div>
          )}

          {/* Staged Adjustments List */}
          {stagedAdjustments.length > 0 && (
            <div className="p-4 border rounded-lg bg-card shadow-sm space-y-2">
              <h3 className="font-semibold font-headline text-lg">3. Adjustments Pending Save</h3>
              <ScrollArea className="h-[200px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-body">Item</TableHead>
                      <TableHead className="font-body text-right">Qty Change</TableHead>
                      <TableHead className="font-body">Reason</TableHead>
                      <TableHead className="font-body">Notes</TableHead>
                      <TableHead className="font-body text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagedAdjustments.map(adj => (
                      <TableRow key={adj.displayId}>
                        <TableCell className="font-body text-sm">{adj.itemNameFull}</TableCell>
                        <TableCell className={`font-body text-right font-medium ${adj.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {adj.quantityChange > 0 ? `+${adj.quantityChange.toLocaleString()}` : adj.quantityChange.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-body text-sm">{INVENTORY_ADJUSTMENT_REASONS.find(r => r.value === adj.reason)?.label}</TableCell>
                        <TableCell className="font-body text-xs truncate max-w-xs">{adj.notes || '-'}</TableCell>
                        <TableCell className="font-body text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveFromList(adj.displayId)} title="Remove">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6 border-t">
          <Button type="button" variant="outline" onClick={() => router.push('/inventory')} disabled={isSubmitting} className="font-body">
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSaveAllAdjustments} 
            disabled={isSubmitting || stagedAdjustments.length === 0} 
            className="font-body"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Edit className="mr-2 h-4 w-4" />}
            Save All Adjustments
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
