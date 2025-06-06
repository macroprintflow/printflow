
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
] as const;

type PaperQualityValue = typeof PAPER_QUALITY_OPTIONS[number]['value'];
export type PaperQualityType = PaperQualityValue | '';


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
  paperGsm: number; // Target/Job GSM
  paperQuality: PaperQualityType; // Target/Job Quality
  wastagePercentage?: number;
  cuttingLayoutDescription?: string;
  // Fields to store the actual selected master sheet details from suggestion
  selectedMasterSheetGsm?: number;
  selectedMasterSheetQuality?: PaperQualityType;
  sourceInventoryItemId?: string;

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
  grossQuantity: z.coerce.number().positive("Gross quantity must be positive"),

  paperGsm: z.coerce.number().positive("Paper GSM must be positive"), // Target GSM
  paperQuality: z.enum(paperQualityEnumValues).refine(val => val !== '', { message: "Paper quality is required" }),


  masterSheetSizeWidth: z.coerce.number().optional(), // From suggestion
  masterSheetSizeHeight: z.coerce.number().optional(), // From suggestion
  wastagePercentage: z.coerce.number().optional(), // From suggestion
  cuttingLayoutDescription: z.string().optional(), // From suggestion
  selectedMasterSheetGsm: z.coerce.number().optional(), // Actual GSM from suggestion
  selectedMasterSheetQuality: z.enum(paperQualityEnumValues).optional(), // Actual quality from suggestion
  sourceInventoryItemId: z.string().optional(), // ID of inventory item from suggestion


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


// ITEM_GROUP_TYPES will now include all paper qualities for more granular filtering on inventory page
export const ITEM_GROUP_TYPES = [
  "All",
  "Master Sheets", // Generic group for sheets not fitting specific paper qualities or for bulk entry
  ...PAPER_QUALITY_OPTIONS.map(opt => opt.label), // Use labels for display
  "Inks",
  "Other Stock"
] as const;

export type ItemGroupType = (typeof ITEM_GROUP_TYPES)[number];

export type InventoryItem = {
  id: string;
  name: string;
  type: 'Master Sheet' | 'Paper Stock' | 'Ink' | 'Other';
  itemGroup: ItemGroupType; // Specific group for tabbing/filtering
  specification: string; 
  paperGsm?: number; // GSM of the paper/sheet
  paperQuality?: PaperQualityType; // Quality of the paper/sheet
  masterSheetSizeWidth?: number; // Width in inches, if it's a master sheet
  masterSheetSizeHeight?: number; // Height in inches, if it's a master sheet
  availableStock: number;
  unit: 'sheets' | 'kg' | 'liters' | 'units';
  reorderPoint?: number;
  supplier?: string;
};

    