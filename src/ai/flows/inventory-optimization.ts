
// src/ai/flows/inventory-optimization.ts
'use server';
/**
 * @fileOverview A flow that suggests the best possible master sheet size from available inventory,
 * calculating the percentage of wastage based on the input paper specifications.
 * All dimensions are expected and returned in inches.
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
  jobSizeWidth: z.number().describe('The width of the job in inches.'),
  jobSizeHeight: z.number().describe('The height of the job in inches.'),
  netQuantity: z.number().describe('The net quantity of sheets required for the job.'),
});
export type OptimizeInventoryInput = z.infer<typeof OptimizeInventoryInputSchema>;

const MasterSheetSuggestionSchema = z.object({
  masterSheetSizeWidth: z.number().describe('The width of the suggested master sheet size in inches.'),
  masterSheetSizeHeight: z.number().describe('The height of the suggested master sheet size in inches.'),
  wastagePercentage: z.number().describe('The percentage of wastage for the suggested master sheet size.'),
  sheetsPerMasterSheet: z.number().describe('Number of sheets that can be cut from one master sheet.'),
  totalMasterSheetsNeeded: z.number().describe('Total number of master sheets needed to fulfill the job.'),
  cuttingLayoutDescription: z.string().optional().describe("Textual description of the cutting layout, e.g., '3 across x 4 down (job portrait)'."),
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

  Given the following paper specifications and job requirements, suggest the best possible master sheet sizes.
  All dimensions are in INCHES.
  Job Size: {{{jobSizeWidth}}}W x {{{jobSizeHeight}}}H inches
  Net Quantity: {{{netQuantity}}} sheets

  The following are the 'Available Master Sheet Sizes' (Width x Height in INCHES) you MUST consider:
  - 27.56 x 39.37
  - 28.35 x 40.16
  - 25.59 x 35.43
  - 25.20 x 18.90
  - 19.69 x 27.56

  For EACH of these 'Available Master Sheet Sizes':
  1. Calculate how many job sheets (job size: {{{jobSizeWidth}}}in x {{{jobSizeHeight}}}in) can be cut. This is 'sheetsPerMasterSheet'.
     To do this, you MUST consider two orientations for the job sheet on the current Master Sheet and select the orientation that yields the maximum number of pieces:

     a. **Job Portrait Orientation on Master (Job as {{{jobSizeWidth}}}W x {{{jobSizeHeight}}}H):**
        Let CurrentMasterSheetWidth and CurrentMasterSheetHeight be the dimensions of the master sheet being evaluated.
        Pieces_Across_Portrait = floor(CurrentMasterSheetWidth / {{{jobSizeWidth}}})
        Pieces_Down_Portrait = floor(CurrentMasterSheetHeight / {{{jobSizeHeight}}})
        Total_Ups_Portrait = Pieces_Across_Portrait * Pieces_Down_Portrait

     b. **Job Landscape Orientation on Master (Job as {{{jobSizeHeight}}}W x {{{jobSizeWidth}}}H):**
        Let CurrentMasterSheetWidth and CurrentMasterSheetHeight be the dimensions of the master sheet being evaluated.
        Pieces_Across_Landscape = floor(CurrentMasterSheetWidth / {{{jobSizeHeight}}})
        Pieces_Down_Landscape = floor(CurrentMasterSheetHeight / {{{jobSizeWidth}}})
        Total_Ups_Landscape = Pieces_Across_Landscape * Pieces_Down_Landscape

     The 'sheetsPerMasterSheet' for the current Master Sheet is the MAXIMUM of Total_Ups_Portrait and Total_Ups_Landscape.
     The 'cuttingLayoutDescription' for the current Master Sheet must describe the orientation (portrait or landscape) and the arrangement (e.g., 'Pieces_Across x Pieces_Down') that yielded this maximum. For example: '2 across x 2 down (job portrait)' or '1 across x 3 down (job landscape)'.

  2. Calculate the 'wastagePercentage' for the current Master Sheet.
     JobSheetArea = {{{jobSizeWidth}}} * {{{jobSizeHeight}}}
     MasterSheetArea = CurrentMasterSheetWidth * CurrentMasterSheetHeight
     UsedArea = JobSheetArea * sheetsPerMasterSheet
     WastagePercentage = ((MasterSheetArea - UsedArea) / MasterSheetArea) * 100
     Ensure WastagePercentage is a number.

  3. Calculate 'totalMasterSheetsNeeded' for the current Master Sheet.
     totalMasterSheetsNeeded = ceil({{{netQuantity}}} / sheetsPerMasterSheet)

  After performing these calculations for ALL 'Available Master Sheet Sizes', compile a list of suggestions.
  Each suggestion in the output array must include:
  - masterSheetSizeWidth (from the available list)
  - masterSheetSizeHeight (from the available list)
  - wastagePercentage (calculated)
  - sheetsPerMasterSheet (calculated maximum)
  - totalMasterSheetsNeeded (calculated)
  - cuttingLayoutDescription (corresponding to the maximum ups)

  The \`suggestions\` array in your output should be sorted by \`wastagePercentage\` (lowest first). If wastage percentages are equal, prioritize the suggestion that results in fewer \`totalMasterSheetsNeeded\`.

  The \`optimalSuggestion\` in your output should be the first item from this sorted \`suggestions\` array.

  Paper GSM: {{{paperGsm}}} gsm
  Paper Quality: {{{paperQuality}}}

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
    if (output?.suggestions) {
      output.suggestions.forEach(s => {
        s.wastagePercentage = parseFloat(s.wastagePercentage.toFixed(2));
        s.masterSheetSizeWidth = parseFloat(s.masterSheetSizeWidth.toFixed(2));
        s.masterSheetSizeHeight = parseFloat(s.masterSheetSizeHeight.toFixed(2));
      });
    }
    if (output?.optimalSuggestion) {
       output.optimalSuggestion.wastagePercentage = parseFloat(output.optimalSuggestion.wastagePercentage.toFixed(2));
       output.optimalSuggestion.masterSheetSizeWidth = parseFloat(output.optimalSuggestion.masterSheetSizeWidth.toFixed(2));
       output.optimalSuggestion.masterSheetSizeHeight = parseFloat(output.optimalSuggestion.masterSheetSizeHeight.toFixed(2));
    }
    return output!;
  }
);

