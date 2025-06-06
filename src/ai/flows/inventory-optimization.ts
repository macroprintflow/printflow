// src/ai/flows/inventory-optimization.ts
'use server';
/**
 * @fileOverview A flow that suggests the best possible master sheet size from available inventory,
 * calculating the percentage of wastage based on the input paper specifications.
 *
 * - optimizeInventory - A function that handles the inventory optimization process.
 * - OptimizeInventoryInput - The input type for the optimizeInventory function.
 * - OptimizeInventoryOutput - The return type for the optimizeInventory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OptimizeInventoryInputSchema = z.object({
  paperGsm: z.number().describe('The paper GSM (grams per square meter).'),
  paperQuality: z.string().describe('The paper quality (e.g., coated, uncoated).'),
  jobSizeWidth: z.number().describe('The width of the job in mm.'),
  jobSizeHeight: z.number().describe('The height of the job in mm.'),
  netQuantity: z.number().describe('The net quantity of sheets required for the job.'),
});
export type OptimizeInventoryInput = z.infer<typeof OptimizeInventoryInputSchema>;

const MasterSheetSuggestionSchema = z.object({
  masterSheetSizeWidth: z.number().describe('The width of the suggested master sheet size in mm.'),
  masterSheetSizeHeight: z.number().describe('The height of the suggested master sheet size in mm.'),
  wastagePercentage: z.number().describe('The percentage of wastage for the suggested master sheet size.'),
  sheetsPerMasterSheet: z.number().describe('Number of sheets that can be cut from one master sheet.'),
  totalMasterSheetsNeeded: z.number().describe('Total number of master sheets needed to fulfill the job.'),
});

const OptimizeInventoryOutputSchema = z.object({
  suggestions: z.array(MasterSheetSuggestionSchema).describe('An array of master sheet size suggestions, sorted by wastage percentage (lowest first).'),
  optimalSuggestion: MasterSheetSuggestionSchema.optional().describe('The optimal master sheet size suggestion based on the lowest wastage percentage.'),
});
export type OptimizeInventoryOutput = z.infer<typeof OptimizeInventoryOutputSchema>;

export async function optimizeInventory(input: OptimizeInventoryInput): Promise<OptimizeInventoryOutput> {
  return optimizeInventoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeInventoryPrompt',
  input: {schema: OptimizeInventoryInputSchema},
  output: {schema: OptimizeInventoryOutputSchema},
  prompt: `You are an expert in printing and packaging, specializing in optimizing material usage to minimize waste.

  Given the following paper specifications and job requirements, suggest the best possible master sheet sizes from available inventory. Calculate the percentage of wastage for each suggested master sheet size.

  Paper GSM: {{{paperGsm}}} gsm
  Paper Quality: {{{paperQuality}}}
  Job Size Width: {{{jobSizeWidth}}} mm
  Job Size Height: {{{jobSizeHeight}}} mm
  Net Quantity: {{{netQuantity}}} sheets

  Consider common master sheet sizes and prioritize those that minimize wastage. Also calculate how many sheets fit on the master sheet, and how many total master sheets are needed.

  Available Master Sheet Sizes (Width x Height in mm):
  - 700 x 1000
  - 720 x 1020
  - 650 x 900
  - 640 x 480
  - 500 x 700

  Return an array of suggestions sorted by wastage percentage (lowest first). Each suggestion must include the master sheet size (width and height), wastage percentage, sheets per master sheet, and total master sheets needed.
  Also include the optimalSuggestion based on the lowest wastage percentage.
  The optimalSuggestion should take into account both minimizing waste and minimizing the total number of master sheets required.

  Ensure the output is a valid JSON.
  `,
});

const optimizeInventoryFlow = ai.defineFlow(
  {
    name: 'optimizeInventoryFlow',
    inputSchema: OptimizeInventoryInputSchema,
    outputSchema: OptimizeInventoryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
