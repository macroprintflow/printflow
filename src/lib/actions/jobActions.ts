'use server';

import type { JobCardFormValues, JobCardData } from '@/lib/definitions';
import { optimizeInventory, type OptimizeInventoryInput, type OptimizeInventoryOutput } from '@/ai/flows/inventory-optimization';
import { revalidatePath } from 'next/cache';

// Placeholder for database interactions
let jobCards: JobCardData[] = [];
let jobCounter = 1;

function generateJobCardNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const randomNumber = Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
  return `JC-${year}${month}${day}-${randomNumber}`;
}


export async function createJobCard(data: JobCardFormValues): Promise<{ success: boolean; message: string; jobCard?: JobCardData }> {
  try {
    // Simulate database insertion
    const newJobCard: JobCardData = {
      ...data,
      id: (jobCounter++).toString(),
      jobCardNumber: generateJobCardNumber(),
      date: new Date().toISOString().split('T')[0], // Current date
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobCards.push(newJobCard);
    console.log('Created job card:', newJobCard);
    revalidatePath('/jobs'); // Revalidate the jobs list page
    revalidatePath('/jobs/new'); // Revalidate the new job page (e.g. for clearing form or redirecting)
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

// Placeholder for fetching job templates
export async function getJobTemplates() {
  return [
    { id: 'template1', name: 'Golden Tray', kindOfJob: 'METPET', coating: 'VARNISH_GLOSS', hotFoilStamping: 'GOLDEN' },
    { id: 'template2', name: 'Rigid Top and Bottom Box', boxMaking: 'COMBINED', pasting: 'YES' },
    { id: 'template3', name: 'Monocarton Box', kindOfJob: 'NORMAL' },
  ];
}
