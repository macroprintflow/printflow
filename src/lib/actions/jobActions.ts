
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

const initialInventoryItems: InventoryItem[] = [
  // Master Sheets with detailed properties
  { id: 'inv001', name: 'SBS 300GSM 27.56x39.37in', type: 'Master Sheet', itemGroup: 'SBS', specification: '300 GSM SBS, 27.56in x 39.37in', paperGsm: 300, paperQuality: 'SBS', masterSheetSizeWidth: 27.56, masterSheetSizeHeight: 39.37, availableStock: 5000, unit: 'inches', reorderPoint: 1000, dateOfEntry: new Date().toISOString() },
  { id: 'inv002', name: 'Art Paper Gloss 250GSM 28.35x40.16in', type: 'Master Sheet', itemGroup: 'Art Paper Gloss', specification: '250 GSM Art Paper Gloss, 28.35in x 40.16in', paperGsm: 250, paperQuality: 'ART_PAPER_GLOSS', masterSheetSizeWidth: 28.35, masterSheetSizeHeight: 40.16, availableStock: 3000, unit: 'inches', reorderPoint: 500, dateOfEntry: new Date().toISOString() },
  { id: 'inv003', name: 'Greyback 350GSM 25.59x35.43in', type: 'Master Sheet', itemGroup: 'Greyback', specification: '350 GSM Greyback, 25.59in x 35.43in', paperGsm: 350, paperQuality: 'GREYBACK', masterSheetSizeWidth: 25.59, masterSheetSizeHeight: 35.43, availableStock: 4500, unit: 'inches', reorderPoint: 800, dateOfEntry: new Date().toISOString() },
  { id: 'inv011', name: 'SBS 280GSM 25.20x18.90in', type: 'Master Sheet', itemGroup: 'SBS', specification: '280 GSM SBS, 25.20in x 18.90in', paperGsm: 280, paperQuality: 'SBS', masterSheetSizeWidth: 25.20, masterSheetSizeHeight: 18.90, availableStock: 2000, unit: 'inches', reorderPoint: 400, dateOfEntry: new Date().toISOString() },
  { id: 'inv012', name: 'WG Kappa 400GSM 19.69x27.56in', type: 'Master Sheet', itemGroup: 'WG Kappa', specification: '400 GSM WG Kappa, 19.69in x 27.56in', paperGsm: 400, paperQuality: 'WG_KAPPA', masterSheetSizeWidth: 19.69, masterSheetSizeHeight: 27.56, availableStock: 1500, unit: 'inches', reorderPoint: 300, dateOfEntry: new Date().toISOString() },
  { id: 'inv013', name: 'SBS 280GSM 27.56x39.37in', type: 'Master Sheet', itemGroup: 'SBS', specification: '280 GSM SBS, 27.56in x 39.37in', paperGsm: 280, paperQuality: 'SBS', masterSheetSizeWidth: 27.56, masterSheetSizeHeight: 39.37, availableStock: 500, unit: 'inches', reorderPoint: 100, dateOfEntry: new Date().toISOString() },
  { id: 'inv015', name: 'GG Kappa 320GSM 20x30in', type: 'Master Sheet', itemGroup: 'GG Kappa', specification: '320 GSM GG Kappa, 20in x 30in', paperGsm: 320, paperQuality: 'GG_KAPPA', masterSheetSizeWidth: 20, masterSheetSizeHeight: 30, availableStock: 1800, unit: 'inches', reorderPoint: 350, dateOfEntry: new Date().toISOString() },

  // Paper Stock (can also be used as master sheets if dimensions are suitable)
  { id: 'inv004', name: 'Art Paper Matt 300GSM', type: 'Paper Stock', itemGroup: 'Art Paper Matt', specification: '300 GSM, Art Paper Matt', paperGsm: 300, paperQuality: 'ART_PAPER_MATT', availableStock: 10000, unit: 'inches', reorderPoint: 2000, dateOfEntry: new Date().toISOString() },
  { id: 'inv005', name: 'Kraft Paper 120GSM', type: 'Paper Stock', itemGroup: 'Kraft Paper', specification: '120 GSM, Uncoated', paperGsm: 120, paperQuality: 'KRAFT_PAPER', availableStock: 8000, unit: 'inches', reorderPoint: 1500, dateOfEntry: new Date().toISOString() },
  { id: 'inv008', name: 'SBS 280GSM', type: 'Paper Stock', itemGroup: 'SBS', specification: '280 GSM, C1S', paperGsm: 280, paperQuality: 'SBS', availableStock: 7000, unit: 'inches', reorderPoint: 1200, dateOfEntry: new Date().toISOString() },
  { id: 'inv009', name: 'Greyback 400GSM', type: 'Paper Stock', itemGroup: 'Greyback', specification: '400 GSM, Coated', paperGsm: 400, paperQuality: 'GREYBACK', availableStock: 6000, unit: 'inches', reorderPoint: 1000, dateOfEntry: new Date().toISOString() },
  { id: 'inv014', name: 'GG Kappa 350GSM', type: 'Paper Stock', itemGroup: 'GG Kappa', specification: '350 GSM', paperGsm: 350, paperQuality: 'GG_KAPPA', availableStock: 2500, unit: 'inches', reorderPoint: 500, dateOfEntry: new Date().toISOString() },

  // Other items
  { id: 'inv006', name: 'Black Ink', type: 'Ink', itemGroup: 'Inks', specification: 'Process Black', availableStock: 50, unit: 'kg', reorderPoint: 10, dateOfEntry: new Date().toISOString() },
  { id: 'inv007', name: 'Pantone 185C', type: 'Ink', itemGroup: 'Inks', specification: 'Red', availableStock: 20, unit: 'kg', reorderPoint: 5, dateOfEntry: new Date().toISOString() },
  { id: 'inv010', name: 'Varnish Gloss', type: 'Other', itemGroup: 'Other Stock', specification: 'For Coating', availableStock: 100, unit: 'liters', reorderPoint: 20, dateOfEntry: new Date().toISOString() },
];

if (!global.__inventoryItemsStore__) {
  global.__inventoryItemsStore__ = [...initialInventoryItems];
}
if (typeof global.__inventoryCounter__ === 'undefined') {
    global.__inventoryCounter__ = initialInventoryItems.length + 1;
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
    const allInventory = await getInventoryItems(); // Uses global.__inventoryItemsStore__
    console.log('[InventoryOptimization] Full inventory fetched (first 5 items):', JSON.stringify(allInventory.slice(0,5).map(i => ({id: i.id, name: i.name, type: i.type, w: i.masterSheetSizeWidth, h: i.masterSheetSizeHeight, gsm: i.paperGsm, quality: i.paperQuality})), null, 2));
    console.log(`[InventoryOptimization] Job Input: GSM=${jobInput.paperGsm}, Quality=${jobInput.paperQuality}, Size=${jobInput.jobSizeWidth}x${jobInput.jobSizeHeight}, Qty=${jobInput.netQuantity}`);


    const { paperGsm: targetGsm, paperQuality: targetQuality } = jobInput;

    const availableMasterSheets: AvailableSheet[] = allInventory
      .filter(item => {
        // Primary filter: Must have dimensions and core paper properties to be considered a master sheet
        if (!item.masterSheetSizeWidth || item.masterSheetSizeWidth <= 0 ||
            !item.masterSheetSizeHeight || item.masterSheetSizeHeight <= 0 ||
            !item.paperGsm || item.paperGsm <= 0 ||
            !item.paperQuality || item.paperQuality === '') {
          console.log(`[InventoryOptimization] Filtering out item ${item.id} ('${item.name}') due to missing/invalid critical master sheet fields. W: ${item.masterSheetSizeWidth}, H: ${item.masterSheetSizeHeight}, GSM: ${item.paperGsm}, Q: ${item.paperQuality}`);
          return false;
        }

        // Paper Quality Check: Case-insensitive match
        if (item.paperQuality.toLowerCase() !== targetQuality.toLowerCase()) {
          console.log(`[InventoryOptimization] Filtering out item ${item.id} ('${item.name}') due to quality mismatch. ItemQ: ${item.paperQuality}, TargetQ: ${targetQuality}`);
          return false;
        }

        // GSM Tolerance Check
        const gsmDiff = Math.abs(item.paperGsm - targetGsm);
        const highToleranceQualities: PaperQualityType[] = ['SBS', 'ART_PAPER_GLOSS', 'ART_PAPER_MATT', 'GREYBACK', 'WHITEBACK'];
        let gsmTolerance = 5; 
        // Check if item.paperQuality is one of the high tolerance types
        if (highToleranceQualities.some(hq => hq.toLowerCase() === item.paperQuality!.toLowerCase())) {
            gsmTolerance = 20;
        }


        if (gsmDiff > gsmTolerance) {
          console.log(`[InventoryOptimization] Filtering out item ${item.id} ('${item.name}') due to GSM mismatch. ItemGSM: ${item.paperGsm}, TargetGSM: ${targetGsm}, Diff: ${gsmDiff}, Tolerance: ${gsmTolerance}`);
          return false;
        }
        
        console.log(`[InventoryOptimization] Item ${item.id} ('${item.name}') PASSED filters. W: ${item.masterSheetSizeWidth}, H: ${item.masterSheetSizeHeight}, GSM: ${item.paperGsm}, Q: ${item.paperQuality}`);
        return true;
      })
      .map(item => ({ // Map to the structure expected by the AI flow
        id: item.id,
        masterSheetSizeWidth: item.masterSheetSizeWidth!,
        masterSheetSizeHeight: item.masterSheetSizeHeight!,
        paperGsm: item.paperGsm!,
        paperQuality: item.paperQuality!,
      }));

    console.log('[InventoryOptimization] Filtered Available Master Sheets for AI (first 5 items):', JSON.stringify(availableMasterSheets.slice(0,5), null, 2));
    if (availableMasterSheets.length === 0) {
      console.log('[InventoryOptimization] No suitable master sheets found after filtering to send to AI.');
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
    console.log('[InventoryOptimization] Raw AI Output:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('Error fetching inventory optimization suggestions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions.';
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
      global.__inventoryItemsStore__ = [];
  }
  return [...global.__inventoryItemsStore__];
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
      itemGroup = getPaperQualityLabel(paperQuality) as ItemGroupType; // Ensure this is a valid ItemGroupType

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
    } else if (data.category === 'GLASS_JAR') {
      itemType = 'Glass Jar';
      itemGroup = 'Glass Jars';
    } else if (data.category === 'MAGNET') {
      itemType = 'Magnet';
      itemGroup = 'Magnets';
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
        global.__inventoryItemsStore__ = [];
    }
    global.__inventoryItemsStore__.push(newItem);
    global.__inventoryCounter__ = currentInventoryCounter + 1;

    console.log('Added inventory item:', JSON.stringify(newItem, null, 2));
    revalidatePath('/inventory');
    return { success: true, message: 'Inventory item added successfully!', item: newItem };
  } catch (error) {
    console.error('Error adding inventory item:', error);
    return { success: false, message: 'Failed to add inventory item.' };
  }
}


    