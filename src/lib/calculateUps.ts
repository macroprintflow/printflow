
export type LayoutInfo = {
  layout: "portrait" | "landscape";
  ups: number;
  cols: number;
  rows: number;
};

export function calculateUps({
  jobW,
  jobH,
  sheetW,
  sheetH,
}: {
  jobW: number;
  jobH: number;
  sheetW: number;
  sheetH: number;
}): LayoutInfo {
  // Portrait orientation for the job on the sheet
  const colsP = Math.floor(sheetW / jobW);
  const rowsP = Math.floor(sheetH / jobH);
  const upsP = colsP * rowsP;

  // Landscape orientation for the job on the sheet
  const colsL = Math.floor(sheetW / jobH); // Job width becomes job height for landscape
  const rowsL = Math.floor(sheetH / jobW); // Job height becomes job width for landscape
  const upsL = colsL * rowsL;

  if (upsP >= upsL) {
    return {
      layout: "portrait",
      ups: upsP,
      cols: colsP,
      rows: rowsP,
    };
  } else {
    return {
      layout: "landscape",
      ups: upsL,
      cols: colsL,
      rows: rowsL,
    };
  }
}
