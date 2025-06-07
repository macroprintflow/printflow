
"use client";

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, Printer, Paintbrush, Box, Package, MagnetIcon, ShoppingCart, PlusCircle } from "lucide-react";
import { useState } from "react";
// EnterPurchaseDialog is removed
import { AddItemDialog } from '@/components/inventory/AddItemDialog'; 

const mainCategories = [
  { name: "Paper", slug: "paper", icon: Printer, description: "Master sheets and paper stock." },
  { name: "Inks", slug: "inks", icon: Paintbrush, description: "All types of printing inks." },
  { name: "Plastic Trays", slug: "plastic-trays", icon: Package, description: "Trays for packaging." },
  { name: "Glass Jars", slug: "glass-jars", icon: Box, description: "Glass jars and containers." },
  { name: "Magnets", slug: "magnets", icon: MagnetIcon, description: "Magnets for boxes and crafts." },
  { name: "Other Materials", slug: "other-materials", icon: Archive, description: "Miscellaneous stock items." },
];

export default function InventoryCategorySelectionPage() {
  // isEnterPurchaseDialogOpen state is removed
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false); 

  const handleInventoryUpdate = () => {
    console.log("Inventory updated, refresh would happen here.");
    // e.g., router.refresh() or re-fetch data
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle className="font-headline flex items-center">
                    <Archive className="mr-2 h-6 w-6 text-primary" /> Inventory Management
                </CardTitle>
                <CardDescription className="font-body">
                    Select a category to view stock or enter a new purchase bill.
                </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button onClick={() => setIsAddItemDialogOpen(true)} variant="outline" className="w-full sm:w-auto font-body">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Single Item
                </Button>
                <Button asChild className="w-full sm:w-auto font-body">
                  <Link href="/inventory/new-purchase">
                    <ShoppingCart className="mr-2 h-4 w-4" /> Enter Purchase Bill
                  </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
          {mainCategories.map((category) => (
            <Card key={category.slug} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium font-headline flex items-center">
                  <category.icon className="mr-3 h-5 w-5 text-muted-foreground" />
                  {category.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-body mb-4">{category.description}</p>
                <Button asChild className="w-full font-body">
                  <Link href={`/inventory/${category.slug}`}>View {category.name}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
      {/* EnterPurchaseDialog component is removed */}
      <AddItemDialog
        isOpen={isAddItemDialogOpen}
        setIsOpen={setIsAddItemDialogOpen}
        onItemAdded={handleInventoryUpdate}
      />
    </div>
  );
}
