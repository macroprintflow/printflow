
"use client"; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, PlusCircle, Search, History, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { InventoryAdjustmentsDialog } from "@/components/inventory/InventoryAdjustmentsDialog";
import { getInventoryItems } from "@/lib/actions/jobActions";
import type { InventoryItem, PaperQualityType } from "@/lib/definitions";
import { PAPER_QUALITY_OPTIONS } from "@/lib/definitions";
import Link from "next/link";
import { useParams } from "next/navigation";

// Helper function to get display name for category slug
const getCategoryDisplayName = (slug: string | string[] | undefined): string => {
  if (typeof slug !== 'string') return "Inventory";
  switch (slug) {
    case "paper": return "Paper";
    case "inks": return "Inks";
    case "plastic-trays": return "Plastic Trays";
    case "glass-jars": return "Glass Jars";
    case "magnets": return "Magnets";
    case "other-materials": return "Other Materials";
    default: return "Inventory";
  }
};

export default function FilteredInventoryPage() {
  const params = useParams();
  const categorySlug = params.category;
  const categoryDisplayName = getCategoryDisplayName(categorySlug);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isAdjustmentsDialogOpen, setIsAdjustmentsDialogOpen] = useState(false);
  const [selectedItemForAdjustments, setSelectedItemForAdjustments] = useState<InventoryItem | null>(null);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    const items = await getInventoryItems();
    setInventoryItems(items);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const paperQualityValues = useMemo(() => PAPER_QUALITY_OPTIONS.map(opt => opt.label), []);

  const filteredItems = useMemo(() => {
    let itemsToFilter = inventoryItems;

    // Primary filter based on categorySlug
    if (categorySlug === "paper") {
      itemsToFilter = itemsToFilter.filter(item => item.type === 'Master Sheet' || paperQualityValues.includes(item.itemGroup as string));
    } else if (categorySlug === "inks") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Inks");
    } else if (categorySlug === "plastic-trays") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Plastic Trays");
    } else if (categorySlug === "glass-jars") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Glass Jars");
    } else if (categorySlug === "magnets") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Magnets");
    } else if (categorySlug === "other-materials") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Other Stock");
    } else {
      // If categorySlug is unknown or not provided, show nothing or handle error
      itemsToFilter = [];
    }

    // Secondary filter based on search query
    if (searchQuery.trim() !== "") {
      const lowerCaseQuery = searchQuery.toLowerCase();
      itemsToFilter = itemsToFilter.filter(item => {
        return (
          item.name.toLowerCase().includes(lowerCaseQuery) ||
          item.type.toLowerCase().includes(lowerCaseQuery) ||
          (item.paperGsm && item.paperGsm.toString().includes(lowerCaseQuery)) ||
          (item.id && item.id.toLowerCase().includes(lowerCaseQuery))
        );
      });
    }
    return itemsToFilter;
  }, [inventoryItems, searchQuery, categorySlug, paperQualityValues]);

  const handleViewAdjustments = (item: InventoryItem) => {
    setSelectedItemForAdjustments(item);
    setIsAdjustmentsDialogOpen(true);
  };

  const renderInventoryTable = useCallback((items: InventoryItem[]) => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <Archive className="mx-auto h-12 w-12 text-muted-foreground animate-pulse" />
          <p className="mt-4 text-lg text-muted-foreground font-body">Loading {categoryDisplayName.toLowerCase()} inventory...</p>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold font-headline">
            {searchQuery.trim() !== "" ? `No ${categoryDisplayName} Match Your Search` : `No Items in ${categoryDisplayName}`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            {searchQuery.trim() !== "" 
              ? "Try adjusting your search terms or clearing the search."
              : `There are no inventory items in the ${categoryDisplayName.toLowerCase()} category, or the inventory is empty.`
            }
          </p>
           <Button className="mt-6" onClick={() => setIsAddItemDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item to {categoryDisplayName}
          </Button>
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-headline">Item Name (Size)</TableHead>
            <TableHead className="font-headline">Type</TableHead>
            <TableHead className="font-headline">Item Group</TableHead>
            <TableHead className="font-headline">Paper GSM</TableHead>
            <TableHead className="font-headline text-right">Available Stock</TableHead>
            <TableHead className="font-headline text-right">Unit</TableHead>
            <TableHead className="font-headline text-right">Reorder Point</TableHead>
            <TableHead className="font-headline text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell 
                className="font-medium font-body hover:underline cursor-pointer"
                onClick={() => handleViewAdjustments(item)}
              >
                {item.name}
              </TableCell>
              <TableCell>
                <Badge variant={
                  item.type === 'Master Sheet' ? 'secondary' :
                  item.type === 'Paper Stock' ? 'outline' : 
                  item.type === 'Ink' ? 'default' : 'secondary' 
                } className="font-body capitalize">
                  {item.type}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="default" className="font-body capitalize bg-accent text-accent-foreground">
                  {item.itemGroup}
                </Badge>
              </TableCell>
              <TableCell className="font-body">{item.paperGsm || '-'}</TableCell>
              <TableCell className="font-body text-right">{item.availableStock?.toLocaleString() ?? 0}</TableCell>
              <TableCell className="font-body text-right">{item.unit}</TableCell>
              <TableCell className="font-body text-right">{item.reorderPoint ? item.reorderPoint.toLocaleString() : '-'}</TableCell>
              <TableCell className="text-center">
                <Button variant="ghost" size="icon" onClick={() => handleViewAdjustments(item)} title="View Stock History">
                  <History className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [isLoading, searchQuery, categoryDisplayName]);


  return (
    <div className="space-y-6">
      <Button variant="outline" asChild className="mb-4 font-body">
        <Link href="/inventory">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Categories
        </Link>
      </Button>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-headline flex items-center">
              <Archive className="mr-2 h-6 w-6 text-primary" /> {categoryDisplayName} Inventory
            </CardTitle>
            <CardDescription className="font-body">
              View and manage your stock of {categoryDisplayName.toLowerCase()}. Click item name for stock history.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Search ${categoryDisplayName.toLowerCase()}...`}
                className="pl-10 w-full sm:w-64 font-body" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setIsAddItemDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabs removed as primary filtering is by URL category */}
          {renderInventoryTable(filteredItems)}
        </CardContent>
      </Card>
      <AddItemDialog 
        isOpen={isAddItemDialogOpen} 
        setIsOpen={setIsAddItemDialogOpen} 
        onItemAdded={fetchInventory} 
      />
      <InventoryAdjustmentsDialog
        isOpen={isAdjustmentsDialogOpen}
        setIsOpen={setIsAdjustmentsDialogOpen}
        item={selectedItemForAdjustments}
      />
    </div>
  );
}
