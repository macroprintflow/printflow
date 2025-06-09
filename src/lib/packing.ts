
// src/lib/packing.ts
import { MaxRectsPacker } from 'maxrects-packer';

/**
 * Return the maximum #ups that fit onto ONE master sheet using MaxRectsPacker.
 * @param jobWIn  Job width  (inches)
 * @param jobHIn  Job height (inches)
 * @param sheetWIn Master sheet width  (inches)
 * @param sheetHIn Master sheet height (inches)
 * @param allowRotation default = true  (rotate jobs 90° if it helps)
 */
export function countUpsWithMaxrects(
  jobWIn: number,
  jobHIn: number,
  sheetWIn: number,
  sheetHIn: number,
  allowRotation = true,
): { ups: number; layoutDescription: string } {
  const SCALE = 100;                 // hundredth-inch resolution
  const jobW   = Math.round(jobWIn   * SCALE);
  const jobH   = Math.round(jobHIn   * SCALE);
  const sheetW = Math.round(sheetWIn * SCALE);
  const sheetH = Math.round(sheetHIn * SCALE);

  if (jobW <= 0 || jobH <= 0 || sheetW <= 0 || sheetH <= 0) {
    console.warn(`[countUpsWithMaxrects] Invalid zero or negative dimension. Job: ${jobWIn}x${jobHIn}, Sheet: ${sheetWIn}x${sheetHIn}. Returning 0 ups.`);
    return { ups: 0, layoutDescription: "Invalid dimensions" };
  }

  const packerOptions = {
    smart: true,     // Tries to look ahead to find better packing.
    pot: false,      // Power of Two. Not relevant for paper.
    allowRotation, // Whether rectangles can be rotated.
    // Consider adding `tag` or other options if you need to track individual rectangles
    // exportOption: { type: 'json' } // If you want to export layout data later
  };
  
  const packer = new MaxRectsPacker(sheetW, sheetH, 0, packerOptions);

  // Push "a lot" of identical rectangles into the packer.
  // The packer will keep taking them until the sheet is full.
  // Max reasonable items on a sheet; adjust if necessary.
  // This should be more than enough for typical print scenarios.
  const MAX_ITEMS_TO_TEST = Math.max(100, Math.ceil((sheetW/jobW) * (sheetH/jobH)) * 2); 
  
  const rectangles = Array.from({ length: MAX_ITEMS_TO_TEST }, (_, i) => ({
    width:  jobW,
    height: jobH,
    data:   { id: `item_${i}` } // Optional data payload
  }));
  
  packer.addArray(rectangles);

  const placedCount = packer.bins[0]?.rects.length ?? 0;

  return {
    ups: placedCount,
    layoutDescription: `MaxRects: ${placedCount} ups (rotation ${allowRotation ? 'enabled' : 'disabled'})`
  };
}
