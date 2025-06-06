
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
  availableMasterSheets: z.array(AvailableSheetSchema).describe('A list of master sheets from inventory that match the basic criteria for the job. The AI should process these sheets to find the optimal ones.'),
});
export type OptimizeInventoryInput = z.infer<typeof OptimizeInventoryInputSchema>;

const MasterSheetSuggestionSchema = z.object({
  sourceInventoryItemId: z.string().describe('The inventory ID of the master sheet used for this suggestion.'),
  masterSheetSizeWidth: z.number().describe('The width of the suggested master sheet size in inches (from inventory).'),
  masterSheetSizeHeight: z.number().describe('The height of the suggested master sheet size in inches (from inventory).'),
  paperGsm: z.number().describe('The actual GSM of the suggested master sheet (from inventory).'),
  paperQuality: z.string().describe('The actual paper quality of the suggested master sheet (from inventory).'),
  wastagePercentage: z.number().describe('The percentage of wastage for the suggested master sheet size.'),
  sheetsPerMasterSheet: z.number().int().describe('Number of job sheets that can be cut from one master sheet. Must be an integer.'),
  totalMasterSheetsNeeded: z.number().int().describe('Total number of master sheets needed to fulfill the job. Must be an integer.'),
  cuttingLayoutDescription: z.string().optional().describe("Textual description of the cutting layout, e.g., '3 across x 4 down (job portrait)'."),
});

// This output schema is for the AI flow itself.
const OptimizeInventoryOutputSchema = z.object({
  suggestions: z.array(MasterSheetSuggestionSchema).describe('An array of master sheet size suggestions, sorted by wastage percentage (lowest first).'),
  optimalSuggestion: MasterSheetSuggestionSchema.optional().describe('The optimal master sheet size suggestion based on the lowest wastage percentage.'),
});
export type OptimizeInventoryOutput = import('@/lib/definitions').OptimizeInventoryOutput;


export async function optimizeInventory(input: OptimizeInventoryInput): Promise<OptimizeInventoryOutput> {
  console.log('[InventoryOptimization AI Flow] optimizeInventory function called with input (availableMasterSheets count):', input.availableMasterSheets?.length);
  return optimizeInventoryFlow(input);
}

// New prompt definition
const prompt = ai.definePrompt({
  name: 'optimizeInventoryPrompt',
  input: {schema: OptimizeInventoryInputSchema }, // Matches the function signature
  output: { // Schema for what the AI is expected to return directly
    schema: z.object({
        suggestions: z.array(MasterSheetSuggestionSchema),
        optimalSuggestion: MasterSheetSuggestionSchema.optional()
      }),
  },
  prompt: ({ targetPaperGsm, targetPaperQuality, jobSizeWidth, jobSizeHeight, netQuantity, availableMasterSheets }) => `
You are a precise calculator and an expert in printing and packaging optimization. Your goal is to minimize waste.

IMPORTANT: Your response MUST ONLY consider the master sheets explicitly provided in the \`availableMasterSheets\` data below. Do not include any sheets not found in this input. If this input array is empty or contains no suitable sheets based on the job requirements, the \`suggestions\` array in your output must be empty, and "optimalSuggestion" must be undefined.

### Task:
Given the job specifications:
- Job Sheet Size: ${jobSizeWidth} inches (Width) x ${jobSizeHeight} inches (Height)
- Target Paper GSM: ${targetPaperGsm}
- Target Paper Quality: ${targetPaperQuality}
- Net Quantity Needed: ${netQuantity} sheets

You are provided with a list of 'Available Master Sheets' from inventory. For EACH sheet in the \`availableMasterSheets\` data below:
1.  Identify the Current Master Sheet properties: ID, Width, Height, GSM, Quality.
2.  Calculate how many job sheets (size: ${jobSizeWidth}x${jobSizeHeight}) can be cut from this Current Master Sheet. This is \`sheetsPerMasterSheet\`.
    To do this, you MUST consider two orientations for the job sheet on the Current Master Sheet and select the orientation that yields the maximum number of pieces:
    a. Job Portrait Orientation on Master (Job as ${jobSizeWidth}W x ${jobSizeHeight}H):
       Pieces_Across_Portrait = floor(CurrentMasterSheetWidth / ${jobSizeWidth})
       Pieces_Down_Portrait = floor(CurrentMasterSheetHeight / ${jobSizeHeight})
       Total_Ups_Portrait = Pieces_Across_Portrait * Pieces_Down_Portrait
    b. Job Landscape Orientation on Master (Job as ${jobSizeHeight}W x ${jobSizeWidth}H):
       Pieces_Across_Landscape = floor(CurrentMasterSheetWidth / ${jobSizeHeight})
       Pieces_Down_Landscape = floor(CurrentMasterSheetHeight / ${jobSizeWidth})
       Total_Ups_Landscape = Pieces_Across_Landscape * Pieces_Down_Landscape
    The \`sheetsPerMasterSheet\` for the Current Master Sheet is the MAXIMUM of Total_Ups_Portrait and Total_Ups_Landscape. This value MUST be an integer.
    IMPORTANT: If \`sheetsPerMasterSheet\` calculates to 0 (e.g., job dimensions are larger than master sheet), this master sheet is unsuitable. DO NOT include it in the \`suggestions\` array.
3.  If \`sheetsPerMasterSheet\` > 0, provide a \`cuttingLayoutDescription\` (e.g., "3 across x 2 down (job portrait)").
4.  If \`sheetsPerMasterSheet\` > 0, calculate \`wastagePercentage\`:
    JobSheetArea = ${jobSizeWidth} * ${jobSizeHeight}
    MasterSheetArea = CurrentMasterSheetWidth * CurrentMasterSheetHeight
    UsedArea = JobSheetArea * sheetsPerMasterSheet
    WastedArea = MasterSheetArea - UsedArea
    WastagePercentage = (WastedArea / MasterSheetArea) * 100. (Round to two decimal places, ensure it's a number).
5.  If \`sheetsPerMasterSheet\` > 0, calculate \`totalMasterSheetsNeeded\`:
    totalMasterSheetsNeeded = ceil(${netQuantity} / sheetsPerMasterSheet). (Must be an integer).

### Output Format:
After processing ALL provided \`Available Master Sheets\` that result in sheetsPerMasterSheet > 0, compile a list of suggestions.
Sort the \`suggestions\` array by \`wastagePercentage\` (lowest first). If wastage percentages are equal, prioritize fewer \`totalMasterSheetsNeeded\`.
The \`optimalSuggestion\` should be the best item from this sorted list.
If no sheets are suitable (i.e., \`suggestions\` array is empty), then return an empty \`suggestions\` array and no \`optimalSuggestion\`.

Return a JSON object strictly adhering to this structure:
{
  "suggestions": [
    {
      "sourceInventoryItemId": "...", // from availableMasterSheets.id
      "masterSheetSizeWidth": ...,    // from availableMasterSheets.masterSheetSizeWidth
      "masterSheetSizeHeight": ...,   // from availableMasterSheets.masterSheetSizeHeight
      "paperGsm": ...,                // from availableMasterSheets.paperGsm
      "paperQuality": "...",          // from availableMasterSheets.paperQuality
      "sheetsPerMasterSheet": ...,    // calculated integer
      "totalMasterSheetsNeeded": ..., // calculated integer
      "wastagePercentage": ...,       // calculated number (e.g., 12.5)
      "cuttingLayoutDescription": "..." // e.g., "3x2 portrait layout" or similar
    }
    // ... more suggestions if any
  ],
  "optimalSuggestion": { /* same structure as a suggestion, or undefined if no suggestions */ }
}

### Data:
Available Master Sheets to process:
${JSON.stringify(availableMasterSheets, null, 2)}

CRITICAL: Respond ONLY with a valid JSON object matching the defined output structure. Do NOT use placeholder text like 'string' or placeholder numbers like '1.23' in your actual calculated values. Ensure all calculations are accurate.
If the \`availableMasterSheets\` array is empty or no sheets are suitable, the "suggestions" array in your JSON output MUST be empty, and "optimalSuggestion" must be undefined.
  `,
});


const optimizeInventoryFlow = ai.defineFlow(
  {
    name: 'optimizeInventoryFlow',
    inputSchema: OptimizeInventoryInputSchema,
    outputSchema: OptimizeInventoryOutputSchema, 
  },
  async (input): Promise<OptimizeInventoryOutput> => {
    console.log('[InventoryOptimization AI Flow] optimizeInventoryFlow called.');
    console.log('[InventoryOptimization AI Flow] Received input (availableMasterSheets count):', input.availableMasterSheets?.length);
    if (input.availableMasterSheets?.length) {
      console.log('[InventoryOptimization AI Flow] Preview of received availableMasterSheets (first 2):', JSON.stringify(input.availableMasterSheets.slice(0,2), null, 2));
    }

    if (!input.availableMasterSheets || input.availableMasterSheets.length === 0) {
      console.log('[InventoryOptimization AI Flow] Input availableMasterSheets is empty or undefined. Returning empty suggestions immediately as per flow logic.');
      return { suggestions: [], optimalSuggestion: undefined };
    }

    console.log('[InventoryOptimization AI Flow] Calling AI prompt with structured input...');
    
    const {output: rawAiOutput, usage} = await prompt(input);
    
    console.log('[InventoryOptimization AI Flow] Raw structured output from AI prompt:', JSON.stringify(rawAiOutput, null, 2));
    if (usage) {
      console.log('[InventoryOptimization AI Flow] AI prompt usage stats:', JSON.stringify(usage, null, 2));
    }

    if (!rawAiOutput) {
      console.error('[InventoryOptimization AI Flow] AI prompt returned null or undefined output. Returning empty suggestions.');
      return { suggestions: [], optimalSuggestion: undefined };
    }
    
    // Create a mutable deep copy of the AI output for processing
    let processedOutput: { suggestions: any[], optimalSuggestion?: any };
    try {
        processedOutput = JSON.parse(JSON.stringify(rawAiOutput));
    } catch (e) {
        console.error('[InventoryOptimization AI Flow] Error parsing AI output (not valid JSON or structure):', e);
        console.error('[InventoryOptimization AI Flow] Faulty AI Output:', rawAiOutput);
        return { suggestions: [], optimalSuggestion: undefined };
    }
    
    if (!processedOutput.suggestions) {
        console.warn('[InventoryOptimization AI Flow] AI output was missing the suggestions array. Defaulting to empty array.');
        processedOutput.suggestions = [];
    }
    
    // Cleanup logic for optimalSuggestion
    if (
      !processedOutput.suggestions?.length || 
      (processedOutput.optimalSuggestion && typeof processedOutput.optimalSuggestion.sourceInventoryItemId === 'string' && processedOutput.optimalSuggestion.sourceInventoryItemId.toLowerCase() === 'string') ||
      (processedOutput.optimalSuggestion && typeof processedOutput.optimalSuggestion.masterSheetSizeWidth === 'number' && processedOutput.optimalSuggestion.masterSheetSizeWidth === 1.23) 
    ) {
      if (processedOutput.suggestions?.length && processedOutput.optimalSuggestion) {
        console.log(`[InventoryOptimization AI Flow] Cleanup: optimalSuggestion appears to be placeholder or invalid. Original optimal: ${JSON.stringify(processedOutput.optimalSuggestion)}. Setting to undefined as suggestions exist but optimal is invalid.`);
      } else if (!processedOutput.suggestions?.length) {
        console.log(`[InventoryOptimization AI Flow] Cleanup: No suggestions, so optimalSuggestion must be undefined. Original optimal: ${JSON.stringify(processedOutput.optimalSuggestion)}`);
      }
      processedOutput.optimalSuggestion = undefined;
    }
    
    // If suggestions exist, but optimal is undefined (either by AI or our cleanup), pick the first.
    if (processedOutput.suggestions.length > 0 && !processedOutput.optimalSuggestion) {
        console.warn('[InventoryOptimization AI Flow] Suggestions exist but optimalSuggestion is undefined. Assigning first suggestion as optimal.');
        processedOutput.optimalSuggestion = processedOutput.suggestions[0];
    }
    
    // Ensure data types and rounding for suggestions
    processedOutput.suggestions.forEach(s => {
      s.masterSheetSizeWidth = parseFloat(Number(s.masterSheetSizeWidth || 0).toFixed(2));
      s.masterSheetSizeHeight = parseFloat(Number(s.masterSheetSizeHeight || 0).toFixed(2));
      s.paperGsm = Number(s.paperGsm || 0);
      s.wastagePercentage = parseFloat(Number(s.wastagePercentage || 0).toFixed(2));
      s.sheetsPerMasterSheet = Math.floor(Number(s.sheetsPerMasterSheet || 0));
      s.totalMasterSheetsNeeded = Math.ceil(Number(s.totalMasterSheetsNeeded || 0));
    });
    
    // Ensure data types and rounding for optimalSuggestion if it exists
    if (processedOutput.optimalSuggestion) {
       const opt = processedOutput.optimalSuggestion;
       opt.masterSheetSizeWidth = parseFloat(Number(opt.masterSheetSizeWidth || 0).toFixed(2));
       opt.masterSheetSizeHeight = parseFloat(Number(opt.masterSheetSizeHeight || 0).toFixed(2));
       opt.paperGsm = Number(opt.paperGsm || 0);
       opt.wastagePercentage = parseFloat(Number(opt.wastagePercentage || 0).toFixed(2));
       opt.sheetsPerMasterSheet = Math.floor(Number(opt.sheetsPerMasterSheet || 0)); // Ensure integer
       opt.totalMasterSheetsNeeded = Math.ceil(Number(opt.totalMasterSheetsNeeded || 0)); // Ensure integer
    }
    
    console.log(`[InventoryOptimization AI Flow] Returning processed output. Suggestions count: ${processedOutput.suggestions.length}. Optimal is ${processedOutput.optimalSuggestion ? 'defined' : 'undefined'}.`);
    
    return {
        suggestions: processedOutput.suggestions,
        optimalSuggestion: processedOutput.optimalSuggestion,
    };
  }
);

    