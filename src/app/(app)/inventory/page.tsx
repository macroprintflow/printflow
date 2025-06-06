
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, PlusCircle, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventoryItems } from "@/lib/actions/jobActions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default async function InventoryPage() {
  const inventoryItems = await getInventoryItems();

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
          {inventoryItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-headline">Item Name</TableHead>
                  <TableHead className="font-headline">Type</TableHead>
                  <TableHead className="font-headline">Specification</TableHead>
                  <TableHead className="font-headline text-right">Available Stock</TableHead>
                  <TableHead className="font-headline text-right">Unit</TableHead>
                  <TableHead className="font-headline text-right">Reorder Point</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems.map((item) => (
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
                    <TableCell className="font-body text-sm text-muted-foreground">{item.specification}</TableCell>
                    <TableCell className="font-body text-right">{item.availableStock.toLocaleString()}</TableCell>
                    <TableCell className="font-body text-right">{item.unit}</TableCell>
                    <TableCell className="font-body text-right">{item.reorderPoint ? item.reorderPoint.toLocaleString() : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold font-headline">Inventory is Empty</h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                Start by adding your first inventory item.
              </p>
              <Button disabled className="mt-6"> {/* Placeholder for future add item */}
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
