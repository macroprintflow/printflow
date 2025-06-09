
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
  cuttingLayoutDescription: z.string().optional().describe("Textual description of the cutting layout, e.g., '3 across x 4 down (job portrait)'."),
  locationGodown: z.string().optional().describe('The godown where the item is stored.'),
  locationLineNumber: z.string().optional().describe('The line number/specific location in the godown.'),
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

const epsilon = 1e-6; // Epsilon for floating point comparisons

// Corrected Macro Staggered Logic (from user)
function calculateMacroStaggeredUpsFixedInternal(
  jobW: number, jobH: number, sheetW: number, sheetH: number
) {
  let bestUps = 0;
  let bestDesc = "";
  const eps = 1e-6; // ← keep using the same epsilon

  /* ---------- CASE 1: portrait rows first, rotated in leftover ---------- */
  for (let portraitRows = 0; portraitRows <= Math.floor((sheetH + eps) / jobH); ++portraitRows) {
    const usedH = portraitRows * jobH;
    const remH  = sheetH - usedH;

    const colsPortrait  = Math.floor((sheetW + eps) / jobW);
    const upsPortrait   = portraitRows * colsPortrait;

    const rowsRot = remH + eps >= jobW ? Math.floor((remH + eps) / jobW) : 0;      // ★ fixed
    const colsRot = rowsRot > 0      ? Math.floor((sheetW + eps) / jobH) : 0;      // ★ fixed
    const upsRot  = rowsRot * colsRot;

    const total = upsPortrait + upsRot;
    if (total > bestUps) {
      bestUps  = total;
      bestDesc = `${colsPortrait}x${portraitRows} portrait + ${colsRot}x${rowsRot} rotated`;
    }
  }

  /* ---------- CASE 2: rotated rows first, portrait in leftover ---------- */
  for (let rotRows = 0; rotRows <= Math.floor((sheetH + eps) / jobW); ++rotRows) {
    const usedH = rotRows * jobW;
    const remH  = sheetH - usedH;

    const colsRot = Math.floor((sheetW + eps) / jobH);
    const upsRot  = rotRows * colsRot;

    const rowsPor = remH + eps >= jobH ? Math.floor((remH + eps) / jobH) : 0;       // ★ fixed
    const colsPor = rowsPor > 0      ? Math.floor((sheetW + eps) / jobW) : 0;       // ★ fixed
    const upsPor  = rowsPor * colsPor;

    const total = upsPor + upsRot;
    if (total > bestUps) {
      bestUps  = total;
      bestDesc = `${colsRot}x${rotRows} rotated + ${colsPor}x${rowsPor} portrait`;
    }
  }

  return { ups: bestUps, description: bestDesc };
}


// Improved Guillotine Cut Calculation (integrates macro staggered)
function calculateMaxGuillotineUps(jobW: number, jobH: number, sheetW: number, sheetH: number) {
  let maxUps = 0;
  let bestLayout = "N/A";
  
  if (jobW <= 0 || jobH <=0 || sheetW <=0 || sheetH <= 0) {
      console.warn(`[calculateMaxGuillotineUps] Invalid zero or negative dimension detected. Job: ${jobW}x${jobH}, Sheet: ${sheetW}x${sheetH}. Returning 0 ups.`);
      return { ups: 0, description: "Invalid dimensions" };
  }

  const orientations = [
    {w: jobW, h: jobH, label: 'portrait'},
    {w: jobH, h: jobW, label: 'landscape'}
  ];

  for (const orient of orientations) {
    if (orient.w <=0 || orient.h <=0) continue;

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
      }
    }
    
    // Strategy 3: Check Macro Staggered Layout (using the corrected function)
    const staggeredResult = calculateMacroStaggeredUpsFixedInternal(orient.w, orient.h, sheetW, sheetH);
    if (staggeredResult.ups > maxUps) {
        maxUps = staggeredResult.ups;
        bestLayout = `${staggeredResult.description} (macro staggered ${orient.label})`;
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

    const allSuggestions: z.infer<typeof MasterSheetSuggestionSchema>[] = [];

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
        continue; 
      }
      console.log(
        'INPUTS:',
        jobSizeWidth, jobSizeHeight,
        sheet.masterSheetSizeWidth, sheet.masterSheetSizeHeight
      );
      
      const debugResOrig = calculateMaxGuillotineUps(
        jobSizeWidth,
        jobSizeHeight,
        sheet.masterSheetSizeWidth,
        sheet.masterSheetSizeHeight
      );
      console.log('GUILLOTINE RESULT:', debugResOrig);
    
      let bestUpsForThisSheet = 0;
      let bestLayoutDesc = "N/A";
      let effectiveSheetW = sheet.masterSheetSizeWidth;
      let effectiveSheetH = sheet.masterSheetSizeHeight;
      
      // Check original master sheet orientation
      const resOrig = calculateMaxGuillotineUps(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeWidth, sheet.masterSheetSizeHeight);
      if (resOrig.ups > bestUpsForThisSheet) {
        bestUpsForThisSheet = resOrig.ups;
        bestLayoutDesc = `${resOrig.description} (Master Portrait)`;
        effectiveSheetW = sheet.masterSheetSizeWidth;
        effectiveSheetH = sheet.masterSheetSizeHeight;
      }
      
      // Check rotated master sheet orientation (if not square)
      if (Math.abs(sheet.masterSheetSizeWidth - sheet.masterSheetSizeHeight) > epsilon) { 
        const resRot = calculateMaxGuillotineUps(jobSizeWidth, jobSizeHeight, sheet.masterSheetSizeHeight, sheet.masterSheetSizeWidth);
        if (resRot.ups > bestUpsForThisSheet) {
          bestUpsForThisSheet = resRot.ups;
          bestLayoutDesc = `${resRot.description} (Master Landscape)`;
          effectiveSheetW = sheet.masterSheetSizeHeight; // Master sheet was rotated
          effectiveSheetH = sheet.masterSheetSizeWidth;
        }
      }

      if (bestUpsForThisSheet === 0) {
        console.log(`[InventoryOptimization TS Flow] Sheet ID ${sheet.id} (${sheet.name || 'Unknown Name'}) yields 0 ups after all calculations. Skipping.`);
        continue;
      }

      const jobArea = jobSizeWidth * jobSizeHeight;
      // Use the 'effective' sheet dimensions that yielded the best ups for wastage calculation
      const masterSheetAreaUsedForLayout = effectiveSheetW * effectiveSheetH; 
      const usedArea = bestUpsForThisSheet * jobArea;
      const wastagePercentage = masterSheetAreaUsedForLayout > 0 ? Number(((1 - (usedArea / masterSheetAreaUsedForLayout)) * 100).toFixed(2)) : 100;
      const totalMasterSheetsNeeded = Math.ceil(netQuantity / bestUpsForThisSheet);
      
      allSuggestions.push({
        id: sheet.id,
        masterSheetSizeWidth: sheet.masterSheetSizeWidth, // Report original inventory sheet dims
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
      });
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
    

