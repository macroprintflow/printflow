
// src/lib/packing.ts
import { MaxRectsPacker, type MaxRectsPackerOptions } from 'maxrects-packer';

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
  console.log(`[countUpsWithMaxrects] Inputs: jobWIn=${jobWIn}, jobHIn=${jobHIn}, sheetWIn=${sheetWIn}, sheetHIn=${sheetHIn}, allowRotation=${allowRotation}`);

  const SCALE = 1000; // Increased for finer precision (0.001-inch resolution)
  const jobW_scaled   = Math.round(jobWIn   * SCALE);
  const jobH_scaled   = Math.round(jobHIn   * SCALE);
  const sheetW_scaled = Math.round(sheetWIn * SCALE);
  const sheetH_scaled = Math.round(sheetHIn * SCALE);

  console.log(`[countUpsWithMaxrects] Scaled (x${SCALE}): jobW_scaled=${jobW_scaled}, jobH_scaled=${jobH_scaled}, sheetW_scaled=${sheetW_scaled}, sheetH_scaled=${sheetH_scaled}`);

  if (jobW_scaled <= 0 || jobH_scaled <= 0 || sheetW_scaled <= 0 || sheetH_scaled <= 0) {
    console.warn(`[countUpsWithMaxrects] Invalid zero or negative scaled dimension. Job: ${jobW_scaled}x${jobH_scaled}, Sheet: ${sheetW_scaled}x${sheetH_scaled}. Returning 0 ups.`);
    return { ups: 0, layoutDescription: "Invalid dimensions" };
  }

  const packerOptions: MaxRectsPackerOptions = {
    smart: true,     // Tries to look ahead to find better packing.
    pot: false,      // Power of Two. Set to false for irregular sizes and rotation.
    allowRotation,   // Whether rectangles can be rotated.
    // logic: 0, // MAX_AREA - If library supported it, could be an option. MaxRectsPacker uses 'smart'.
  };
  
  const packer = new MaxRectsPacker(sheetW_scaled, sheetH_scaled, 0, packerOptions);
  
  // Use a fixed, sufficiently large number of rectangles to test packing capacity.
  // 20 was from user's 8-up REPL test. For 5-up, 20 is also plenty.
  const MAX_ITEMS_TO_TEST = 20; 
  console.log(`[countUpsWithMaxrects] Attempting to pack up to ${MAX_ITEMS_TO_TEST} items.`);
  
  const rectangles = Array.from({ length: MAX_ITEMS_TO_TEST }, (_, i) => ({
    width:  jobW_scaled,
    height: jobH_scaled,
    data:   { id: `item_${i}` } // Optional data payload
  }));
  
  packer.addArray(rectangles);
  packer.repack(false); // Attempt to optimize the packing further.

  const placedCount = packer.bins[0]?.rects.length ?? 0;
  const layoutDesc = `MaxRects: ${placedCount} ups (rotation ${allowRotation ? 'enabled' : 'disabled'}, SCALE=${SCALE})`;
  console.log(`[countUpsWithMaxrects] Result: { ups: ${placedCount}, layoutDescription: "${layoutDesc}" }`);

  return {
    ups: placedCount,
    layoutDescription: layoutDesc
  };
}

