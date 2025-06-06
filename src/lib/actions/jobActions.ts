
'use server';

import type { JobCardFormValues, JobCardData, JobTemplateData, JobTemplateFormValues, InventoryItem, PaperQualityType, InventorySuggestion, InventoryItemFormValues, InventoryItemType, ItemGroupType, UnitValue } from '@/lib/definitions';
import { PAPER_QUALITY_OPTIONS, getPaperQualityLabel } from '@/lib/definitions';
import { optimizeInventory, type OptimizeInventoryInput, type OptimizeInventoryOutput, type AvailableSheet } from '@/ai/flows/inventory-optimization';
import { revalidatePath } from 'next/cache';

declare global {
  var __jobCards__: JobCardData[] | undefined;
  var __jobCounter__: number | undefined;
  var __jobTemplatesStore__: JobTemplateData[] | undefined;
  var __templateCounter__: number | undefined;
  var __inventoryItemsStore__: InventoryItem[] | undefined;
  var __inventoryCounter__: number | undefined;
}

// Initialize global stores if they don't exist
if (global.__jobCards__ === undefined) {
  global.__jobCards__ = [];
  console.log('[JobActions] Initialized global.__jobCards__');
}
if (global.__jobCounter__ === undefined) {
  global.__jobCounter__ = 1;
  console.log('[JobActions] Initialized global.__jobCounter__');
}

const initialJobTemplates: JobTemplateData[] = [
    { id: 'template1', name: 'Golden Tray (Predefined)', kindOfJob: 'METPET', coating: 'VARNISH_GLOSS', hotFoilStamping: 'GOLDEN', paperQuality: 'GOLDEN_SHEET' },
    { id: 'template2', name: 'Rigid Top and Bottom Box (Predefined)', boxMaking: 'COMBINED', pasting: 'YES', paperQuality: 'WG_KAPPA' },
    { id: 'template3', name: 'Monocarton Box (Predefined)', kindOfJob: 'NORMAL', paperQuality: 'SBS' },
];
if (global.__jobTemplatesStore__ === undefined) {
  global.__jobTemplatesStore__ = [...initialJobTemplates];
  console.log('[JobActions] Initialized global.__jobTemplatesStore__');
}
if (global.__templateCounter__ === undefined) {
  global.__templateCounter__ = initialJobTemplates.length + 1;
  console.log('[JobActions] Initialized global.__templateCounter__');
}

if (global.__inventoryItemsStore__ === undefined) {
  console.log('[InventoryManagement] Global inventory ITEMS store was UNDEFINED. Initializing to empty array.');
  global.__inventoryItemsStore__ = [];
} else {
  console.log('[InventoryManagement] Global inventory ITEMS store already exists. Count:', global.__inventoryItemsStore__.length);
}

if (global.__inventoryCounter__ === undefined) {
  console.log('[InventoryManagement] Global inventory COUNTER was UNDEFINED. Initializing to 1.');
  global.__inventoryCounter__ = 1;
} else {
   console.log('[InventoryManagement] Global inventory COUNTER already exists. Value:', global.__inventoryCounter__);
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
): Promise<OptimizeInventoryOutput | { error: string }> { // Removed debugLog from return type
  console.log('[JobActions] === Get Inventory Optimization Suggestions START ===');
  console.log('[JobActions] Job Input received:', JSON.stringify(jobInput, null, 2));

  try {
    if (!jobInput.paperQuality || jobInput.paperQuality === "") {
        console.log('[JobActions] Target paper quality from jobInput is empty. Returning empty suggestions immediately.');
        return { suggestions: [], optimalSuggestion: undefined };
    }
    
    const allInventory = await getInventoryItems();
    console.log(`[JobActions] Full inventory fetched (${allInventory.length} items). Preview (first 5):`, JSON.stringify(allInventory.slice(0, 5), null, 2));

    const availableMasterSheets: AvailableSheet[] = [];
    const targetQualityLower = jobInput.paperQuality.toLowerCase();

    console.log(`[JobActions] Filtering inventory. Target Quality (lowercase): '${targetQualityLower}'`);

    for (const item of allInventory) {
      console.log(`[JobActions] Processing item ID: ${item.id}, Name: '${item.name}', W: ${item.masterSheetSizeWidth}, H: ${item.masterSheetSizeHeight}, GSM: ${item.paperGsm}, Quality: '${item.paperQuality}'`);

      const hasRequiredSheetFields =
        item.masterSheetSizeWidth && item.masterSheetSizeWidth > 0 &&
        item.masterSheetSizeHeight && item.masterSheetSizeHeight > 0 &&
        item.paperGsm && item.paperGsm > 0 &&
        item.paperQuality && item.paperQuality !== '';
      console.log(`[JobActions] Item ID: ${item.id} - Check 'hasRequiredSheetFields': ${hasRequiredSheetFields}`);

      if (!hasRequiredSheetFields) {
        console.log(`[JobActions] Item ID: ${item.id} - Filtered out: Missing critical master sheet fields.`);
        continue;
      }

      const itemQualityLower = item.paperQuality!.toLowerCase(); 
      const qualityMatch = itemQualityLower === targetQualityLower;
      console.log(`[JobActions] Item ID: ${item.id} - Check 'qualityMatch' (ItemQ: '${itemQualityLower}', TargetQ: '${targetQualityLower}'): ${qualityMatch}`);
      
      if (qualityMatch) {
        console.log(`[JobActions] Item ID: ${item.id} - Passed JS filters. Adding to AI candidate list.`);
        availableMasterSheets.push({
          id: item.id,
          masterSheetSizeWidth: item.masterSheetSizeWidth!,
          masterSheetSizeHeight: item.masterSheetSizeHeight!,
          paperGsm: item.paperGsm!,
          paperQuality: item.paperQuality!,
        });
      } else {
        console.log(`[JobActions] Item ID: ${item.id} - Filtered out: Quality mismatch.`);
      }
    }
    
    console.log(`[JobActions] JavaScript filtering complete. ${availableMasterSheets.length} sheets are candidates for AI.`);
    if (availableMasterSheets.length > 0) {
        console.log('[JobActions] Candidate sheets (first 5):', JSON.stringify(availableMasterSheets.slice(0,5), null, 2));
    }


    if (availableMasterSheets.length === 0) {
      console.log('[JobActions] No master sheets passed JavaScript filters. Bypassing AI and returning empty suggestions.');
      console.log('[JobActions] === Get Inventory Optimization Suggestions END (No suitable sheets found by JS filter) ===');
      return { suggestions: [], optimalSuggestion: undefined };
    }
    
    const aiInput: OptimizeInventoryInput = {
      targetPaperGsm: jobInput.paperGsm,
      targetPaperQuality: jobInput.paperQuality, 
      jobSizeWidth: jobInput.jobSizeWidth,
      jobSizeHeight: jobInput.jobSizeHeight,
      netQuantity: jobInput.netQuantity,
      availableMasterSheets: availableMasterSheets,
    };

    console.log('[JobActions] Calling AI flow `optimizeInventory` with input (availableMasterSheets count):', aiInput.availableMasterSheets.length);
    const result = await optimizeInventory(aiInput);
    console.log('[JobActions] Raw AI Output from `optimizeInventory` flow:', JSON.stringify(result, null, 2));
    console.log('[JobActions] === Get Inventory Optimization Suggestions END ===');
    
    return result; // result is OptimizeInventoryOutput, which no longer has debugLog

  } catch (error) {
    console.error('[JobActions Error] Error in getInventoryOptimizationSuggestions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions.';
    console.log('[JobActions] === Get Inventory Optimization Suggestions END (Error) ===');
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
  // Ensured by module-level initialization
  if (global.__inventoryItemsStore__ === undefined) {
     console.warn("[InventoryManagement] getInventoryItems: __inventoryItemsStore__ was undefined! Re-initializing to empty for safety, but this is unexpected.");
     global.__inventoryItemsStore__ = [];
  }
  console.log('[InventoryManagement] getInventoryItems: Returning store. Count:', global.__inventoryItemsStore__!.length);
  return [...global.__inventoryItemsStore__!]; 
}

export async function addInventoryItem(data: InventoryItemFormValues): Promise<{ success: boolean; message: string; item?: InventoryItem }> {
  try {
    // Defensive initialization
    if (global.__inventoryItemsStore__ === undefined) {
      console.warn("CRITICAL: __inventoryItemsStore__ undefined in addInventoryItem at start. Initializing.");
      global.__inventoryItemsStore__ = [];
    }
    if (global.__inventoryCounter__ === undefined) {
      console.warn("CRITICAL: __inventoryCounter__ undefined in addInventoryItem at start. Initializing.");
      global.__inventoryCounter__ = (global.__inventoryItemsStore__?.length || 0) + 1;
    }

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

    console.log('[InventoryManagement] Added inventory item. Current store size:', global.__inventoryItemsStore__!.length, 'New item ID:', newItem.id);
    revalidatePath('/inventory');
    return { success: true, message: 'Inventory item added successfully!', item: newItem };
  } catch (error) {
    console.error('[InventoryManagement Error] Error adding inventory item:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while adding the item.';
    return { success: false, message: `Failed to add inventory item: ${errorMessage}` };
  }
}

    