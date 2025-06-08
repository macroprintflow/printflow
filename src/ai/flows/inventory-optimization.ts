
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
import { KAPPA_MDF_QUALITIES, getPaperQualityUnit } from '@/lib/definitions';


const AvailableSheetSchema = z.object({
  id: z.string().describe('The inventory ID of this available master sheet.'),
  masterSheetSizeWidth: z.number().describe('The width of this available master sheet in inches.'),
  masterSheetSizeHeight: z.number().describe('The height of this available master sheet in inches.'),
  paperGsm: z.number().optional().describe('The GSM of this available master sheet, if applicable.'),
  paperThicknessMm: z.number().optional().describe('The thickness in mm of this available master sheet, if applicable (e.g., for Kappa, MDF).'),
  paperQuality: z.string().describe('The quality of this available master sheet.'),
  availableStock: z.number().optional().describe('The available stock quantity for this master sheet.'),
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

const OptimizeInventoryOutputSchema = z.object({
  suggestions: z.array(MasterSheetSuggestionSchema).describe('An array of master sheet size suggestions, sorted by sheetsPerMasterSheet (highest first), then wastage percentage (lowest first).'),
  optimalSuggestion: MasterSheetSuggestionSchema.optional().describe('The optimal master sheet size suggestion based on the highest sheetsPerMasterSheet and then lowest wastage percentage.'),
});
export type OptimizeInventoryOutput = ImportedOptimizeInventoryOutput;


export async function optimizeInventory(input: OptimizeInventoryInput): Promise<OptimizeInventoryOutput> {
  console.log('[InventoryOptimization TS Flow] optimizeInventory function called with input (availableMasterSheets count):', input.availableMasterSheets?.length);
  return optimizeInventoryFlow(input);
}

// New improved guillotine cut calculation function (Provided by User)
function calculateMaxGuillotineUps(jobW: number, jobH: number, sheetW: number, sheetH: number) {
  let maxUps = 0;
  let bestLayout = "";

  // Try both job orientations
  const orientations = [
    {w: jobW, h: jobH, label: 'portrait'},
    {w: jobH, h: jobW, label: 'landscape'}
  ];

  for (const orient of orientations) {
    // Loop over possible number of jobs across width (first guillotine cut - vertical cuts)
    for (let colsInStrip1 = 1; colsInStrip1 <= Math.floor(sheetW / orient.w); colsInStrip1++) {
      const strip1Width = colsInStrip1 * orient.w;
      const strip1Height = sheetH; // Full sheet height for this strip
      const strip1Rows = Math.floor(strip1Height / orient.h);
      const upsInStrip1 = colsInStrip1 * strip1Rows;

      // Remaining strip (right side)
      const remainderW = sheetW - strip1Width;
      let upsInRemainder = 0;
      let remainderDesc = "";
      if (remainderW >= Math.min(jobW, jobH)) { // Check if remainder can fit at least one job in any orientation
        // Try both orientations in the remainder
        for (const remOrient of orientations) {
          if (remOrient.w > 0 && remOrient.h > 0) { // Ensure valid dimensions for remainder orientation
            const remCols = Math.floor(remainderW / remOrient.w);
            const remRows = Math.floor(sheetH / remOrient.h); // Remainder uses full sheet height
            const remUps = remCols * remRows;
            if (remUps > upsInRemainder) {
              upsInRemainder = remUps;
              remainderDesc = ` + ${remCols}x${remRows} ${remOrient.label} (remainder)`;
            }
          }
        }
      }
      const totalUps = upsInStrip1 + upsInRemainder;
      if (totalUps > maxUps) {
        maxUps = totalUps;
        bestLayout = `${colsInStrip1}x${strip1Rows} ${orient.label}${remainderDesc}`;
      }
    }

    // Repeat for horizontal guillotine (first cut across height - horizontal cuts)
    for (let rowsInStrip1 = 1; rowsInStrip1 <= Math.floor(sheetH / orient.h); rowsInStrip1++) {
      const strip1Height = rowsInStrip1 * orient.h;
      const strip1Width = sheetW; // Full sheet width for this strip
      const strip1Cols = Math.floor(strip1Width / orient.w);
      const upsInStrip1 = strip1Cols * rowsInStrip1;

      // Remaining strip (bottom)
      const remainderH = sheetH - strip1Height;
      let upsInRemainder = 0;
      let remainderDesc = "";
      if (remainderH >= Math.min(jobW, jobH)) { // Check if remainder can fit at least one job
        for (const remOrient of orientations) {
           if (remOrient.w > 0 && remOrient.h > 0) { // Ensure valid dimensions for remainder orientation
            const remCols = Math.floor(sheetW / remOrient.w); // Remainder uses full sheet width
            const remRows = Math.floor(remainderH / remOrient.h);
            const remUps = remCols * remRows;
            if (remUps > upsInRemainder) {
              upsInRemainder = remUps;
              remainderDesc = ` + ${remCols}x${remRows} ${remOrient.label} (remainder)`;
            }
          }
        }
      }
      const totalUps = upsInStrip1 + upsInRemainder;
      if (totalUps > maxUps) {
        maxUps = totalUps;
        bestLayout = `${strip1Cols}x${rowsInStrip1} ${orient.label}${remainderDesc}`;
      }
    }
  }
  return { ups: maxUps, description: bestLayout };
}


const optimizeInventoryFlow = ai.defineFlow(
  {
    name: 'optimizeInventoryFlow',
    inputSchema: OptimizeInventoryInputSchema,
    outputSchema: OptimizeInventoryOutputSchema,
  },
  async (input): Promise<OptimizeInventoryOutput> => {
    console.log('[InventoryOptimization TS Flow] optimizeInventoryFlow called.');
    console.log('[InventoryOptimization TS Flow] Received input (availableMasterSheets count):', input.availableMasterSheets?.length);
    
    if (!input.availableMasterSheets || input.availableMasterSheets.length === 0) {
      console.log('[InventoryOptimization TS Flow] Input availableMasterSheets is empty. Returning empty suggestions.');
      return { suggestions: [], optimalSuggestion: undefined };
    }

    const { 
      targetPaperGsm, 
      targetPaperThicknessMm, 
      targetPaperQuality, 
      jobSizeWidth, 
      jobSizeHeight, 
      netQuantity 
    } = input;

    const allSuggestions: MasterSheetSuggestionSchema[] = [];

    for (const sheet of input.availableMasterSheets) {
      const targetUnit = getPaperQualityUnit(targetPaperQuality as any);
      const sheetUnit = getPaperQualityUnit(sheet.paperQuality as any);

      if (sheet.paperQuality !== targetPaperQuality) continue;
      if ((sheet.availableStock ?? 0) <= 0) continue;

      if (targetUnit === 'mm' && sheetUnit === 'mm') {
        if (targetPaperThicknessMm === undefined || sheet.paperThicknessMm === undefined || Math.abs(sheet.paperThicknessMm - targetPaperThicknessMm) > 0.1) {
          continue;
        }
      } else if (targetUnit === 'gsm' && sheetUnit === 'gsm') {
        if (targetPaperGsm === undefined || sheet.paperGsm === undefined) continue;
        const gsmTolerance = targetPaperGsm * 0.05;
        if (Math.abs(sheet.paperGsm - targetPaperGsm) > gsmTolerance) {
          continue;
        }
      } else {
        continue; // Mismatched quality types (e.g., trying to compare GSM with mm based)
      }

      let bestUpsForThisSheet = 0;
      let bestLayoutDesc = "N/A";
      
      // Calculate for original master sheet orientation
      const resOrig = calculateMaxGuillotineUps(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeWidth, sheet.masterSheetSizeHeight);
      if (resOrig.ups > bestUpsForThisSheet) {
        bestUpsForThisSheet = resOrig.ups;
        bestLayoutDesc = `${resOrig.description} (Master Portrait)`;
      }
      
      // Calculate for rotated master sheet orientation
      // Only rotate if width and height are different to avoid redundant calculation
      if (sheet.masterSheetSizeWidth !== sheet.masterSheetSizeHeight) {
        const resRot = calculateMaxGuillotineUps(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeHeight, sheet.masterSheetSizeWidth); // Note: H, W swapped for sheet
        if (resRot.ups > bestUpsForThisSheet) {
          bestUpsForThisSheet = resRot.ups;
          bestLayoutDesc = `${resRot.description} (Master Landscape)`;
        }
      }


      if (bestUpsForThisSheet === 0) {
        console.log(`[InventoryOptimization TS Flow] Sheet ID ${sheet.id} (${sheet.name}) yields 0 ups after all calculations. Skipping.`);
        continue;
      }

      const jobArea = jobSizeWidth * jobSizeHeight;
      const masterSheetArea = sheet.masterSheetSizeWidth * sheet.masterSheetSizeHeight;
      const usedArea = bestUpsForThisSheet * jobArea;
      const wastagePercentage = masterSheetArea > 0 ? Number(((1 - (usedArea / masterSheetArea)) * 100).toFixed(2)) : 100;
      const totalMasterSheetsNeeded = Math.ceil(netQuantity / bestUpsForThisSheet);
      
      allSuggestions.push({
        sourceInventoryItemId: sheet.id,
        masterSheetSizeWidth: sheet.masterSheetSizeWidth,
        masterSheetSizeHeight: sheet.masterSheetSizeHeight,
        paperGsm: sheet.paperGsm,
        paperThicknessMm: sheet.paperThicknessMm,
        paperQuality: sheet.paperQuality,
        sheetsPerMasterSheet: bestUpsForThisSheet,
        totalMasterSheetsNeeded,
        wastagePercentage,
        cuttingLayoutDescription: bestLayoutDesc,
      });
    }

    // Sort suggestions: Primary by sheetsPerMasterSheet (desc), secondary by wastagePercentage (asc), tertiary by totalMasterSheetsNeeded (asc)
    allSuggestions.sort((a, b) => {
      if (b.sheetsPerMasterSheet !== a.sheetsPerMasterSheet) {
        return b.sheetsPerMasterSheet - a.sheetsPerMasterSheet;
      }
      if (a.wastagePercentage !== b.wastagePercentage) {
        return a.wastagePercentage - b.wastagePercentage;
      }
      return a.totalMasterSheetsNeeded - b.totalMasterSheetsNeeded;
    });
    
    const optimalSuggestion = allSuggestions.length > 0 ? allSuggestions[0] : undefined;

    console.log(`[InventoryOptimization TS Flow] Processed ${input.availableMasterSheets.length} sheets. Generated ${allSuggestions.length} suggestions.`);
    if (optimalSuggestion) {
      console.log('[InventoryOptimization TS Flow] Optimal suggestion:', JSON.stringify(optimalSuggestion, null, 2));
    }

    return {
      suggestions: allSuggestions,
      optimalSuggestion: optimalSuggestion,
    };
  }
);

    
