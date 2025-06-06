
'use server';

import type { JobCardFormValues, JobCardData, JobTemplateData, JobTemplateFormValues, InventoryItem, PaperQualityType, InventorySuggestion, InventoryItemFormValues, InventoryItemType, ItemGroupType, UnitValue, OptimizeInventoryOutput, InventoryAdjustment } from '@/lib/definitions';
import { PAPER_QUALITY_OPTIONS, getPaperQualityLabel, INVENTORY_ADJUSTMENT_REASONS } from '@/lib/definitions';
import { calculateUps } from '@/lib/calculateUps';
import { revalidatePath } from 'next/cache';

declare global {
  var __jobCards__: JobCardData[] | undefined;
  var __jobCounter__: number | undefined;
  var __jobTemplatesStore__: JobTemplateData[] | undefined;
  var __templateCounter__: number | undefined;
  var __inventoryItemsStore__: InventoryItem[] | undefined;
  var __inventoryCounter__: number | undefined;
  var __inventoryAdjustmentsStore__: InventoryAdjustment[] | undefined;
  var __adjustmentCounter__: number | undefined;
}

// Initialize global stores if they don't exist
if (global.__jobCards__ === undefined) {
  global.__jobCards__ = [];
}
if (global.__jobCounter__ === undefined) {
  global.__jobCounter__ = 1;
}

const initialJobTemplates: JobTemplateData[] = [
    { id: 'template1', name: 'Golden Tray (Predefined)', kindOfJob: 'METPET', coating: 'VARNISH_GLOSS', hotFoilStamping: 'GOLDEN', paperQuality: 'GOLDEN_SHEET' },
    { id: 'template2', name: 'Rigid Top and Bottom Box (Predefined)', boxMaking: 'COMBINED', pasting: 'YES', paperQuality: 'WG_KAPPA' },
    { id: 'template3', name: 'Monocarton Box (Predefined)', kindOfJob: 'NORMAL', paperQuality: 'SBS' },
];
if (global.__jobTemplatesStore__ === undefined) {
  global.__jobTemplatesStore__ = [...initialJobTemplates];
}
if (global.__templateCounter__ === undefined) {
  global.__templateCounter__ = initialJobTemplates.length + 1;
}

if (global.__inventoryItemsStore__ === undefined) {
  console.log('[InventoryManagement] Initializing global inventory store to be empty (first load).');
  global.__inventoryItemsStore__ = [];
}
if (global.__inventoryCounter__ === undefined) {
    global.__inventoryCounter__ = (global.__inventoryItemsStore__?.length || 0) + 1;
}

if (global.__inventoryAdjustmentsStore__ === undefined) {
  global.__inventoryAdjustmentsStore__ = [];
}
if (global.__adjustmentCounter__ === undefined) {
  global.__adjustmentCounter__ = 1;
}


function generateJobCardNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `JC-${year}${month}${day}-${randomNumber}`;
}

export async function createJobCard(data: JobCardFormValues): Promise<{ success: boolean; message: string; jobCard?: JobCardData }> {
  try {
    const currentJobCounter = global.__jobCounter__!;
    const newJobCard: JobCardData = {
      ...data,
      id: currentJobCounter.toString(),
      jobCardNumber: generateJobCardNumber(),
      date: new Date().toISOString().split('T')[0],
      cuttingLayoutDescription: data.cuttingLayoutDescription,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    global.__jobCards__!.push(newJobCard);
    global.__jobCounter__ = currentJobCounter + 1;

    // Stock Deduction and Adjustment Log
    if (data.sourceInventoryItemId && data.totalMasterSheetsNeeded && data.totalMasterSheetsNeeded > 0) {
      const inventoryItemIndex = global.__inventoryItemsStore__!.findIndex(item => item.id === data.sourceInventoryItemId);
      if (inventoryItemIndex !== -1) {
        global.__inventoryItemsStore__![inventoryItemIndex].availableStock -= data.totalMasterSheetsNeeded;

        const adjustment: InventoryAdjustment = {
          id: `adj${global.__adjustmentCounter__!++}`,
          inventoryItemId: data.sourceInventoryItemId,
          date: new Date().toISOString(),
          quantityChange: -data.totalMasterSheetsNeeded,
          reason: INVENTORY_ADJUSTMENT_REASONS.find(r => r.value === 'JOB_USAGE')!.value,
          reference: newJobCard.jobCardNumber,
          notes: `Used for job: ${newJobCard.jobName}`,
        };
        global.__inventoryAdjustmentsStore__!.push(adjustment);
        revalidatePath('/inventory');
      } else {
        console.warn(`[JobActions] Inventory item ID ${data.sourceInventoryItemId} not found for stock deduction for job ${newJobCard.jobCardNumber}.`);
      }
    }


    console.log('[JobActions] Created job card:', newJobCard.jobCardNumber);
    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job card created successfully!', jobCard: newJobCard };
  } catch (error) {
    console.error('[JobActions Error] Error creating job card:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create job card: ${errorMessage}` };
  }
}

export async function getInventoryOptimizationSuggestions(
  jobInput: {
    paperGsm: number;
    paperQuality: PaperQualityType;
    jobSizeWidth: number;
    jobSizeHeight: number;
    netQuantity: number;
  }
): Promise<OptimizeInventoryOutput | { error: string }> {
  console.log('[JobActions TS Calc] === Get Inventory Optimization Suggestions START ===');
  console.log('[JobActions TS Calc] Job Input received:', JSON.stringify(jobInput, null, 2));

  try {
    if (!jobInput.paperQuality || jobInput.paperQuality === "") {
        console.log('[JobActions TS Calc] Target paper quality from jobInput is empty. Returning empty suggestions immediately.');
        return { suggestions: [], optimalSuggestion: undefined };
    }
     if (jobInput.jobSizeWidth <= 0 || jobInput.jobSizeHeight <= 0 || jobInput.netQuantity <=0) {
        console.log('[JobActions TS Calc] Invalid job dimensions or net quantity. Returning empty suggestions.');
        return { suggestions: [], optimalSuggestion: undefined };
    }
    
    const allInventory = await getInventoryItems();
    console.log(`[JobActions TS Calc] Full inventory fetched (${allInventory.length} items).`);

    const targetQualityLower = jobInput.paperQuality.toLowerCase();

    const processedSuggestions: InventorySuggestion[] = allInventory
      .filter(item => {
        const hasRequiredSheetFields =
          item.masterSheetSizeWidth && item.masterSheetSizeWidth > 0 &&
          item.masterSheetSizeHeight && item.masterSheetSizeHeight > 0 &&
          item.paperGsm && item.paperGsm > 0 &&
          item.paperQuality && item.paperQuality !== '';
        
        if (!hasRequiredSheetFields) return false;

        const itemQualityLower = item.paperQuality!.toLowerCase();
        return itemQualityLower === targetQualityLower;
      })
      .map(sheet => {
        const layoutInfo = calculateUps({
          jobW: jobInput.jobSizeWidth,
          jobH: jobInput.jobSizeHeight,
          sheetW: sheet.masterSheetSizeWidth!,
          sheetH: sheet.masterSheetSizeHeight!,
        });

        if (layoutInfo.ups === 0) {
          console.log(`[JobActions TS Calc] Sheet ID ${sheet.id} (${sheet.name}) yields 0 ups. Skipping.`);
          return null;
        }

        const sheetArea = sheet.masterSheetSizeWidth! * sheet.masterSheetSizeHeight!;
        const jobArea = jobInput.jobSizeWidth * jobInput.jobSizeHeight;
        const usedArea = layoutInfo.ups * jobArea;
        
        let wastagePercentage = 0;
        if (sheetArea > 0) {
            wastagePercentage = 100 - (usedArea / sheetArea) * 100;
        } else {
            wastagePercentage = 100; 
        }

        const totalMasterSheetsNeeded = Math.ceil(jobInput.netQuantity / layoutInfo.ups);

        const suggestion: InventorySuggestion = {
          sourceInventoryItemId: sheet.id,
          masterSheetSizeWidth: sheet.masterSheetSizeWidth!,
          masterSheetSizeHeight: sheet.masterSheetSizeHeight!,
          paperGsm: sheet.paperGsm!,
          paperQuality: sheet.paperQuality!,
          sheetsPerMasterSheet: layoutInfo.ups,
          totalMasterSheetsNeeded,
          wastagePercentage: Number(wastagePercentage.toFixed(2)),
          cuttingLayoutDescription: `${layoutInfo.cols} across x ${layoutInfo.rows} down (job ${layoutInfo.layout})`,
        };
        console.log(`[JobActions TS Calc] Processed sheet ID ${sheet.id}: Ups: ${layoutInfo.ups}, Wastage: ${suggestion.wastagePercentage}%, Layout: ${suggestion.cuttingLayoutDescription}`);
        return suggestion;
      })
      .filter((s): s is InventorySuggestion => s !== null)
      .sort((a, b) => {
        if (a.wastagePercentage === b.wastagePercentage) {
          return a.totalMasterSheetsNeeded - b.totalMasterSheetsNeeded;
        }
        return a.wastagePercentage - b.wastagePercentage;
      });
    
    console.log(`[JobActions TS Calc] TypeScript processing complete. ${processedSuggestions.length} valid suggestions found.`);

    const optimalSuggestion = processedSuggestions.length > 0 ? processedSuggestions[0] : undefined;

    if (optimalSuggestion) {
      console.log('[JobActions TS Calc] Optimal suggestion:', JSON.stringify(optimalSuggestion, null, 2));
    } else {
      console.log('[JobActions TS Calc] No optimal suggestion found.');
    }
    
    console.log('[JobActions TS Calc] === Get Inventory Optimization Suggestions END ===');
    return { suggestions: processedSuggestions, optimalSuggestion };

  } catch (error) {
    console.error('[JobActions Error] Error in getInventoryOptimizationSuggestions (TS Calc):', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions using TS calculation.';
    console.log('[JobActions TS Calc] === Get Inventory Optimization Suggestions END (Error) ===');
    return { error: `Failed to fetch inventory optimization suggestions: ${errorMessage}` };
  }
}


export async function getJobTemplates(): Promise<JobTemplateData[]> {
  return [...global.__jobTemplatesStore__!];
}

export async function createJobTemplate(data: JobTemplateFormValues): Promise<{ success: boolean; message: string; template?: JobTemplateData }> {
  try {
    const currentTemplateCounter = global.__templateCounter__!;
    const newTemplate: JobTemplateData = {
      ...data,
      id: `template${currentTemplateCounter}`,
    };
    global.__jobTemplatesStore__!.push(newTemplate);
    global.__templateCounter__ = currentTemplateCounter + 1;

    console.log('[JobActions] Created job template:', newTemplate.name);
    revalidatePath('/templates');
    revalidatePath('/templates/new');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job template created successfully!', template: newTemplate };
  } catch (error) {
    console.error('[JobActions Error] Error creating job template:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create job template: ${errorMessage}` };
  }
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  if (global.__inventoryItemsStore__ === undefined) {
     console.warn("[InventoryManagement] getInventoryItems: __inventoryItemsStore__ was undefined! Re-initializing to empty for safety, but this is unexpected.");
     global.__inventoryItemsStore__ = [];
  }
  return [...global.__inventoryItemsStore__!]; 
}

export async function addInventoryItem(data: InventoryItemFormValues): Promise<{ success: boolean; message: string; item?: InventoryItem }> {
  try {
    if (global.__inventoryItemsStore__ === undefined) {
      console.warn("CRITICAL: __inventoryItemsStore__ undefined in addInventoryItem at start. Initializing.");
      global.__inventoryItemsStore__ = [];
    }
    if (global.__inventoryCounter__ === undefined) {
      console.warn("CRITICAL: __inventoryCounter__ undefined in addInventoryItem at start. Initializing.");
      global.__inventoryCounter__ = (global.__inventoryItemsStore__?.length || 0) + 1;
    }
     if (global.__inventoryAdjustmentsStore__ === undefined) global.__inventoryAdjustmentsStore__ = [];
     if (global.__adjustmentCounter__ === undefined) global.__adjustmentCounter__ = 1;


    const currentInventoryCounter = global.__inventoryCounter__!;

    let itemType: InventoryItemType = 'Other';
    let itemGroup: ItemGroupType = 'Other Stock';
    let specificName = data.itemName;
    let specificSpecification = data.itemSpecification || '';
    let masterSheetSizeWidth_val: number | undefined = undefined;
    let masterSheetSizeHeight_val: number | undefined = undefined;
    let paperGsm_val: number | undefined = undefined;
    let paperQuality_val: PaperQualityType | undefined = undefined;

    if (data.category === 'PAPER') {
      if (typeof data.paperMasterSheetSizeWidth !== 'number' || data.paperMasterSheetSizeWidth <= 0) {
        throw new Error("Invalid or missing Paper Width for PAPER category.");
      }
      if (typeof data.paperMasterSheetSizeHeight !== 'number' || data.paperMasterSheetSizeHeight <= 0) {
        throw new Error("Invalid or missing Paper Height for PAPER category.");
      }
      if (typeof data.paperGsm !== 'number' || data.paperGsm <= 0) {
        throw new Error("Invalid or missing Paper GSM for PAPER category.");
      }
      if (!data.paperQuality || data.paperQuality === "") {
          throw new Error("Invalid or missing Paper Quality for PAPER category.");
      }

      masterSheetSizeWidth_val = data.paperMasterSheetSizeWidth;
      masterSheetSizeHeight_val = data.paperMasterSheetSizeHeight;
      paperGsm_val = data.paperGsm;
      paperQuality_val = data.paperQuality as PaperQualityType;
      
      itemType = 'Master Sheet';
      const qualityLabel = getPaperQualityLabel(paperQuality_val);
      itemGroup = qualityLabel as ItemGroupType; 

      specificName = `${qualityLabel} ${paperGsm_val}GSM ${masterSheetSizeWidth_val.toFixed(2)}x${masterSheetSizeHeight_val.toFixed(2)}in`.trim();
      specificSpecification = `${paperGsm_val}GSM ${qualityLabel}, ${masterSheetSizeWidth_val.toFixed(2)}in x ${masterSheetSizeHeight_val.toFixed(2)}in`;
    
    } else if (data.category === 'INKS') {
      if (!data.inkName || data.inkName.trim() === '') { 
         throw new Error("Ink Name is required for INKS category.");
      }
      itemType = 'Ink';
      itemGroup = 'Inks';
      specificName = data.inkName;
      specificSpecification = data.inkSpecification || 'N/A';
    } else if (data.category === 'PLASTIC_TRAY') {
      itemType = 'Plastic Tray';
      itemGroup = 'Plastic Trays';
      specificName = data.itemName || "Plastic Tray";
    } else if (data.category === 'GLASS_JAR') {
      itemType = 'Glass Jar';
      itemGroup = 'Glass Jars';
      specificName = data.itemName || "Glass Jar";
    } else if (data.category === 'MAGNET') {
      itemType = 'Magnet';
      itemGroup = 'Magnets';
      specificName = data.itemName || "Magnet";
    } else { 
        if (!data.itemName || data.itemName.trim() === '') { 
             throw new Error("Item Name is required for OTHER category.");
        }
        itemType = 'Other';
        itemGroup = 'Other Stock';
        specificName = data.itemName;
    }

    const newItem: InventoryItem = {
      id: `inv${currentInventoryCounter}`,
      name: specificName,
      type: itemType,
      itemGroup: itemGroup,
      specification: specificSpecification,
      paperGsm: paperGsm_val,
      paperQuality: paperQuality_val,
      masterSheetSizeWidth: masterSheetSizeWidth_val,
      masterSheetSizeHeight: masterSheetSizeHeight_val,
      availableStock: data.availableStock,
      unit: data.unit as UnitValue,
      reorderPoint: data.reorderPoint,
      purchaseBillNo: data.purchaseBillNo,
      vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
      dateOfEntry: data.dateOfEntry,
    };

    global.__inventoryItemsStore__!.push(newItem);
    global.__inventoryCounter__ = currentInventoryCounter + 1;

    const initialAdjustment: InventoryAdjustment = {
        id: `adj${global.__adjustmentCounter__!++}`,
        inventoryItemId: newItem.id,
        date: new Date().toISOString(),
        quantityChange: newItem.availableStock,
        reason: INVENTORY_ADJUSTMENT_REASONS.find(r => r.value === 'INITIAL_STOCK')!.value,
        reference: data.purchaseBillNo || 'Initial Entry',
        notes: 'Initial stock added via Add Item form.',
    };
    global.__inventoryAdjustmentsStore__!.push(initialAdjustment);


    console.log('[InventoryManagement] Added inventory item. Current store size:', global.__inventoryItemsStore__!.length, 'New item ID:', newItem.id);
    revalidatePath('/inventory');
    return { success: true, message: 'Inventory item added successfully!', item: newItem };
  } catch (error) {
    console.error('[InventoryManagement Error] Error adding inventory item:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while adding the item.';
    return { success: false, message: `Failed to add inventory item: ${errorMessage}` };
  }
}

export async function getInventoryAdjustmentsForItem(inventoryItemId: string): Promise<InventoryAdjustment[]> {
  if (!global.__inventoryAdjustmentsStore__) {
    return [];
  }
  return global.__inventoryAdjustmentsStore__
    .filter(adj => adj.inventoryItemId === inventoryItemId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending
}
