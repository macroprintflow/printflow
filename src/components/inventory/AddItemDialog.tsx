
"use client";

import React, { useState, type Dispatch, type SetStateAction, Fragment } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn, type Control } from "react-hook-form";
import type { InventoryItemFormValues, InventoryCategory, PaperQualityType, UnitValue } from "@/lib/definitions";
import { InventoryItemFormSchema, INVENTORY_CATEGORIES, PAPER_QUALITY_OPTIONS, VENDOR_OPTIONS, UNIT_OPTIONS, getPaperQualityLabel } from "@/lib/definitions";
import { addInventoryItem } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusCircle, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface AddItemDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onItemAdded?: () => void;
}

// Helper components defined at the top level of the module
const PaperFields = ({ control }: { control: Control<InventoryItemFormValues> }) => (
  <>
    <FormField control={control} name="itemName" render={({ field }) => (<FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl><FormMessage /></FormItem>)} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField control={control} name="paperMasterSheetSizeWidth" render={({ field }) => (
        <FormItem>
          <FormLabel>Paper Width (in)</FormLabel>
          <FormControl><Input type="number" placeholder="e.g., 27.56" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="paperMasterSheetSizeHeight" render={({ field }) => (
        <FormItem>
          <FormLabel>Paper Height (in)</FormLabel>
          <FormControl><Input type="number" placeholder="e.g., 39.37" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
    <FormField control={control} name="paperQuality" render={({ field }) => (
      <FormItem>
        <FormLabel>Paper Quality</FormLabel>
        <Select onValueChange={field.onChange} value={field.value || ""}>
          <FormControl><SelectTrigger className="font-body"><SelectValue placeholder="Select paper quality" /></SelectTrigger></FormControl>
          <SelectContent>{PAPER_QUALITY_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
    <FormField control={control} name="paperGsm" render={({ field }) => (
      <FormItem>
        <FormLabel>Paper GSM</FormLabel>
        <FormControl><Input type="number" placeholder="e.g., 300" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body"/></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  </>
);

const InkFields = ({ control }: { control: Control<InventoryItemFormValues> }) => (
  <>
     <FormField control={control} name="itemName" render={({ field }) => (<FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl><FormMessage /></FormItem>)} />
     <FormField control={control} name="inkName" render={({ field }) => (
         <FormItem>
             <FormLabel>Ink Name/Type</FormLabel>
             <FormControl><Input placeholder="e.g., Process Black, Pantone 185C" {...field} className="font-body"/></FormControl>
             <FormMessage />
         </FormItem>
     )} />
     <FormField control={control} name="inkSpecification" render={({ field }) => (
         <FormItem>
             <FormLabel>Ink Specification/Color</FormLabel>
             <FormControl><Input placeholder="e.g., Oil-based, Red" {...field} className="font-body"/></FormControl>
             <FormMessage />
         </FormItem>
     )} />
  </>
);

const OtherCategoryFields = ({ control, categoryLabel }: { control: Control<InventoryItemFormValues>; categoryLabel: string }) => (
  <>
    <FormField control={control} name="itemName" render={({ field }) => (
      <FormItem>
        <FormLabel>Item Name</FormLabel>
        <FormControl><Input placeholder={`e.g., ${categoryLabel} Model X`} {...field} className="font-body"/></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <FormField control={control} name="itemSpecification" render={({ field }) => (
      <FormItem>
        <FormLabel>Specification</FormLabel>
        <FormControl><Input placeholder="e.g., Size, Material, Color" {...field} className="font-body"/></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  </>
);

const CommonFields = ({ form }: { form: UseFormReturn<InventoryItemFormValues> }) => {
  const watchedVendor = form.watch("vendorName");
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="availableStock"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g., 1000"
                  {...field}
                  value={field.value ?? 0}
                  onChange={e => {
                    const value = e.target.value;
                    field.onChange(value === '' ? 0 : parseFloat(value));
                  }}
                  className="font-body"
                />
              </FormControl>
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

      <FormField control={form.control} name="purchaseBillNo" render={({ field }) => (
        <FormItem>
          <FormLabel>Purchase Bill No. (Optional)</FormLabel>
          <FormControl><Input placeholder="e.g., INV-2024-001" {...field} className="font-body"/></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="vendorName" render={({ field }) => (
        <FormItem>
          <FormLabel>Vendor Name (Optional)</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || ""}>
            <FormControl><SelectTrigger className="font-body"><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
            <SelectContent>{VENDOR_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />

      {watchedVendor === 'OTHER' && (
        <FormField control={form.control} name="otherVendorName" render={({ field }) => (
          <FormItem>
            <FormLabel>Specify Vendor Name</FormLabel>
            <FormControl><Input placeholder="Enter vendor name" {...field} className="font-body"/></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}

      <FormField control={form.control} name="dateOfEntry" render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Date of Entry</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal font-body", !field.value && "text-muted-foreground")}>
                  {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(date) => field.onChange(date?.toISOString())} initialFocus />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );
};

export function AddItemDialog({ isOpen, setIsOpen, onItemAdded }: AddItemDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const formDefaultValues: InventoryItemFormValues = {
    category: undefined,
    paperMasterSheetSizeWidth: undefined,
    paperMasterSheetSizeHeight: undefined,
    paperQuality: "",
    paperGsm: undefined,
    inkName: "",
    inkSpecification: "",
    itemName: "",
    itemSpecification: "",
    availableStock: 0,
    unit: "sheets" as UnitValue, // Default unit
    purchaseBillNo: "",
    vendorName: undefined,
    otherVendorName: "",
    dateOfEntry: new Date().toISOString(),
    reorderPoint: undefined,
  };

  const form: UseFormReturn<InventoryItemFormValues> = useForm<InventoryItemFormValues>({
    resolver: zodResolver(InventoryItemFormSchema),
    defaultValues: formDefaultValues,
  });

  const handleCategorySelect = (category: InventoryCategory) => {
    form.reset(formDefaultValues);
    setSelectedCategory(category);
    form.setValue("category", category);

    if (category === 'PAPER') {
      form.setValue("itemName", "Paper Stock"); // Default name, will be refined later
      form.setValue("unit", "sheets" as UnitValue); // Default unit for paper
    } else if (category === 'INKS') {
      form.setValue("itemName", "Ink");
      form.setValue("unit", "kg" as UnitValue);
    } else if (category === 'PLASTIC_TRAY') {
      form.setValue("itemName", "Plastic Tray");
      form.setValue("unit", "pieces" as UnitValue);
    } else if (category === 'GLASS_JAR') {
      form.setValue("itemName", "Glass Jar");
      form.setValue("unit", "pieces" as UnitValue);
    } else if (category === 'MAGNET') {
      form.setValue("itemName", "Magnet");
      form.setValue("unit", "pieces" as UnitValue);
    } else { // OTHER
      form.setValue("itemName", "");
      form.setValue("unit", "units" as UnitValue);
    }

    setStep(2);
  };

  const resetDialogState = () => {
    form.reset(formDefaultValues);
    setSelectedCategory(null);
    setStep(1);
    setIsSubmitting(false);
  };

  async function onSubmit(values: InventoryItemFormValues) {
    if (!selectedCategory) return;

    setIsSubmitting(true);
    const result = await addInventoryItem({...values, category: selectedCategory});
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Success!",
        description: "Inventory item added successfully.",
      });
      resetDialogState();
      if (onItemAdded) {
        onItemAdded();
      }
      setIsOpen(false);
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to add inventory item.",
        variant: "destructive",
      });
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
       resetDialogState();
    }
    setIsOpen(open);
  };

  const renderStep1 = () => (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline">Add New Inventory Item - Step 1</DialogTitle>
        <DialogDescription className="font-body">Select the category of the item you want to add.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
        {INVENTORY_CATEGORIES.map(cat => (
          <Button key={cat.value} variant="outline" className="font-body justify-between h-12" onClick={() => handleCategorySelect(cat.value)}>
            {cat.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} className="font-body">Cancel</Button>
      </DialogFooter>
    </>
  );

  const renderStep2 = () => {
    if (!selectedCategory) return null;
    const categoryLabel = INVENTORY_CATEGORIES.find(c => c.value === selectedCategory)?.label || "Item";

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="font-headline">Add New {categoryLabel} - Step 2</DialogTitle>
            <DialogDescription className="font-body">Enter the details for the new {categoryLabel.toLowerCase()}.</DialogDescription>
          </DialogHeader>

          {selectedCategory === 'PAPER' && <PaperFields control={form.control} />}
          {selectedCategory === 'INKS' && <InkFields control={form.control} />}
          {(selectedCategory && selectedCategory !== 'PAPER' && selectedCategory !== 'INKS') && (
            <OtherCategoryFields control={form.control} categoryLabel={categoryLabel} />
          )}

          <CommonFields form={form} />

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isSubmitting} className="font-body">Back</Button>
            <Button type="submit" disabled={isSubmitting} className="font-body">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </Form>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto font-body">
        {step === 1 ? renderStep1() : renderStep2()}
      </DialogContent>
    </Dialog>
  );
}
