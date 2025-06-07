
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn, type Control } from "react-hook-form";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import type { InventoryItemFormValues, InventoryCategory, PaperQualityType, UnitValue } from "@/lib/definitions";
import { InventoryItemFormSchema, INVENTORY_CATEGORIES, PAPER_QUALITY_OPTIONS, VENDOR_OPTIONS, UNIT_OPTIONS, getPaperQualityLabel, getPaperQualityUnit, KAPPA_MDF_QUALITIES } from "@/lib/definitions";
import { addInventoryItem } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusCircle, Trash2, Loader2, ShoppingCart, ArrowLeft, Warehouse } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

// Helper components (moved from dialog)
const CurrentItemPaperFields = ({ form, onFormChange }: { form: UseFormReturn<Partial<InventoryItemFormValues>>, onFormChange: () => void }) => {
  const watchedPaperQuality = form.watch("paperQuality");
  const paperUnit = getPaperQualityUnit(watchedPaperQuality as PaperQualityType);

  useEffect(() => {
    const subscription = form.watch(() => onFormChange());
    return () => subscription.unsubscribe();
  }, [form, onFormChange]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="paperMasterSheetSizeWidth" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper Width (in)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="e.g., 27.56" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body h-11"/>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="paperMasterSheetSizeHeight" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper Height (in)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="e.g., 39.37" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body h-11"/>
            </FormControl>
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
            <FormControl>
                <SelectTrigger className="font-body h-11">
                  <SelectValue placeholder="Select paper quality" />
                </SelectTrigger>
            </FormControl>
            <SelectContent>{PAPER_QUALITY_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      {paperUnit === 'gsm' && (
        <FormField control={form.control} name="paperGsm" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper GSM</FormLabel>
            <FormControl>
              <Input type="number" placeholder="e.g., 300" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body h-11"/>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}
      {paperUnit === 'mm' && (
         <FormField control={form.control} name="paperThicknessMm" render={({ field }) => (
          <FormItem>
            <FormLabel>Paper Thickness (mm)</FormLabel>
            <FormControl>
              <Input type="number" step="0.1" placeholder="e.g., 1.2" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body h-11"/>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}
    </>
  );
};

const CurrentItemInkFields = ({ form, onFormChange }: { form: UseFormReturn<Partial<InventoryItemFormValues>>, onFormChange: () => void }) => {
   useEffect(() => {
    const subscription = form.watch(() => onFormChange());
    return () => subscription.unsubscribe();
  }, [form, onFormChange]);

  return (
  <>
     <FormField control={form.control} name="inkName" render={({ field }) => (
         <FormItem>
             <FormLabel>Ink Name/Type</FormLabel>
             <FormControl>
              <Input placeholder="e.g., Process Black, Pantone 185C" {...field} value={field.value ?? ''} className="font-body h-11"/>
            </FormControl>
             <FormMessage />
         </FormItem>
     )} />
     <FormField control={form.control} name="inkSpecification" render={({ field }) => (
         <FormItem>
             <FormLabel>Ink Specification/Color</FormLabel>
             <FormControl>
              <Input placeholder="e.g., Oil-based, Red" {...field} value={field.value ?? ''}  className="font-body h-11"/>
            </FormControl>
             <FormMessage />
         </FormItem>
     )} />
  </>
)};

const CurrentItemOtherCategoryFields = ({ form, categoryLabel, onFormChange }: { form: UseFormReturn<Partial<InventoryItemFormValues>>; categoryLabel: string; onFormChange: () => void }) => {
   useEffect(() => {
    const subscription = form.watch(() => onFormChange());
    return () => subscription.unsubscribe();
  }, [form, onFormChange]);
  
  return (
  <>
    <FormField control={form.control} name="itemName" render={({ field }) => (
      <FormItem>
        <FormLabel>Item Name</FormLabel>
        <FormControl>
          <Input placeholder={`e.g., ${categoryLabel} Model X`} {...field} value={field.value ?? ''} className="font-body h-11"/>
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <FormField control={form.control} name="itemSpecification" render={({ field }) => (
      <FormItem>
        <FormLabel>Specification</FormLabel>
        <FormControl>
          <Input placeholder="e.g., Size, Material, Color" {...field} value={field.value ?? ''} className="font-body h-11"/>
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  </>
)};

const CurrentItemCommonFields = ({ form, onFormChange }: { form: UseFormReturn<Partial<InventoryItemFormValues>>, onFormChange: () => void }) => {
   useEffect(() => {
    const subscription = form.watch(() => onFormChange());
    return () => subscription.unsubscribe();
  }, [form, onFormChange]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity for this Item</FormLabel> 
              <FormControl>
                <Input 
                    type="number" 
                    placeholder="e.g., 1000" 
                    {...field} 
                    value={field.value ?? ''} 
                    onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                    className="font-body h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        <FormField control={form.control} name="unit" render={({ field }) => (
          <FormItem>
            <FormLabel>Unit</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || "sheets" as UnitValue}>
              <FormControl>
                <SelectTrigger className="font-body h-11">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>{UNIT_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="locationCode" render={({ field }) => (
          <FormItem>
            <FormLabel>Location Code (Optional)</FormLabel>
            <FormControl>
              <div className="relative">
                <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="e.g., Kuvam Up - A1" {...field} value={field.value ?? ''} className="font-body h-11 pl-10"/>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="reorderPoint" render={({ field }) => (
          <FormItem>
            <FormLabel>Reorder Point (Optional)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="font-body h-11"/>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </>
  );
};

type PurchaseListItem = Omit<InventoryItemFormValues, 'purchaseBillNo' | 'dateOfEntry' | 'vendorName' | 'otherVendorName'> & { displayId: number; displayName: string; };

const deriveItemNameInternal = (values: Partial<InventoryItemFormValues>): string => {
  if (!values.category) return "Item (select category)";
  
  const categoryLabel = INVENTORY_CATEGORIES.find(c => c.value === values.category)?.label || "Item";
  
  if (values.category === 'PAPER') {
      const quality = values.paperQuality as PaperQualityType;
      const qualityLabel = getPaperQualityLabel(quality);
      const unit = getPaperQualityUnit(quality);
      const width = values.paperMasterSheetSizeWidth || 0;
      const height = values.paperMasterSheetSizeHeight || 0;
      if (!qualityLabel || width <= 0 || height <=0) return "Paper (incomplete specs)";
      if (unit === 'mm') {
          const thickness = values.paperThicknessMm || '?';
          if (thickness === '?') return "Paper (incomplete specs)";
          return `${qualityLabel} ${thickness}mm (${width.toFixed(1)}x${height.toFixed(1)}in)`;
      }
      const gsm = values.paperGsm || '?';
      if (gsm === '?') return "Paper (incomplete specs)";
      return `${qualityLabel} ${gsm}GSM (${width.toFixed(1)}x${height.toFixed(1)}in)`;
  } else if (values.category === 'INKS') {
      return values.inkName || `Ink (define name)`;
  } else {
      const baseItemName = values.itemName || `${categoryLabel}`;
      if (baseItemName.toLowerCase().includes(categoryLabel.toLowerCase())) {
          return values.itemName || `${categoryLabel} (define name)`;
      }
      return values.itemName ? `${values.itemName} (${categoryLabel})` : `${categoryLabel} (define name)`;
  }
};

export default function NewPurchasePage() {
  const router = useRouter();
  const [purchaseBillNo, setPurchaseBillNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
  const [purchaseVendor, setPurchaseVendor] = useState<string | undefined>(undefined);
  const [otherPurchaseVendor, setOtherPurchaseVendor] = useState("");
  const [otherVendorError, setOtherVendorError] = useState<string | null>(null);

  const [itemsInPurchaseList, setItemsInPurchaseList] = useState<PurchaseListItem[]>([]);
  const [currentItemCategory, setCurrentItemCategory] = useState<InventoryCategory | null>(null);
  const [nextDisplayId, setNextDisplayId] = useState(1);

  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const { toast } = useToast();
  
  const currentItemForm = useForm<Partial<InventoryItemFormValues>>({
    resolver: zodResolver(InventoryItemFormSchema.innerType().partial()),
    defaultValues: {
      category: undefined,
      quantity: undefined, 
      unit: "pieces" as UnitValue, // Defaulted to pieces, will be overridden by category logic
      paperMasterSheetSizeWidth: undefined,
      paperMasterSheetSizeHeight: undefined,
      paperQuality: "",
      paperGsm: undefined,
      paperThicknessMm: undefined,
      inkName: "",
      inkSpecification: "",
      itemName: "", 
      itemSpecification: "",
      reorderPoint: undefined,
      locationCode: "",
    },
  });

  const [derivedCurrentItemName, setDerivedCurrentItemName] = useState("");

  const handleCurrentItemFormChange = useCallback(() => {
    setDerivedCurrentItemName(deriveItemNameInternal(currentItemForm.getValues()));
  }, [currentItemForm]);


  const handleAddItemToPurchaseList = () => {
    currentItemForm.trigger().then(isValid => {
      const currentItemValues = currentItemForm.getValues();

      if (!currentItemCategory) {
         toast({ title: "Category Missing", description: "Please select a category for the current item.", variant: "destructive" });
        return;
      }
       if (currentItemValues.quantity === undefined || currentItemValues.quantity <= 0) {
        currentItemForm.setError("quantity", { type: "manual", message: "Quantity must be > 0" });
        toast({ title: "Invalid Quantity", description: "Please enter a quantity greater than 0 for the item.", variant: "destructive" });
        return;
      }
      if (!isValid) {
        toast({ title: "Current Item Incomplete", description: "Please fill all required fields for the current item based on its category (e.g., paper specs, ink name). Refer to highlighted fields.", variant: "destructive" });
        return;
      }

      const derivedName = deriveItemNameInternal(currentItemValues);
      const newItemForList: PurchaseListItem = {
        displayId: nextDisplayId,
        displayName: derivedName,
        category: currentItemCategory,
        paperMasterSheetSizeWidth: currentItemValues.paperMasterSheetSizeWidth,
        paperMasterSheetSizeHeight: currentItemValues.paperMasterSheetSizeHeight,
        paperQuality: currentItemValues.paperQuality,
        paperGsm: currentItemValues.paperGsm,
        paperThicknessMm: currentItemValues.paperThicknessMm,
        inkName: currentItemValues.inkName,
        inkSpecification: currentItemValues.inkSpecification,
        itemName: currentItemValues.itemName || derivedName, 
        itemSpecification: currentItemValues.itemSpecification,
        quantity: currentItemValues.quantity || 0,
        unit: currentItemValues.unit || 'units',
        reorderPoint: currentItemValues.reorderPoint,
        locationCode: currentItemValues.locationCode,
      };
      setItemsInPurchaseList(prev => [...prev, newItemForList]);
      setNextDisplayId(prev => prev + 1);
      
      const newCategory = currentItemForm.getValues().category; 
      
      let defaultUnit: UnitValue;
      let autoItemName = "";

      switch (newCategory) {
        case 'PAPER':
          defaultUnit = 'sheets';
          autoItemName = "Paper Stock Item";
          break;
        case 'INKS':
          defaultUnit = 'kg';
          autoItemName = "Ink Item";
          break;
        case 'PLASTIC_TRAY':
        case 'GLASS_JAR':
        case 'MAGNET':
        case 'OTHER':
           defaultUnit = 'pieces';
           autoItemName = newCategory === 'PLASTIC_TRAY' ? "Plastic Tray" : newCategory === 'GLASS_JAR' ? "Glass Jar" : newCategory === 'MAGNET' ? "Magnet" : ""; 
           break;
        default:
          defaultUnit = 'units';
      }
      
      currentItemForm.reset({
        category: newCategory, 
        quantity: undefined, 
        unit: defaultUnit as UnitValue,
        paperMasterSheetSizeWidth: newCategory === 'PAPER' ? currentItemValues.paperMasterSheetSizeWidth : undefined,
        paperMasterSheetSizeHeight: newCategory === 'PAPER' ? currentItemValues.paperMasterSheetSizeHeight : undefined,
        paperQuality: newCategory === 'PAPER' ? currentItemValues.paperQuality : "",
        paperGsm: newCategory === 'PAPER' ? currentItemValues.paperGsm : undefined,
        paperThicknessMm: newCategory === 'PAPER' ? currentItemValues.paperThicknessMm : undefined,
        inkName: newCategory === 'INKS' ? currentItemValues.inkName : "",
        inkSpecification: newCategory === 'INKS' ? currentItemValues.inkSpecification : "",
        itemName: autoItemName, 
        itemSpecification: "",
        reorderPoint: undefined, 
        locationCode: "",
      });
      setCurrentItemCategory(newCategory || null);
      setDerivedCurrentItemName(""); 
    });
  };

  const handleRemoveItemFromList = (displayId: number) => {
    setItemsInPurchaseList(prev => prev.filter(item => item.displayId !== displayId));
  };

  const resetPage = () => {
    setPurchaseBillNo("");
    setPurchaseDate(new Date());
    setPurchaseVendor(undefined);
    setOtherPurchaseVendor("");
    setOtherVendorError(null);
    setItemsInPurchaseList([]);
    
    const currentCategory = currentItemForm.getValues().category;
    let autoItemName = "";
    let defaultUnit: UnitValue = 'pieces';

    if (currentCategory) {
      switch (currentCategory) {
        case 'PAPER': autoItemName = "Paper Stock Item"; defaultUnit = 'sheets'; break;
        case 'INKS': autoItemName = "Ink Item"; defaultUnit = 'kg'; break;
        case 'PLASTIC_TRAY': 
        case 'GLASS_JAR': 
        case 'MAGNET': 
        case 'OTHER':
          defaultUnit = 'pieces';
          autoItemName = currentCategory === 'PLASTIC_TRAY' ? "Plastic Tray" : currentCategory === 'GLASS_JAR' ? "Glass Jar" : currentCategory === 'MAGNET' ? "Magnet" : "";
          break;
        default: defaultUnit = 'units';
      }
    }

    currentItemForm.reset({ 
        category: undefined, 
        quantity: undefined, 
        unit: defaultUnit,
        paperMasterSheetSizeWidth: undefined,
        paperMasterSheetSizeHeight: undefined,
        paperQuality: "",
        paperGsm: undefined,
        paperThicknessMm: undefined,
        inkName: "",
        inkSpecification: "",
        itemName: autoItemName, 
        itemSpecification: "",
        reorderPoint: undefined,
        locationCode: "",
    });
    setCurrentItemCategory(null);
    setDerivedCurrentItemName("");
    setIsSubmittingPurchase(false);
    setNextDisplayId(1);
  };

  const handleSavePurchase = async () => {
    setOtherVendorError(null); 
    if (!purchaseBillNo.trim()) {
      toast({ title: "Missing Purchase Bill No.", description: "Please enter the purchase bill number.", variant: "destructive" });
      return;
    }
    if (!purchaseDate) {
      toast({ title: "Missing Purchase Date", description: "Please select the purchase date.", variant: "destructive" });
      return;
    }
    if (purchaseVendor === 'OTHER' && !otherPurchaseVendor.trim()) {
      setOtherVendorError("Please specify the vendor name when 'Other' is selected.");
      toast({ title: "Missing Vendor Name", description: "Please specify the vendor name when 'Other' is selected.", variant: "destructive" });
      return;
    }
    if (itemsInPurchaseList.length === 0) {
      toast({ title: "No Items Added", description: "Please add at least one item to the purchase list.", variant: "destructive" });
      return;
    }

    setIsSubmittingPurchase(true);

    const results = await Promise.all(
      itemsInPurchaseList.map(item => {
        const itemDataForAction: InventoryItemFormValues = {
          ...item,
          purchaseBillNo: purchaseBillNo,
          dateOfEntry: purchaseDate.toISOString(),
          vendorName: purchaseVendor,
          otherVendorName: purchaseVendor === 'OTHER' ? otherPurchaseVendor : "",
          itemName: item.itemName || item.displayName, 
        };
        return addInventoryItem(itemDataForAction);
      })
    );
    
    const errorMessages: string[] = results
      .map((res, i) => !res.success ? `Failed for item "${itemsInPurchaseList[i].displayName}": ${res.message}` : null)
      .filter((msg): msg is string => msg !== null);


    const allItemsSaved = errorMessages.length === 0;

    setIsSubmittingPurchase(false);

    if (allItemsSaved) {
      toast({ title: "Purchase Saved!", description: `Successfully added ${itemsInPurchaseList.length} item(s) from bill ${purchaseBillNo}.` });
      resetPage();
      router.push('/inventory');
    } else {
       toast({
        title: "Error Saving Purchase",
        description: (
          <div className="text-sm">
            <p className="font-semibold mb-1">Some items could not be saved:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errorMessages.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        ),
        variant: "destructive",
        duration: 10000,
      });
    }
  };
  
  const handleCancel = () => {
    resetPage();
    router.push('/inventory');
  };

  const currentCategoryLabel = currentItemCategory ? INVENTORY_CATEGORIES.find(c => c.value === currentItemCategory)?.label || "Item" : "Item";

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
            <ShoppingCart className="mr-3 h-6 w-6 text-primary"/>Enter New Purchase Bill
          </CardTitle>
          <CardDescription className="font-body">Add multiple inventory items received under a single purchase bill.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg bg-card shadow-sm space-y-4">
              <h3 className="font-semibold font-headline text-lg">Purchase Bill Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseBillNoInput">Purchase Bill No.</Label>
                  <Input id="purchaseBillNoInput" placeholder="e.g., INV-2024-123" value={purchaseBillNo} onChange={(e) => setPurchaseBillNo(e.target.value)} className="font-body h-11"/>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="purchaseDateButton">Purchase Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                        <Button id="purchaseDateButton" variant={"outline"} className={cn("w-full pl-3 text-left font-normal font-body h-11 py-2", !purchaseDate && "text-muted-foreground")}>
                          {purchaseDate ? format(purchaseDate, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={purchaseDate} onSelect={setPurchaseDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="purchaseVendorSelect">Vendor Name (Optional)</Label>
                  <Select onValueChange={setPurchaseVendor} value={purchaseVendor || ""}>
                    <SelectTrigger id="purchaseVendorSelect" className="font-body h-11">
                        <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>{VENDOR_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value} className="font-body">{opt.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              {purchaseVendor === 'OTHER' && (
                <div className="space-y-2">
                  <Label htmlFor="otherPurchaseVendorInput">Specify Vendor Name</Label>
                  <Input 
                    id="otherPurchaseVendorInput" 
                    placeholder="Enter vendor name" 
                    value={otherPurchaseVendor} 
                    onChange={(e) => {
                        setOtherPurchaseVendor(e.target.value);
                        if (e.target.value.trim()) setOtherVendorError(null);
                    }} 
                    className={cn("font-body h-11", otherVendorError && "border-destructive")}
                  />
                   {otherVendorError && <p className="text-xs text-destructive mt-1">{otherVendorError}</p>}
                </div>
              )}
            </div>

            <div className="p-4 border rounded-lg bg-card shadow-sm space-y-4">
               <h3 className="font-semibold font-headline text-lg">Add Item to Purchase</h3>
              <Form {...currentItemForm}>
                <form className="space-y-4">
                   <FormField control={currentItemForm.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Category</FormLabel>
                      <Select onValueChange={(value) => { 
                          field.onChange(value); 
                          setCurrentItemCategory(value as InventoryCategory); 
                          
                          let defaultUnit: UnitValue;
                          let autoItemName = "";
                          const newCategoryValue = value as InventoryCategory;

                          switch (newCategoryValue) {
                            case 'PAPER':
                              defaultUnit = 'sheets';
                              autoItemName = "Paper Stock Item";
                              break;
                            case 'INKS':
                              defaultUnit = 'kg';
                              autoItemName = "Ink Item";
                              break;
                            case 'PLASTIC_TRAY':
                            case 'GLASS_JAR':
                            case 'MAGNET':
                            case 'OTHER':
                               defaultUnit = 'pieces';
                               autoItemName = newCategoryValue === 'PLASTIC_TRAY' ? "Plastic Tray" : newCategoryValue === 'GLASS_JAR' ? "Glass Jar" : newCategoryValue === 'MAGNET' ? "Magnet" : ""; 
                               break;
                            default:
                              defaultUnit = 'units';
                              autoItemName = "";
                          }
                          
                          currentItemForm.reset({
                            category: newCategoryValue, 
                            paperMasterSheetSizeWidth: undefined,
                            paperMasterSheetSizeHeight: undefined,
                            paperQuality: "",
                            paperGsm: undefined,
                            paperThicknessMm: undefined,
                            inkName: "",
                            inkSpecification: "",
                            itemName: autoItemName, 
                            itemSpecification: "",
                            quantity: undefined, 
                            unit: defaultUnit, 
                            reorderPoint: undefined,
                            locationCode: "",
                          });
                          handleCurrentItemFormChange(); 
                        }} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="font-body h-11">
                            <SelectValue placeholder="Select item category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>{INVENTORY_CATEGORIES.map(cat => (<SelectItem key={cat.value} value={cat.value} className="font-body">{cat.label}</SelectItem>))}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {currentItemCategory === 'PAPER' && <CurrentItemPaperFields form={currentItemForm} onFormChange={handleCurrentItemFormChange} />}
                  {currentItemCategory === 'INKS' && <CurrentItemInkFields form={currentItemForm} onFormChange={handleCurrentItemFormChange} />}
                  {(currentItemCategory && currentItemCategory !== 'PAPER' && currentItemCategory !== 'INKS') && (
                    <CurrentItemOtherCategoryFields form={currentItemForm} categoryLabel={currentCategoryLabel} onFormChange={handleCurrentItemFormChange} />
                  )}
                  
                  {currentItemCategory && <CurrentItemCommonFields form={currentItemForm} onFormChange={handleCurrentItemFormChange} />}
                  
                  {currentItemCategory && (
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-sm text-muted-foreground font-body">Derived Item: {derivedCurrentItemName || "Configure above"}</p>
                      <Button type="button" onClick={handleAddItemToPurchaseList} variant="secondary">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Item to List
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </div>

            {itemsInPurchaseList.length > 0 && (
              <div className="p-4 border rounded-lg bg-card shadow-sm space-y-2">
                <h3 className="font-semibold font-headline text-lg">Items in this Purchase</h3>
                <ScrollArea className="h-[250px] border rounded-md"> 
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-body">Item Name</TableHead>
                        <TableHead className="font-body text-right">Qty</TableHead>
                        <TableHead className="font-body">Unit</TableHead>
                        <TableHead className="font-body">Location</TableHead>
                        <TableHead className="font-body text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsInPurchaseList.map((item) => (
                        <TableRow key={item.displayId}>
                          <TableCell className="font-body">{item.displayName}</TableCell>
                          <TableCell className="font-body text-right">{item.quantity.toLocaleString()}</TableCell>
                          <TableCell className="font-body">{item.unit}</TableCell>
                          <TableCell className="font-body">{item.locationCode || '-'}</TableCell>
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
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6 border-t">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmittingPurchase} className="font-body">Cancel</Button>
          <Button type="button" onClick={handleSavePurchase} disabled={isSubmittingPurchase || itemsInPurchaseList.length === 0} className="font-body">
            {isSubmittingPurchase ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
            Save Entire Purchase
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    
