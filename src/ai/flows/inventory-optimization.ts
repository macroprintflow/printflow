
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

const OptimizeInventoryOutputSchema = z.object({
  suggestions: z.array(MasterSheetSuggestionSchema).describe('An array of master sheet size suggestions, sorted by sheetsPerMasterSheet (highest first), then wastage percentage (lowest first).'),
  optimalSuggestion: MasterSheetSuggestionSchema.optional().describe('The optimal master sheet size suggestion based on the highest sheetsPerMasterSheet and then lowest wastage percentage.'),
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
  let bestDesc = "";
  const eps = epsilon; 
  console.log(`[StaggeredCalc] Input: jobW=${jobW}, jobH=${jobH}, sheetW=${sheetW}, sheetH=${sheetH}`);

  // CASE 1: Portrait rows on top, as many as fit; fill leftover with as many *rows* of rotated jobs as possible
  for (let portraitRows = 0; portraitRows <= Math.floor((sheetH + eps) / jobH); ++portraitRows) {
    const usedH = portraitRows * jobH;
    if (usedH > sheetH + eps) continue;
    const remainingH = sheetH - usedH;

    const colsPortrait = Math.floor((sheetW + eps) / jobW);
    const upsPortrait = portraitRows * colsPortrait;

    let upsRotated = 0;
    let rotatedRows = 0;
    let rotatedCols = 0;
    if (remainingH + eps >= jobW) { 
      rotatedRows = Math.floor((remainingH + eps) / jobW); 
      rotatedCols = Math.floor((sheetW + eps) / jobH);    
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
    if (usedH > sheetH + eps) continue;
    const remainingH = sheetH - usedH;

    const colsRot = Math.floor((sheetW + eps) / jobH);
    const upsRot = rotRows * colsRot;

    let upsPortrait = 0;
    let portraitRowsInLeftover = 0; 
    let colsPortraitInLeftover = 0; 
    if (remainingH + eps >= jobH) { 
      portraitRowsInLeftover = Math.floor((remainingH + eps) / jobH); 
      colsPortraitInLeftover = Math.floor((sheetW + eps) / jobW);    
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
      let remainderLayoutDesc = "";
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
      let remainderLayoutDesc = "";
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
    console.log(`[GuillotineCalc] Calling Macro Staggered for job orient ${orient.label} (${orient.w}x${orient.h}) on sheet ${sheetW}x${sheetH}`);
    const staggeredResult = calculateMacroStaggeredUpsFixedInternal(orient.w, orient.h, sheetW, sheetH);
    console.log(`[GuillotineCalc] Macro Staggered result for job orient ${orient.label}: ${staggeredResult.ups} ups, desc: ${staggeredResult.description}`);
    if (staggeredResult.ups > maxUps) {
        maxUps = staggeredResult.ups;
        bestLayout = `${staggeredResult.description} (macro staggered ${orient.label})`;
        console.log(`[GuillotineCalc] Macro Staggered New best: ${maxUps} ups, layout: ${bestLayout}`);
    }
  }
  console.log(`[GuillotineCalc] Final result for job ${jobW}x${jobH} on sheet ${sheetW}x${sheetH}: ${maxUps} ups, layout: ${bestLayout}`);
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
    
    const currentSuggestion = {
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
 * Placeholder for 2D Bin Packing strategy.
 * This would involve a different set of algorithms, potentially from a library.
 */
async function get2DBinPackingLayoutSuggestions(
  input: OptimizeInventoryInput
): Promise<OptimizeInventoryOutput> {
  console.warn('[InventoryOptimization TS Flow] 2D Bin Packing strategy is NOT YET IMPLEMENTED. This function is a placeholder.');
  console.log('[2DBinPacking] Received input:', JSON.stringify(input, null, 2));
  
  // --- Step 1: Prepare items for the bin packing library ---
  // The items to pack are multiple copies of the job sheet (jobSizeWidth x jobSizeHeight).
  // The bin is one of the availableMasterSheets.
  // You'll likely iterate through each availableMasterSheet that matches quality criteria,
  // similar to the guillotine strategy.

  // For each suitable master sheet from input.availableMasterSheets:
  //   const masterSheet = /* current master sheet */;
  //   const itemsToPack = [];
  //   // Create a list of job items. Some libraries might take a count, others might need individual items.
  //   // For simplicity, let's assume we are trying to fit as many as possible on *one* master sheet.
  //   // The library might tell us how many fit.
  //   for (let i = 0; i < 1000; i++) { // Pack a large number to see max fit, or adjust based on library
  //      itemsToPack.push({ id: `job_item_${i}`, width: input.jobSizeWidth, height: input.jobSizeHeight, allowRotation: true });
  //   }

  //   const bin = { width: masterSheet.masterSheetSizeWidth, height: masterSheet.masterSheetSizeHeight };

  // --- Step 2: Call the 2D Bin Packing Library ---
  //   // This is pseudo-code, replace with actual library calls
  //   // const packer = new SomeBinPackingLibrary(bin.width, bin.height, { /* options */ });
  //   // const result = packer.pack(itemsToPack);
  //   // const packedItems = result.packedItems; // Or however the library returns successfully packed items

  // --- Step 3: Process the Library's Results ---
  //   let sheetsPerMasterSheet = 0;
  //   if (packedItems && packedItems.length > 0) {
  //     sheetsPerMasterSheet = packedItems.length; // Number of job items that fit on this one master sheet
  //   }

  //   if (sheetsPerMasterSheet > 0) {
  //     const jobArea = input.jobSizeWidth * input.jobSizeHeight;
  //     const masterSheetArea = masterSheet.masterSheetSizeWidth * masterSheet.masterSheetSizeHeight;
  //     const usedArea = sheetsPerMasterSheet * jobArea;
  //     const wastagePercentage = masterSheetArea > 0 ? Number(((1 - (usedArea / masterSheetArea)) * 100).toFixed(2)) : 100;
  //     const totalMasterSheetsNeeded = Math.ceil(input.netQuantity / sheetsPerMasterSheet);

  //     const suggestion: z.infer<typeof MasterSheetSuggestionSchema> = {
  //       id: masterSheet.id,
  //       masterSheetSizeWidth: masterSheet.masterSheetSizeWidth,
  //       masterSheetSizeHeight: masterSheet.masterSheetSizeHeight,
  //       paperGsm: masterSheet.paperGsm,
  //       paperThicknessMm: masterSheet.paperThicknessMm,
  //       paperQuality: masterSheet.paperQuality,
  //       sheetsPerMasterSheet,
  //       totalMasterSheetsNeeded,
  //       wastagePercentage,
  //       cuttingLayoutDescription: `2D Bin Packed: ${sheetsPerMasterSheet} ups. (Further details depend on library output visualization or processing)`,
  //       locationGodown: masterSheet.locationGodown,
  //       locationLineNumber: masterSheet.locationLineNumber,
  //     };
  //     // Add this suggestion to a list of suggestions for 2D packing
  //   }

  // After iterating all suitable master sheets and collecting suggestions:
  // Sort them and find the optimal one, similar to getGuillotineLayoutSuggestions.

  toast({
    title: "2D Bin Packing Not Implemented",
    description: "This optimization strategy is a placeholder. Please integrate a suitable 2D bin packing library.",
    variant: "default",
    duration: 7000,
  });

  return { suggestions: [], optimalSuggestion: undefined }; // Placeholder return
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
      console.log('[InventoryOptimization TS Flow] Attempting 2D Bin Packing strategy.');
      result = await get2DBinPackingLayoutSuggestions(input);
    } else { // Default to GUILLOTINE
      console.log('[InventoryOptimization TS Flow] Using GUILLOTINE strategy.');
      result = await getGuillotineLayoutSuggestions(input);
    }
    
    console.log('[InventoryOptimization TS Flow] All sorted suggestions:', JSON.stringify(result.suggestions, null, 2));
    return result;
  }
);
    

      