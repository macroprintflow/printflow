
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

// Ensures inventory store starts empty.
const initialInventoryItems: InventoryItem[] = [];

// Ensures inventory store is reset if initialInventoryItems is empty.
if (!global.__inventoryItemsStore__ || initialInventoryItems.length === 0) {
  console.log('[InventoryManagement] Initializing/Resetting global inventory store to be empty because initialInventoryItems is empty.');
  global.__inventoryItemsStore__ = [...initialInventoryItems];
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
    console.log('[InventoryOptimization Debug] Job Input:', JSON.stringify(jobInput, null, 2));
    
    const allInventory = await getInventoryItems();
    console.log('[InventoryOptimization Debug] Full inventory fetched:', JSON.stringify(allInventory, null, 2));

    // --- DEBUG MODE: Bypass AI and show all inventory items as suggestions ---
    const debugSuggestions: InventorySuggestion[] = allInventory.map(item => {
      // Attempt to get sheet-specific properties, or use defaults
      const masterSheetSizeWidth = typeof item.masterSheetSizeWidth === 'number' ? item.masterSheetSizeWidth : 0;
      const masterSheetSizeHeight = typeof item.masterSheetSizeHeight === 'number' ? item.masterSheetSizeHeight : 0;
      const paperGsm = typeof item.paperGsm === 'number' ? item.paperGsm : 0;
      const paperQuality = typeof item.paperQuality === 'string' && item.paperQuality !== '' ? item.paperQuality : 'N/A';

      return {
        sourceInventoryItemId: item.id,
        masterSheetSizeWidth: masterSheetSizeWidth,
        masterSheetSizeHeight: masterSheetSizeHeight,
        paperGsm: paperGsm,
        paperQuality: paperQuality,
        wastagePercentage: 0, // Placeholder
        sheetsPerMasterSheet: (masterSheetSizeWidth > 0 && masterSheetSizeHeight > 0) ? 1 : 0, // Basic placeholder
        totalMasterSheetsNeeded: item.availableStock, // Using available stock for this field in debug
        cuttingLayoutDescription: `DEBUG: ${item.name} (Type: ${item.type})`,
      };
    });

    console.log('[InventoryOptimization Debug] DEBUG MODE: Returning all inventory items as suggestions:', JSON.stringify(debugSuggestions, null, 2));
    return { suggestions: debugSuggestions, optimalSuggestion: undefined };
    // --- END DEBUG MODE ---

    /* // Original AI Path (commented out for debug)
    const availableMasterSheets: AvailableSheet[] = [];
    for (const item of allInventory) {
      if (
        item.masterSheetSizeWidth && item.masterSheetSizeWidth > 0 &&
        item.masterSheetSizeHeight && item.masterSheetSizeHeight > 0 &&
        item.paperGsm && item.paperGsm > 0 &&
        item.paperQuality && item.paperQuality !== ''
      ) {
        console.log(`[InventoryOptimization Debug] Item ${item.id} ('${item.name}') is a potential sheet. W=${item.masterSheetSizeWidth}, H=${item.masterSheetSizeHeight}, GSM=${item.paperGsm}, Q=${item.paperQuality}. Adding to AI input.`);
        availableMasterSheets.push({
          id: item.id,
          masterSheetSizeWidth: item.masterSheetSizeWidth,
          masterSheetSizeHeight: item.masterSheetSizeHeight,
          paperGsm: item.paperGsm,
          paperQuality: item.paperQuality,
        });
      } else {
        console.log(`[InventoryOptimization Debug] Filtering out item ${item.id} ('${item.name}') from AI input due to missing/invalid critical master sheet fields. W=${item.masterSheetSizeWidth}, H=${item.masterSheetSizeHeight}, GSM=${item.paperGsm}, Q=${item.paperQuality}`);
      }
    }

    console.log('[InventoryOptimization Debug] Available master sheets being sent to AI:', JSON.stringify(availableMasterSheets, null, 2));
    
    if (availableMasterSheets.length === 0) {
      console.log('[InventoryOptimization Debug] No suitable master sheets identified from inventory to send to AI after filtering for valid sheet properties.');
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

    // If AI is called with no sheets, it might hallucinate.
    // This check ensures we short-circuit if the JS-side filtering results in no valid sheets.
    if (!aiInput.availableMasterSheets || aiInput.availableMasterSheets.length === 0) {
      console.log('[InventoryOptimization AI Flow] Received empty or no availableMasterSheets. Returning empty suggestions.');
      return { suggestions: [], optimalSuggestion: undefined };
    }
    const result = await optimizeInventory(aiInput);
    console.log('[InventoryOptimization Debug] Raw AI Output:', JSON.stringify(result, null, 2));
    
    // Post-processing to ensure data types and rounding
    if (result?.suggestions) {
      result.suggestions.forEach(s => {
        s.masterSheetSizeWidth = parseFloat(Number(s.masterSheetSizeWidth || 0).toFixed(2));
        s.masterSheetSizeHeight = parseFloat(Number(s.masterSheetSizeHeight || 0).toFixed(2));
        s.paperGsm = Number(s.paperGsm || 0);
        s.wastagePercentage = parseFloat(Number(s.wastagePercentage || 0).toFixed(2));
        s.sheetsPerMasterSheet = Math.floor(Number(s.sheetsPerMasterSheet || 0));
        s.totalMasterSheetsNeeded = Math.ceil(Number(s.totalMasterSheetsNeeded || 0));
      });
    }
    if (result?.optimalSuggestion) {
       const opt = result.optimalSuggestion;
       opt.masterSheetSizeWidth = parseFloat(Number(opt.masterSheetSizeWidth || 0).toFixed(2));
       opt.masterSheetSizeHeight = parseFloat(Number(opt.masterSheetSizeHeight || 0).toFixed(2));
       opt.paperGsm = Number(opt.paperGsm || 0);
       opt.wastagePercentage = parseFloat(Number(opt.wastagePercentage || 0).toFixed(2));
       opt.sheetsPerMasterSheet = Math.floor(Number(opt.sheetsPerMasterSheet || 0));
       opt.totalMasterSheetsNeeded = Math.ceil(Number(opt.totalMasterSheetsNeeded || 0));
    }
    return result!;
    */ // End Original AI Path

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
      
      itemType = 'Master Sheet'; // This ensures it's considered a sheet type
      itemGroup = getPaperQualityLabel(paperQuality) as ItemGroupType; 

      // Standardize name and specification for paper items
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
    
