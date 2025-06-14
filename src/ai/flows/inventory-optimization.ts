
// src/ai/flows/inventory-optimization.ts
'use server';
/**
 * @fileOverview A flow that suggests the best possible master sheet size from available inventory,
 * calculating the percentage of wastage based on different layout strategies.
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
import { countUpsWithMaxrects } from '@/lib/packing';


const AvailableSheetSchema = z.object({
  id: z.string().describe('The inventory ID of this available master sheet.'),
  masterSheetSizeWidth: z.number().describe('The width of this available master sheet in inches.'),
  masterSheetSizeHeight: z.number().describe('The height of this available master sheet in inches.'),
  paperGsm: z.number().optional().describe('The GSM of this available master sheet, if applicable.'),
  paperThicknessMm: z.number().optional().describe('The thickness in mm of this available master sheet, if applicable (e.g., for Kappa, MDF).'),
  paperQuality: z.string().describe('The quality of this available master sheet.'),
  availableStock: z.number().optional().describe('The available stock quantity for this master sheet.'),
  name: z.string().optional().describe('Name of the inventory item, for logging or debugging'),
  locationGodown: z.string().optional().describe('The godown where the item is stored.'),
  locationLineNumber: z.string().optional().describe('The line number/specific location in the godown.'),
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
  optimizationStrategy: z.enum(['GUILLOTINE', 'BIN_PACKING_2D']).default('GUILLOTINE').optional().describe('The optimization strategy to use. GUILLOTINE for straight cuts, BIN_PACKING_2D for more complex nesting (placeholder).')
});
export type OptimizeInventoryInput = z.infer<typeof OptimizeInventoryInputSchema>;

const MasterSheetSuggestionSchema = z.object({
  id: z.string().describe('The inventory ID of the master sheet used for this suggestion.'),
  masterSheetSizeWidth: z.number().describe('The width of the suggested master sheet size in inches (from inventory).'),
  masterSheetSizeHeight: z.number().describe('The height of the suggested master sheet size in inches (from inventory).'),
  paperGsm: z.number().optional().describe('The actual GSM of the suggested master sheet (from inventory), if applicable.'),
  paperThicknessMm: z.number().optional().describe('The actual thickness in mm of the suggested master sheet (from inventory), if applicable.'),
  paperQuality: z.string().describe('The actual paper quality of the suggested master sheet (from inventory).'),
  wastagePercentage: z.number().describe('The percentage of wastage for the suggested master sheet size.'),
  sheetsPerMasterSheet: z.number().int().describe('Number of job sheets that can be cut from one master sheet. Must be an integer.'),
  totalMasterSheetsNeeded: z.number().int().describe('Total number of master sheets needed to fulfill the job. Must be an integer.'),
  cuttingLayoutDescription: z.string().optional().describe("Textual description of the cutting layout, e.g., '3 across x 4 down (job portrait)' or 'Complex nested layout (see diagram)'. Bin packing might have more abstract descriptions."),
  locationGodown: z.string().optional().describe('The godown where the item is stored.'),
  locationLineNumber: z.string().optional().describe('The line number/specific location in the godown.'),
});

export type OptimizeInventoryOutput = ImportedOptimizeInventoryOutput;


export async function optimizeInventory(input: OptimizeInventoryInput): Promise<OptimizeInventoryOutput> {
  console.log('[InventoryOptimization TS Flow] optimizeInventory function called with input:', JSON.stringify(input, null, 2));
  return optimizeInventoryFlow(input);
}

const epsilon = 1e-6; // Epsilon for floating point comparisons

// Helper for specialized "macro staggered" layout.
function calculateMacroStaggeredUpsFixedInternal(
  jobW: number, jobH: number, sheetW: number, sheetH: number
) {
  let bestUps = 0;
  let bestDesc = undefined;
  const eps = epsilon; 
  console.log(`[StaggeredCalc] Input: jobW=${jobW}, jobH=${jobH}, sheetW=${sheetW}, sheetH=${sheetH}`);

  // CASE 1: Portrait rows on top, as many as fit; fill leftover with as many *rows* of rotated jobs as possible
  for (let portraitRows = 0; portraitRows <= Math.floor((sheetH + eps) / jobH); ++portraitRows) {
    const usedH = portraitRows * jobH;
    if (usedH > sheetH + eps) continue; // Ensure used height doesn't exceed sheet height with epsilon
    const remainingH = sheetH - usedH;

    const colsPortrait = Math.floor((sheetW + eps) / jobW);
    const upsPortrait = portraitRows * colsPortrait;

    let upsRotated = 0;
    let rotatedRows = 0;
    let rotatedCols = 0;
    // Check if remaining height can fit at least one rotated job's width (jobW)
    if (remainingH + eps >= jobW) { 
      rotatedRows = Math.floor((remainingH + eps) / jobW); // How many rows of rotated items fit
      rotatedCols = Math.floor((sheetW + eps) / jobH);    // How many columns of rotated items fit
      upsRotated = rotatedRows * rotatedCols;
    }
    const totalUps = upsPortrait + upsRotated;
    if (totalUps > bestUps) {
      bestUps = totalUps;
      bestDesc = `${colsPortrait}x${portraitRows} portrait + ${rotatedCols}x${rotatedRows} rotated in leftover`;
    }
  }

  // CASE 2: Rotated rows on top, as many as fit; fill leftover with as many portrait rows as possible
  for (let rotRows = 0; rotRows <= Math.floor((sheetH + eps) / jobW); ++rotRows) {
    const usedH = rotRows * jobW;
    if (usedH > sheetH + eps) continue; // Ensure used height doesn't exceed sheet height with epsilon
    const remainingH = sheetH - usedH;

    const colsRot = Math.floor((sheetW + eps) / jobH);
    const upsRot = rotRows * colsRot;

    let upsPortrait = 0;
    let portraitRowsInLeftover = 0; 
    let colsPortraitInLeftover = 0; 
    // Check if remaining height can fit at least one portrait job's height (jobH)
    if (remainingH + eps >= jobH) { 
      portraitRowsInLeftover = Math.floor((remainingH + eps) / jobH); // How many rows of portrait items fit
      colsPortraitInLeftover = Math.floor((sheetW + eps) / jobW);    // How many columns of portrait items fit
      upsPortrait = portraitRowsInLeftover * colsPortraitInLeftover;
    }

    const totalUps = upsPortrait + upsRot;
    if (totalUps > bestUps) {
      bestUps = totalUps;
      bestDesc = `${colsRot}x${rotRows} rotated + ${colsPortraitInLeftover}x${portraitRowsInLeftover} portrait in leftover`;
    }
  }
  console.log(`[StaggeredCalc] Final best for this job/sheet combo: ${bestUps} ups, desc: ${bestDesc}`);
  return { ups: bestUps, description: bestDesc };
}


// Guillotine Cut Calculation
function calculateMaxGuillotineUps(jobW: number, jobH: number, sheetW: number, sheetH: number) {
  let maxUps = 0;
  let bestLayout = "N/A";
  console.log(`[GuillotineCalc] Input: jobW=${jobW}, jobH=${jobH}, sheetW=${sheetW}, sheetH=${sheetH}`);
  
  if (jobW <= 0 || jobH <=0 || sheetW <=0 || sheetH <= 0) {
      console.warn(`[GuillotineCalc] Invalid zero or negative dimension. Job: ${jobW}x${jobH}, Sheet: ${sheetW}x${sheetH}. Returning 0 ups.`);
      return { ups: 0, description: "Invalid dimensions" };
  }

  const orientations = [
    {w: jobW, h: jobH, label: 'portrait'},
    {w: jobH, h: jobW, label: 'landscape'}
  ];

  for (const orient of orientations) {
    console.log(`[GuillotineCalc] Testing job orientation: ${orient.label} (Job Dim: ${orient.w}x${orient.h})`);
    if (orient.w <=0 || orient.h <=0) {
        console.log(`[GuillotineCalc] Invalid job orientation dimension. Skipping.`);
        continue;
    }

    // Strategy 1: Primary cut along width (vertical cuts first)
    for (let colsInStrip1 = 1; colsInStrip1 <= Math.floor(sheetW / orient.w + epsilon); colsInStrip1++) {
      const strip1Width = colsInStrip1 * orient.w;
      const rowsInStrip1 = Math.floor(sheetH / orient.h + epsilon);
      const upsInStrip1 = colsInStrip1 * rowsInStrip1;

      const remainderW = sheetW - strip1Width;
      let upsInRemainder = 0;
      let remainderLayoutDesc = undefined;
      if (remainderW >= Math.min(jobW, jobH) - epsilon) {
        for (const remOrient of orientations) {
          if(remOrient.w <=0 || remOrient.h <=0) continue;
          const remCols = Math.floor(remainderW / remOrient.w + epsilon);
          const remRows = Math.floor(sheetH / remOrient.h + epsilon);
          const currentRemainderUps = remCols * remRows;
          if (currentRemainderUps > upsInRemainder) {
            upsInRemainder = currentRemainderUps;
            remainderLayoutDesc = ` + ${remCols}x${remRows} ${remOrient.label} (right remainder)`;
          }
        }
      }
      const totalUps = upsInStrip1 + upsInRemainder;
      if (totalUps > maxUps) {
        maxUps = totalUps;
        bestLayout = `${colsInStrip1}x${rowsInStrip1} ${orient.label} (main strip)${remainderLayoutDesc}`;
        console.log(`[GuillotineCalc] Strategy 1 New best: ${maxUps} ups, layout: ${bestLayout}`);
      }
    }

    // Strategy 2: Primary cut along height (horizontal cuts first)
    for (let rowsInStrip1 = 1; rowsInStrip1 <= Math.floor(sheetH / orient.h + epsilon); rowsInStrip1++) {
      const strip1Height = rowsInStrip1 * orient.h;
      const colsInStrip1 = Math.floor(sheetW / orient.w + epsilon);
      const upsInStrip1 = colsInStrip1 * rowsInStrip1;

      const remainderH = sheetH - strip1Height;
      let upsInRemainder = 0;
      let remainderLayoutDesc = undefined;
      if (remainderH >= Math.min(jobW, jobH) - epsilon) {
        for (const remOrient of orientations) {
          if(remOrient.w <=0 || remOrient.h <=0) continue;
          const remCols = Math.floor(sheetW / remOrient.w + epsilon);
          const remRows = Math.floor(remainderH / remOrient.h + epsilon);
          const currentRemainderUps = remCols * remRows;
          if (currentRemainderUps > upsInRemainder) {
            upsInRemainder = currentRemainderUps;
            remainderLayoutDesc = ` + ${remCols}x${remRows} ${remOrient.label} (bottom remainder)`;
          }
        }
      }
      const totalUps = upsInStrip1 + upsInRemainder;
      if (totalUps > maxUps) {
        maxUps = totalUps;
        bestLayout = `${colsInStrip1}x${rowsInStrip1} ${orient.label} (main strip)${remainderLayoutDesc}`;
        console.log(`[GuillotineCalc] Strategy 2 New best: ${maxUps} ups, layout: ${bestLayout}`);
      }
    }
    
    // Strategy 3: Check Macro Staggered Layout
    console.log(`[GuillotineCalc][S3] === Macro Staggered Check for Job Orient: ${orient.label} (${orient.w}x${orient.h}) on Sheet ${sheetW}x${sheetH} ===`);
    console.log(`[GuillotineCalc][S3] Current maxUps BEFORE staggered: ${maxUps}, bestLayout: ${bestLayout}`);
    const staggeredResult = calculateMacroStaggeredUpsFixedInternal(orient.w, orient.h, sheetW, sheetH);
    console.log(`[GuillotineCalc][S3] Macro Staggered Raw Result: Ups=${staggeredResult.ups}, Desc='${staggeredResult.description}'`);
    
    if (staggeredResult.ups > maxUps) {
      console.log(`[GuillotineCalc][S3] !!! NEW BEST from Macro Staggered !!! Ups: ${staggeredResult.ups} (was ${maxUps}). Adopting.`);
      maxUps = staggeredResult.ups;
      bestLayout = `${staggeredResult.description} (macro staggered ${orient.label})`;
    } else {
      console.log(`[GuillotineCalc][S3] Macro Staggered (${staggeredResult.ups} ups) did NOT beat current maxUps (${maxUps}). No change to maxUps.`);
    }
    console.log(`[GuillotineCalc][S3] Current maxUps AFTER staggered for this orient: ${maxUps}, bestLayout: ${bestLayout}`);
    console.log(`[GuillotineCalc][S3] === END Macro Staggered Check for Job Orient: ${orient.label} ===`);
  }
  console.log(`[GuillotineCalc] FINAL Max Ups for job ${jobW}x${jobH} on sheet ${sheetW}x${sheetH} after all orientations: ${maxUps}, Layout: ${bestLayout}`);
  return { ups: maxUps, description: bestLayout };
}

/**
 * Calculates inventory suggestions based on guillotine cutting logic.
 */
async function getGuillotineLayoutSuggestions(
  input: OptimizeInventoryInput
): Promise<OptimizeInventoryOutput> {
  console.log('[InventoryOptimization TS Flow] Starting GUILLOTINE-BASED optimization.');
  const { 
    targetPaperGsm, 
    targetPaperThicknessMm, 
    targetPaperQuality, 
    jobSizeWidth, 
    jobSizeHeight, 
    netQuantity 
  } = input;

  const allSuggestions: z.infer<typeof MasterSheetSuggestionSchema>[] = [];

  for (const sheet of input.availableMasterSheets) {
    console.log(`[GuillotineStrategy] Processing sheet ID: ${sheet.id}, Name: ${sheet.name || 'N/A'}, Size: ${sheet.masterSheetSizeWidth}x${sheet.masterSheetSizeHeight}, Quality: ${sheet.paperQuality}, Stock: ${sheet.availableStock}`);
    const targetUnit = getPaperQualityUnit(targetPaperQuality as any);
    const sheetUnit = getPaperQualityUnit(sheet.paperQuality as any);

    if (sheet.paperQuality !== targetPaperQuality) {
      console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} Quality (${sheet.paperQuality}) mismatch with target (${targetPaperQuality}). Skipping.`);
      continue;
    }
    if ((sheet.availableStock ?? 0) <= 0) {
      console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} has no available stock. Skipping.`);
      continue;
    }

    if (targetUnit === 'mm' && sheetUnit === 'mm') {
      if (targetPaperThicknessMm === undefined || sheet.paperThicknessMm === undefined || Math.abs(sheet.paperThicknessMm - targetPaperThicknessMm) > 0.1) { 
        console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} Thickness mismatch (Sheet: ${sheet.paperThicknessMm}mm, Target: ${targetPaperThicknessMm}mm). Skipping.`);
        continue;
      }
    } else if (targetUnit === 'gsm' && sheetUnit === 'gsm') {
      if (targetPaperGsm === undefined || sheet.paperGsm === undefined) {
          console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} or target GSM is undefined. Skipping.`);
          continue;
      }
      const gsmTolerance = targetPaperGsm * 0.05; 
      if (Math.abs(sheet.paperGsm - targetPaperGsm) > gsmTolerance) {
        console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} GSM mismatch (Sheet: ${sheet.paperGsm}gsm, Target: ${targetPaperGsm}gsm, Tolerance: ${gsmTolerance.toFixed(2)}). Skipping.`);
        continue;
      }
    } else {
      console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} Unit mismatch (Sheet Unit: ${sheetUnit}, Target Unit: ${targetUnit}). Skipping.`);
      continue; 
    }
    
    let bestUpsForThisSheet = 0;
    let bestLayoutDesc = "N/A";
    let effectiveSheetW = sheet.masterSheetSizeWidth;
    let effectiveSheetH = sheet.masterSheetSizeHeight;
    
    console.log(`[GuillotineStrategy] Sheet ID ${sheet.id}: Calculating for original orientation (${sheet.masterSheetSizeWidth}x${sheet.masterSheetSizeHeight})`);
    const resOrig = calculateMaxGuillotineUps(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeWidth, sheet.masterSheetSizeHeight);
    console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} (Original Orient): Ups=${resOrig.ups}, Layout='${resOrig.description}'`);
    if (resOrig.ups > bestUpsForThisSheet) {
      bestUpsForThisSheet = resOrig.ups;
      bestLayoutDesc = `${resOrig.description} (Master Portrait)`;
      effectiveSheetW = sheet.masterSheetSizeWidth;
      effectiveSheetH = sheet.masterSheetSizeHeight;
    }
    
    if (Math.abs(sheet.masterSheetSizeWidth - sheet.masterSheetSizeHeight) > epsilon) { 
      console.log(`[GuillotineStrategy] Sheet ID ${sheet.id}: Calculating for rotated orientation (${sheet.masterSheetSizeHeight}x${sheet.masterSheetSizeWidth})`);
      const resRot = calculateMaxGuillotineUps(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeHeight, sheet.masterSheetSizeWidth);
      console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} (Rotated Orient): Ups=${resRot.ups}, Layout='${resRot.description}'`);
      if (resRot.ups > bestUpsForThisSheet) {
        bestUpsForThisSheet = resRot.ups;
        bestLayoutDesc = `${resRot.description} (Master Landscape)`;
        effectiveSheetW = sheet.masterSheetSizeHeight; 
        effectiveSheetH = sheet.masterSheetSizeWidth;
      }
    }

    if (bestUpsForThisSheet === 0) {
      console.log(`[GuillotineStrategy] Sheet ID ${sheet.id} (${sheet.name || 'Unknown Name'}) yields 0 ups after all calculations. Skipping.`);
      continue;
    }

    const jobArea = jobSizeWidth * jobSizeHeight;
    const masterSheetAreaUsedForLayout = effectiveSheetW * effectiveSheetH; 
    const usedArea = bestUpsForThisSheet * jobArea;
    const wastagePercentage = masterSheetAreaUsedForLayout > 0 ? Number(((1 - (usedArea / masterSheetAreaUsedForLayout)) * 100).toFixed(2)) : 100;
    const totalMasterSheetsNeeded = Math.ceil(netQuantity / bestUpsForThisSheet);
    
    const currentSuggestion: z.infer<typeof MasterSheetSuggestionSchema> = {
      id: sheet.id,
      masterSheetSizeWidth: sheet.masterSheetSizeWidth,
      masterSheetSizeHeight: sheet.masterSheetSizeHeight,
      paperGsm: sheet.paperGsm,
      paperThicknessMm: sheet.paperThicknessMm,
      paperQuality: sheet.paperQuality,
      sheetsPerMasterSheet: bestUpsForThisSheet,
      totalMasterSheetsNeeded,
      wastagePercentage,
      cuttingLayoutDescription: bestLayoutDesc,
      locationGodown: sheet.locationGodown,
      locationLineNumber: sheet.locationLineNumber,
    };
    allSuggestions.push(currentSuggestion);
    console.log(`[GuillotineStrategy] Sheet ID ${sheet.id}: Added suggestion - Ups=${bestUpsForThisSheet}, Wastage=${wastagePercentage}%, Layout='${bestLayoutDesc}'`);
  }

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

  console.log(`[GuillotineStrategy] Processed ${input.availableMasterSheets.length} sheets. Generated ${allSuggestions.length} suggestions.`);
  if (optimalSuggestion) {
    console.log('[GuillotineStrategy] Optimal suggestion:', JSON.stringify(optimalSuggestion, null, 2));
  }
  return {
    suggestions: allSuggestions,
    optimalSuggestion: optimalSuggestion,
  };
}

/**
 * Calculates inventory suggestions based on 2D Bin Packing (MaxRects).
 */
async function get2DBinPackingLayoutSuggestions(
  input: OptimizeInventoryInput
): Promise<OptimizeInventoryOutput> {
  console.log('[InventoryOptimization TS Flow] Starting 2D BIN PACKING (MaxRects) optimization.');
  const { 
    targetPaperGsm, 
    targetPaperThicknessMm, 
    targetPaperQuality, 
    jobSizeWidth, 
    jobSizeHeight, 
    netQuantity 
  } = input;

  const allSuggestions: z.infer<typeof MasterSheetSuggestionSchema>[] = [];

  for (const sheet of input.availableMasterSheets) {
    console.log(`[BinPackingStrategy] Processing sheet ID: ${sheet.id}, Name: ${sheet.name || 'N/A'}, Size: ${sheet.masterSheetSizeWidth}x${sheet.masterSheetSizeHeight}, Quality: ${sheet.paperQuality}, Stock: ${sheet.availableStock}`);
    const targetUnit = getPaperQualityUnit(targetPaperQuality as any);
    const sheetUnit = getPaperQualityUnit(sheet.paperQuality as any);

    // --- Quality and Stock Checks (same as Guillotine) ---
    if (sheet.paperQuality !== targetPaperQuality) {
      console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} Quality (${sheet.paperQuality}) mismatch with target (${targetPaperQuality}). Skipping.`);
      continue;
    }
    if ((sheet.availableStock ?? 0) <= 0) {
      console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} has no available stock. Skipping.`);
      continue;
    }
    if (targetUnit === 'mm' && sheetUnit === 'mm') {
      if (targetPaperThicknessMm === undefined || sheet.paperThicknessMm === undefined || Math.abs(sheet.paperThicknessMm - targetPaperThicknessMm) > 0.1) {
        console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} Thickness mismatch. Skipping.`);
        continue;
      }
    } else if (targetUnit === 'gsm' && sheetUnit === 'gsm') {
      if (targetPaperGsm === undefined || sheet.paperGsm === undefined) {
        console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} or target GSM undefined. Skipping.`);
        continue;
      }
      const gsmTolerance = targetPaperGsm * 0.05;
      if (Math.abs(sheet.paperGsm - targetPaperGsm) > gsmTolerance) {
        console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} GSM mismatch. Skipping.`);
        continue;
      }
    } else {
      console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} Unit mismatch. Skipping.`);
      continue;
    }

    let bestUpsForThisSheet = 0;
    let bestLayoutDesc = "N/A";
    let effectiveSheetW = sheet.masterSheetSizeWidth;
    let effectiveSheetH = sheet.masterSheetSizeHeight;
    const allowRotationForPacker = true; 

    // Calculate for original master sheet orientation
    console.log(`[BinPackingStrategy] Sheet ID ${sheet.id}: Calculating for original orientation (${sheet.masterSheetSizeWidth}x${sheet.masterSheetSizeHeight}) using MaxRects. Job: ${jobSizeWidth}x${jobSizeHeight}`);
    const resOrig = countUpsWithMaxrects(
      jobSizeWidth, 
      jobSizeHeight, 
      sheet.masterSheetSizeWidth, 
      sheet.masterSheetSizeHeight, 
      allowRotationForPacker
    );
    console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} (Original Orient - MaxRects): Ups=${resOrig.ups}, Layout='${resOrig.layoutDescription}'`);
    if (resOrig.ups > bestUpsForThisSheet) {
      bestUpsForThisSheet = resOrig.ups;
      bestLayoutDesc = `${resOrig.layoutDescription} (Master Portrait)`;
      effectiveSheetW = sheet.masterSheetSizeWidth;
      effectiveSheetH = sheet.masterSheetSizeHeight;
    }

    // Calculate for rotated master sheet orientation (if not square)
    if (Math.abs(sheet.masterSheetSizeWidth - sheet.masterSheetSizeHeight) > epsilon) {
      console.log(`[BinPackingStrategy] Sheet ID ${sheet.id}: Calculating for rotated orientation (${sheet.masterSheetSizeHeight}x${sheet.masterSheetSizeWidth}) using MaxRects. Job: ${jobSizeWidth}x${jobSizeHeight}`);
      const resRot = countUpsWithMaxrects(
        jobSizeWidth, 
        jobSizeHeight, 
        sheet.masterSheetSizeHeight, 
        sheet.masterSheetSizeWidth,  
        allowRotationForPacker
      );
      console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} (Rotated Orient - MaxRects): Ups=${resRot.ups}, Layout='${resRot.layoutDescription}'`);
      if (resRot.ups > bestUpsForThisSheet) {
        bestUpsForThisSheet = resRot.ups;
        bestLayoutDesc = `${resRot.layoutDescription} (Master Landscape)`;
        effectiveSheetW = sheet.masterSheetSizeHeight;
        effectiveSheetH = sheet.masterSheetSizeWidth;
      }
    }
    
    if (bestUpsForThisSheet === 0) {
      console.log(`[BinPackingStrategy] Sheet ID ${sheet.id} (${sheet.name || 'Unknown Name'}) yields 0 ups with MaxRects. Skipping.`);
      continue;
    }

    const jobArea = jobSizeWidth * jobSizeHeight;
    const masterSheetAreaUsedForLayout = effectiveSheetW * effectiveSheetH; 
    const usedArea = bestUpsForThisSheet * jobArea;
    const wastagePercentage = masterSheetAreaUsedForLayout > 0 ? Number(((1 - (usedArea / masterSheetAreaUsedForLayout)) * 100).toFixed(2)) : 100;
    const totalMasterSheetsNeeded = Math.ceil(netQuantity / bestUpsForThisSheet);

    const currentSuggestion: z.infer<typeof MasterSheetSuggestionSchema> = {
      id: sheet.id,
      masterSheetSizeWidth: sheet.masterSheetSizeWidth,
      masterSheetSizeHeight: sheet.masterSheetSizeHeight,
      paperGsm: sheet.paperGsm,
      paperThicknessMm: sheet.paperThicknessMm,
      paperQuality: sheet.paperQuality,
      sheetsPerMasterSheet: bestUpsForThisSheet,
      totalMasterSheetsNeeded,
      wastagePercentage,
      cuttingLayoutDescription: bestLayoutDesc,
      locationGodown: sheet.locationGodown,
      locationLineNumber: sheet.locationLineNumber,
    };
    allSuggestions.push(currentSuggestion);
    console.log(`[BinPackingStrategy] Sheet ID ${sheet.id}: Added suggestion - Ups=${bestUpsForThisSheet}, Wastage=${wastagePercentage}%, Layout='${bestLayoutDesc}'`);
  }

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

  console.log(`[BinPackingStrategy] Processed ${input.availableMasterSheets.length} sheets. Generated ${allSuggestions.length} suggestions with MaxRects.`);
  if (optimalSuggestion) {
    console.log('[BinPackingStrategy] Optimal suggestion (MaxRects):', JSON.stringify(optimalSuggestion, null, 2));
  }
  return {
    suggestions: allSuggestions,
    optimalSuggestion: optimalSuggestion,
  };
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
    console.log('[InventoryOptimization TS Flow] Selected strategy:', input.optimizationStrategy || 'GUILLOTINE (default)');
    
    if (!input.availableMasterSheets || input.availableMasterSheets.length === 0) {
      console.log('[InventoryOptimization TS Flow] Input availableMasterSheets is empty. Returning empty suggestions.');
      return { suggestions: [], optimalSuggestion: undefined };
    }

    let result: OptimizeInventoryOutput;

    if (input.optimizationStrategy === 'BIN_PACKING_2D') {
      console.log('[InventoryOptimization TS Flow] Attempting 2D Bin Packing strategy (MaxRects).');
      result = await get2DBinPackingLayoutSuggestions(input);
    } else { // Default to GUILLOTINE
      console.log('[InventoryOptimization TS Flow] Using GUILLOTINE strategy.');
      result = await getGuillotineLayoutSuggestions(input);
    }
    
    console.log('[InventoryOptimization TS Flow] All sorted suggestions:', JSON.stringify(result.suggestions, null, 2));
    return result;
  }
);
    

      

    