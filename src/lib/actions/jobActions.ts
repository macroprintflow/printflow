'use server';

// TypeScript types
import type {
  JobCardFormValues, JobTemplateFormValues, 
  InventorySuggestion, InventoryItemFormValues, InventoryItemType, ItemGroupType, UnitValue,
  OptimizeInventoryOutput, InventoryAdjustmentReasonValue, WorkflowStep,
  SubmitDesignInput, PlateTypeValue, ColorProfileValue,
  PaperQualityType, InventoryCategory, InventoryItem, InventoryAdjustment, InventoryAdjustmentItemFormValues, JobCardData, JobTemplateData, DesignSubmission
} from '@/lib/definitions';
import { deleteField } from "firebase/firestore";
import {
  addDoc,
  doc,
  setDoc,
  updateDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
// Helper functions & constants for paper quality, inventory, etc.
import {
  asPaperQuality,
  getPaperQualityLabel,
  getPaperQualityUnit,
  INVENTORY_ADJUSTMENT_REASONS,
  KAPPA_MDF_QUALITIES,
  PAPER_QUALITY_OPTIONS,
} from '@/lib/definitions';

import { calculateUps } from '@/lib/calculateUps';
import { revalidatePath } from 'next/cache';
import { getDB } from "@/lib/firebase/clientApp";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

// ---- TYPE GUARD for Paper Quality ----
function isPaperQuality(val: any): val is PaperQualityType {
  return PAPER_QUALITY_OPTIONS.some(opt => opt.value === val);
}

// ---- TYPE GUARD for Inventory Category ----
const INVENTORY_CATEGORIES = [
  "ALL", "PAPER", "INKS", "PLASTIC_TRAY", "GLASS_JAR", "MAGNET", "OTHER"
] as const;
type InventoryCategoryType = typeof INVENTORY_CATEGORIES[number];

function isInventoryCategory(val: any): val is InventoryCategoryType {
  return INVENTORY_CATEGORIES.includes(val);
}

// --- In-Memory Global Stores and Counters ---
declare global {
  var __jobCards__: JobCardData[] | undefined;
  var __jobCounter__: number | undefined;
  var __jobTemplatesStore__: JobTemplateData[] | undefined;
  var __templateCounter__: number | undefined;
  var __inventoryItemsStore__: InventoryItem[] | undefined;
  var __inventoryCounter__: number | undefined;
  var __inventoryAdjustmentsStore__: InventoryAdjustment[] | undefined;
  var __adjustmentCounter__: number | undefined;
  var __designSubmissionsStore__: DesignSubmission[] | undefined;
  var __designSubmissionCounter__: number | undefined;
  var __jobSeriesLetter__: string | undefined;
  var __jobSeriesCounter__: number | undefined;
}


// --- Initialize Global Stores and Counters (In-Memory) ---
function initializeInMemoryStores() {
  console.log('[JobActions] Initializing in-memory stores...');
  if (global.__jobCards__ === undefined) {
    global.__jobCards__ = [];
    global.__jobCounter__ = 1;
    console.log('[JobActions] Initialized __jobCards__ and __jobCounter__.');
  }
  if (global.__jobSeriesLetter__ === undefined) {
    global.__jobSeriesLetter__ = 'A';
    console.log('[JobActions] Initialized __jobSeriesLetter__.');
  }
  if (global.__jobSeriesCounter__ === undefined) {
    global.__jobSeriesCounter__ = 1;
    console.log('[JobActions] Initialized __jobSeriesCounter__.');
  }

  if (global.__jobTemplatesStore__ === undefined) {
    global.__jobTemplatesStore__ = [
      { id: 'template1', name: 'Golden Tray (Predefined)', kindOfJob: 'METPET', coating: 'VARNISH_GLOSS', hotFoilStamping: 'GOLDEN', paperQuality: 'GOLDEN_SHEET', predefinedWorkflow: [] },
      { id: 'template2', name: 'Rigid Top and Bottom Box (Predefined)', boxMaking: 'COMBINED', pasting: 'YES', paperQuality: 'WG_KAPPA', predefinedWorkflow: [] },
      { id: 'template3', name: 'Monocarton Box (Predefined)', kindOfJob: 'NORMAL', paperQuality: 'SBS', predefinedWorkflow: [] },
    ];
    global.__templateCounter__ = global.__jobTemplatesStore__.length + 1;
    console.log('[JobActions] Initialized __jobTemplatesStore__ and __templateCounter__.');
  }

  if (global.__inventoryItemsStore__ === undefined) {
    global.__inventoryItemsStore__ = [];
    global.__inventoryCounter__ = 1;
    console.log('[JobActions] Initialized __inventoryItemsStore__ and __inventoryCounter__.');
  }

  if (global.__inventoryAdjustmentsStore__ === undefined) {
    global.__inventoryAdjustmentsStore__ = [];
    global.__adjustmentCounter__ = 1;
    console.log('[JobActions] Initialized __inventoryAdjustmentsStore__ and __adjustmentCounter__.');
  }

  if (global.__designSubmissionsStore__ === undefined) {
    global.__designSubmissionsStore__ = [];
    global.__designSubmissionCounter__ = 1;
    console.log('[JobActions] Initialized __designSubmissionsStore__ and __designSubmissionCounter__.');
  }
  console.log('[JobActions] In-memory stores initialization complete.');
}

initializeInMemoryStores(); // Call initialization when module loads


function generateJobCardNumber(): string {
  if (!global.__jobSeriesLetter__ || global.__jobSeriesCounter__ === undefined) {
    // Fallback initialization if somehow missed
    global.__jobSeriesLetter__ = 'A';
    global.__jobSeriesCounter__ = 1;
  }
  if (global.__jobSeriesCounter__ > 999) {
    global.__jobSeriesLetter__ = String.fromCharCode(global.__jobSeriesLetter__.charCodeAt(0) + 1);
    global.__jobSeriesCounter__ = 1;
  }
  const sequentialNumber = global.__jobSeriesCounter__.toString().padStart(3, '0');
  const jobCardNumber = `JC-${global.__jobSeriesLetter__}-${sequentialNumber}`;
  global.__jobSeriesCounter__++;
  return jobCardNumber;
}

export async function createJobCard(data: JobCardFormValues): Promise<{ success: boolean; message: string; jobCard?: JobCardData }> {
  try {
    if (!global.__jobCards__) global.__jobCards__ = [];
    if (global.__jobCounter__ === undefined) global.__jobCounter__ = 1;
    if (!global.__inventoryItemsStore__) global.__inventoryItemsStore__ = [];
    if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];
    if (global.__adjustmentCounter__ === undefined) global.__adjustmentCounter__ = 1;

    const currentJobCounter = global.__jobCounter__;

    // --- Validate/cast all paper-related union types! ---
    const mainPaperQuality = asPaperQuality(data.paperQuality);
if (!mainPaperQuality) {
  throw new Error("Invalid or missing paperQuality");
}

const selSheetQuality: PaperQualityType | undefined = isPaperQuality(data.selectedMasterSheetQuality)
  ? data.selectedMasterSheetQuality
  : undefined;

const isKappa = KAPPA_MDF_QUALITIES.includes(mainPaperQuality);
const isSelKappa = selSheetQuality ? KAPPA_MDF_QUALITIES.includes(selSheetQuality) : false;

const newJobCard: JobCardData = {
  id: currentJobCounter.toString(),
  jobCardNumber: generateJobCardNumber(),
  date: new Date().toISOString().split('T')[0],

  // Form values or defaults
  jobName: data.jobName,
  customerName: data.customerName,
  jobSizeWidth: data.jobSizeWidth,
  jobSizeHeight: data.jobSizeHeight,
  netQuantity: data.netQuantity,
  grossQuantity: data.grossQuantity,
  paperQuality: mainPaperQuality ?? "SBS", // default fallback if needed

  // Add optional fields if they exist in data (or provide safe defaults)
  customerId: data.customerId,
  masterSheetSizeWidth: data.masterSheetSizeWidth,
  masterSheetSizeHeight: data.masterSheetSizeHeight,
  paperGsm: data.paperGsm,
  targetPaperThicknessMm: data.targetPaperThicknessMm,
  wastagePercentage: data.wastagePercentage,
  cuttingLayoutDescription: data.cuttingLayoutDescription,

  selectedMasterSheetGsm: data.selectedMasterSheetGsm,
  selectedMasterSheetThicknessMm: data.selectedMasterSheetThicknessMm,
  selectedMasterSheetQuality: asPaperQuality(data.selectedMasterSheetQuality),
  sourceInventoryItemId: data.sourceInventoryItemId,
  sheetsPerMasterSheet: data.sheetsPerMasterSheet,
  totalMasterSheetsNeeded: data.totalMasterSheetsNeeded,

  // Workflow/production fields (required, so supply blank if not used yet)
  kindOfJob: data.kindOfJob ?? undefined,
  printingFront: data.printingFront ?? undefined,
  printingBack: data.printingBack ?? undefined,
  coating: data.coating ?? undefined,
  die: data.die ?? undefined,
  hotFoilStamping: data.hotFoilStamping ?? undefined,
  emboss: data.emboss ?? undefined,
  pasting: data.pasting ?? undefined,
  boxMaking: data.boxMaking ?? undefined,

  specialInks: data.specialInks,
  assignedDieMachine: data.assignedDieMachine,
  remarks: data.remarks,
  dispatchDate: data.dispatchDate,
  linkedJobCardIds: data.linkedJobCardIds,
  currentDepartment: data.currentDepartment,
  status: "Pending Planning",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  workflowSteps: data.workflowSteps || [],
  pdfDataUri: data.pdfDataUri,
  hasPendingInventory: data.hasPendingInventory,
};
    global.__jobCards__.push(newJobCard);
    global.__jobCounter__ = currentJobCounter + 1;

    // Deduct stock if applicable
    if (data.sourceInventoryItemId && data.totalMasterSheetsNeeded && data.totalMasterSheetsNeeded > 0) {
      const itemExists = global.__inventoryItemsStore__.some(item => item.id === data.sourceInventoryItemId);
      if (itemExists) {
        const adjustment: InventoryAdjustment = {
          id: `adj${global.__adjustmentCounter__++}`,
          inventoryItemId: data.sourceInventoryItemId,
          date: new Date().toISOString(),
          quantityChange: -data.totalMasterSheetsNeeded,
          reason: 'JOB_USAGE',
          reference: newJobCard.jobCardNumber,
          notes: `Used for job: ${newJobCard.jobName}`,
        };
        global.__inventoryAdjustmentsStore__.push(adjustment);
      }
    }

    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    revalidatePath('/inventory', 'layout');
    revalidatePath('/planning');
    revalidatePath('/customer/my-jobs');
    return { success: true, message: 'Job card created successfully! (In-memory)', jobCard: newJobCard };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create job card: ${errorMessage}` };
  }
}

export async function getJobCards(): Promise<JobCardData[]> {
  if (!global.__jobCards__) global.__jobCards__ = [];
  return [...global.__jobCards__];
}

export async function getJobCardById(id: string): Promise<JobCardData | null> {
  if (!global.__jobCards__) global.__jobCards__ = [];
  const job = global.__jobCards__.find(j => j.id === id);
  return job || null;
}

export async function getInventoryOptimizationSuggestions(
  jobInput: {
    paperGsm?: number;
    paperThicknessMm?: number;
    paperQuality: PaperQualityType;
    jobSizeWidth: number;
    jobSizeHeight: number;
    quantityToProduce: number;
  }
): Promise<OptimizeInventoryOutput | { error: string }> {
  console.log('[JobActions TS Calc] getInventoryOptimizationSuggestions called (in-memory). Job Input:', JSON.stringify(jobInput, null, 2));
  const allInventoryMasterItems = await getInventoryItems(); 
  
  if (allInventoryMasterItems.length === 0) {
    console.log('[JobActions TS Calc] No inventory items to process for optimization suggestions (getInventoryItems returned empty).');
    return { suggestions: [], optimalSuggestion: undefined };
  }
  // The original complex logic for suggestions is omitted here as it will operate on an empty list.
  return { suggestions: [], optimalSuggestion: undefined };
}


export async function getJobTemplates(): Promise<JobTemplateData[]> {
  if (!global.__jobTemplatesStore__) global.__jobTemplatesStore__ = [];
  return [...global.__jobTemplatesStore__];
}

export async function createJobTemplate(
  data: JobTemplateFormValues
): Promise<{ success: boolean; message: string; template?: JobTemplateData }> {
  try {
    if (!global.__jobTemplatesStore__) global.__jobTemplatesStore__ = [];
    if (global.__templateCounter__ === undefined) global.__templateCounter__ = 1;

    const currentTemplateCounter = global.__templateCounter__;
    const newTemplate: JobTemplateData = {
      ...data,
      id: `template${currentTemplateCounter}`,
      predefinedWorkflow: data.predefinedWorkflow || [],
      paperQuality: asPaperQuality(data.paperQuality), // <<------ THIS LINE IS NEW!
    };
    global.__jobTemplatesStore__.push(newTemplate);
    global.__templateCounter__ = currentTemplateCounter + 1;

    console.log('[JobActions] Created job template (in-memory):', newTemplate.name);
    revalidatePath('/templates');
    revalidatePath('/templates/new');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job template created successfully! (In-memory)', template: newTemplate };
  } catch (error) {
    console.error('[JobActions Error] Error creating job template (in-memory):', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create job template: ${errorMessage}` };
  }
}

export async function getUniqueCustomerNames(): Promise<string[]> {
  if (!global.__jobCards__) global.__jobCards__ = [];
  const customerNames = new Set(global.__jobCards__.map(job => job.customerName));
  return Array.from(customerNames).sort();
}

export async function getJobsByCustomerName(customerName: string): Promise<JobCardData[]> {
  if (!global.__jobCards__) global.__jobCards__ = [];
  return global.__jobCards__.filter(job => job.customerName === customerName).sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return a.jobName.localeCompare(b.jobName);
  });
}

function generateItemTypeKey(data: InventoryItemFormValues): string {
  const quality = asPaperQuality(data.paperQuality);
  if (data.category === 'PAPER') {
      if (!quality) {
          throw new Error("paperQuality is required and must be valid for PAPER category in generateItemTypeKey!");
      }
      const unit = getPaperQualityUnit(quality);
      const width = data.paperMasterSheetSizeWidth || 0;
      const height = data.paperMasterSheetSizeHeight || 0;
      if (unit === 'mm') {
          const thickness = data.paperThicknessMm || 0;
          return `paper_${quality}_${thickness}mm_${width.toFixed(2)}x${height.toFixed(2)}`.toLowerCase();
      } else {
          const gsm = data.paperGsm || 0;
          return `paper_${quality}_${gsm}gsm_${width.toFixed(2)}x${height.toFixed(2)}`.toLowerCase();
      }
  } else if (data.category === 'INKS') {
      const inkName = data.inkName || 'unknown_ink';
      return `ink_${inkName}`.toLowerCase();
  } else {
      const itemName = data.itemName || 'unknown_item';
      return `other_${data.category}_${itemName}`.toLowerCase().replace(/\s+/g, '_');
  }
}
function isSameInventoryItem(
  item: InventoryItem,
  form: InventoryItemFormValues,
  computedKey: string
): boolean {
  const quality = asPaperQuality(item.paperQuality);
  if (!quality) return false;

  const unit = getPaperQualityUnit(quality);

  if (form.category === "PAPER" && item.type === "Master Sheet") {
    const key =
      unit === "mm"
        ? `paper_${quality}_${item.paperThicknessMm}mm_${item.masterSheetSizeWidth?.toFixed(
            2
          )}x${item.masterSheetSizeHeight?.toFixed(2)}`
        : `paper_${quality}_${item.paperGsm}gsm_${item.masterSheetSizeWidth?.toFixed(
            2
          )}x${item.masterSheetSizeHeight?.toFixed(2)}`;
    return key.toLowerCase() === computedKey;
  }

  if (form.category === "INKS" && item.type === "Ink") {
    return `ink_${item.name}`.toLowerCase() === computedKey;
  }

  if (form.category !== "PAPER" && form.category !== "INKS") {
    const normalized = (item.name || "unknown_item")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const cat = item.itemGroup === "Other Stock" ? "OTHER" : item.itemGroup;
    return `other_${cat}_${normalized}`.toLowerCase() === computedKey;
  }

  return false;
}

/* =======================================================================
   Helper ②  – build all fields for a NEW inventory item
   ======================================================================= */
function buildItemFields(data: InventoryItemFormValues) {
  let itemType: InventoryItemType = "Other";
  let itemGroup: ItemGroupType    = "Other Stock";
  let specificName                = data.itemName;
  let specificSpecification       = data.itemSpecification || "";

  let masterSheetSizeWidth_val    : number | undefined;
  let masterSheetSizeHeight_val   : number | undefined;
  let paperGsm_val                : number | undefined;
  let paperThicknessMm_val        : number | undefined;
  let paperQuality_val            : PaperQualityType | undefined;

  let qualityLabel = "";
  let unit: "mm" | "gsm" | null = null;

  /* ------------ PAPER ------------ */
  if (data.category === "PAPER") {
    masterSheetSizeWidth_val  = data.paperMasterSheetSizeWidth;
    masterSheetSizeHeight_val = data.paperMasterSheetSizeHeight;
    paperQuality_val          = asPaperQuality(data.paperQuality);

    if (!paperQuality_val) {
      throw new Error("paperQuality is required and must be valid for PAPER category!");
    }

    itemType     = "Master Sheet";
    qualityLabel = getPaperQualityLabel(paperQuality_val);
    itemGroup    = qualityLabel as ItemGroupType;
    unit         = getPaperQualityUnit(paperQuality_val);

    if (unit === "mm") {
      paperThicknessMm_val = data.paperThicknessMm;
      specificName = `${masterSheetSizeWidth_val?.toFixed(
        2
      )}x${masterSheetSizeHeight_val?.toFixed(2)}in - ${paperThicknessMm_val}mm`;
    } else {
      paperGsm_val = data.paperGsm;
      specificName = `${masterSheetSizeWidth_val?.toFixed(
        2
      )}x${masterSheetSizeHeight_val?.toFixed(2)}in - ${paperGsm_val}GSM`;
    }

    specificSpecification = `${qualityLabel} ${
      unit === "mm"
        ? (paperThicknessMm_val ?? "") + "mm"
        : (paperGsm_val ?? "") + "GSM"
    }, ${masterSheetSizeWidth_val?.toFixed(2)}in x ${masterSheetSizeHeight_val?.toFixed(
      2
    )}in`;
  }

  /* ------------ INKS ------------ */
  else if (data.category === "INKS") {
    itemType               = "Ink";
    itemGroup              = "Inks";
    specificName           = data.inkName || "";
    specificSpecification  = data.inkSpecification || "N/A";
  }

  /* ------------ OTHER CATEGORIES ------------ */
  else {
    specificName = data.itemName;
    itemType =
      data.category === "PLASTIC_TRAY"
        ? "Plastic Tray"
        : data.category === "GLASS_JAR"
        ? "Glass Jar"
        : data.category === "MAGNET"
        ? "Magnet"
        : "Other";

    itemGroup =
      data.category === "PLASTIC_TRAY"
        ? "Plastic Trays"
        : data.category === "GLASS_JAR"
        ? "Glass Jars"
        : data.category === "MAGNET"
        ? "Magnets"
        : "Other Stock";
  }

  return {
    itemType,
    itemGroup,
    specificName,
    specificSpecification,
    masterSheetSizeWidth_val,
    masterSheetSizeHeight_val,
    paperGsm_val,
    paperThicknessMm_val,
    paperQuality_val,
  };
}
export async function addInventoryItem(
  data: InventoryItemFormValues
): Promise<{ success: boolean; message: string; item?: InventoryItem }> {
  try {

    const db = getDB();
    const inventoryItemsCollection = collection(db, "inventoryItems");
    /* ─── In-memory store boot-strapping ────────────────────────── */
    global.__inventoryItemsStore__        ??= [];
    global.__inventoryAdjustmentsStore__  ??= [];
    global.__inventoryCounter__           ??= 1;
    global.__adjustmentCounter__          ??= 1;

    /* ─── 0. Locate existing item in memory ─────────────────────── */
    const itemTypeKey  = generateItemTypeKey(data);
    const existingItem = global.__inventoryItemsStore__
      .find(item => isSameInventoryItem(item, data, itemTypeKey));

    /* ─── 1. Create-or-update inventory item ────────────────────── */
    let inventoryItemId: string;
    let adjustmentReason: InventoryAdjustmentReasonValue = "INITIAL_STOCK";
    let itemForMessage:  InventoryItem;

    

    /* ---------- UPDATE existing item ---------- */
    if (existingItem) {
      inventoryItemId  = existingItem.id;
      adjustmentReason = "PURCHASE_RECEIVED";

      if (data.reorderPoint !== undefined &&
          (existingItem.reorderPoint === undefined || data.reorderPoint > existingItem.reorderPoint)) {
        existingItem.reorderPoint = data.reorderPoint;
      }
      if (data.locationCode) existingItem.locationCode = data.locationCode;

      itemForMessage = existingItem;

      /* Build update object without undefined */
      const updates: Record<string, any> = { updatedAt: serverTimestamp() };
      updates.reorderPoint = existingItem.reorderPoint ?? deleteField();
      updates.locationCode = existingItem.locationCode ?? deleteField();

      await setDoc(
        doc(db, "inventoryItems", inventoryItemId),
        updates,
        { merge: true }
      );
      
      /* 🔍 DEBUG */
      console.log("[addInventoryItem] upserted doc:", inventoryItemId);
    } else {
      /* ---------- CREATE new item ---------- */
      const currentInventoryCounter = global.__inventoryCounter__++;
      inventoryItemId = `inv${currentInventoryCounter}`;

      const {
        itemType, itemGroup, specificName, specificSpecification,
        masterSheetSizeWidth_val, masterSheetSizeHeight_val,
        paperGsm_val, paperThicknessMm_val, paperQuality_val,
      } = buildItemFields(data);

      const base: Partial<InventoryItem> = {
        id   : inventoryItemId,
        name : specificName,
        type : itemType,
        itemGroup,
        specification        : specificSpecification,
        masterSheetSizeWidth : masterSheetSizeWidth_val,
        masterSheetSizeHeight: masterSheetSizeHeight_val,
        paperGsm             : paperGsm_val,
        paperThicknessMm     : paperThicknessMm_val,
        paperQuality         : paperQuality_val,
        availableStock       : data.quantity ?? 0,
        locationCode         : data.locationCode,
        purchaseBillNo       : data.purchaseBillNo,
        vendorName           : data.vendorName === "OTHER" ? data.otherVendorName : data.vendorName,
        dateOfEntry          : data.dateOfEntry,
        unit                 : data.unit as UnitValue,
      
      };
      if (data.reorderPoint !== undefined) base.reorderPoint = data.reorderPoint;

      const newItemMaster = base as InventoryItem;

      global.__inventoryItemsStore__.push(newItemMaster);
      await setDoc(doc(db, "inventoryItems", inventoryItemId), newItemMaster);

      itemForMessage = newItemMaster;

      /* 🔍 DEBUG */
      console.log("[addInventoryItem] created:", inventoryItemId);
    }


 /* ================================================================
   2.  Create inventory adjustment (memory + Firestore)
   ================================================================ */
if (
  data.quantity > 0 ||                     // normal stock-in
  (adjustmentReason === "INITIAL_STOCK" && data.quantity === 0)
) {
  const adj: InventoryAdjustment = {
    id             : `adj${global.__adjustmentCounter__++}`,
    inventoryItemId,
    date           : data.dateOfEntry,
    quantityChange : data.quantity,
    reason         : adjustmentReason,
    reference      :
      data.purchaseBillNo ||
      (adjustmentReason === "INITIAL_STOCK" ? "Initial Entry" : "Stock Added"),
    notes          :
      adjustmentReason === "INITIAL_STOCK"
        ? "Initial stock."
        : `Bill: ${data.purchaseBillNo || "N/A"}`,
    vendorName     : data.vendorName === "OTHER"
                      ? data.otherVendorName
                      : data.vendorName,
    purchaseBillNo : data.purchaseBillNo,
        
  };

  /* 🔍 DEBUG: confirm the adjustment object & ID */
  console.log("[applyInventoryAdjustments] adj object →", adj);

  /* ── in-memory log ───────────────────────────────────────────── */
  global.__inventoryAdjustmentsStore__.push(adj);

  /* ── Firestore transaction: verify doc, increment stock, add adj ─ */
  const itemRef = doc(db, "inventoryItems", inventoryItemId);
  const adjCol  = collection(db, "inventoryAdjustments");

  await runTransaction(db, async (tx) => {
    /* 1️⃣ ensure the inventory document exists */
    const snap = await tx.get(itemRef);
    if (!snap.exists()) {
      throw new Error(`Inventory document ${inventoryItemId} not found`);
    }

    /* 2️⃣ increment availableStock */
    tx.update(itemRef, {
      availableStock: increment(data.quantity),
      updatedAt     : serverTimestamp(),   // omit if not in your interface
    });

    /* 3️⃣ add adjustment document with auto-generated ID */
    tx.set(doc(adjCol), adj);
  });
}

/* ----------------------------------------------------------------
   3.  Finish response & invalidate cache
   ---------------------------------------------------------------- */
console.log(
  `[JobActions] Inventory item ${itemForMessage.name} ${
    existingItem ? "updated" : "created"
  } (Firestore + memory).`
);
revalidatePath("/inventory", "layout");

    /* ─── success ─────────────────────────────────────────────── */
    return {
      success : true,
      message : `Stock updated for: ${itemForMessage.name}. Quantity added: ${data.quantity}`,
      item    : itemForMessage,
    };

  } catch (error) {
    console.error("[JobActions Error] addInventoryItem:", error);
    const msg = error instanceof Error ? error.message : "Unexpected error.";
    return { success: false, message: `Failed to update stock: ${msg}` };
  }
}

/* =======================================================================
   getInventoryItems – reads from Firestore and applies category filter
   ======================================================================= */
export async function getInventoryItems(
  categoryFilter: InventoryCategoryType = "ALL"
): Promise<InventoryItem[]> {
  const db      = getDB();
  const colRef  = collection(db, "inventoryItems");
  const snap    = await getDocs(colRef);

  /* ---- map + validate paperQuality ---------------------------------- */
  let items: InventoryItem[] = snap.docs.map((doc) => {
    const data = doc.data();
    const validatedPaperQuality = isPaperQuality(data.paperQuality)
      ? data.paperQuality
      : undefined;

    return {
      ...data,
      id: doc.id,
      paperQuality: validatedPaperQuality,
    } as InventoryItem;
  });

  /* ---- optional category filtering ---------------------------------- */
  if (categoryFilter !== "ALL") {
    items = items.filter((item) => {
      switch (categoryFilter as InventoryCategory) {
        case "PAPER":
          return item.type === "Master Sheet";
        case "INKS":
          return item.itemGroup === "Inks";
        case "PLASTIC_TRAY":
          return item.itemGroup === "Plastic Trays";
        case "GLASS_JAR":
          return item.itemGroup === "Glass Jars";
        case "MAGNET":
          return item.itemGroup === "Magnets";
        case "OTHER":
          return item.itemGroup === "Other Stock";
        default:
          return false;
      }
    });
  }

  return items;
}

export async function getInventoryAdjustmentsForItem(
  inventoryItemId: string
): Promise<InventoryAdjustment[]> {
  const db       = getDB();
  const colRef   = collection(db, "inventoryAdjustments");
  const q        = query(colRef,
                         where("inventoryItemId", "==", inventoryItemId),
                         orderBy("date", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }) as InventoryAdjustment);
}

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Inventory Adjustments: Apply batch                                 */
/* ------------------------------------------------------------------ */


export async function applyInventoryAdjustments(
  adjustments: Array<Omit<InventoryAdjustmentItemFormValues, "itemNameFull">>
): Promise<{
  success: boolean;
  message: string;
  errors?: { itemIndex: number; message: string }[];
}> {
  const db     = getDB();
  const adjCol = collection(db, "inventoryAdjustments");
  const errors: { itemIndex: number; message: string }[] = [];

  for (let i = 0; i < adjustments.length; i++) {
    const adj = adjustments[i];

    /* ── basic validation ───────────────────────────────────────── */
    if (!adj.inventoryItemId) {
      errors.push({ itemIndex: i, message: "Missing inventoryItemId." });
      continue;
    }
    if (adj.quantityChange === 0) {
      errors.push({ itemIndex: i, message: "Qty change cannot be zero." });
      continue;
    }

    /* ── Firestore transaction: create adj + update stock ───────── */
    try {
      await runTransaction(db, async (tx) => {
        /* 1️⃣  create adjustment document */
        await addDoc(adjCol, {
          ...adj,
          date     : new Date().toISOString(),
          createdAt: serverTimestamp(),
        });

        /* 2️⃣  increment availableStock in inventoryItems doc */
        const itemRef = doc(db, "inventoryItems", adj.inventoryItemId);
        tx.update(itemRef, {
          availableStock: increment(adj.quantityChange),
          updatedAt     : serverTimestamp(),   // remove if not in your type
        });
      });
    } catch (err: any) {
      errors.push({
        itemIndex: i,
        message  : err?.message ?? "Transaction failed",
      });
    }
  }
 
  if (errors.length) {
    return { success: false, message: "Some adjustments failed.", errors };
  }

  return {
    success: true,
    message: `${adjustments.length} inventory adjustment(s) applied successfully.`,
  };
}


export async function updateDesignSubmissionStatus(
  id: string,
  status: "approved" | "rejected"
): Promise<{ success: boolean; submission?: DesignSubmission, message?: string }> {
  if (!global.__designSubmissionsStore__) global.__designSubmissionsStore__ = [];
  const submissionIndex = global.__designSubmissionsStore__.findIndex(s => s.id === id);
  if (submissionIndex === -1) return { success: false, message: "Submission not found (in-memory)." };
  global.__designSubmissionsStore__[submissionIndex].status = status;
  global.__designSubmissionsStore__[submissionIndex].date = new Date().toISOString();
  console.log('[JobActions] Updated design submission status (in-memory):', id, status);
  revalidatePath('/for-approval');
  revalidatePath('/jobs/new');
  return { success: true, submission: global.__designSubmissionsStore__[submissionIndex] };
}

export async function getDesignSubmissions(): Promise<DesignSubmission[]> {
  if (!global.__designSubmissionsStore__) global.__designSubmissionsStore__ = [];
  return [...global.__designSubmissionsStore__];
}

export async function getApprovedDesigns(): Promise<DesignSubmission[]> {
  if (!global.__designSubmissionsStore__) global.__designSubmissionsStore__ = [];
  return global.__designSubmissionsStore__.filter(s => s.status === 'approved');
}
    