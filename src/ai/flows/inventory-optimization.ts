
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
  cuttingLayoutAsciiArt: z.string().optional().describe("An ASCII art representation of the cutting layout. 'J' for job, 'W' for waste.")
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

  Given the following paper specifications and job requirements, suggest the best possible master sheet sizes from available inventory. Calculate the percentage of wastage for each suggested master sheet size. All dimensions are in INCHES.

  Paper GSM: {{{paperGsm}}} gsm
  Paper Quality: {{{paperQuality}}}
  Job Size Width: {{{jobSizeWidth}}} inches
  Job Size Height: {{{jobSizeHeight}}} inches
  Net Quantity: {{{netQuantity}}} sheets

  Consider common master sheet sizes and prioritize those that minimize wastage.
  Also calculate how many sheets fit on the master sheet (sheetsPerMasterSheet), and how many total master sheets are needed.

  Available Master Sheet Sizes (Width x Height in INCHES):
  - 27.56 x 39.37
  - 28.35 x 40.16
  - 25.59 x 35.43
  - 25.20 x 18.90
  - 19.69 x 27.56

  For each suggestion, also determine the optimal way to cut the job sheets (job size: {{{jobSizeWidth}}}in x {{{jobSizeHeight}}}in) from the master sheet. This involves finding how many job pieces fit along the master sheet's width (N_across) and how many fit along its height (M_down). You should consider placing the job sheet in both portrait (width={{{jobSizeWidth}}}, height={{{jobSizeHeight}}}) and landscape (width={{{jobSizeHeight}}}, height={{{jobSizeWidth}}}) orientations on the master sheet to maximize the total number of pieces. Return a cuttingLayoutDescription field as a string like 'N_across x M_down (job orientation)', e.g., '3 across x 4 down (job portrait)' or '2 across x 5 down (job landscape)'.

  Additionally, provide a simple ASCII art representation of the cutting layout, named 'cuttingLayoutAsciiArt'. This should be a multi-line string. Use 'J' to represent a job sheet piece, and 'W' for significant waste areas. Try to make it roughly proportional to the master sheet, showing rows and columns of 'J' and 'W'. For example, for 2 across x 3 down on a master sheet that allows for some waste:
  cuttingLayoutAsciiArt:
  "JJW\\nJJW\\nJJW\\nWWW"
  (Ensure the ASCII art is a single string with '\\n' for newlines).

  Return an array of suggestions sorted by wastage percentage (lowest first). Each suggestion must include the master sheet size (width and height in inches), wastage percentage, sheets per master sheet, total master sheets needed, cuttingLayoutDescription, and cuttingLayoutAsciiArt.
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
