
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

const initialInventoryItems: InventoryItem[] = [];

// Corrected initialization logic:
// Only initialize from initialInventoryItems if the global store doesn't exist yet.
if (typeof global.__inventoryItemsStore__ === 'undefined') {
  console.log('[InventoryManagement] Global inventory store UNDEFINED, initializing from initialInventoryItems (which is empty).');
  global.__inventoryItemsStore__ = [...initialInventoryItems];
} else {
  // This case means the store exists. We don't want to overwrite it here.
  // console.log('[InventoryManagement] Global inventory store already exists. Count:', global.__inventoryItemsStore__.length);
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

    console.log('[JobActions] Created job card:', newJobCard.jobCardNumber);
    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job card created successfully!', jobCard: newJobCard };
  } catch (error) {
    console.error('[JobActions Error] Error creating job card:', error);
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
): Promise<OptimizeInventoryOutput | { error: string; debugLog?: string }> {
  let currentDebugLog = "=== Get Inventory Optimization Suggestions START ===\n";
  currentDebugLog += `Job Input received: ${JSON.stringify(jobInput, null, 2)}\n`;

  try {
    if (!jobInput.paperQuality || jobInput.paperQuality === "") {
        currentDebugLog += "Target paper quality from jobInput is empty. Returning empty suggestions immediately.\n";
        console.log(currentDebugLog); // Log before returning
        return { suggestions: [], optimalSuggestion: undefined, debugLog: currentDebugLog };
    }
    
    const allInventory = await getInventoryItems(); // This will now hopefully get the persistent items
    currentDebugLog += `Full inventory fetched (${allInventory.length} items).\n`;
    if (allInventory.length > 0) {
      currentDebugLog += `Full list: ${JSON.stringify(allInventory, null, 2)}\n`;
    } else {
      currentDebugLog += `Full list: []\n`;
    }


    const availableMasterSheets: AvailableSheet[] = [];
    const targetQualityLower = jobInput.paperQuality.toLowerCase();

    currentDebugLog += `Filtering inventory. Target Quality (lowercase): '${targetQualityLower}'\n`;

    for (const item of allInventory) {
      currentDebugLog += `Processing item ID: ${item.id}, Name: '${item.name}', W: ${item.masterSheetSizeWidth}, H: ${item.masterSheetSizeHeight}, GSM: ${item.paperGsm}, Quality: '${item.paperQuality}'\n`;

      const hasRequiredSheetFields =
        item.masterSheetSizeWidth && item.masterSheetSizeWidth > 0 &&
        item.masterSheetSizeHeight && item.masterSheetSizeHeight > 0 &&
        item.paperGsm && item.paperGsm > 0 &&
        item.paperQuality && item.paperQuality !== '';
      currentDebugLog += `  Item ID: ${item.id} - Check 'hasRequiredSheetFields': ${hasRequiredSheetFields}\n`;

      if (!hasRequiredSheetFields) {
        currentDebugLog += `  Item ID: ${item.id} - Filtered out: Missing critical master sheet fields.\n`;
        continue;
      }

      const itemQualityLower = item.paperQuality!.toLowerCase(); // `item.paperQuality` is checked in hasRequiredSheetFields
      const qualityMatch = itemQualityLower === targetQualityLower;
      currentDebugLog += `  Item ID: ${item.id} - Check 'qualityMatch' (ItemQ: '${itemQualityLower}', TargetQ: '${targetQualityLower}'): ${qualityMatch}\n`;
      
      if (qualityMatch) {
        currentDebugLog += `  Item ID: ${item.id} - Passed JS filters. Adding to AI candidate list.\n`;
        availableMasterSheets.push({
          id: item.id,
          masterSheetSizeWidth: item.masterSheetSizeWidth!,
          masterSheetSizeHeight: item.masterSheetSizeHeight!,
          paperGsm: item.paperGsm!,
          paperQuality: item.paperQuality!,
        });
      } else {
        currentDebugLog += `  Item ID: ${item.id} - Filtered out: Quality mismatch.\n`;
      }
    }
    
    currentDebugLog += `JavaScript filtering complete. ${availableMasterSheets.length} sheets are candidates for AI.\n`;
    if (availableMasterSheets.length > 0) {
        currentDebugLog += `Candidate sheets (first 5): ${JSON.stringify(availableMasterSheets.slice(0,5), null, 2)}\n`;
    }


    if (availableMasterSheets.length === 0) {
      currentDebugLog += "No master sheets passed JavaScript filters (e.g., quality match). Bypassing AI and returning empty suggestions.\n";
      currentDebugLog += "=== Get Inventory Optimization Suggestions END (No suitable sheets found by JS filter) ===\n";
      console.log(currentDebugLog); // Log before returning
      return { suggestions: [], optimalSuggestion: undefined, debugLog: currentDebugLog };
    }
    
    const aiInput: OptimizeInventoryInput = {
      targetPaperGsm: jobInput.paperGsm,
      targetPaperQuality: jobInput.paperQuality, 
      jobSizeWidth: jobInput.jobSizeWidth,
      jobSizeHeight: jobInput.jobSizeHeight,
      netQuantity: jobInput.netQuantity,
      availableMasterSheets: availableMasterSheets,
    };

    currentDebugLog += `Calling AI flow 'optimizeInventory' with input: ${JSON.stringify(aiInput, (key, value) => key === 'availableMasterSheets' ? `${value.length} sheets (full list logged above or by AI flow)` : value, 2)}\n`;
    
    // The result from AI flow already includes its own debugLog if any.
    const result = await optimizeInventory(aiInput); 
    
    let aiFlowDebugLog = "";
    if ('debugLog' in result && result.debugLog) {
      aiFlowDebugLog = `\n--- AI Flow Internal Log ---\n${result.debugLog}`;
    }
    
    currentDebugLog += `Raw AI Output from 'optimizeInventory' flow: ${JSON.stringify(result, null, 2)}\n`;
    currentDebugLog += "=== Get Inventory Optimization Suggestions END ===\n";
    console.log(currentDebugLog + aiFlowDebugLog); // Log combined debug info

    // Ensure the final returned object also carries the combined debugLog for the UI
    const finalResult: OptimizeInventoryOutput = {
        suggestions: result.suggestions || [],
        optimalSuggestion: result.optimalSuggestion,
        debugLog: currentDebugLog + aiFlowDebugLog,
    };
    return finalResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions.';
    currentDebugLog += `Error in getInventoryOptimizationSuggestions: ${errorMessage}\nStack: ${error instanceof Error ? error.stack : 'N/A'}\n`;
    currentDebugLog += "=== Get Inventory Optimization Suggestions END (Error) ===\n";
    console.error(currentDebugLog); // Log error details
    return { error: `Failed to fetch inventory optimization suggestions: ${errorMessage}`, debugLog: currentDebugLog };
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

    console.log('[JobActions] Created job template:', newTemplate.name);
    revalidatePath('/templates');
    revalidatePath('/templates/new');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job template created successfully!', template: newTemplate };
  } catch (error) {
    console.error('[JobActions Error] Error creating job template:', error);
    return { success: false, message: 'Failed to create job template.' };
  }
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  // Ensure the store is initialized if it's undefined
  if (typeof global.__inventoryItemsStore__ === 'undefined') {
      console.log('[InventoryManagement][getInventoryItems] Global inventory store UNDEFINED, initializing to empty array.');
      global.__inventoryItemsStore__ = []; 
  }
  // console.log('[InventoryManagement][getInventoryItems] Fetching items. Current store size:', global.__inventoryItemsStore__.length);
  return [...global.__inventoryItemsStore__!]; // Return a copy
}

export async function addInventoryItem(data: InventoryItemFormValues): Promise<{ success: boolean; message: string; item?: InventoryItem }> {
  try {
    // Ensure the store is initialized if it's undefined
    if (typeof global.__inventoryItemsStore__ === 'undefined') {
        console.log('[InventoryManagement][addInventoryItem] Global inventory store UNDEFINED during add, initializing to empty array.');
        global.__inventoryItemsStore__ = [];
    }
    if (typeof global.__inventoryCounter__ === 'undefined') { // Ensure counter is also initialized
        global.__inventoryCounter__ = 1;
    }


    const currentInventoryCounter = global.__inventoryCounter__!;
    let itemType: InventoryItemType = 'Other';
    let itemGroup: ItemGroupType = 'Other Stock';
    
    let specificName = data.itemName; 
    let specificSpecification = data.itemSpecification || '';

    let masterSheetSizeWidth: number | undefined = undefined;
    let masterSheetSizeHeight: number | undefined = undefined;
    let paperGsm: number | undefined = undefined;
    let paperQuality: PaperQualityType | undefined = paperQuality = data.paperQuality as PaperQualityType || undefined;


    if (data.category === 'PAPER') {
      masterSheetSizeWidth = data.paperMasterSheetSizeWidth!;
      masterSheetSizeHeight = data.paperMasterSheetSizeHeight!;
      paperGsm = data.paperGsm!;
      // paperQuality is already assigned above
      
      itemType = 'Master Sheet';
      const qualityLabel = paperQuality ? getPaperQualityLabel(paperQuality) : "UnknownPaper";
      itemGroup = qualityLabel as ItemGroupType; 

      specificName = `${qualityLabel} ${paperGsm}GSM ${masterSheetSizeWidth?.toFixed(2)}x${masterSheetSizeHeight?.toFixed(2)}in`.trim();
      specificSpecification = `${paperGsm}GSM ${qualityLabel}, ${masterSheetSizeWidth?.toFixed(2)}in x ${masterSheetSizeHeight?.toFixed(2)}in`;
      // console.log(`[InventoryManagement] Adding PAPER item. Category: ${data.category}, Name: ${specificName}, Quality: ${paperQuality}, GSM: ${paperGsm}, W: ${masterSheetSizeWidth}, H: ${masterSheetSizeHeight}`);
    
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
        // For 'OTHER', paperQuality, paperGsm, etc., will remain undefined unless explicitly set by future form fields for 'OTHER'
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

    global.__inventoryItemsStore__.push(newItem);
    global.__inventoryCounter__ = currentInventoryCounter + 1;

    console.log(`[InventoryManagement] Added inventory item. Current store size: ${global.__inventoryItemsStore__.length}. New item: ${JSON.stringify(newItem, null, 2)}`);
    revalidatePath('/inventory');
    return { success: true, message: 'Inventory item added successfully!', item: newItem };
  } catch (error) {
    console.error('[InventoryManagement Error] Error adding inventory item:', error);
    return { success: false, message: 'Failed to add inventory item.' };
  }
}
    
