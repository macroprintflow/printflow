
'use server';

import type { JobCardFormValues, JobCardData, JobTemplateData, JobTemplateFormValues, InventoryItem, PaperQualityType, InventorySuggestion } from '@/lib/definitions';
import { PAPER_QUALITY_OPTIONS } from '@/lib/definitions';
import { optimizeInventory, type OptimizeInventoryInput, type OptimizeInventoryOutput, type AvailableSheet } from '@/ai/flows/inventory-optimization';
import { revalidatePath } from 'next/cache';

declare global {
  var __jobCards__: JobCardData[] | undefined;
  var __jobCounter__: number | undefined;
  var __jobTemplatesStore__: JobTemplateData[] | undefined;
  var __templateCounter__: number | undefined;
  var __inventoryItemsStore__: InventoryItem[] | undefined;
}

if (!global.__jobCards__) {
  global.__jobCards__ = [];
}
if (typeof global.__jobCounter__ === 'undefined') {
  global.__jobCounter__ = 1;
}
let jobCards: JobCardData[] = global.__jobCards__;


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
let jobTemplatesStore: JobTemplateData[] = global.__jobTemplatesStore__;


const initialInventoryItems: InventoryItem[] = [
  // Master Sheets with detailed properties
  { id: 'inv001', name: 'SBS Master 27.56x39.37in 300GSM', type: 'Master Sheet', itemGroup: 'SBS', specification: '27.56in x 39.37in, 300 GSM SBS', paperGsm: 300, paperQuality: 'SBS', masterSheetSizeWidth: 27.56, masterSheetSizeHeight: 39.37, availableStock: 5000, unit: 'sheets', reorderPoint: 1000 },
  { id: 'inv002', name: 'Art Paper Gloss Master 28.35x40.16in 250GSM', type: 'Master Sheet', itemGroup: 'Art Paper Gloss', specification: '28.35in x 40.16in, 250 GSM Art Paper Gloss', paperGsm: 250, paperQuality: 'ART_PAPER_GLOSS', masterSheetSizeWidth: 28.35, masterSheetSizeHeight: 40.16, availableStock: 3000, unit: 'sheets', reorderPoint: 500 },
  { id: 'inv003', name: 'Greyback Master 25.59x35.43in 350GSM', type: 'Master Sheet', itemGroup: 'Greyback', specification: '25.59in x 35.43in, 350 GSM Greyback', paperGsm: 350, paperQuality: 'GREYBACK', masterSheetSizeWidth: 25.59, masterSheetSizeHeight: 35.43, availableStock: 4500, unit: 'sheets', reorderPoint: 800 },
  { id: 'inv011', name: 'SBS Master 25.20x18.90in 280GSM', type: 'Master Sheet', itemGroup: 'SBS', specification: '25.20in x 18.90in, 280 GSM SBS', paperGsm: 280, paperQuality: 'SBS', masterSheetSizeWidth: 25.20, masterSheetSizeHeight: 18.90, availableStock: 2000, unit: 'sheets', reorderPoint: 400 },
  { id: 'inv012', name: 'WG Kappa Master 19.69x27.56in 400GSM', type: 'Master Sheet', itemGroup: 'WG Kappa', specification: '19.69in x 27.56in, 400 GSM WG Kappa', paperGsm: 400, paperQuality: 'WG_KAPPA', masterSheetSizeWidth: 19.69, masterSheetSizeHeight: 27.56, availableStock: 1500, unit: 'sheets', reorderPoint: 300 },
  { id: 'inv013', name: 'SBS Master 27.56x39.37in 280GSM', type: 'Master Sheet', itemGroup: 'SBS', specification: '27.56in x 39.37in, 280 GSM SBS', paperGsm: 280, paperQuality: 'SBS', masterSheetSizeWidth: 27.56, masterSheetSizeHeight: 39.37, availableStock: 500, unit: 'sheets', reorderPoint: 100 },


  // Paper Stock (can also be used as master sheets if dimensions are suitable)
  { id: 'inv004', name: 'Art Card Paper 300GSM', type: 'Paper Stock', itemGroup: 'Art Paper Matt', specification: '300 GSM, Art Paper Matt', paperGsm: 300, paperQuality: 'ART_PAPER_MATT', availableStock: 10000, unit: 'sheets', reorderPoint: 2000 },
  { id: 'inv005', name: 'Kraft Paper 120GSM', type: 'Paper Stock', itemGroup: 'Kraft Paper', specification: '120 GSM, Uncoated', paperGsm: 120, paperQuality: 'KRAFT_PAPER', availableStock: 8000, unit: 'sheets', reorderPoint: 1500 },
  { id: 'inv008', name: 'SBS Board 280GSM', type: 'Paper Stock', itemGroup: 'SBS', specification: '280 GSM, C1S', paperGsm: 280, paperQuality: 'SBS', availableStock: 7000, unit: 'sheets', reorderPoint: 1200 },
  { id: 'inv009', name: 'Greyback Board 400GSM', type: 'Paper Stock', itemGroup: 'Greyback', specification: '400 GSM, Coated', paperGsm: 400, paperQuality: 'GREYBACK', availableStock: 6000, unit: 'sheets', reorderPoint: 1000 },
  { id: 'inv014', name: 'GG Kappa Board 350GSM', type: 'Paper Stock', itemGroup: 'GG Kappa', specification: '350 GSM', paperGsm: 350, paperQuality: 'GG_KAPPA', availableStock: 2500, unit: 'sheets', reorderPoint: 500 },


  // Other items
  { id: 'inv006', name: 'Black Ink', type: 'Ink', itemGroup: 'Inks', specification: 'Process Black', availableStock: 50, unit: 'kg', reorderPoint: 10 },
  { id: 'inv007', name: 'Pantone 185C', type: 'Ink', itemGroup: 'Inks', specification: 'Red', availableStock: 20, unit: 'kg', reorderPoint: 5 },
  { id: 'inv010', name: 'Varnish Gloss', type: 'Other', itemGroup: 'Other Stock', specification: 'For Coating', availableStock: 100, unit: 'liters', reorderPoint: 20 },
];

if (!global.__inventoryItemsStore__) {
  global.__inventoryItemsStore__ = [...initialInventoryItems];
}
let inventoryItemsStore: InventoryItem[] = global.__inventoryItemsStore__;


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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobCards.push(newJobCard);
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
  jobInput: { // User's target specifications
    paperGsm: number;
    paperQuality: PaperQualityType;
    jobSizeWidth: number;
    jobSizeHeight: number;
    netQuantity: number;
  }
): Promise<OptimizeInventoryOutput | { error: string }> {
  try {
    const allInventory = await getInventoryItems();
    
    const { paperGsm: targetGsm, paperQuality: targetQuality } = jobInput;

    const availableMasterSheets: AvailableSheet[] = allInventory
      .filter(item => {
        // Must be a sheet type with defined dimensions, GSM, and quality
        if (!(item.type === 'Master Sheet' || item.type === 'Paper Stock')) return false;
        if (!item.masterSheetSizeWidth || !item.masterSheetSizeHeight || !item.paperGsm || !item.paperQuality) return false;

        // Exact paper quality match
        if (item.paperQuality !== targetQuality) return false;

        // GSM tolerance
        const gsmDiff = Math.abs(item.paperGsm - targetGsm);
        const artPaperQualities: PaperQualityType[] = ['ART_PAPER_GLOSS', 'ART_PAPER_MATT'];

        if (item.paperQuality === 'SBS' || artPaperQualities.includes(item.paperQuality)) {
          if (gsmDiff > 10) return false;
        } else if (item.paperQuality === 'GREYBACK' || item.paperQuality === 'WHITEBACK') {
          if (gsmDiff > 20) return false;
        } else { // Exact match for other qualities
          if (gsmDiff !== 0) return false;
        }
        return true;
      })
      .map(item => ({
        id: item.id,
        masterSheetSizeWidth: item.masterSheetSizeWidth!,
        masterSheetSizeHeight: item.masterSheetSizeHeight!,
        paperGsm: item.paperGsm!,
        paperQuality: item.paperQuality!,
      }));

    if (availableMasterSheets.length === 0) {
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
    return result;

  } catch (error) {
    console.error('Error fetching inventory optimization suggestions:', error);
    // It's good to provide a more specific error message if possible
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions.';
    return { error: `Failed to fetch inventory optimization suggestions: ${errorMessage}` };
  }
}


export async function getJobTemplates(): Promise<JobTemplateData[]> {
  return [...jobTemplatesStore];
}

export async function createJobTemplate(data: JobTemplateFormValues): Promise<{ success: boolean; message: string; template?: JobTemplateData }> {
  try {
    const currentTemplateCounter = global.__templateCounter__!;
    const newTemplate: JobTemplateData = {
      ...data,
      id: `template${currentTemplateCounter}`,
    };
    jobTemplatesStore.push(newTemplate);
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
  return [...inventoryItemsStore];
}

export function getPaperQualityLabel(value: PaperQualityType): string {
  const option = PAPER_QUALITY_OPTIONS.find(opt => opt.value === value);
  return option ? option.label : value;
}

    