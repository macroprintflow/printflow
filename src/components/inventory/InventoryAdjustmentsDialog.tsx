
"use client";

import React, { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem, InventoryAdjustment } from "@/lib/definitions";
import { getInventoryAdjustmentReasonLabel, INVENTORY_ADJUSTMENT_REASONS } from "@/lib/definitions";
import { getInventoryAdjustmentsForItem } from "@/lib/actions/jobActions";
import { format } from "date-fns";
import { ArrowUpCircle, ArrowDownCircle, Loader2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InventoryAdjustmentsDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  item: InventoryItem | null;
}

export function InventoryAdjustmentsDialog({ isOpen, setIsOpen, item }: InventoryAdjustmentsDialogProps) {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && item) {
      const fetchAdjustments = async () => {
        setIsLoading(true);
        try {
          const fetchedAdjustments = await getInventoryAdjustmentsForItem(item.id);
          setAdjustments(fetchedAdjustments);
        } catch (error) {
          console.error("Failed to fetch inventory adjustments:", error);
          toast({
            title: "Error",
            description: "Could not load stock adjustment history.",
            variant: "destructive",
          });
          setAdjustments([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchAdjustments();
    } else {
      setAdjustments([]); // Clear adjustments when dialog is closed or no item
    }
  }, [isOpen, item, toast]);

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setAdjustments([]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-3xl font-body">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center">
            <History className="mr-2 h-6 w-6 text-primary" />
            Stock Adjustment History for: {item?.name || "Item"}
          </DialogTitle>
          <DialogDescription>
            View the history of stock changes for this inventory item.
            Current Stock: {item?.availableStock.toLocaleString() || 'N/A'} {item?.unit || ''}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading history...</p>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="text-center py-8">
              <History className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">No adjustment history found for this item.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-headline">Date</TableHead>
                    <TableHead className="font-headline text-center">Type</TableHead>
                    <TableHead className="font-headline text-right">Quantity</TableHead>
                    <TableHead className="font-headline">Reason</TableHead>
                    <TableHead className="font-headline">Reference</TableHead>
                    <TableHead className="font-headline">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell className="font-body text-xs">
                        {format(new Date(adj.date), "dd MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell className="font-body text-center">
                        {adj.quantityChange >= 0 ? (
                          <ArrowUpCircle className="h-5 w-5 text-green-500 inline-block" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5 text-red-500 inline-block" />
                        )}
                      </TableCell>
                      <TableCell className={`font-body text-right font-medium ${adj.quantityChange >=0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(adj.quantityChange).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-body">
                        <Badge variant="outline">
                          {getInventoryAdjustmentReasonLabel(adj.reason)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-body text-xs truncate max-w-[100px]">{adj.reference || "-"}</TableCell>
                      <TableCell className="font-body text-xs truncate max-w-[150px]">{adj.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => handleDialogClose(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
