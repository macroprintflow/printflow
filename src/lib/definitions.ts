
import type { LucideIcon } from "lucide-react";
import {
  FileCheck2, Scissors, Printer, Wand2, Film, Crop, Sparkles, ClipboardPaste, Box, Package, FileSpreadsheet,
  FileText, Newspaper, Archive as ArchiveIcon, Layers, Palette, Focus, UserRoundPlus
} from "lucide-react"; // Renamed Archive to ArchiveIcon, Added UserRoundPlus
import { z } from 'zod';

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
  sourceInventoryItemId?: string;
  masterSheetSizeWidth: number;
  masterSheetSizeHeight: number;
  paperGsm?: number;
  paperThicknessMm?: number;
  paperQuality: string;
  wastagePercentage: number;
  sheetsPerMasterSheet: number;
  totalMasterSheetsNeeded: number;
  cuttingLayoutDescription?: string;
  availableQuantity?: number;
};

export const PAPER_QUALITY_OPTIONS = [
  { value: 'SBS', label: 'SBS', unit: 'gsm' },
  { value: 'GREYBACK', label: 'Greyback', unit: 'gsm' },
  { value: 'WHITEBACK', label: 'Whiteback', unit: 'gsm' },
  { value: 'ART_PAPER_GLOSS', label: 'Art Paper Gloss', unit: 'gsm' },
  { value: 'ART_PAPER_MATT', label: 'Art Paper Matt', unit: 'gsm' },
  { value: 'BUTTER_PAPER', label: 'Butter Paper', unit: 'gsm' },
  { value: 'GOLDEN_SHEET', label: 'Golden Sheet', unit: 'gsm' },
  { value: 'JAPANESE_PAPER', label: 'Japanese Paper', unit: 'gsm' },
  { value: 'IMPORTED_PAPER', label: 'Imported Paper', unit: 'gsm' },
  { value: 'KRAFT_PAPER', label: 'Kraft Paper', unit: 'gsm' },
  { value: 'GG_KAPPA', label: 'GG Kappa', unit: 'mm' },
  { value: 'WG_KAPPA', label: 'WG Kappa', unit: 'mm' },
  { value: 'MDF', label: 'MDF', unit: 'mm' },
] as const;

type PaperQualityValue = typeof PAPER_QUALITY_OPTIONS[number]['value'];
export type PaperQualityType = PaperQualityValue;

// Ensure paperQualityEnumValues is defined before JobCardSchema
export const paperQualityEnumValues = PAPER_QUALITY_OPTIONS.map(opt => opt.value) as [string, ...string[]];

// --- HELPER FUNCTION: Only allows valid paper qualities ---
export function asPaperQuality(val: any): PaperQualityType | undefined {
  return (PAPER_QUALITY_OPTIONS.some(opt => opt.value === val) ? val : undefined) as PaperQualityType | undefined;
}

export function getPaperQualityLabel(value: PaperQualityType): string {
  const option = PAPER_QUALITY_OPTIONS.find(opt => opt.value === value);
  return option ? option.label : value;
}

export function getPaperQualityUnit(value: PaperQualityType): 'gsm' | 'mm' | null {
  const option = PAPER_QUALITY_OPTIONS.find(opt => opt.value === value);
  return option ? option.unit : null;
}

export const KAPPA_MDF_QUALITIES: PaperQualityType[] = ['GG_KAPPA', 'WG_KAPPA', 'MDF'];

export interface WorkflowProcessStepDefinition {
  slug: string;
  name: string;
  icon: LucideIcon;
}

export const PRODUCTION_PROCESS_STEPS: WorkflowProcessStepDefinition[] = [
  { name: "Job Approval", slug: "job-approval", icon: FileCheck2 },
  { name: "Cutter", slug: "cutter", icon: Scissors },
  { name: "Printing", slug: "printing", icon: Printer },
  { name: "Texture UV", slug: "texture-uv", icon: Palette },
  { name: "Lamination", slug: "lamination", icon: Film },
  { name: "Die Cutting", slug: "die-cutting", icon: Focus },
  { name: "Foil Stamping", slug: "foil-stamping", icon: Sparkles },
  { name: "Pasting", slug: "pasting", icon: Layers },
  { name: "Box Making & Assembly", slug: "box-making-assembly", icon: Box },
  { name: "Packing", slug: "packing", icon: Package },
  { name: "To be Billed", slug: "to-be-billed", icon: FileSpreadsheet },
];

export const WorkflowStepSchema = z.object({
  stepSlug: z.string(),
  order: z.number().int().positive(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export type JobCardData = {
  id?: string;
  jobCardNumber?: string;
  date: string;
  jobName: string;
  customerName: string; // This will be populated by selected customer's fullName
  customerId?: string; // Store the ID of the selected customer
  jobSizeWidth: number;
  jobSizeHeight: number;
  masterSheetSizeWidth?: number;
  masterSheetSizeHeight?: number;
  netQuantity: number;
  grossQuantity: number;
  paperGsm?: number;
  targetPaperThicknessMm?: number;
  paperQuality: PaperQualityType;
  wastagePercentage?: number;
  cuttingLayoutDescription?: string;

  selectedMasterSheetGsm?: number;
  selectedMasterSheetThicknessMm?: number;
  selectedMasterSheetQuality?: PaperQualityType;
  sourceInventoryItemId?: string;
  sheetsPerMasterSheet?: number;
  totalMasterSheetsNeeded?: number;

  kindOfJob: 'METPET' | 'NORMAL' | 'NO_PRINTING' | undefined;
  printingFront: 'SM74' | 'SORSZ' | 'DOMINANT' | 'NO_PRINTING' | undefined;
  printingBack: 'SM74' | 'SORSZ' | 'DOMINANT' | 'NO_PRINTING' | undefined;
  coating: 'TEXTURE_UV' | 'VARNISH_GLOSS' | 'VARNISH_MATT' | 'UV_ONLY' | 'NO_COATING' | undefined;
  specialInks?: string;
  die: 'NEW' | 'OLD' | undefined;
  assignedDieMachine?: 'Machine1' | 'Machine2' | 'Machine3' | 'Machine4' | undefined;
  hotFoilStamping: 'GOLDEN' | 'SILVER' | 'COPPER' | 'NO_LEAF' | undefined;
  emboss: 'YES' | 'NO' | undefined;
  pasting: 'YES' | 'NO' | undefined;
  boxMaking: 'MACHINE' | 'MANUAL' | 'COMBINED' | undefined;
  remarks?: string;
  dispatchDate?: string;

  linkedJobCardIds?: string[];
  currentDepartment?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  workflowSteps?: WorkflowStep[];
  pdfDataUri?: string;
  hasPendingInventory?: boolean;
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
  predefinedWorkflow?: WorkflowStep[];
};


export const JobCardSchema = z.object({
  jobCardNumber: z.string().optional(),
  currentDepartment: z.string().optional(), // for Zod
  jobName: z.string().min(1, "Job name is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerId: z.string().optional(),

  jobSizeWidth: z.coerce.number().positive("Job width (in) must be positive"),
  jobSizeHeight: z.coerce.number().positive("Job height (in) must be positive"),

  netQuantity: z.coerce.number().positive("Net quantity must be positive"),
  grossQuantity: z.coerce.number().positive("Gross quantity (total master sheets if not optimizing) must be positive"),

  paperGsm: z.coerce.number().optional(),
  targetPaperThicknessMm: z.coerce.number().optional(),
  paperQuality: z.enum(paperQualityEnumValues), // REQUIRED (remove .refine!)

  masterSheetSizeWidth: z.coerce.number().optional(),
  masterSheetSizeHeight: z.coerce.number().optional(),
  wastagePercentage: z.coerce.number().optional(),
  cuttingLayoutDescription: z.string().optional(),
  selectedMasterSheetGsm: z.coerce.number().optional(),
  selectedMasterSheetThicknessMm: z.coerce.number().optional(),
  selectedMasterSheetQuality: z.enum(paperQualityEnumValues).optional(),
  sourceInventoryItemId: z.string().optional(),
  sheetsPerMasterSheet: z.coerce.number().optional(),
  totalMasterSheetsNeeded: z.coerce.number().optional(),

  kindOfJob: z.enum(['METPET', 'NORMAL', 'NO_PRINTING']).optional(),
  printingFront: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING']).optional(),
  printingBack: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING']).optional(),
  coating: z.enum(['TEXTURE_UV', 'VARNISH_GLOSS', 'VARNISH_MATT', 'UV_ONLY', 'NO_COATING']).optional(),
  specialInks: z.string().optional(),
  die: z.enum(['NEW', 'OLD']).optional(),
  assignedDieMachine: z.enum(['Machine1', 'Machine2', 'Machine3', 'Machine4']).optional(),
  hotFoilStamping: z.enum(['GOLDEN', 'SILVER', 'COPPER', 'NO_LEAF']).optional(),
  emboss: z.enum(['YES', 'NO']).optional(),
  pasting: z.enum(['YES', 'NO']).optional(),
  boxMaking: z.enum(['MACHINE', 'MANUAL', 'COMBINED']).optional(),
  remarks: z.string().optional(),
  dispatchDate: z.string().optional(),
  workflowSteps: z.array(WorkflowStepSchema).optional(),
  pdfDataUri: z.string().optional(),
  linkedJobCardIds: z.array(z.string()).optional(),
  hasPendingInventory: z.boolean().optional(),
}).superRefine((data, ctx) => {
  const unit = getPaperQualityUnit(data.paperQuality as PaperQualityType); // Cast as PaperQualityType
  if (data.paperQuality && unit === 'gsm' && (data.paperGsm === undefined || data.paperGsm <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paper GSM must be positive for this quality.", path: ["paperGsm"] });
  }
  if (data.paperQuality && unit === 'mm' && (data.targetPaperThicknessMm === undefined || data.targetPaperThicknessMm <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Target paper thickness (mm) must be positive for this quality.", path: ["targetPaperThicknessMm"] });
  }
});


export type JobCardFormValues = z.infer<typeof JobCardSchema>;



export const JobTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  paperQuality: z.enum(paperQualityEnumValues).optional(),
  kindOfJob: z.enum(['METPET', 'NORMAL', 'NO_PRINTING']).default('NORMAL').optional(),
  printingFront: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING']).default('NO_PRINTING').optional(),
  printingBack: z.enum(['SM74', 'SORSZ', 'DOMINANT', 'NO_PRINTING']).default('NO_PRINTING').optional(),
  coating: z.enum(['TEXTURE_UV', 'VARNISH_GLOSS', 'VARNISH_MATT', 'UV_ONLY', 'NO_COATING']).default('NO_COATING').optional(),
  die: z.enum(['NEW', 'OLD']).default('NEW').optional(),
  hotFoilStamping: z.enum(['GOLDEN', 'SILVER', 'COPPER', 'NO_LEAF']).default('NO_LEAF').optional(),
  emboss: z.enum(['YES', 'NO']).default('NO').optional(),
  pasting: z.enum(['YES', 'NO']).default('NO').optional(),
  boxMaking: z.enum(['MACHINE', 'MANUAL', 'COMBINED']).default('MACHINE').optional(),
  predefinedWorkflow: z.array(WorkflowStepSchema).optional(),
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
  paperThicknessMm?: number;
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
  locationCode?: string;
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
  { value: 'OTHER', label: 'Other Material/Stock', iconName: "ArchiveIcon" },
] as const;
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]['value'];


const unitEnumValues = UNIT_OPTIONS.map(opt => opt.value) as [string, ...string[]];

export const InventoryItemFormSchema = z.object({
  category: z.enum(INVENTORY_CATEGORIES.map(c => c.value) as [string, ...string[]]),

  paperMasterSheetSizeWidth: z.coerce.number().optional(),
  paperMasterSheetSizeHeight: z.coerce.number().optional(),
  paperQuality: z.enum(paperQualityEnumValues).optional(),
  paperGsm: z.coerce.number().optional(),
  paperThicknessMm: z.coerce.number().optional(),

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
  locationCode: z.string().optional(),
  hasPendingInventory: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.category === 'PAPER') {
    if (!data.paperQuality || data.paperQuality === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paper quality is required for paper items.", path: ["paperQuality"] });
    } else {
      const qualityInfo = PAPER_QUALITY_OPTIONS.find(opt => opt.value === data.paperQuality);
      if (qualityInfo) {
        if (qualityInfo.unit === 'gsm' && (data.paperGsm === undefined || data.paperGsm <= 0)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid Paper GSM (must be > 0) is required for this paper quality.", path: ["paperGsm"] });
        }
        if (qualityInfo.unit === 'mm' && (data.paperThicknessMm === undefined || data.paperThicknessMm <= 0)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid Paper Thickness (mm) (must be > 0) is required for this paper quality.", path: ["paperThicknessMm"] });
        }
      }
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
  { value: 'OTHER', label: 'Other (Specify in notes)' },
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

export const InventoryAdjustmentItemSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory Item ID is required"),
  itemNameFull: z.string(),
  quantityChange: z.number().refine(val => val !== 0, "Quantity change cannot be zero"),
  reason: z.enum(INVENTORY_ADJUSTMENT_REASONS.map(r => r.value) as [string, ...string[]])
          .refine(val => val !== undefined && val !== '', "Reason for adjustment is required"),
  notes: z.string().optional(),
});
export type InventoryAdjustmentItemFormValues = z.infer<typeof InventoryAdjustmentItemSchema>;


export type PaperSubCategoryFilterValue =
  | "SBS" | "KAPPA_GROUP" | "GREYBACK" | "WHITEBACK" | "ART_PAPER_GROUP"
  | "JAPANESE_PAPER" | "IMPORTED_PAPER" | "MDF_GROUP" | "BUTTER_PAPER"
  | "OTHER_PAPER_GROUP" | "__ALL_PAPER__";

export type ArtPaperFinishFilterValue = "ART_PAPER_MATT_FINISH" | "ART_PAPER_GLOSS_FINISH";
export type KappaFinishFilterValue = "KAPPA_GG_FINISH" | "KAPPA_WG_FINISH";
export type SubCategoryFinishFilterValue = ArtPaperFinishFilterValue | KappaFinishFilterValue;


export type PaperSubCategory = {
  name: string;
  filterValue: PaperSubCategoryFilterValue;
  qualityValues: PaperQualityType[];
  predefinedSpecs?: number[];
  specUnit?: 'GSM' | 'mm';
  subFinishes?: Array<{
    name: string;
    finishFilterValue: SubCategoryFinishFilterValue;
    actualQualityValue: PaperQualityType;
    predefinedSpecs: number[];
    specUnit: 'GSM' | 'mm';
    icon: LucideIcon;
  }>;
  icon: LucideIcon;
};

export const PAPER_SUB_CATEGORIES: PaperSubCategory[] = [
  {
    name: "SBS", filterValue: "SBS", icon: FileText,
    qualityValues: ["SBS"],
    predefinedSpecs: [200, 210, 220, 230, 250, 270, 280, 290, 300, 320, 350],
    specUnit: 'GSM',
  },
  {
    name: "Kappa Paper", filterValue: "KAPPA_GROUP", icon: Newspaper,
    qualityValues: ["GG_KAPPA", "WG_KAPPA"],
    subFinishes: [
      {
        name: "Grey-Grey (GG) Kappa", finishFilterValue: "KAPPA_GG_FINISH", actualQualityValue: "GG_KAPPA",
        predefinedSpecs: [0.82, 0.96, 1.0, 1.1, 1.2, 1.4, 1.5], specUnit: 'mm', icon: Layers
      },
      {
        name: "White-Grey (WG) Kappa", finishFilterValue: "KAPPA_WG_FINISH", actualQualityValue: "WG_KAPPA",
        predefinedSpecs: [0.82, 0.96, 1.0, 1.1, 1.2, 1.4, 1.5], specUnit: 'mm', icon: Layers
      }
    ]
  },
  {
    name: "Greyback", filterValue: "GREYBACK", icon: FileText,
    qualityValues: ["GREYBACK"],
    predefinedSpecs: [230, 285, 300, 320, 340, 350, 380, 400],
    specUnit: 'GSM',
  },
  {
    name: "Whiteback", filterValue: "WHITEBACK", icon: FileText,
    qualityValues: ["WHITEBACK"],
    predefinedSpecs: [230, 285, 300, 320, 340, 350, 380, 400],
    specUnit: 'GSM',
  },
  {
    name: "Art Paper", filterValue: "ART_PAPER_GROUP", icon: Newspaper,
    qualityValues: ["ART_PAPER_GLOSS", "ART_PAPER_MATT"],
    subFinishes: [
      {
        name: "Matt Finish", finishFilterValue: "ART_PAPER_MATT_FINISH", actualQualityValue: "ART_PAPER_MATT",
        predefinedSpecs: [100, 120, 130, 150, 170], specUnit: 'GSM', icon: FileText
      },
      {
        name: "Gloss Finish", finishFilterValue: "ART_PAPER_GLOSS_FINISH", actualQualityValue: "ART_PAPER_GLOSS",
        predefinedSpecs: [100, 120, 130, 150, 170], specUnit: 'GSM', icon: FileText
      }
    ]
  },
  {
    name: "Japanese Paper", filterValue: "JAPANESE_PAPER", icon: FileText,
    qualityValues: ["JAPANESE_PAPER"],
  },
  {
    name: "Imported Paper", filterValue: "IMPORTED_PAPER", icon: FileText,
    qualityValues: ["IMPORTED_PAPER"],
  },
  {
    name: "MDF", filterValue: "MDF_GROUP", icon: Box,
    qualityValues: ["MDF"],
    predefinedSpecs: [2.0, 2.3, 2.5, 3.0, 4.0, 5.0, 6.0],
    specUnit: 'mm',
  },
  {
    name: "Butter Paper", filterValue: "BUTTER_PAPER", icon: FileText,
    qualityValues: ["BUTTER_PAPER"],
  },
  {
    name: "Other Paper", filterValue: "OTHER_PAPER_GROUP", icon: ArchiveIcon,
    qualityValues: [],
  },
  {
    name: "View All Paper Types", filterValue: "__ALL_PAPER__", icon: Printer,
    qualityValues: [],
  },
];

export const PLATE_TYPES = [
  { value: 'old', label: 'Old Plates' },
  { value: 'new', label: 'New Plates' },
] as const;
export type PlateTypeValue = typeof PLATE_TYPES[number]['value'];

export const COLOR_PROFILES = [
  { value: 'cmyk', label: 'CMYK' },
  { value: 'cmyk_white', label: 'CMYK + White' },
  { value: 'other', label: 'Other (Specify)' },
] as const;
export type ColorProfileValue = typeof COLOR_PROFILES[number]['value'];


export const SubmitDesignInputSchema = z.object({
  pdfName: z.string().describe("The original name of the PDF file."),
  jobName: z.string().describe("The name of the job this design is for."),
  customerName: z.string().describe("The name of the customer for this job."),
  pdfDataUri: z
    .string()
    .describe(
      "The PDF file content as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  plateType: z.enum(['new', 'old']).describe("Specifies if the design is for new or old plates."),
  colorProfile: z.enum(['cmyk', 'cmyk_white', 'other']).optional().describe("Color profile for new plates."),
  otherColorProfileDetail: z.string().optional().describe("Details if color profile is 'other'."),
});
export type SubmitDesignInput = z.infer<typeof SubmitDesignInputSchema>;

export const SubmitDesignOutputSchema = z.object({
  submissionId: z.string().describe("A unique identifier for this design submission from the backend/database."),
  pdfName: z.string().describe("The name of the PDF file."),
  jobName: z.string().describe("The job name."),
  customerName: z.string().describe("The customer name."),
  status: z.enum(["pending", "approved", "rejected"]).describe("The initial status of the submission."),
  message: z.string().optional().describe("A confirmation or status message from the AI."),
  plateType: z.enum(['new', 'old']).describe("The plate type of the submission."),
  colorProfile: z.enum(['cmyk', 'cmyk_white', 'other']).optional().describe("Color profile if new plate."),
  otherColorProfileDetail: z.string().optional().describe("Details if color profile is 'other'."),
});
export type SubmitDesignOutput = z.infer<typeof SubmitDesignOutputSchema>;

export interface DesignSubmission {
  id: string;
  pdfName: string;
  jobName: string;
  customerName: string;
  uploader: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  pdfDataUri?: string;
  plateType: PlateTypeValue;
  colorProfile?: ColorProfileValue;
  otherColorProfileDetail?: string;
}

export const SendPlateEmailInputSchema = z.object({
  jobName: z.string().describe("Name of the job."),
  customerName: z.string().describe("Name of the customer."),
  pdfName: z.string().describe("Filename of the PDF design."),
  pdfDataUri: z.string().describe("The PDF design as a data URI."),
  colorProfile: z.enum(['cmyk', 'cmyk_white', 'other']).optional().describe("Color profile for the plates."),
  otherColorProfileDetail: z.string().optional().describe("Details if color profile is 'other'."),
  plateType: z.enum(['new', 'old']).default('new').describe("Plate type, typically 'new' for this flow."),
  jobCardNumber: z.string().optional().describe("Job card number, if available."),
});
export type SendPlateEmailInput = z.infer<typeof SendPlateEmailInputSchema>;

export const SendPlateEmailOutputSchema = z.object({
  success: z.boolean().describe("Whether the email was sent successfully."),
  message: z.string().describe("A message indicating the outcome of the email sending attempt."),
  messageId: z.string().optional().describe("The message ID from the email provider if successful."),
});
export type SendPlateEmailOutput = z.infer<typeof SendPlateEmailOutputSchema>;

export interface CountryCode {
  name: string;
  code: string;
  dialCode: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { name: "India (भारत)", code: "IN", dialCode: "+91" },
  { name: "United States", code: "US", dialCode: "+1" },
  { name: "United Kingdom", code: "GB", dialCode: "+44" },
  { name: "Canada", code: "CA", dialCode: "+1" },
  { name: "Australia", code: "AU", dialCode: "+61" },
];

export type UserRole = "Admin" | "Manager" | "Departmental" | "Customer";

export interface UserData {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  linkedCustomerId?: string; // Added for linking user to a customer account
}

// Customer Data Structure and Schema
export const CustomerAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
});
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;

export const CustomerPhoneNumberSchema = z.object({
  countryCode: z.string().optional(), // e.g., "+91"
  number: z.string().optional(), // e.g., "9876543210"
});
export type CustomerPhoneNumber = z.infer<typeof CustomerPhoneNumberSchema>;

export const CustomerDataSchema = z.object({
  id: z.string().optional(), // Firestore document ID
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")), // Optional, but must be valid email if provided
  phoneNumber: CustomerPhoneNumberSchema.optional(),
  address: CustomerAddressSchema.optional(),
  createdAt: z.string().optional(), // ISO date string
  updatedAt: z.string().optional(), // ISO date string
});
export type CustomerData = z.infer<typeof CustomerDataSchema>;
export type CustomerFormValues = Omit<CustomerData, 'id' | 'createdAt' | 'updatedAt'>;

export const CustomerListItemSchema = z.object({
  id: z.string(),
  fullName: z.string(),
});
export type CustomerListItem = z.infer<typeof CustomerListItemSchema>;

export { UserRoundPlus }; // Exporting new icon
    
