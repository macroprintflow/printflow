
"use client";

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, Printer, Paintbrush, Box, Package, MagnetIcon, ShoppingCart, Edit, Upload, Download } from "lucide-react"; // Added Download
import { useToast } from '@/hooks/use-toast';
import React, { useRef } from "react"; // Added useRef
import type { InventoryItemFormValues, InventoryCategory, UnitValue, PaperQualityType } from '@/lib/definitions'; // Added types
import { addInventoryItem } from '@/lib/actions/jobActions'; // Added action
import { VENDOR_OPTIONS, INVENTORY_CATEGORIES, UNIT_OPTIONS, PAPER_QUALITY_OPTIONS, getPaperQualityUnit } from '@/lib/definitions'; // Added definitions
import { format } from 'date-fns'; // For default date

const mainCategories = [
  { name: "Paper", slug: "paper", icon: Printer, description: "Master sheets and paper stock." },
  { name: "Inks", slug: "inks", icon: Paintbrush, description: "All types of printing inks." },
  { name: "Plastic Trays", slug: "plastic-trays", icon: Package, description: "Trays for packaging." },
  { name: "Glass Jars", slug: "glass-jars", icon: Box, description: "Glass jars and containers." },
  { name: "Magnets", slug: "magnets", icon: MagnetIcon, description: "Magnets for boxes and crafts." },
  { name: "Other Materials", slug: "other-materials", icon: Archive, description: "Miscellaneous stock items." },
];

const EXPECTED_INVENTORY_CSV_HEADERS = [
    "category", "itemName", "itemSpecification", "quantity", "unit",
    "paperMasterSheetSizeWidth", "paperMasterSheetSizeHeight", "paperQuality", "paperGsm", "paperThicknessMm",
    "inkName", "inkSpecification",
    "purchaseBillNo", "vendorName", "otherVendorName", "dateOfEntry", "reorderPoint", "locationCode"
];

export default function InventoryCategorySelectionPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInventoryImportCsvClick = () => {
    fileInputRef.current?.click();
  };

  const handleInventoryCsvFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast({ title: "Processing CSV...", description: "Please wait while the inventory items are being imported." });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error Reading File", description: "Could not read the CSV file content.", variant: "destructive" });
        return;
      }

      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "CSV file must contain a header row and at least one data row.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const headerLine = lines[0].split(',').map(h => h.trim());
      const dataLines = lines.slice(1);

      const missingHeaders = EXPECTED_INVENTORY_CSV_HEADERS.filter(expectedHeader =>
        !headerLine.includes(expectedHeader) && (expectedHeader === "category" || expectedHeader === "quantity" || expectedHeader === "unit")
      );
      if (missingHeaders.length > 0) {
          toast({ title: "Invalid CSV Header", description: `Missing mandatory header(s): ${missingHeaders.join(', ')}. Expected includes: ${EXPECTED_INVENTORY_CSV_HEADERS.join(', ')}`, variant: "destructive", duration: 10000 });
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
      }
      
      const headerMap = headerLine.reduce((acc, header, index) => {
        acc[header] = index;
        return acc;
      }, {} as Record<string, number>);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const line of dataLines) {
        const values = line.split(',').map(v => v.trim());
        
        const category = values[headerMap["category"]]?.toUpperCase() as InventoryCategory | undefined;
        if (!category || !INVENTORY_CATEGORIES.find(c => c.value === category)) {
            errorCount++;
            errors.push(`Skipped row (invalid or missing category): ${line.substring(0,50)}...`);
            continue;
        }

        const quantityStr = values[headerMap["quantity"]];
        const quantity = quantityStr ? parseFloat(quantityStr) : undefined;
        if (quantity === undefined || isNaN(quantity) || quantity < 0) {
            errorCount++;
            errors.push(`Skipped row (invalid or missing quantity for ${values[headerMap["itemName"]] || category}): ${line.substring(0,50)}...`);
            continue;
        }
        
        const unit = values[headerMap["unit"]]?.toLowerCase() as UnitValue | undefined;
        if (!unit || !UNIT_OPTIONS.find(u => u.value === unit)) {
            errorCount++;
            errors.push(`Skipped row (invalid or missing unit for ${values[headerMap["itemName"]] || category}): ${line.substring(0,50)}...`);
            continue;
        }

        const itemData: Partial<InventoryItemFormValues> = {
          category: category,
          itemName: values[headerMap["itemName"]],
          itemSpecification: values[headerMap["itemSpecification"]],
          quantity: quantity,
          unit: unit,
          paperMasterSheetSizeWidth: values[headerMap["paperMasterSheetSizeWidth"]] ? parseFloat(values[headerMap["paperMasterSheetSizeWidth"]]) : undefined,
          paperMasterSheetSizeHeight: values[headerMap["paperMasterSheetSizeHeight"]] ? parseFloat(values[headerMap["paperMasterSheetSizeHeight"]]) : undefined,
          paperQuality: values[headerMap["paperQuality"]] as PaperQualityType | undefined,
          paperGsm: values[headerMap["paperGsm"]] ? parseFloat(values[headerMap["paperGsm"]]) : undefined,
          paperThicknessMm: values[headerMap["paperThicknessMm"]] ? parseFloat(values[headerMap["paperThicknessMm"]]) : undefined,
          inkName: values[headerMap["inkName"]],
          inkSpecification: values[headerMap["inkSpecification"]],
          purchaseBillNo: values[headerMap["purchaseBillNo"]],
          vendorName: values[headerMap["vendorName"]] as typeof VENDOR_OPTIONS[number]['value'] | undefined,
          otherVendorName: values[headerMap["otherVendorName"]],
          dateOfEntry: values[headerMap["dateOfEntry"]] || format(new Date(), "yyyy-MM-dd"),
          reorderPoint: values[headerMap["reorderPoint"]] ? parseInt(values[headerMap["reorderPoint"]]) : undefined,
          locationCode: values[headerMap["locationCode"]],
        };
        
        // Category-specific validation
        if (category === 'PAPER') {
            if (!itemData.paperQuality || !PAPER_QUALITY_OPTIONS.find(pq => pq.value === itemData.paperQuality)) {
                errorCount++; errors.push(`PAPER item '${itemData.itemName || 'Unnamed'}' missing or invalid paperQuality.`); continue;
            }
            const pqUnit = getPaperQualityUnit(itemData.paperQuality);
            if (pqUnit === 'gsm' && (!itemData.paperGsm || itemData.paperGsm <= 0)) {
                errorCount++; errors.push(`PAPER item '${itemData.itemName || 'Unnamed'}' missing or invalid paperGsm.`); continue;
            }
            if (pqUnit === 'mm' && (!itemData.paperThicknessMm || itemData.paperThicknessMm <= 0)) {
                errorCount++; errors.push(`PAPER item '${itemData.itemName || 'Unnamed'}' missing or invalid paperThicknessMm.`); continue;
            }
            if (!itemData.paperMasterSheetSizeWidth || itemData.paperMasterSheetSizeWidth <= 0 || !itemData.paperMasterSheetSizeHeight || itemData.paperMasterSheetSizeHeight <=0) {
                errorCount++; errors.push(`PAPER item '${itemData.itemName || 'Unnamed'}' missing or invalid sheet dimensions.`); continue;
            }
            if (!itemData.itemName) itemData.itemName = `${itemData.paperQuality} ${pqUnit === 'gsm' ? itemData.paperGsm+'GSM' : itemData.paperThicknessMm+'mm'} ${itemData.paperMasterSheetSizeWidth}x${itemData.paperMasterSheetSizeHeight}`;

        } else if (category === 'INKS') {
            if (!itemData.inkName) {
                errorCount++; errors.push(`INKS item missing inkName.`); continue;
            }
            if(!itemData.itemName) itemData.itemName = itemData.inkName;
        } else { // Other categories
            if (!itemData.itemName) {
                 errorCount++; errors.push(`${category} item missing itemName.`); continue;
            }
        }
         if (itemData.vendorName === 'OTHER' && !itemData.otherVendorName) {
            errorCount++; errors.push(`Item '${itemData.itemName}' has vendor 'OTHER' but no otherVendorName specified.`); continue;
         }


        try {
          const result = await addInventoryItem(itemData as InventoryItemFormValues); // Cast as full type after validation
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Failed to add ${itemData.itemName || `item in row ${dataLines.indexOf(line) + 2}`}: ${result.message}`);
          }
        } catch (err) {
          errorCount++;
          errors.push(`Error adding ${itemData.itemName || `item in row ${dataLines.indexOf(line) + 2}`}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      toast({
        title: "Inventory CSV Import Complete",
        description: (
          <div>
            <p>Successfully added/updated: {successCount} item(s).</p>
            {errorCount > 0 && <p>Failed operations: {errorCount}.</p>}
            {errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer">View Errors ({errors.length})</summary>
                <ul className="text-xs list-disc list-inside max-h-20 overflow-y-auto p-1 border rounded bg-destructive/10">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
          </div>
        ),
        duration: errorCount > 0 ? 15000 : 7000,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      toast({ title: "Error Reading File", description: "An error occurred while trying to read the CSV file.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleExportSampleInventoryCsv = () => {
    const headerString = EXPECTED_INVENTORY_CSV_HEADERS.join(',') + '\r\n';
    const sampleRowPaper = "PAPER,SBS 300GSM 20x30,Art Paper for luxury boxes,500,sheets,20,30,SBS,300,,,,INV-2024-001,JV_TRADERS,,2024-01-15,100,Shelf A1" + '\r\n';
    const sampleRowInk = "INKS,Process Black Ink,Standard black ink,10,kg,,,,,,,SuperInks Co.,,INV-2024-002,OTHER,Deepak Inks,2024-01-16,2,Shelf B2" + '\r\n';
    const sampleRowOther = "PLASTIC_TRAY,Tray Model X,10x8x2 cm clear tray,1000,pieces,,,,,,,,INV-2024-003,Rohit Agencies,,2024-01-17,200,Shelf C3" + '\r\n';

    const csvString = headerString + sampleRowPaper + sampleRowInk + sampleRowOther;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "sample-inventory-import.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        toast({ title: "Export Failed", description: "Your browser does not support this feature.", variant: "destructive"});
    }
  };


  return (
    <div className="space-y-6">
      <input 
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleInventoryCsvFileSelect}
        className="hidden"
      />
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle className="font-headline flex items-center">
                    <Archive className="mr-2 h-6 w-6 text-primary" /> Inventory Management
                </CardTitle>
                <CardDescription className="font-body">
                    Select a category to view stock, enter a new purchase bill, or make adjustments.
                </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto font-body" onClick={handleInventoryImportCsvClick}>
                  <Upload className="mr-2 h-4 w-4" /> Import Inventory CSV
                </Button>
                <Button variant="outline" className="w-full sm:w-auto font-body" onClick={handleExportSampleInventoryCsv}>
                  <Download className="mr-2 h-4 w-4" /> Export Sample CSV
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto font-body">
                  <Link href="/inventory/new-adjustment">
                    <Edit className="mr-2 h-4 w-4" /> Make Inventory Adjustment(s)
                  </Link>
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
    </div>
  );
}
