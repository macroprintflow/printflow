
// src/ai/flows/inventory-optimization.ts
'use server';
/**
 * @fileOverview A flow that suggests the best possible master sheet size from available inventory,
 * calculating the percentage of wastage based on the input paper specifications.
 * All dimensions are expected and returned in inches. Thickness is in mm.
 *
 * - optimizeInventory - A function that handles the inventory optimization process.
 * - OptimizeInventoryInput - The input type for the optimizeInventory function.
 * - OptimizeInventoryOutput - The return type for the optimizeInventory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { OptimizeInventoryOutput as ImportedOptimizeInventoryOutput } from '@/lib/definitions';
import { KAPPA_MDF_QUALITIES } from '@/lib/definitions';


const AvailableSheetSchema = z.object({
  id: z.string().describe('The inventory ID of this available master sheet.'),
  masterSheetSizeWidth: z.number().describe('The width of this available master sheet in inches.'),
  masterSheetSizeHeight: z.number().describe('The height of this available master sheet in inches.'),
  paperGsm: z.number().optional().describe('The GSM of this available master sheet, if applicable.'),
  paperThicknessMm: z.number().optional().describe('The thickness in mm of this available master sheet, if applicable (e.g., for Kappa, MDF).'),
  paperQuality: z.string().describe('The quality of this available master sheet.'),
});
export type AvailableSheet = z.infer<typeof AvailableSheetSchema>;


const OptimizeInventoryInputSchema = z.object({
  targetPaperGsm: z.number().optional().describe('The target paper GSM for the job, if applicable.'),
  targetPaperThicknessMm: z.number().optional().describe('The target paper thickness in mm for the job, if applicable (e.g., for Kappa, MDF).'),
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
  paperGsm: z.number().optional().describe('The actual GSM of the suggested master sheet (from inventory), if applicable.'),
  paperThicknessMm: z.number().optional().describe('The actual thickness in mm of the suggested master sheet (from inventory), if applicable.'),
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
export type OptimizeInventoryOutput = ImportedOptimizeInventoryOutput;


export async function optimizeInventory(input: OptimizeInventoryInput): Promise<OptimizeInventoryOutput> {
  console.log('[InventoryOptimization AI Flow] optimizeInventory function called with input (availableMasterSheets count):', input.availableMasterSheets?.length);
  return optimizeInventoryFlow(input);
}

// New prompt definition
const prompt = ai.definePrompt({
  name: 'optimizeInventoryPrompt',
  input: {schema: OptimizeInventoryInputSchema },
  output: {
    schema: z.object({
        suggestions: z.array(MasterSheetSuggestionSchema),
        optimalSuggestion: MasterSheetSuggestionSchema.optional()
      }),
  },
  prompt: ({ targetPaperGsm, targetPaperThicknessMm, targetPaperQuality, jobSizeWidth, jobSizeHeight, netQuantity, availableMasterSheets }) => `
You are a precise calculator and an expert in printing and packaging optimization. Your goal is to minimize waste.
You MUST perform the calculations exactly as described, using integer division (floor function) where specified for ups calculations.

IMPORTANT: Your response MUST ONLY consider the master sheets explicitly provided in the \`availableMasterSheets\` data below. Do not include any sheets not found in this input. If this input array is empty or contains no suitable sheets based on the job requirements, the \`suggestions\` array in your output must be empty, and "optimalSuggestion" must be undefined.

### Job Specifications:
- Job Sheet Size: ${jobSizeWidth} inches (Width) x ${jobSizeHeight} inches (Height)
- Target Paper Quality: ${targetPaperQuality}
${KAPPA_MDF_QUALITIES.includes(targetPaperQuality as any) ? `- Target Paper Thickness: ${targetPaperThicknessMm} mm` : `- Target Paper GSM: ${targetPaperGsm}`}
- Net Quantity Needed: ${netQuantity} sheets

### Task:
For EACH sheet in the \`availableMasterSheets\` data provided below:
1.  Identify the Current Master Sheet properties from the JSON data for that sheet:
    - CurrentMasterSheetID: from \`id\`
    - CurrentMasterSheetWidth: from \`masterSheetSizeWidth\`
    - CurrentMasterSheetHeight: from \`masterSheetSizeHeight\`
    - CurrentMasterSheetQuality: from \`paperQuality\`
    - CurrentMasterSheetGSM: from \`paperGsm\` (if applicable)
    - CurrentMasterSheetThicknessMm: from \`paperThicknessMm\` (if applicable, e.g. for Kappa, MDF)

2.  Filtering:
    - If target paper quality is '${KAPPA_MDF_QUALITIES.join("' or '")}', the CurrentMasterSheet MUST have a \`paperThicknessMm\` that closely matches \`targetPaperThicknessMm\`.
    - Otherwise (for other paper qualities), the CurrentMasterSheet MUST have a \`paperGsm\` that closely matches \`targetPaperGsm\`.
    - If a sheet does not meet these primary criteria (quality AND GSM/Thickness match), DO NOT process it further. Skip it.

3.  Calculate for **Portrait Layout** (Job as ${jobSizeWidth}W x ${jobSizeHeight}H on CurrentMasterSheet):
    - Pieces_Across_Portrait = floor(CurrentMasterSheetWidth / ${jobSizeWidth})
    - Pieces_Down_Portrait = floor(CurrentMasterSheetHeight / ${jobSizeHeight})
    - Total_Ups_Portrait = Pieces_Across_Portrait * Pieces_Down_Portrait

4.  Calculate for **Landscape Layout** (Job as ${jobSizeHeight}W x ${jobSizeWidth}H on CurrentMasterSheet, meaning job is rotated):
    - Pieces_Across_Landscape = floor(CurrentMasterSheetWidth / ${jobSizeHeight})
    - Pieces_Down_Landscape = floor(CurrentMasterSheetHeight / ${jobSizeWidth})
    - Total_Ups_Landscape = Pieces_Across_Landscape * Pieces_Down_Landscape

5.  Determine the final \`sheetsPerMasterSheet\` and \`cuttingLayoutDescription\`:
    - IF Total_Ups_Portrait >= Total_Ups_Landscape:
        - sheetsPerMasterSheet = Total_Ups_Portrait
        - cuttingLayoutDescription = \`\${Pieces_Across_Portrait} across x \${Pieces_Down_Portrait} down (job portrait)\`
    - ELSE (meaning Total_Ups_Landscape > Total_Ups_Portrait):
        - sheetsPerMasterSheet = Total_Ups_Landscape
        - cuttingLayoutDescription = \`\${Pieces_Across_Landscape} across x \${Pieces_Down_Landscape} down (job landscape)\`
    This sheetsPerMasterSheet value MUST be an integer.

6.  IMPORTANT: If the calculated \`sheetsPerMasterSheet\` from step 5 is 0 (e.g., because the job dimensions are larger than the CurrentMasterSheet dimensions), then this CurrentMasterSheet is unsuitable. DO NOT include this CurrentMasterSheet in the \`suggestions\` output array. Skip all further calculations for this sheet and proceed to the next available master sheet.

7.  If \`sheetsPerMasterSheet\` > 0, calculate \`totalMasterSheetsNeeded\`:
    - totalMasterSheetsNeeded = ceil(${netQuantity} / sheetsPerMasterSheet). This value MUST be an integer.

8.  If \`sheetsPerMasterSheet\` > 0, calculate \`wastagePercentage\`:
    - JobSheetArea = ${jobSizeWidth} * ${jobSizeHeight}
    - MasterSheetArea = CurrentMasterSheetWidth * CurrentMasterSheetHeight
    - UsedArea = JobSheetArea * sheetsPerMasterSheet
    - WastedArea = MasterSheetArea - UsedArea
    - wastagePercentage = (WastedArea / MasterSheetArea) * 100. (Round to two decimal places, ensure it's a number).

### Output Format:
After processing ALL provided \`Available Master Sheets\` that result in sheetsPerMasterSheet > 0 AND meet the GSM/Thickness criteria, compile a list of suggestions.
Each suggestion must include all calculated fields: sourceInventoryItemId, masterSheetSizeWidth, masterSheetSizeHeight, paperQuality, sheetsPerMasterSheet, totalMasterSheetsNeeded, wastagePercentage, and cuttingLayoutDescription.
Also include \`paperGsm\` OR \`paperThicknessMm\` as appropriate for the sheet's quality.
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
      "paperGsm": ...,                // from availableMasterSheets.paperGsm (if applicable)
      "paperThicknessMm": ...,        // from availableMasterSheets.paperThicknessMm (if applicable)
      "paperQuality": "...",          // from availableMasterSheets.paperQuality
      "sheetsPerMasterSheet": ...,    // calculated integer from step 5
      "totalMasterSheetsNeeded": ..., // calculated integer from step 7
      "wastagePercentage": ...,       // calculated number from step 8 (e.g., 12.5)
      "cuttingLayoutDescription": "..." // from step 5, e.g., "3x2 (job portrait)"
    }
    // ... more suggestions if any
  ],
  "optimalSuggestion": { /* same structure as a suggestion, or undefined if no suggestions */ }
}

### Data:
Available Master Sheets to process:
${JSON.stringify(availableMasterSheets, null, 2)}

CRITICAL: Respond ONLY with a valid JSON object matching the defined output structure. Do NOT use placeholder text like 'string' or placeholder numbers like '1.23' in your actual calculated values. Ensure all calculations are accurate and all numerical results of division are floored before multiplication for ups calculation. Ensure \`cuttingLayoutDescription\` correctly reflects the pieces across, pieces down, and the orientation (job portrait or job landscape) that achieved the maximum ups.
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
      let jobSpec = `Job Size ${input.jobSizeWidth}x${input.jobSizeHeight}, Quality ${input.targetPaperQuality}, Net Qty ${input.netQuantity}`;
      if (KAPPA_MDF_QUALITIES.includes(input.targetPaperQuality as any) && input.targetPaperThicknessMm !== undefined) {
        jobSpec += `, Thickness ${input.targetPaperThicknessMm}mm`;
      } else if (input.targetPaperGsm !== undefined) {
        jobSpec += `, GSM ${input.targetPaperGsm}`;
      }
      console.log(`[InventoryOptimization AI Flow] Job details for prompt: ${jobSpec}`);
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

    let processedOutput: { suggestions: any[], optimalSuggestion?: any };
    try {
        const plainOutput = typeof rawAiOutput === 'object' && rawAiOutput !== null ? { ...rawAiOutput } : rawAiOutput;
        processedOutput = JSON.parse(JSON.stringify(plainOutput)); // Create a mutable deep copy
    } catch (e) {
        console.error('[InventoryOptimization AI Flow] Error parsing AI output (not valid JSON or structure):', e);
        console.error('[InventoryOptimization AI Flow] Faulty AI Output:', rawAiOutput);
        return { suggestions: [], optimalSuggestion: undefined };
    }

    if (!processedOutput.suggestions) {
        console.warn('[InventoryOptimization AI Flow] AI output was missing the suggestions array. Defaulting to empty array.');
        processedOutput.suggestions = [];
    }

    if (!processedOutput.suggestions?.length) {
      if (processedOutput.optimalSuggestion) {
        console.log(`[InventoryOptimization AI Flow] Cleanup: Suggestions array is empty, but optimalSuggestion was present. Setting optimalSuggestion to undefined. Original optimal: ${JSON.stringify(processedOutput.optimalSuggestion)}`);
      }
      processedOutput.optimalSuggestion = undefined;
    } else if (processedOutput.optimalSuggestion) {
      const opt = processedOutput.optimalSuggestion;
      if (
        (typeof opt.sourceInventoryItemId === 'string' && opt.sourceInventoryItemId.toLowerCase() === 'string') ||
        (typeof opt.masterSheetSizeWidth === 'number' && opt.masterSheetSizeWidth === 1.23) ||
        (opt.sheetsPerMasterSheet === 123 && opt.paperQuality === 'string')
      ) {
        console.log(`[InventoryOptimization AI Flow] Cleanup: optimalSuggestion appears to be placeholder data. Setting to undefined. Original optimal: ${JSON.stringify(opt)}`);
        processedOutput.optimalSuggestion = undefined;
      }
    }

    if (processedOutput.suggestions.length > 0 && !processedOutput.optimalSuggestion) {
        console.warn('[InventoryOptimization AI Flow] Suggestions exist but optimalSuggestion is undefined after AI output/cleanup. Assigning first suggestion as optimal.');
        processedOutput.optimalSuggestion = processedOutput.suggestions[0];
    }

    processedOutput.suggestions.forEach(s => {
      s.masterSheetSizeWidth = parseFloat(Number(s.masterSheetSizeWidth || 0).toFixed(2));
      s.masterSheetSizeHeight = parseFloat(Number(s.masterSheetSizeHeight || 0).toFixed(2));
      s.paperGsm = s.paperGsm !== undefined ? Number(s.paperGsm) : undefined;
      s.paperThicknessMm = s.paperThicknessMm !== undefined ? parseFloat(Number(s.paperThicknessMm).toFixed(2)) : undefined;
      s.wastagePercentage = parseFloat(Number(s.wastagePercentage || 0).toFixed(2));
      s.sheetsPerMasterSheet = Math.floor(Number(s.sheetsPerMasterSheet || 0));
      s.totalMasterSheetsNeeded = Math.ceil(Number(s.totalMasterSheetsNeeded || 0));
    });

    if (processedOutput.optimalSuggestion) {
       const opt = processedOutput.optimalSuggestion;
       opt.masterSheetSizeWidth = parseFloat(Number(opt.masterSheetSizeWidth || 0).toFixed(2));
       opt.masterSheetSizeHeight = parseFloat(Number(opt.masterSheetSizeHeight || 0).toFixed(2));
       opt.paperGsm = opt.paperGsm !== undefined ? Number(opt.paperGsm) : undefined;
       opt.paperThicknessMm = opt.paperThicknessMm !== undefined ? parseFloat(Number(opt.paperThicknessMm).toFixed(2)) : undefined;
       opt.wastagePercentage = parseFloat(Number(opt.wastagePercentage || 0).toFixed(2));
       opt.sheetsPerMasterSheet = Math.floor(Number(opt.sheetsPerMasterSheet || 0));
       opt.totalMasterSheetsNeeded = Math.ceil(Number(opt.totalMasterSheetsNeeded || 0));
    }

    console.log(`[InventoryOptimization AI Flow] Returning processed output. Suggestions count: ${processedOutput.suggestions.length}. Optimal is ${processedOutput.optimalSuggestion ? 'defined' : 'undefined'}.`);

    const finalOutput: OptimizeInventoryOutput = {
        suggestions: processedOutput.suggestions,
        optimalSuggestion: processedOutput.optimalSuggestion,
    };
    return finalOutput;
  }
);


    