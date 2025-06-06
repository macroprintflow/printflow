
'use server';

import type { JobCardFormValues, JobCardData, JobTemplateData, JobTemplateFormValues, InventoryItem } from '@/lib/definitions';
import { optimizeInventory, type OptimizeInventoryInput, type OptimizeInventoryOutput } from '@/ai/flows/inventory-optimization';
import { revalidatePath } from 'next/cache';

// Augment the global type for TypeScript to avoid errors
declare global {
  var __jobCards__: JobCardData[] | undefined;
  var __jobCounter__: number | undefined;
  var __jobTemplatesStore__: JobTemplateData[] | undefined;
  var __templateCounter__: number | undefined;
  var __inventoryItemsStore__: InventoryItem[] | undefined;
}

// Initialize jobCards and jobCounter on globalThis if they don't exist
if (!global.__jobCards__) {
  global.__jobCards__ = [];
}
if (typeof global.__jobCounter__ === 'undefined') {
  global.__jobCounter__ = 1;
}
let jobCards: JobCardData[] = global.__jobCards__;
// jobCounter will be managed directly via global.__jobCounter__ where used

// Initial data for jobTemplatesStore
const initialJobTemplates: JobTemplateData[] = [
    { id: 'template1', name: 'Golden Tray (Predefined)', kindOfJob: 'METPET', coating: 'VARNISH_GLOSS', hotFoilStamping: 'GOLDEN' },
    { id: 'template2', name: 'Rigid Top and Bottom Box (Predefined)', boxMaking: 'COMBINED', pasting: 'YES' },
    { id: 'template3', name: 'Monocarton Box (Predefined)', kindOfJob: 'NORMAL' },
];

// Initialize jobTemplatesStore and templateCounter on globalThis
if (!global.__jobTemplatesStore__) {
  global.__jobTemplatesStore__ = [...initialJobTemplates];
}
if (typeof global.__templateCounter__ === 'undefined') {
  global.__templateCounter__ = initialJobTemplates.length + 1;
}
let jobTemplatesStore: JobTemplateData[] = global.__jobTemplatesStore__;
// templateCounter will be managed directly via global.__templateCounter__ where used


// Initial data for inventoryItemsStore
const initialInventoryItems: InventoryItem[] = [
  { id: 'inv001', name: 'Master Sheet 27.56x39.37in', type: 'Master Sheet', itemGroup: 'Master Sheets', specification: '27.56in x 39.37in', availableStock: 5000, unit: 'sheets', reorderPoint: 1000 },
  { id: 'inv002', name: 'Master Sheet 28.35x40.16in', type: 'Master Sheet', itemGroup: 'Master Sheets', specification: '28.35in x 40.16in', availableStock: 3000, unit: 'sheets', reorderPoint: 500 },
  { id: 'inv003', name: 'Master Sheet 25.59x35.43in', type: 'Master Sheet', itemGroup: 'Master Sheets', specification: '25.59in x 35.43in', availableStock: 4500, unit: 'sheets', reorderPoint: 800 },
  { id: 'inv004', name: 'Art Card Paper 300GSM', type: 'Paper Stock', itemGroup: 'Art Card', specification: '300 GSM, Coated', availableStock: 10000, unit: 'sheets', reorderPoint: 2000 },
  { id: 'inv005', name: 'Kraft Paper 120GSM', type: 'Paper Stock', itemGroup: 'Kraft Paper', specification: '120 GSM, Uncoated', availableStock: 8000, unit: 'sheets', reorderPoint: 1500 },
  { id: 'inv006', name: 'Black Ink', type: 'Ink', itemGroup: 'Inks', specification: 'Process Black', availableStock: 50, unit: 'kg', reorderPoint: 10 },
  { id: 'inv007', name: 'Pantone 185C', type: 'Ink', itemGroup: 'Inks', specification: 'Red', availableStock: 20, unit: 'kg', reorderPoint: 5 },
  { id: 'inv008', name: 'SBS Board 280GSM', type: 'Paper Stock', itemGroup: 'SBS', specification: '280 GSM, C1S', availableStock: 7000, unit: 'sheets', reorderPoint: 1200 },
  { id: 'inv009', name: 'Greyback Board 400GSM', type: 'Paper Stock', itemGroup: 'Greyback', specification: '400 GSM, Coated', availableStock: 6000, unit: 'sheets', reorderPoint: 1000 },
  { id: 'inv010', name: 'Varnish Gloss', type: 'Other', itemGroup: 'Other Stock', specification: 'For Coating', availableStock: 100, unit: 'liters', reorderPoint: 20 },
];

// Initialize inventoryItemsStore on globalThis
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
      ...data, // Spread all form values, including new layout fields
      id: currentJobCounter.toString(),
      jobCardNumber: generateJobCardNumber(),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobCards.push(newJobCard); // jobCards refers to global.__jobCards__
    global.__jobCounter__ = currentJobCounter + 1; // Increment the counter on globalThis

    console.log('Created job card:', newJobCard);
    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job card created successfully!', jobCard: newJobCard };
  } catch (error) {
    console.error('Error creating job card:', error);
    return { success: false, message: 'Failed to create job card.' };
  }
}

export async function getInventoryOptimizationSuggestions(input: OptimizeInventoryInput): Promise<OptimizeInventoryOutput | { error: string }> {
  try {
    const result = await optimizeInventory(input);
    return result;
  } catch (error) {
    console.error('Error fetching inventory optimization suggestions:', error);
    return { error: 'Failed to fetch inventory optimization suggestions.' };
  }
}

export async function getJobTemplates(): Promise<JobTemplateData[]> {
  // Simulate fetching from a database
  return [...jobTemplatesStore]; // jobTemplatesStore refers to global.__jobTemplatesStore__
}

export async function createJobTemplate(data: JobTemplateFormValues): Promise<{ success: boolean; message: string; template?: JobTemplateData }> {
  try {
    const currentTemplateCounter = global.__templateCounter__!;
    const newTemplate: JobTemplateData = {
      ...data,
      id: `template${currentTemplateCounter}`,
    };
    jobTemplatesStore.push(newTemplate); // jobTemplatesStore refers to global.__jobTemplatesStore__
    global.__templateCounter__ = currentTemplateCounter + 1; // Increment the counter on globalThis

    console.log('Created job template:', newTemplate);
    revalidatePath('/templates');
    revalidatePath('/templates/new');
    revalidatePath('/jobs/new'); // To refresh template list in job card form
    return { success: true, message: 'Job template created successfully!', template: newTemplate };
  } catch (error) {
    console.error('Error creating job template:', error);
    return { success: false, message: 'Failed to create job template.' };
  }
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  // Simulate fetching from a database
  return [...inventoryItemsStore]; // inventoryItemsStore refers to global.__inventoryItemsStore__
}
