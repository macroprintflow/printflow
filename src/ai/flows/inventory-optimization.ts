
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

const AvailableSheetSchema = z.object({
  id: z.string().describe('The inventory ID of this available master sheet.'),
  masterSheetSizeWidth: z.number().describe('The width of this available master sheet in inches.'),
  masterSheetSizeHeight: z.number().describe('The height of this available master sheet in inches.'),
  paperGsm: z.number().describe('The GSM of this available master sheet.'),
  paperQuality: z.string().describe('The quality of this available master sheet.'),
});
export type AvailableSheet = z.infer<typeof AvailableSheetSchema>;


const OptimizeInventoryInputSchema = z.object({
  targetPaperGsm: z.number().describe('The target paper GSM for the job.'),
  targetPaperQuality: z.string().describe('The target paper quality for the job.'),
  jobSizeWidth: z.number().describe('The width of the job in inches.'),
  jobSizeHeight: z.number().describe('The height of the job in inches.'),
  netQuantity: z.number().describe('The net quantity of sheets required for the job.'),
  availableMasterSheets: z.array(AvailableSheetSchema).describe('A list of master sheets from inventory that match the basic criteria (type, quality, GSM tolerance) for the job. The AI should process these sheets to find the optimal ones.'),
});
export type OptimizeInventoryInput = z.infer<typeof OptimizeInventoryInputSchema>;

const MasterSheetSuggestionSchema = z.object({
  sourceInventoryItemId: z.string().describe('The inventory ID of the master sheet used for this suggestion.'),
  masterSheetSizeWidth: z.number().describe('The width of the suggested master sheet size in inches (from inventory).'),
  masterSheetSizeHeight: z.number().describe('The height of the suggested master sheet size in inches (from inventory).'),
  paperGsm: z.number().describe('The actual GSM of the suggested master sheet (from inventory).'),
  paperQuality: z.string().describe('The actual paper quality of the suggested master sheet (from inventory).'),
  wastagePercentage: z.number().describe('The percentage of wastage for the suggested master sheet size.'),
  sheetsPerMasterSheet: z.number().describe('Number of job sheets that can be cut from one master sheet.'),
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

  Job Specifications:
  - Target Paper GSM: {{{targetPaperGsm}}}
  - Target Paper Quality: {{{targetPaperQuality}}}
  - Job Size: {{{jobSizeWidth}}}W x {{{jobSizeHeight}}}H inches
  - Net Quantity: {{{netQuantity}}} sheets

  You are provided with a list of 'Available Master Sheets' from inventory. For EACH sheet in '{{{availableMasterSheets}}}':
  1. Identify the current master sheet's properties:
     - CurrentMasterSheetID: from 'id'
     - CurrentMasterSheetWidth: from 'masterSheetSizeWidth'
     - CurrentMasterSheetHeight: from 'masterSheetSizeHeight'
     - CurrentMasterSheetGSM: from 'paperGsm'
     - CurrentMasterSheetQuality: from 'paperQuality'

  2. Calculate how many job sheets (job size: {{{jobSizeWidth}}}in x {{{jobSizeHeight}}}in) can be cut from this CurrentMasterSheet. This is 'sheetsPerMasterSheet'.
     To do this, you MUST consider two orientations for the job sheet on the CurrentMasterSheet and select the orientation that yields the maximum number of pieces:

     a. **Job Portrait Orientation on Master (Job as {{{jobSizeWidth}}}W x {{{jobSizeHeight}}}H):**
        Pieces_Across_Portrait = floor(CurrentMasterSheetWidth / {{{jobSizeWidth}}})
        Pieces_Down_Portrait = floor(CurrentMasterSheetHeight / {{{jobSizeHeight}}})
        Total_Ups_Portrait = Pieces_Across_Portrait * Pieces_Down_Portrait

     b. **Job Landscape Orientation on Master (Job as {{{jobSizeHeight}}}W x {{{jobSizeWidth}}}H):**
        Pieces_Across_Landscape = floor(CurrentMasterSheetWidth / {{{jobSizeHeight}}})
        Pieces_Down_Landscape = floor(CurrentMasterSheetHeight / {{{jobSizeWidth}}})
        Total_Ups_Landscape = Pieces_Across_Landscape * Pieces_Down_Landscape

     The 'sheetsPerMasterSheet' for the CurrentMasterSheet is the MAXIMUM of Total_Ups_Portrait and Total_Ups_Landscape. This value MUST be an integer.
     The 'cuttingLayoutDescription' for the CurrentMasterSheet must describe the orientation (portrait or landscape) and the arrangement (e.g., 'Pieces_Across x Pieces_Down') that yielded this maximum. For example: '2 across x 2 down (job portrait)' or '1 across x 3 down (job landscape)'.

  3. Calculate the 'wastagePercentage' for the CurrentMasterSheet.
     Let JobSheetArea = {{{jobSizeWidth}}} * {{{jobSizeHeight}}}.
     Let MasterSheetAreaForCurrent = CurrentMasterSheetWidth * CurrentMasterSheetHeight.
     The 'sheetsPerMasterSheet' value used in the calculation below MUST be the integer value determined in step 2 for the current master sheet.
     UsedAreaForWastageCalc = JobSheetArea * sheetsPerMasterSheet.
     WastedArea = MasterSheetAreaForCurrent - UsedAreaForWastageCalc.
     WastagePercentage = (WastedArea / MasterSheetAreaForCurrent) * 100.
     Round the WastagePercentage to two decimal places. Ensure it is a number.

  4. Calculate 'totalMasterSheetsNeeded' for the CurrentMasterSheet.
     totalMasterSheetsNeeded = ceil({{{netQuantity}}} / sheetsPerMasterSheet)

  After performing these calculations for ALL provided 'Available Master Sheets', compile a list of suggestions.
  Each suggestion in the output array must include:
  - sourceInventoryItemId (CurrentMasterSheetID)
  - masterSheetSizeWidth (CurrentMasterSheetWidth)
  - masterSheetSizeHeight (CurrentMasterSheetHeight)
  - paperGsm (CurrentMasterSheetGSM)
  - paperQuality (CurrentMasterSheetQuality)
  - wastagePercentage (calculated and rounded)
  - sheetsPerMasterSheet (calculated maximum integer)
  - totalMasterSheetsNeeded (calculated)
  - cuttingLayoutDescription (corresponding to the maximum ups)

  The \`suggestions\` array in your output should be sorted by \`wastagePercentage\` (lowest first). If wastage percentages are equal, prioritize the suggestion that results in fewer \`totalMasterSheetsNeeded\`. If still equal, prefer suggestions where the master sheet GSM is closer to the \`targetPaperGsm\`.

  The \`optimalSuggestion\` in your output should be the first item from this sorted \`suggestions\` array.
  If no 'Available Master Sheets' were provided or if none are suitable (e.g., job size is larger than any master sheet), return an empty suggestions array and no optimal suggestion.

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
    if (!input.availableMasterSheets || input.availableMasterSheets.length === 0) {
      return { suggestions: [], optimalSuggestion: undefined };
    }
    const {output} = await prompt(input);
    
    if (output?.suggestions) {
      output.suggestions.forEach(s => {
        s.wastagePercentage = parseFloat(Number(s.wastagePercentage).toFixed(2));
        s.masterSheetSizeWidth = parseFloat(Number(s.masterSheetSizeWidth).toFixed(2));
        s.masterSheetSizeHeight = parseFloat(Number(s.masterSheetSizeHeight).toFixed(2));
        s.paperGsm = Number(s.paperGsm);
      });
    }
    if (output?.optimalSuggestion) {
       output.optimalSuggestion.wastagePercentage = parseFloat(Number(output.optimalSuggestion.wastagePercentage).toFixed(2));
       output.optimalSuggestion.masterSheetSizeWidth = parseFloat(Number(output.optimalSuggestion.masterSheetSizeWidth).toFixed(2));
       output.optimalSuggestion.masterSheetSizeHeight = parseFloat(Number(output.optimalSuggestion.masterSheetSizeHeight).toFixed(2));
       output.optimalSuggestion.paperGsm = Number(output.optimalSuggestion.paperGsm);
    }
    return output!;
  }
);

    