
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

// Helper function to calculate ups for a given job and sheet orientation (simple fill)
function calculateSimpleFill(
  jobW: number, jobH: number, // Job dimensions for this attempt
  sheetW: number, sheetH: number // Sheet dimensions for this attempt
): { ups: number; cols: number; rows: number; jobOrientation: 'portrait' | 'landscape' } {
  // Attempt 1: Job as is (jobW x jobH)
  const colsP = Math.floor(sheetW / jobW);
  const rowsP = Math.floor(sheetH / jobH);
  const upsP = colsP * rowsP;

  // Attempt 2: Job rotated (jobH x jobW)
  const colsL = Math.floor(sheetW / jobH);
  const rowsL = Math.floor(sheetH / jobW);
  const upsL = colsL * rowsL;

  if (upsP >= upsL) {
    return { ups: upsP, cols: colsP, rows: rowsP, jobOrientation: 'portrait' };
  } else {
    return { ups: upsL, cols: colsL, rows: rowsL, jobOrientation: 'landscape' };
  }
}


// Helper function for two-stage guillotine cuts
function calculateTwoStageGuillotine(
  jobW_orig: number, jobH_orig: number, // Original job dimensions
  sheetW_eff: number, sheetH_eff: number // Effective sheet dimensions for this attempt
): { ups: number; description: string } {
  let maxUps = 0;
  let description = "N/A";

  // Primary Orientation: Job Portrait (jobW_orig x jobH_orig)
  // Secondary Orientation: Job Landscape (jobH_orig x jobW_orig)

  // Strategy 1: Horizontal primary cut, fill first strip with Job Portrait
  if (sheetH_eff >= jobH_orig) {
    const strip1_cols = Math.floor(sheetW_eff / jobW_orig);
    const strip1_rows = 1; // Only one row for the primary strip height
    const ups_strip1 = strip1_cols * strip1_rows;

    if (ups_strip1 > 0) {
      const remainderH = sheetH_eff - jobH_orig;
      let totalUps = ups_strip1;
      let currentDesc = `${strip1_cols}x${strip1_rows} JP`;

      if (remainderH > 0) {
        const remainderFill = calculateSimpleFill(jobW_orig, jobH_orig, sheetW_eff, remainderH);
        if (remainderFill.ups > 0) {
          totalUps += remainderFill.ups;
          currentDesc += ` + ${remainderFill.cols}x${remainderFill.rows} ${remainderFill.jobOrientation === 'portrait' ? 'JP' : 'JL'} (rem H)`;
        }
      }
      if (totalUps > maxUps) {
        maxUps = totalUps;
        description = currentDesc;
      }
    }
  }

  // Strategy 2: Horizontal primary cut, fill first strip with Job Landscape
  if (sheetH_eff >= jobW_orig) { // Job height for landscape is jobW_orig
    const strip1_cols = Math.floor(sheetW_eff / jobH_orig); // width of landscape job
    const strip1_rows = 1;
    const ups_strip1 = strip1_cols * strip1_rows;

    if (ups_strip1 > 0) {
      const remainderH = sheetH_eff - jobW_orig; // height of landscape job
      let totalUps = ups_strip1;
      let currentDesc = `${strip1_cols}x${strip1_rows} JL`;

      if (remainderH > 0) {
        const remainderFill = calculateSimpleFill(jobW_orig, jobH_orig, sheetW_eff, remainderH);
        if (remainderFill.ups > 0) {
          totalUps += remainderFill.ups;
          currentDesc += ` + ${remainderFill.cols}x${remainderFill.rows} ${remainderFill.jobOrientation === 'portrait' ? 'JP' : 'JL'} (rem H)`;
        }
      }
      if (totalUps > maxUps) {
        maxUps = totalUps;
        description = currentDesc;
      }
    }
  }
  
  // Strategy 3: Vertical primary cut, fill first strip with Job Portrait
  if (sheetW_eff >= jobW_orig) {
    const strip1_cols = 1;
    const strip1_rows = Math.floor(sheetH_eff / jobH_orig);
    const ups_strip1 = strip1_cols * strip1_rows;

    if (ups_strip1 > 0) {
      const remainderW = sheetW_eff - jobW_orig;
      let totalUps = ups_strip1;
      let currentDesc = `${strip1_cols}x${strip1_rows} JP`;
      
      if (remainderW > 0) {
        const remainderFill = calculateSimpleFill(jobW_orig, jobH_orig, remainderW, sheetH_eff);
        if (remainderFill.ups > 0) {
          totalUps += remainderFill.ups;
          currentDesc += ` + ${remainderFill.cols}x${remainderFill.rows} ${remainderFill.jobOrientation === 'portrait' ? 'JP' : 'JL'} (rem V)`;
        }
      }
      if (totalUps > maxUps) {
        maxUps = totalUps;
        description = currentDesc;
      }
    }
  }

  // Strategy 4: Vertical primary cut, fill first strip with Job Landscape
  if (sheetW_eff >= jobH_orig) { // Job width for landscape is jobH_orig
    const strip1_cols = 1;
    const strip1_rows = Math.floor(sheetH_eff / jobW_orig); // height of landscape job
    const ups_strip1 = strip1_cols * strip1_rows;

    if (ups_strip1 > 0) {
      const remainderW = sheetW_eff - jobH_orig; // width of landscape job
      let totalUps = ups_strip1;
      let currentDesc = `${strip1_cols}x${strip1_rows} JL`;

      if (remainderW > 0) {
        const remainderFill = calculateSimpleFill(jobW_orig, jobH_orig, remainderW, sheetH_eff);
        if (remainderFill.ups > 0) {
          totalUps += remainderFill.ups;
          currentDesc += ` + ${remainderFill.cols}x${remainderFill.rows} ${remainderFill.jobOrientation === 'portrait' ? 'JP' : 'JL'} (rem V)`;
        }
      }
      if (totalUps > maxUps) {
        maxUps = totalUps;
        description = currentDesc;
      }
    }
  }
  
  return { ups: maxUps, description };
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
      // 1. Filtering based on quality and GSM/Thickness
      const targetUnit = getPaperQualityUnit(targetPaperQuality as any);
      const sheetUnit = getPaperQualityUnit(sheet.paperQuality as any);

      if (sheet.paperQuality !== targetPaperQuality) continue;
      if ((sheet.availableStock ?? 0) <= 0) continue;


      if (targetUnit === 'mm' && sheetUnit === 'mm') {
        if (targetPaperThicknessMm === undefined || sheet.paperThicknessMm === undefined || Math.abs(sheet.paperThicknessMm - targetPaperThicknessMm) > 0.1) { // Tolerance
          continue;
        }
      } else if (targetUnit === 'gsm' && sheetUnit === 'gsm') {
        if (targetPaperGsm === undefined || sheet.paperGsm === undefined) continue;
        const gsmTolerance = targetPaperGsm * 0.05; // 5% tolerance
        if (Math.abs(sheet.paperGsm - targetPaperGsm) > gsmTolerance) {
          continue;
        }
      } else {
        // Mismatch in unit types (e.g. target is GSM, sheet is MM), or invalid quality
        continue;
      }

      let bestUpsForThisSheet = 0;
      let bestLayoutDesc = "N/A";
      let masterWasRotated = false;

      // Calculation for original master sheet orientation
      const resOrig = calculateOptimalGuillotineLayout(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeWidth, sheet.masterSheetSizeHeight);
      if (resOrig.ups > bestUpsForThisSheet) {
        bestUpsForThisSheet = resOrig.ups;
        bestLayoutDesc = `${resOrig.description} (Master Portrait)`;
        masterWasRotated = false;
      }
      
      // Calculation for rotated master sheet orientation
      const resRot = calculateOptimalGuillotineLayout(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeHeight, sheet.masterSheetSizeWidth); // Note: H, W swapped
      if (resRot.ups > bestUpsForThisSheet) {
        bestUpsForThisSheet = resRot.ups;
        bestLayoutDesc = `${resRot.description} (Master Landscape)`;
        masterWasRotated = true;
      }


      if (bestUpsForThisSheet === 0) {
        console.log(`[InventoryOptimization TS Flow] Sheet ID ${sheet.id} yields 0 ups after all calculations. Skipping.`);
        continue;
      }

      const jobArea = jobSizeWidth * jobSizeHeight;
      const masterSheetArea = sheet.masterSheetSizeWidth * sheet.masterSheetSizeHeight; // Always use original area for wastage
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

    // Sort suggestions: highest ups, then lowest wastage, then fewest total masters
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

    