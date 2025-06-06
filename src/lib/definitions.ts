
export type PaperSpecs = {
  gsm: number;
  quality: string;
};

export type JobSize = {
  width: number;
  height: number;
};

export type MasterSheetSize = {
  width: number;
  height: number;
};

export type InventorySuggestion = {
  sourceInventoryItemId?: string; // ID of the inventory item used for this suggestion
  masterSheetSizeWidth: number;
  masterSheetSizeHeight: number;
  paperGsm: number; // Actual GSM of the suggested sheet
  paperQuality: string; // Actual quality of the suggested sheet
  wastagePercentage: number;
  sheetsPerMasterSheet: number;
  totalMasterSheetsNeeded: number;
  cuttingLayoutDescription?: string;
};

export const PAPER_QUALITY_OPTIONS = [
  { value: 'SBS', label: 'SBS' },
  { value: 'GREYBACK', label: 'Greyback' },
  { value: 'WHITEBACK', label: 'Whiteback' },
  { value: 'ART_PAPER_GLOSS', label: 'Art Paper Gloss' },
  { value: 'ART_PAPER_MATT', label: 'Art Paper Matt' },
  { value: 'BUTTER_PAPER', label: 'Butter Paper' },
  { value: 'GOLDEN_SHEET', label: 'Golden Sheet' },
  { value: 'JAPANESE_PAPER', label: 'Japanese Paper' },
  { value: 'IMPORTED_PAPER', label: 'Imported Paper' },
  { value: 'KRAFT_PAPER', label: 'Kraft Paper' },
  { value: 'GG_KAPPA', label: 'GG Kappa' },
  { value: 'WG_KAPPA', label: 'WG Kappa' },
  { value: 'MDF', label: 'MDF' }, // Added MDF
] as const;

type PaperQualityValue = typeof PAPER_QUALITY_OPTIONS[number]['value'];
export type PaperQualityType = PaperQualityValue | '';

export function getPaperQualityLabel(value: PaperQualityType): string {
  const option = PAPER_QUALITY_OPTIONS.find(opt => opt.value === value);
  return option ? option.label : value;
}


export type JobCardData = {
  id?: string;
  jobCardNumber?: string;
  date: string;
  jobName: string;
  customerName: string;
  jobSizeWidth: number;
  jobSizeHeight: number;
  masterSheetSizeWidth?: number;
  masterSheetSizeHeight?: number;
  netQuantity: number;
  grossQuantity: number;
  paperGsm: number;
  paperQuality: PaperQualityType;
  wastagePercentage?: number;
  cuttingLayoutDescription?: string;

  selectedMasterSheetGsm?: number;
  selectedMasterSheetQuality?: PaperQualityType;
  sourceInventoryItemId?: string;
  sheetsPerMasterSheet?: number;
  totalMasterSheetsNeeded?: number;

  kindOfJob: 'METPET' | 'NORMAL' | 'NO_PRINTING' | '';
  printingFront: 'SM74' | 'SORSZ' | 'DOMINANT' | 'NO_PRINTING' | '';
  printingBack: 'SM74' | 'SORSZ' | 'DOMINANT' | 'NO_PRINTING' | '';
  coating: 'TEXTURE_UV' | 'VARNISH_GLOSS' | 'VARNISH_MATT' | 'UV_ONLY' | 'NO_COATING' | '';
  specialInks?: string;
  die: 'NEW' | 'OLD' | '';
  assignedDieMachine?: 'Machine1' | 'Machine2' | 'Machine3' | 'Machine4' | '';
  hotFoilStamping: 'GOLDEN' | 'SILVER' | 'COPPER' | 'NO_LEAF' | '';
  emboss: 'YES' | 'NO' | '';
  pasting: 'YES' | 'NO' | '';
  boxMaking: 'MACHINE' | 'MANUAL' | 'COMBINED' | '';
  remarks?: string;
  dispatchDate?: string;

  linkedJobCardIds?: string[];
  currentDepartment?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type JobTemplateData = {
  id: string;
  name: string;
  paperQuality?: PaperQualityType;
  kindOfJob?: JobCardData['kindOfJob'];
  printingFront?: JobCardData['printingFront'];
  printingBack?: JobCardData['printingBack'];
  coating?: JobCardData['coating'];
  die?: JobCardData['die'];
  hotFoilStamping?: JobCardData['hotFoilStamping'];
  emboss?: JobCardData['emboss'];
  pasting?: JobCardData['pasting'];
  boxMaking?: JobCardData['boxMaking'];
};


import { z } from 'zod';

const paperQualityEnumValues = ['', ...PAPER_QUALITY_OPTIONS.map(opt => opt.value)] as const;

export const JobCardSchema = z.object({
  jobName: z.string().min(1, "Job name is required"),
  customerName: z.string().min(1, "Customer name is required"),

  jobSizeWidth: z.coerce.number().positive("Job width (in) must be positive"),
  jobSizeHeight: z.coerce.number().positive("Job height (in) must be positive"),

  netQuantity: z.coerce.number().positive("Net quantity must be positive"),
  grossQuantity: z.coerce.number().positive("Gross quantity (total master sheets if not optimizing) must be positive"),

  paperGsm: z.coerce.number().positive("Paper GSM must be positive"),
  paperQuality: z.enum(paperQualityEnumValues).refine(val => val !== '', { message: "Paper quality is required" }),

  masterSheetSizeWidth: z.coerce.number().optional(),
  masterSheetSizeHeight: z.coerce.number().optional(),
  wastagePercentage: z.coerce.number().optional(),
  cuttingLayoutDescription: z.string().optional(),
  selectedMasterSheetGsm: z.coerce.number().optional(),
  selectedMasterSheetQuality: z.enum(paperQualityEnumValues).optional(),
  sourceInventoryItemId: z.string().optional(),
  sheetsPerMasterSheet: z.coerce.number().optional(),
  totalMasterSheetsNeeded: z.coerce.number().optional(),

  kindOfJob: z.enum(['METPET', 'NORMAL', 'NO_PRINTING', '']).default('').optional(),
  printingFront: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING', '']).default('').optional(),
  printingBack: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING', '']).default('').optional(),
  coating: z.enum(['TEXTURE_UV', 'VARNISH_GLOSS', 'VARNISH_MATT', 'UV_ONLY', 'NO_COATING', '']).default('').optional(),
  specialInks: z.string().optional(),
  die: z.enum(['NEW', 'OLD', '']).default('').optional(),
  assignedDieMachine: z.enum(['Machine1', 'Machine2', 'Machine3', 'Machine4', '']).default('').optional(),
  hotFoilStamping: z.enum(['GOLDEN', 'SILVER', 'COPPER', 'NO_LEAF', '']).default('').optional(),
  emboss: z.enum(['YES', 'NO', '']).default('').optional(),
  pasting: z.enum(['YES', 'NO', '']).default('').optional(),
  boxMaking: z.enum(['MACHINE', 'MANUAL', 'COMBINED', '']).default('').optional(),
  remarks: z.string().optional(),
  dispatchDate: z.string().optional(),
});

export type JobCardFormValues = z.infer<typeof JobCardSchema>;


export const JobTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  paperQuality: z.enum(paperQualityEnumValues).default('').optional(),
  kindOfJob: z.enum(['METPET', 'NORMAL', 'NO_PRINTING', '']).default('').optional(),
  printingFront: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING', '']).default('').optional(),
  printingBack: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING', '']).default('').optional(),
  coating: z.enum(['TEXTURE_UV', 'VARNISH_GLOSS', 'VARNISH_MATT', 'UV_ONLY', 'NO_COATING', '']).default('').optional(),
  die: z.enum(['NEW', 'OLD', '']).default('').optional(),
  hotFoilStamping: z.enum(['GOLDEN', 'SILVER', 'COPPER', 'NO_LEAF', '']).default('').optional(),
  emboss: z.enum(['YES', 'NO', '']).default('').optional(),
  pasting: z.enum(['YES', 'NO', '']).default('').optional(),
  boxMaking: z.enum(['MACHINE', 'MANUAL', 'COMBINED', '']).default('').optional(),
});

export type JobTemplateFormValues = z.infer<typeof JobTemplateSchema>;


export const KINDS_OF_JOB_OPTIONS = [
  { value: 'METPET', label: 'MetPet' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'NO_PRINTING', label: 'No Printing' },
] as const;

export const PRINTING_MACHINE_OPTIONS = [
  { value: 'SM74', label: 'SM74' },
  { value: 'SORSZ', label: 'SORSZ' },
  { value: 'DOMINANT', label: 'Dominant' },
  { value: 'NO_PRINTING', label: 'No Printing' },
] as const;

export const COATING_OPTIONS = [
  { value: 'TEXTURE_UV', label: 'Texture UV' },
  { value: 'VARNISH_GLOSS', label: 'Varnish Gloss' },
  { value: 'VARNISH_MATT', label: 'Varnish Matt' },
  { value: 'UV_ONLY', label: 'UV Only' },
  { value: 'NO_COATING', label: 'No Coating' },
] as const;

export const DIE_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'OLD', label: 'Old' },
] as const;

export const DIE_MACHINE_OPTIONS = [
  { value: 'Machine1', label: 'Die Machine 1' },
  { value: 'Machine2', label: 'Die Machine 2' },
  { value: 'Machine3', label: 'Die Machine 3' },
  { value: 'Machine4', label: 'Die Machine 4' },
] as const;

export const HOT_FOIL_OPTIONS = [
  { value: 'GOLDEN', label: 'Golden' },
  { value: 'SILVER', label: 'Silver' },
  { value: 'COPPER', label: 'Copper' },
  { value: 'NO_LEAF', label: 'No Leaf' },
] as const;

export const YES_NO_OPTIONS = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
] as const;

export const BOX_MAKING_OPTIONS = [
  { value: 'MACHINE', label: 'Machine' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'COMBINED', label: 'Combined' },
] as const;

export const ITEM_GROUP_TYPES = [
  "All",
  ...PAPER_QUALITY_OPTIONS.map(opt => opt.label),
  "Inks",
  "Plastic Trays",
  "Glass Jars",
  "Magnets",
  "Other Stock"
] as const;

export type ItemGroupType = (typeof ITEM_GROUP_TYPES)[number];

export type InventoryItemType =
  | 'Master Sheet'
  | 'Paper Stock' 
  | 'Ink'
  | 'Plastic Tray'
  | 'Glass Jar'
  | 'Magnet'
  | 'Other';

export const UNIT_OPTIONS = [
  { value: 'sheets', label: 'Sheets' },
  { value: 'kg', label: 'Kg' },
  { value: 'liters', label: 'Liters' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'units', label: 'Units' },
] as const;
export type UnitValue = typeof UNIT_OPTIONS[number]['value'];

export type InventoryItem = {
  id: string; 
  name: string; 
  type: InventoryItemType;
  itemGroup: ItemGroupType;
  specification: string; 
  paperGsm?: number;
  paperQuality?: PaperQualityType;
  masterSheetSizeWidth?: number;
  masterSheetSizeHeight?: number;
  unit: UnitValue; 
  reorderPoint?: number;
  supplier?: string; 
  purchaseBillNo?: string; 
  vendorName?: string; 
  dateOfEntry?: string; 
  availableStock?: number; 
};


export const VENDOR_OPTIONS = [
  { value: 'JV_TRADERS', label: 'JV Traders' },
  { value: 'MLM_INDIA', label: 'MLM India' },
  { value: 'PAPER_LINK', label: 'Paper Link' },
  { value: 'ROHIT_AGENCIES', label: 'Rohit Agencies' },
  { value: 'SUMAT_PARSHAD', label: 'Sumat Parshad' },
  { value: 'OTHER', label: 'Other (Specify)'},
] as const;


export const INVENTORY_CATEGORIES = [
  { value: 'PAPER', label: 'Paper', iconName: "Printer" },
  { value: 'INKS', label: 'Inks', iconName: "Paintbrush" },
  { value: 'PLASTIC_TRAY', label: 'Plastic Tray', iconName: "Package" },
  { value: 'GLASS_JAR', label: 'Glass Jars', iconName: "Box" },
  { value: 'MAGNET', label: 'Magnets', iconName: "MagnetIcon" },
  { value: 'OTHER', label: 'Other Material/Stock', iconName: "Archive" },
] as const;
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]['value'];


const unitEnumValues = UNIT_OPTIONS.map(opt => opt.value) as [string, ...string[]];

export const InventoryItemFormSchema = z.object({
  category: z.enum(INVENTORY_CATEGORIES.map(c => c.value) as [string, ...string[]]),

  paperMasterSheetSizeWidth: z.coerce.number().optional(),
  paperMasterSheetSizeHeight: z.coerce.number().optional(),
  paperQuality: z.enum(paperQualityEnumValues).optional(),
  paperGsm: z.coerce.number().optional(),

  inkName: z.string().optional(),
  inkSpecification: z.string().optional(),

  itemName: z.string().min(1, "Item name is required"),
  itemSpecification: z.string().optional(),

  quantity: z.coerce.number().min(0, "Quantity to add must be non-negative"),
  unit: z.enum(unitEnumValues),
  purchaseBillNo: z.string().optional(),
  vendorName: z.enum(VENDOR_OPTIONS.map(v => v.value) as [string, ...string[]]).optional(),
  otherVendorName: z.string().optional(),
  dateOfEntry: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date"}),
  reorderPoint: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
  if (data.category === 'PAPER') {
    if (!data.paperQuality || data.paperQuality === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paper quality is required for paper items.", path: ["paperQuality"] });
    }
    if (data.paperGsm === undefined || data.paperGsm <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid Paper GSM (must be > 0) is required for paper items.", path: ["paperGsm"] });
    }
    if (data.paperMasterSheetSizeWidth === undefined || data.paperMasterSheetSizeWidth <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid Paper Width (must be > 0) is required for paper items.", path: ["paperMasterSheetSizeWidth"] });
    }
    if (data.paperMasterSheetSizeHeight === undefined || data.paperMasterSheetSizeHeight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid Paper Height (must be > 0) is required for paper items.", path: ["paperMasterSheetSizeHeight"] });
    }
  }
  if (data.category === 'INKS') {
    if (!data.inkName || data.inkName.trim() === '') {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ink name is required for ink items.", path: ["inkName"] });
    }
  }
  if (data.vendorName === 'OTHER' && (!data.otherVendorName || data.otherVendorName.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please specify the vendor name.", path: ["otherVendorName"] });
  }
   if (data.quantity < 0) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quantity cannot be negative.", path: ["quantity"] });
   }
});

export type InventoryItemFormValues = z.infer<typeof InventoryItemFormSchema>;

export type OptimizeInventoryOutput = {
  suggestions: InventorySuggestion[];
  optimalSuggestion?: InventorySuggestion;
};

export const INVENTORY_ADJUSTMENT_REASONS = [
  { value: 'INITIAL_STOCK', label: 'Initial Stock Entry' },
  { value: 'PURCHASE_RECEIVED', label: 'Purchase Received' },
  { value: 'STOCK_ADDITION', label: 'Manual Stock Addition' },
  { value: 'JOB_USAGE', label: 'Job Card Usage' },
  { value: 'MANUAL_CORRECTION_ADD', label: 'Manual Correction (Add)' },
  { value: 'MANUAL_CORRECTION_SUB', label: 'Manual Correction (Subtract)' },
  { value: 'STOCK_TAKE_GAIN', label: 'Stock Take (Gain)' },
  { value: 'STOCK_TAKE_LOSS', label: 'Stock Take (Loss)' },
  { value: 'RETURN_TO_SUPPLIER', label: 'Return to Supplier' },
  { value: 'DAMAGED_GOODS', label: 'Damaged Goods' },
] as const;

export type InventoryAdjustmentReasonValue = typeof INVENTORY_ADJUSTMENT_REASONS[number]['value'];

export function getInventoryAdjustmentReasonLabel(value: InventoryAdjustmentReasonValue): string {
  return INVENTORY_ADJUSTMENT_REASONS.find(r => r.value === value)?.label || value;
}

export type InventoryAdjustment = {
  id: string; 
  inventoryItemId: string; 
  date: string; 
  quantityChange: number; 
  reason: InventoryAdjustmentReasonValue;
  reference?: string; 
  userId?: string; 
  notes?: string; 
  vendorName?: string; 
  purchaseBillNo?: string; 
};

export const PAPER_SUB_CATEGORIES = [
  { name: "SBS", filterValue: "SBS", qualityValues: ["SBS"] },
  { name: "Kappa", filterValue: "KAPPA_GROUP", qualityValues: ["GG_KAPPA", "WG_KAPPA"] },
  { name: "Greyback", filterValue: "GREYBACK", qualityValues: ["GREYBACK"] },
  { name: "Whiteback", filterValue: "WHITEBACK", qualityValues: ["WHITEBACK"] },
  { name: "Art Paper", filterValue: "ART_PAPER_GROUP", qualityValues: ["ART_PAPER_GLOSS", "ART_PAPER_MATT"] },
  { name: "Japanese Paper", filterValue: "JAPANESE_PAPER", qualityValues: ["JAPANESE_PAPER"] },
  { name: "Imported Paper", filterValue: "IMPORTED_PAPER", qualityValues: ["IMPORTED_PAPER"] },
  { name: "MDF", filterValue: "MDF", qualityValues: ["MDF"] },
  { name: "Butter Paper", filterValue: "BUTTER_PAPER", qualityValues: ["BUTTER_PAPER"] },
  { name: "Other Paper", filterValue: "OTHER_PAPER_GROUP", qualityValues: [] }, // Special handling for "Other"
  { name: "View All Paper Types", filterValue: "__ALL_PAPER__", qualityValues: [] },
] as const;

export type PaperSubCategoryFilterValue = typeof PAPER_SUB_CATEGORIES[number]['filterValue'];

    