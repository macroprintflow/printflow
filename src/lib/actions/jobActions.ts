
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

// This is the source for initial inventory items. It's set to empty.
const initialInventoryItems: InventoryItem[] = [];

if (!global.__jobCards__) {
  global.__jobCards__ = [];
}
if (typeof global.__jobCounter__ === 'undefined') {
  global.__jobCounter__ = 1;
}

const initialJobTemplates: JobTemplateData[] = [
    { id: 'template1', name: 'Golden Tray (Predefined)', kindOfJob: 'METPET', coating: 'VARNISH_GLOSS', hotFoilStamping: 'GOLDEN', paperQuality: 'GOLDEN_SHEET' },
    { id: 'template2', name: 'Rigid Top and Bottom Box (Predefined)', boxMaking: 'COMBINED', pasting: 'YES', paperQuality: 'WG_KAPPA' },
    { id: 'template3', name: 'Monocarton Box (Predefined)', kindOfJob: 'NORMAL', paperQuality: 'SBS' },
];

if (!global.__jobTemplatesStore__) {
  global.__jobTemplatesStore__ = [...initialJobTemplates];
}
if (typeof global.__templateCounter__ === 'undefined') {
  global.__templateCounter__ = initialJobTemplates.length + 1;
}

// Ensures inventory store starts empty if initialInventoryItems is empty.
if (!global.__inventoryItemsStore__ || initialInventoryItems.length === 0) {
  console.log('[InventoryManagement] Initializing/Resetting global inventory store to be empty.');
  global.__inventoryItemsStore__ = [...initialInventoryItems]; // which is []
}

if (typeof global.__inventoryCounter__ === 'undefined') {
    global.__inventoryCounter__ = 1;
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

    console.log('Created job card:', newJobCard);
    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job card created successfully!', jobCard: newJobCard };
  } catch (error) {
    console.error('Error creating job card:', error);
    return { success: false, message: 'Failed to create job card.' };
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
  try {
    const targetQuality = jobInput.paperQuality;
    const targetGsm = jobInput.paperGsm;

    console.log(`[InventoryOptimization Debug] Job Input: GSM=${targetGsm}, Quality=${targetQuality}, Size=${jobInput.jobSizeWidth}x${jobInput.jobSizeHeight}, Qty=${jobInput.netQuantity}`);
    
    const allInventory = await getInventoryItems();
    console.log('[InventoryOptimization Debug] Full inventory fetched:', JSON.stringify(allInventory.map(i => ({id: i.id, name: i.name, type: i.type, w: i.masterSheetSizeWidth, h: i.masterSheetSizeHeight, gsm: i.paperGsm, quality: i.paperQuality})), null, 2));
    
    const availableMasterSheets: AvailableSheet[] = [];

    for (const item of allInventory) {
      let sheetData: AvailableSheet;
      // Check if item has the basic properties of a master sheet
      if (item.masterSheetSizeWidth && item.masterSheetSizeWidth > 0 &&
          item.masterSheetSizeHeight && item.masterSheetSizeHeight > 0 &&
          item.paperGsm && item.paperGsm > 0 &&
          item.paperQuality && item.paperQuality !== '') {
        // Item looks like a sheet, use its actual properties
        sheetData = {
          id: item.id,
          masterSheetSizeWidth: item.masterSheetSizeWidth,
          masterSheetSizeHeight: item.masterSheetSizeHeight,
          paperGsm: item.paperGsm,
          paperQuality: item.paperQuality,
        };
        console.log(`[InventoryOptimization Debug] Item ${item.id} ('${item.name}') is a sheet. Adding to AI list with actual values.`);
      } else {
        // Item doesn't look like a sheet, provide defaults to satisfy AvailableSheetSchema
        // The AI is expected to filter this out if it's not usable based on its prompt.
        sheetData = {
          id: item.id,
          masterSheetSizeWidth: 0, // Default
          masterSheetSizeHeight: 0, // Default
          paperGsm: 0, // Default
          paperQuality: item.name || 'N/A_ITEM_TYPE', // Use item name or a placeholder for quality
        };
        console.log(`[InventoryOptimization Debug] Item ${item.id} ('${item.name}') is NOT a standard sheet. Sending with defaults to AI.`);
      }
      availableMasterSheets.push(sheetData);
    }

    console.log('[InventoryOptimization Debug] Available master sheets being sent to AI (includes all items, with defaults for non-sheets):', JSON.stringify(availableMasterSheets, null, 2));
    
    if (availableMasterSheets.length === 0 && allInventory.length > 0) {
      // This case should ideally not be hit if we're forcing all items through,
      // but good for sanity if allInventory itself was empty.
      console.log('[InventoryOptimization Debug] No items from inventory could be formatted for AI (allInventory might be empty or all items lacked an ID).');
      return { suggestions: [], optimalSuggestion: undefined };
    }
     if (allInventory.length === 0) {
      console.log('[InventoryOptimization Debug] Inventory is empty. No items to send to AI.');
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

    const result = await optimizeInventory(aiInput);
    console.log('[InventoryOptimization Debug] Raw AI Output:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('Error fetching inventory optimization suggestions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions.';
    return { error: `Failed to fetch inventory optimization suggestions: ${errorMessage}` };
  }
}


export async function getJobTemplates(): Promise<JobTemplateData[]> {
  if (!global.__jobTemplatesStore__) {
    global.__jobTemplatesStore__ = [...initialJobTemplates];
  }
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

    console.log('Created job template:', newTemplate);
    revalidatePath('/templates');
    revalidatePath('/templates/new');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job template created successfully!', template: newTemplate };
  } catch (error) {
    console.error('Error creating job template:', error);
    return { success: false, message: 'Failed to create job template.' };
  }
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  if (!global.__inventoryItemsStore__) {
      console.log('[InventoryManagement] __inventoryItemsStore__ was undefined, initializing to empty array.');
      global.__inventoryItemsStore__ = []; 
  }
  return [...global.__inventoryItemsStore__!]; 
}

export async function addInventoryItem(data: InventoryItemFormValues): Promise<{ success: boolean; message: string; item?: InventoryItem }> {
  try {
    const currentInventoryCounter = global.__inventoryCounter__!;
    let itemType: InventoryItemType = 'Other';
    let itemGroup: ItemGroupType = 'Other Stock';
    
    let specificName = data.itemName; 
    let specificSpecification = data.itemSpecification || '';

    let masterSheetSizeWidth: number | undefined = undefined;
    let masterSheetSizeHeight: number | undefined = undefined;
    let paperGsm: number | undefined = undefined;
    let paperQuality: PaperQualityType | undefined = undefined;


    if (data.category === 'PAPER') {
      masterSheetSizeWidth = data.paperMasterSheetSizeWidth!;
      masterSheetSizeHeight = data.paperMasterSheetSizeHeight!;
      paperGsm = data.paperGsm!;
      paperQuality = data.paperQuality as PaperQualityType;
      
      itemType = 'Master Sheet'; // Ensuring it's Master Sheet for paper category with dimensions
      itemGroup = getPaperQualityLabel(paperQuality) as ItemGroupType; 

      specificName = `${getPaperQualityLabel(paperQuality)} ${paperGsm}GSM ${masterSheetSizeWidth.toFixed(2)}x${masterSheetSizeHeight.toFixed(2)}in`.trim();
      specificSpecification = `${paperGsm}GSM ${getPaperQualityLabel(paperQuality)}, ${masterSheetSizeWidth.toFixed(2)}in x ${masterSheetSizeHeight.toFixed(2)}in`;
    
    } else if (data.category === 'INKS') {
      itemType = 'Ink';
      itemGroup = 'Inks';
      specificName = data.inkName || 'Unnamed Ink';
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
    } else { // OTHER
        itemType = 'Other';
        itemGroup = 'Other Stock';
        specificName = data.itemName || "Miscellaneous Item";
    }


    const newItem: InventoryItem = {
      id: `inv${currentInventoryCounter}`,
      name: specificName,
      type: itemType,
      itemGroup: itemGroup,
      specification: specificSpecification,
      paperGsm: paperGsm,
      paperQuality: paperQuality,
      masterSheetSizeWidth: masterSheetSizeWidth,
      masterSheetSizeHeight: masterSheetSizeHeight,
      availableStock: data.availableStock,
      unit: data.unit as UnitValue,
      reorderPoint: data.reorderPoint,
      purchaseBillNo: data.purchaseBillNo,
      vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
      dateOfEntry: data.dateOfEntry,
    };

    if (!global.__inventoryItemsStore__) {
        console.log('[InventoryManagement] __inventoryItemsStore__ was undefined before push, initializing.');
        global.__inventoryItemsStore__ = [];
    }
    global.__inventoryItemsStore__.push(newItem);
    global.__inventoryCounter__ = currentInventoryCounter + 1;

    console.log('[InventoryManagement] Added inventory item:', JSON.stringify(newItem, null, 2));
    revalidatePath('/inventory');
    return { success: true, message: 'Inventory item added successfully!', item: newItem };
  } catch (error)
   {
    console.error('Error adding inventory item:', error);
    return { success: false, message: 'Failed to add inventory item.' };
  }
}
    