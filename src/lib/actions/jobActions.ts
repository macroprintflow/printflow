
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

if (!global.__inventoryItemsStore__ || initialInventoryItems.length === 0) {
  console.log('[InventoryManagement Server] Initializing global inventory store to be empty.');
  global.__inventoryItemsStore__ = [];
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

    // console.log('[JobActions] Created job card:', newJobCard.jobCardNumber);
    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job card created successfully!', jobCard: newJobCard };
  } catch (error) {
    // console.error('[JobActions Error] Error creating job card:', error);
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
  let debugLog = "=== Get Inventory Optimization Suggestions START ===\n";
  debugLog += `Job Input received: ${JSON.stringify(jobInput, null, 2)}\n`;

  try {
    if (!jobInput.paperQuality || jobInput.paperQuality === "") {
        debugLog += "Target paper quality from jobInput is empty. Returning empty suggestions immediately.\n";
        console.log(debugLog);
        return { suggestions: [], optimalSuggestion: undefined, debugLog };
    }
    
    const allInventory = await getInventoryItems();
    debugLog += `Full inventory fetched (${allInventory.length} items).\nFull list: ${JSON.stringify(allInventory, null, 2)}\n`;

    const availableMasterSheets: AvailableSheet[] = [];
    const targetQualityLower = jobInput.paperQuality.toLowerCase();

    debugLog += `Filtering inventory. Target Quality (lowercase): '${targetQualityLower}'\n`;

    for (const item of allInventory) {
      debugLog += `Processing item ID: ${item.id}, Name: '${item.name}', W: ${item.masterSheetSizeWidth}, H: ${item.masterSheetSizeHeight}, GSM: ${item.paperGsm}, Quality: '${item.paperQuality}'\n`;

      const hasRequiredSheetFields =
        item.masterSheetSizeWidth && item.masterSheetSizeWidth > 0 &&
        item.masterSheetSizeHeight && item.masterSheetSizeHeight > 0 &&
        item.paperGsm && item.paperGsm > 0 &&
        item.paperQuality && item.paperQuality !== '';
      debugLog += `  Item ID: ${item.id} - Check 'hasRequiredSheetFields': ${hasRequiredSheetFields}\n`;

      if (!hasRequiredSheetFields) {
        debugLog += `  Item ID: ${item.id} - Filtered out: Missing critical master sheet fields.\n`;
        continue;
      }

      const itemQualityLower = item.paperQuality!.toLowerCase();
      const qualityMatch = itemQualityLower === targetQualityLower;
      debugLog += `  Item ID: ${item.id} - Check 'qualityMatch' (ItemQ: '${itemQualityLower}', TargetQ: '${targetQualityLower}'): ${qualityMatch}\n`;
      
      if (qualityMatch) {
        debugLog += `  Item ID: ${item.id} - Passed JS filters. Adding to AI candidate list.\n`;
        availableMasterSheets.push({
          id: item.id,
          masterSheetSizeWidth: item.masterSheetSizeWidth!,
          masterSheetSizeHeight: item.masterSheetSizeHeight!,
          paperGsm: item.paperGsm!,
          paperQuality: item.paperQuality!,
        });
      } else {
        debugLog += `  Item ID: ${item.id} - Filtered out: Quality mismatch.\n`;
      }
    }
    
    debugLog += `JavaScript filtering complete. ${availableMasterSheets.length} sheets are candidates for AI.\n`;
    if (availableMasterSheets.length > 0) {
        debugLog += `Candidate sheets for AI: ${JSON.stringify(availableMasterSheets, null, 2)}\n`;
    }

    if (availableMasterSheets.length === 0) {
      debugLog += "No master sheets passed JavaScript filters. Bypassing AI and returning empty suggestions.\n";
      debugLog += "=== Get Inventory Optimization Suggestions END (No suitable sheets found by JS filter) ===\n";
      console.log(debugLog);
      return { suggestions: [], optimalSuggestion: undefined, debugLog };
    }
    
    const aiInput: OptimizeInventoryInput = {
      targetPaperGsm: jobInput.paperGsm,
      targetPaperQuality: jobInput.paperQuality, 
      jobSizeWidth: jobInput.jobSizeWidth,
      jobSizeHeight: jobInput.jobSizeHeight,
      netQuantity: jobInput.netQuantity,
      availableMasterSheets: availableMasterSheets,
    };

    debugLog += `Calling AI flow 'optimizeInventory' with input: ${JSON.stringify(aiInput, (key, value) => key === 'availableMasterSheets' ? `${value.length} sheets (full list logged above)` : value, 2)}\n`;
    
    const result = await optimizeInventory(aiInput);
    
    debugLog += `Raw AI Output from 'optimizeInventory' flow: ${JSON.stringify(result, null, 2)}\n`;
    debugLog += "=== Get Inventory Optimization Suggestions END ===\n";
    console.log(debugLog); // Log the full trace to server console
    
    // Ensure the result object has the debugLog property
    const finalResult: OptimizeInventoryOutput = {
        suggestions: result.suggestions || [],
        optimalSuggestion: result.optimalSuggestion,
        debugLog: debugLog + (result.debugLog ? `\n--- AI Flow Internal Log ---\n${result.debugLog}` : ""),
    };
    return finalResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions.';
    debugLog += `Error in getInventoryOptimizationSuggestions: ${errorMessage}\nStack: ${error instanceof Error ? error.stack : 'N/A'}\n`;
    debugLog += "=== Get Inventory Optimization Suggestions END (Error) ===\n";
    console.error(debugLog); // Log the full trace to server console
    return { error: `Failed to fetch inventory optimization suggestions: ${errorMessage}`, debugLog };
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

    // console.log('[JobActions] Created job template:', newTemplate.name);
    revalidatePath('/templates');
    revalidatePath('/templates/new');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job template created successfully!', template: newTemplate };
  } catch (error) {
    // console.error('[JobActions Error] Error creating job template:', error);
    return { success: false, message: 'Failed to create job template.' };
  }
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  if (!global.__inventoryItemsStore__) {
      // console.log('[InventoryManagement Server] __inventoryItemsStore__ was undefined, initializing to empty array.');
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
      
      itemType = 'Master Sheet';
      const qualityLabel = paperQuality ? getPaperQualityLabel(paperQuality) : "UnknownPaper";
      itemGroup = qualityLabel as ItemGroupType; 

      specificName = `${qualityLabel} ${paperGsm}GSM ${masterSheetSizeWidth?.toFixed(2)}x${masterSheetSizeHeight?.toFixed(2)}in`.trim();
      specificSpecification = `${paperGsm}GSM ${qualityLabel}, ${masterSheetSizeWidth?.toFixed(2)}in x ${masterSheetSizeHeight?.toFixed(2)}in`;
      // console.log(`[InventoryManagement Server] Adding PAPER item. Category: ${data.category}, Name: ${specificName}, Quality: ${paperQuality}, GSM: ${paperGsm}, W: ${masterSheetSizeWidth}, H: ${masterSheetSizeHeight}`);
    
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
    } else { 
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
        // console.log('[InventoryManagement Server] __inventoryItemsStore__ was undefined before push, initializing.');
        global.__inventoryItemsStore__ = [];
    }
    global.__inventoryItemsStore__.push(newItem);
    global.__inventoryCounter__ = currentInventoryCounter + 1;

    // console.log('[InventoryManagement Server] Added inventory item. Current store size:', global.__inventoryItemsStore__.length, 'New item:', JSON.stringify(newItem, null, 2));
    revalidatePath('/inventory');
    return { success: true, message: 'Inventory item added successfully!', item: newItem };
  } catch (error) {
    // console.error('[InventoryManagement Error] Error adding inventory item:', error);
    return { success: false, message: 'Failed to add inventory item.' };
  }
}
    
