
"use client";

import React, { useState, useEffect, type Dispatch, type SetStateAction, Fragment } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn, Controller, type Control, useFormContext } from "react-hook-form";
import type { InventoryItemFormValues, InventoryCategory, PaperQualityType, UnitValue } from "@/lib/definitions";
import { InventoryItemFormSchema, INVENTORY_CATEGORIES, PAPER_QUALITY_OPTIONS, VENDOR_OPTIONS, UNIT_OPTIONS, getPaperQualityLabel, getPaperQualityUnit, KAPPA_MDF_QUALITIES } from "@/lib/definitions";
import { addInventoryItem } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusCircle, Trash2, ArrowRight, Loader2, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Re-purposed field components from AddItemDialog (or similar structure)
// These will be used for the "current item being added" part of the purchase dialog

const CurrentItemPaperFields = ({ form, onFormChange }: { form: UseFormReturn<Partial<InventoryItemFormValues>>, onFormChange: () => void }) => {
  const watchedPaperQuality = form.watch("paperQuality");
  const paperUnit = getPaperQualityUnit(watchedPaperQuality as PaperQualityType);

  useEffect(() => {
    onFormChange();
  }, [form.watch(), onFormChange]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="paperMasterSheetSizeWidth" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper Width (in)</FormLabel>
            <FormControl><Input type="number" placeholder="e.g., 27.56" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="paperMasterSheetSizeHeight" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper Height (in)</FormLabel>
            <FormControl><Input type="number" placeholder="e.g., 39.37" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="paperQuality" render={({ field }) => (
        <FormItem>
          <FormLabel>Paper Quality</FormLabel>
          <Select onValueChange={(value) => {
            field.onChange(value);
            form.setValue("paperGsm", undefined);
            form.setValue("paperThicknessMm", undefined);
          }} value={field.value || ""}>
            <FormControl><SelectTrigger className="font-body"><SelectValue placeholder="Select paper quality" /></SelectTrigger></FormControl>
            <SelectContent>{PAPER_QUALITY_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      {paperUnit === 'gsm' && (
        <FormField control={form.control} name="paperGsm" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper GSM</FormLabel>
            <FormControl><Input type="number" placeholder="e.g., 300" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}
      {paperUnit === 'mm' && (
         <FormField control={form.control} name="paperThicknessMm" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper Thickness (mm)</FormLabel>
            <FormControl><Input type="number" step="0.1" placeholder="e.g., 1.2" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}
    </>
  );
};

const CurrentItemInkFields = ({ control, onFormChange }: { control: Control<Partial<InventoryItemFormValues>>, onFormChange: () => void }) => {
  const { watch } = useFormContext<Partial<InventoryItemFormValues>>();
   useEffect(() => {
    const subscription = watch(() => onFormChange());
    return () => subscription.unsubscribe();
  }, [watch, onFormChange]);

  return (
  <>
     <FormField control={control} name="inkName" render={({ field }) => (
         <FormItem>
             <FormLabel>Ink Name/Type</FormLabel>
             <FormControl><Input placeholder="e.g., Process Black, Pantone 185C" {...field} value={field.value ?? ''} className="font-body"/></FormControl>
             <FormMessage />
         </FormItem>
     )} />
     <FormField control={control} name="inkSpecification" render={({ field }) => (
         <FormItem>
             <FormLabel>Ink Specification/Color</FormLabel>
             <FormControl><Input placeholder="e.g., Oil-based, Red" {...field} value={field.value ?? ''}  className="font-body"/></FormControl>
             <FormMessage />
         </FormItem>
     )} />
  </>
)};

const CurrentItemOtherCategoryFields = ({ control, categoryLabel, onFormChange }: { control: Control<Partial<InventoryItemFormValues>>; categoryLabel: string; onFormChange: () => void }) => {
  const { watch } = useFormContext<Partial<InventoryItemFormValues>>();
   useEffect(() => {
    const subscription = watch(() => onFormChange());
    return () => subscription.unsubscribe();
  }, [watch, onFormChange]);
  
  return (
  <>
    <FormField control={control} name="itemName" render={({ field }) => (
      <FormItem>
        <FormLabel>Item Name</FormLabel>
        <FormControl><Input placeholder={`e.g., ${categoryLabel} Model X`} {...field} value={field.value ?? ''} className="font-body"/></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <FormField control={control} name="itemSpecification" render={({ field }) => (
      <FormItem>
        <FormLabel>Specification</FormLabel>
        <FormControl><Input placeholder="e.g., Size, Material, Color" {...field} value={field.value ?? ''} className="font-body"/></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  </>
)};

const CurrentItemCommonFields = ({ form, onFormChange }: { form: UseFormReturn<Partial<InventoryItemFormValues>>, onFormChange: () => void }) => {
   useEffect(() => {
    const subscription = form.watch(() => onFormChange());
    return () => subscription.unsubscribe();
  }, [form.watch, onFormChange]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity for this Item</FormLabel> 
              <FormControl> <Input type="number" placeholder="e.g., 1000" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} className="font-body"/> </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        <FormField control={form.control} name="unit" render={({ field }) => (
          <FormItem>
            <FormLabel>Unit</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || "sheets"}>
              <FormControl><SelectTrigger className="font-body"><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
              <SelectContent>{UNIT_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="reorderPoint" render={({ field }) => (
        <FormItem>
          <FormLabel>Reorder Point (Optional)</FormLabel>
          <FormControl><Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );
};


// Type for items in the purchase list (omitting purchase-level details)
type PurchaseListItem = Omit<InventoryItemFormValues, 'purchaseBillNo' | 'dateOfEntry' | 'vendorName' | 'otherVendorName'> & { displayId: number; displayName: string; };


export function EnterPurchaseDialog({ isOpen, setIsOpen, onItemAdded }: { isOpen: boolean; setIsOpen: Dispatch<SetStateAction<boolean>>; onItemAdded?: () => void; }) {
  const [purchaseBillNo, setPurchaseBillNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
  const [purchaseVendor, setPurchaseVendor] = useState<string | undefined>(undefined);
  const [otherPurchaseVendor, setOtherPurchaseVendor] = useState("");

  const [itemsInPurchaseList, setItemsInPurchaseList] = useState<PurchaseListItem[]>([]);
  const [currentItemCategory, setCurrentItemCategory] = useState<InventoryCategory | null>(null);
  const [nextDisplayId, setNextDisplayId] = useState(1);

  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const { toast } = useToast();
  
  const currentItemForm = useForm<Partial<InventoryItemFormValues>>({
    resolver: zodResolver(InventoryItemFormSchema.sourceSchema.partial()), // Use partial schema for current item
    defaultValues: {
      category: undefined,
      quantity: 0,
      unit: "sheets" as UnitValue,
    },
  });

  const [derivedCurrentItemName, setDerivedCurrentItemName] = useState("");

  const deriveItemName = (values: Partial<InventoryItemFormValues>): string => {
    if (!values.category) return "Item (select category)";
    
    const categoryLabel = INVENTORY_CATEGORIES.find(c => c.value === values.category)?.label || "Item";
    
    if (values.category === 'PAPER') {
        const quality = values.paperQuality as PaperQualityType;
        const qualityLabel = getPaperQualityLabel(quality);
        const unit = getPaperQualityUnit(quality);
        const width = values.paperMasterSheetSizeWidth || 0;
        const height = values.paperMasterSheetSizeHeight || 0;
        if (unit === 'mm') {
            return `${qualityLabel} ${values.paperThicknessMm || '?'}mm (${width.toFixed(1)}x${height.toFixed(1)}in)`;
        }
        return `${qualityLabel} ${values.paperGsm || '?'}GSM (${width.toFixed(1)}x${height.toFixed(1)}in)`;
    } else if (values.category === 'INKS') {
        return values.inkName || `Ink (define name)`;
    } else {
        return values.itemName || `${categoryLabel} (define name)`;
    }
  };

  const handleCurrentItemFormChange = () => {
    setDerivedCurrentItemName(deriveItemName(currentItemForm.getValues()));
  };

  const handleAddItemToPurchaseList = () => {
    currentItemForm.trigger().then(isValid => {
      if (!isValid) {
        toast({ title: "Current Item Incomplete", description: "Please fill all required fields for the current item.", variant: "destructive" });
        return;
      }
      if (!currentItemCategory) {
         toast({ title: "Category Missing", description: "Please select a category for the current item.", variant: "destructive" });
        return;
      }

      const currentItemValues = currentItemForm.getValues();
      const newItemForList: PurchaseListItem = {
        displayId: nextDisplayId,
        displayName: deriveItemName(currentItemValues), // Use derived name
        category: currentItemCategory,
        paperMasterSheetSizeWidth: currentItemValues.paperMasterSheetSizeWidth,
        paperMasterSheetSizeHeight: currentItemValues.paperMasterSheetSizeHeight,
        paperQuality: currentItemValues.paperQuality,
        paperGsm: currentItemValues.paperGsm,
        paperThicknessMm: currentItemValues.paperThicknessMm,
        inkName: currentItemValues.inkName,
        inkSpecification: currentItemValues.inkSpecification,
        itemName: currentItemValues.itemName || deriveItemName(currentItemValues), // Ensure itemName is set
        itemSpecification: currentItemValues.itemSpecification,
        quantity: currentItemValues.quantity || 0,
        unit: currentItemValues.unit || 'units',
        reorderPoint: currentItemValues.reorderPoint,
      };
      setItemsInPurchaseList(prev => [...prev, newItemForList]);
      setNextDisplayId(prev => prev + 1);
      
      // Reset current item form for next entry
      currentItemForm.reset({
        category: undefined, // Keep category or reset? For now, reset.
        quantity: 0,
        unit: "sheets" as UnitValue,
      });
      setCurrentItemCategory(null);
      setDerivedCurrentItemName("");
    });
  };

  const handleRemoveItemFromList = (displayId: number) => {
    setItemsInPurchaseList(prev => prev.filter(item => item.displayId !== displayId));
  };

  const resetDialog = () => {
    setPurchaseBillNo("");
    setPurchaseDate(new Date());
    setPurchaseVendor(undefined);
    setOtherPurchaseVendor("");
    setItemsInPurchaseList([]);
    currentItemForm.reset({ category: undefined, quantity: 0, unit: "sheets" as UnitValue });
    setCurrentItemCategory(null);
    setDerivedCurrentItemName("");
    setIsSubmittingPurchase(false);
    setNextDisplayId(1);
  };

  const handleSavePurchase = async () => {
    if (!purchaseBillNo.trim()) {
      toast({ title: "Missing Purchase Bill No.", description: "Please enter the purchase bill number.", variant: "destructive" });
      return;
    }
    if (!purchaseDate) {
      toast({ title: "Missing Purchase Date", description: "Please select the purchase date.", variant: "destructive" });
      return;
    }
    if (itemsInPurchaseList.length === 0) {
      toast({ title: "No Items Added", description: "Please add at least one item to the purchase list.", variant: "destructive" });
      return;
    }

    setIsSubmittingPurchase(true);
    let allItemsSaved = true;
    let errorMessages = [];

    for (const item of itemsInPurchaseList) {
      const itemDataForAction: InventoryItemFormValues = {
        ...item,
        purchaseBillNo: purchaseBillNo,
        dateOfEntry: purchaseDate.toISOString(),
        vendorName: purchaseVendor,
        otherVendorName: purchaseVendor === 'OTHER' ? otherPurchaseVendor : "",
        itemName: item.itemName || item.displayName, // Ensure itemName is passed
      };
      
      const result = await addInventoryItem(itemDataForAction);
      if (!result.success) {
        allItemsSaved = false;
        errorMessages.push(`Failed for item "${item.displayName}": ${result.message}`);
      }
    }
    setIsSubmittingPurchase(false);

    if (allItemsSaved) {
      toast({ title: "Purchase Saved!", description: `Successfully added ${itemsInPurchaseList.length} item(s) from bill ${purchaseBillNo}.` });
      resetDialog();
      if (onItemAdded) onItemAdded();
      setIsOpen(false);
    } else {
      toast({
        title: "Error Saving Purchase",
        description: (
          <div>
            <p>Some items could not be saved:</p>
            <ul className="list-disc list-inside mt-2">
              {errorMessages.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        ),
        variant: "destructive",
        duration: 10000,
      });
    }
  };
  
  const handleDialogClose = (open: boolean) => {
    if (!open) resetDialog();
    setIsOpen(open);
  };

  const currentCategoryLabel = currentItemCategory ? INVENTORY_CATEGORIES.find(c => c.value === currentItemCategory)?.label || "Item" : "Item";

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col font-body">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center"><ShoppingCart className="mr-2 h-6 w-6 text-primary"/>Enter New Purchase</DialogTitle>
          <DialogDescription>Add multiple inventory items received under a single purchase bill.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-6 -mr-6"> {/* Added pr-6 and -mr-6 for scrollbar spacing */}
          <div className="space-y-6 py-4">
            {/* Purchase Level Details */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <h3 className="font-semibold font-headline text-lg">Purchase Bill Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormItem>
                  <FormLabel>Purchase Bill No.</FormLabel>
                  <FormControl><Input placeholder="e.g., INV-2024-123" value={purchaseBillNo} onChange={(e) => setPurchaseBillNo(e.target.value)} className="font-body"/></FormControl>
                </FormItem>
                <FormItem className="flex flex-col">
                  <FormLabel>Purchase Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal font-body", !purchaseDate && "text-muted-foreground")}>
                          {purchaseDate ? format(purchaseDate, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={purchaseDate} onSelect={setPurchaseDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </FormItem>
                 <FormItem>
                  <FormLabel>Vendor Name (Optional)</FormLabel>
                  <Select onValueChange={setPurchaseVendor} value={purchaseVendor || ""}>
                    <FormControl><SelectTrigger className="font-body"><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                    <SelectContent>{VENDOR_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
                  </Select>
                </FormItem>
              </div>
              {purchaseVendor === 'OTHER' && (
                <FormItem>
                  <FormLabel>Specify Vendor Name</FormLabel>
                  <FormControl><Input placeholder="Enter vendor name" value={otherPurchaseVendor} onChange={(e) => setOtherPurchaseVendor(e.target.value)} className="font-body"/></FormControl>
                </FormItem>
              )}
            </div>

            {/* Current Item Entry Form */}
            <div className="p-4 border rounded-lg space-y-4">
               <h3 className="font-semibold font-headline text-lg">Add Item to Purchase</h3>
              <Form {...currentItemForm}>
                <form className="space-y-4">
                   <FormField control={currentItemForm.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Category</FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); setCurrentItemCategory(value as InventoryCategory); }} value={field.value || ""}>
                        <FormControl><SelectTrigger className="font-body"><SelectValue placeholder="Select item category" /></SelectTrigger></FormControl>
                        <SelectContent>{INVENTORY_CATEGORIES.map(cat => (<SelectItem key={cat.value} value={cat.value} className="font-body">{cat.label}</SelectItem>))}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {currentItemCategory === 'PAPER' && <CurrentItemPaperFields form={currentItemForm} onFormChange={handleCurrentItemFormChange} />}
                  {currentItemCategory === 'INKS' && <CurrentItemInkFields control={currentItemForm.control} onFormChange={handleCurrentItemFormChange} />}
                  {(currentItemCategory && currentItemCategory !== 'PAPER' && currentItemCategory !== 'INKS') && (
                    <CurrentItemOtherCategoryFields control={currentItemForm.control} categoryLabel={currentCategoryLabel} onFormChange={handleCurrentItemFormChange} />
                  )}
                  
                  {currentItemCategory && <CurrentItemCommonFields form={currentItemForm} onFormChange={handleCurrentItemFormChange} />}
                  
                  {currentItemCategory && (
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-sm text-muted-foreground">Derived Item: {derivedCurrentItemName || "Configure above"}</p>
                      <Button type="button" onClick={handleAddItemToPurchaseList} variant="secondary">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Item to List
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </div>

            {/* Items in Purchase List */}
            {itemsInPurchaseList.length > 0 && (
              <div className="p-4 border rounded-lg space-y-2">
                <h3 className="font-semibold font-headline text-lg">Items in this Purchase</h3>
                <ScrollArea className="h-[200px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-body">Item Name</TableHead>
                        <TableHead className="font-body text-right">Qty</TableHead>
                        <TableHead className="font-body">Unit</TableHead>
                        <TableHead className="font-body text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsInPurchaseList.map((item) => (
                        <TableRow key={item.displayId}>
                          <TableCell className="font-body">{item.displayName}</TableCell>
                          <TableCell className="font-body text-right">{item.quantity.toLocaleString()}</TableCell>
                          <TableCell className="font-body">{item.unit}</TableCell>
                          <TableCell className="font-body text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItemFromList(item.displayId)} title="Remove Item">
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
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} disabled={isSubmittingPurchase} className="font-body">Cancel</Button>
          <Button type="button" onClick={handleSavePurchase} disabled={isSubmittingPurchase || itemsInPurchaseList.length === 0} className="font-body">
            {isSubmittingPurchase ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
            Save Entire Purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

