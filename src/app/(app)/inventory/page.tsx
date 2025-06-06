
"use client"; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, PlusCircle, Search, History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInventoryItems } from "@/lib/actions/jobActions";
import { getPaperQualityLabel } from "@/lib/definitions";
import type { InventoryItem, ItemGroupType, PaperQualityType } from "@/lib/definitions";
import { ITEM_GROUP_TYPES } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { InventoryAdjustmentsDialog } from "@/components/inventory/InventoryAdjustmentsDialog";

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ItemGroupType>(ITEM_GROUP_TYPES[0]); 
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

  const filteredItems = useMemo(() => {
    let itemsToFilter = inventoryItems;

    if (activeTab !== "All") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === activeTab);
    }

    if (searchQuery.trim() !== "") {
      const lowerCaseQuery = searchQuery.toLowerCase();
      itemsToFilter = itemsToFilter.filter(item => {
        return (
          item.name.toLowerCase().includes(lowerCaseQuery) ||
          item.type.toLowerCase().includes(lowerCaseQuery) ||
          (item.itemGroup && item.itemGroup.toLowerCase().includes(lowerCaseQuery)) ||
          (item.specification && item.specification.toLowerCase().includes(lowerCaseQuery)) ||
          (item.paperGsm && item.paperGsm.toString().includes(lowerCaseQuery)) ||
          (item.paperQuality && getPaperQualityLabel(item.paperQuality as PaperQualityType).toLowerCase().includes(lowerCaseQuery)) ||
          (item.id && item.id.toLowerCase().includes(lowerCaseQuery))
        );
      });
    }
    return itemsToFilter;
  }, [activeTab, inventoryItems, searchQuery]);

  const handleViewAdjustments = (item: InventoryItem) => {
    setSelectedItemForAdjustments(item);
    setIsAdjustmentsDialogOpen(true);
  };

  const renderInventoryTable = useCallback((items: InventoryItem[]) => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <Archive className="mx-auto h-12 w-12 text-muted-foreground animate-pulse" />
          <p className="mt-4 text-lg text-muted-foreground font-body">Loading inventory...</p>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold font-headline">
            {searchQuery.trim() !== "" ? "No Items Match Your Search" : "No Items in this Group"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            {searchQuery.trim() !== "" 
              ? "Try adjusting your search terms or clearing the search."
              : "There are no inventory items matching the selected group, or the inventory is empty."
            }
          </p>
           <Button className="mt-6" onClick={() => setIsAddItemDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Button>
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-headline">Item Name</TableHead>
            <TableHead className="font-headline">Type</TableHead>
            <TableHead className="font-headline">Item Group</TableHead>
            <TableHead className="font-headline">Specification</TableHead>
            <TableHead className="font-headline">Paper GSM</TableHead>
            <TableHead className="font-headline">Paper Quality</TableHead>
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
              <TableCell className="font-body text-sm text-muted-foreground">{item.specification}</TableCell>
              <TableCell className="font-body">{item.paperGsm || '-'}</TableCell>
              <TableCell className="font-body">{item.paperQuality ? getPaperQualityLabel(item.paperQuality as PaperQualityType) : '-'}</TableCell>
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
  }, [isLoading, searchQuery]); // Removed inventoryItems from dependency array as filteredItems covers it.


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-headline flex items-center">
              <Archive className="mr-2 h-6 w-6 text-primary" /> Inventory Management
            </CardTitle>
            <CardDescription className="font-body">
              View and manage your stock of paper, master sheets, and other materials. Click item name for stock history.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search inventory..." 
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
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ItemGroupType)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 mb-4">
              {ITEM_GROUP_TYPES.map(group => (
                <TabsTrigger key={group} value={group} className="font-body text-xs sm:text-sm">
                  {group}
                </TabsTrigger>
              ))}
            </TabsList>
            {ITEM_GROUP_TYPES.map(group => (
              <TabsContent key={group} value={group}>
                {renderInventoryTable(group === activeTab ? filteredItems : [])}
              </TabsContent>
            ))}
          </Tabs>
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
