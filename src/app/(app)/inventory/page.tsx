
"use client"; // This page now uses client-side state for tabs

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, PlusCircle, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInventoryItems } from "@/lib/actions/jobActions";
import type { InventoryItem, ItemGroupType } from "@/lib/definitions";
import { ITEM_GROUP_TYPES } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ItemGroupType>(ITEM_GROUP_TYPES[0]); // Default to "All"

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const items = await getInventoryItems();
      setInventoryItems(items);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    if (activeTab === "All") {
      return inventoryItems;
    }
    return inventoryItems.filter(item => item.itemGroup === activeTab);
  }, [activeTab, inventoryItems]);

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
          <h3 className="mt-4 text-xl font-semibold font-headline">No Items in this Group</h3>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            There are no inventory items matching the selected group, or the inventory is empty.
          </p>
           <Button disabled className="mt-6"> {/* Placeholder for future add item */}
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
            <TableHead className="font-headline text-right">Available Stock</TableHead>
            <TableHead className="font-headline text-right">Unit</TableHead>
            <TableHead className="font-headline text-right">Reorder Point</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium font-body">{item.name}</TableCell>
              <TableCell>
                <Badge variant={
                  item.type === 'Master Sheet' ? 'secondary' :
                  item.type === 'Paper Stock' ? 'outline' : 'default'
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
              <TableCell className="font-body text-right">{item.availableStock.toLocaleString()}</TableCell>
              <TableCell className="font-body text-right">{item.unit}</TableCell>
              <TableCell className="font-body text-right">{item.reorderPoint ? item.reorderPoint.toLocaleString() : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [isLoading]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-headline flex items-center">
              <Archive className="mr-2 h-6 w-6 text-primary" /> Inventory Management
            </CardTitle>
            <CardDescription className="font-body">
              View and manage your stock of paper, master sheets, and other materials.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search inventory..." className="pl-10 w-full sm:w-64 font-body" disabled />
            </div>
            <Button disabled className="w-full sm:w-auto"> {/* Placeholder for future add item */}
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ItemGroupType)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 mb-4">
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
    </div>
  );
}

