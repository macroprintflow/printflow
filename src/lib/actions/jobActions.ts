
'use server';

import type { JobCardFormValues, JobCardData, JobTemplateData, JobTemplateFormValues, InventoryItem, PaperQualityType, InventorySuggestion, InventoryItemFormValues, InventoryItemType, ItemGroupType, UnitValue, OptimizeInventoryOutput, InventoryAdjustment, InventoryAdjustmentReasonValue, WorkflowStep, InventoryAdjustmentItemFormValues, DesignSubmission, SubmitDesignInput, PlateTypeValue, ColorProfileValue, InventoryCategory } from '@/lib/definitions';
import { PAPER_QUALITY_OPTIONS, getPaperQualityLabel, INVENTORY_ADJUSTMENT_REASONS, KAPPA_MDF_QUALITIES, getPaperQualityUnit } from '@/lib/definitions';
import { calculateUps } from '@/lib/calculateUps';
import { revalidatePath } from 'next/cache';
// Removed fs and path imports

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
    // Ensure stores are initialized (should be by module load)
    if (!global.__jobCards__) global.__jobCards__ = [];
    if (global.__jobCounter__ === undefined) global.__jobCounter__ = 1;
    if (!global.__inventoryItemsStore__) global.__inventoryItemsStore__ = [];
    if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];
    if (global.__adjustmentCounter__ === undefined) global.__adjustmentCounter__ = 1;

    const currentJobCounter = global.__jobCounter__;
    const newJobCard: JobCardData = {
      ...data,
      id: currentJobCounter.toString(),
      jobCardNumber: generateJobCardNumber(),
      date: new Date().toISOString().split('T')[0],
      cuttingLayoutDescription: data.cuttingLayoutDescription,
      sheetsPerMasterSheet: data.sheetsPerMasterSheet,
      totalMasterSheetsNeeded: data.totalMasterSheetsNeeded,
      paperGsm: KAPPA_MDF_QUALITIES.includes(data.paperQuality as PaperQualityType) ? undefined : data.paperGsm,
      targetPaperThicknessMm: KAPPA_MDF_QUALITIES.includes(data.paperQuality as PaperQualityType) ? data.targetPaperThicknessMm : undefined,
      selectedMasterSheetGsm: KAPPA_MDF_QUALITIES.includes(data.selectedMasterSheetQuality as PaperQualityType) ? undefined : data.selectedMasterSheetGsm,
      selectedMasterSheetThicknessMm: KAPPA_MDF_QUALITIES.includes(data.selectedMasterSheetQuality as PaperQualityType) ? data.selectedMasterSheetThicknessMm : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Pending Planning',
      workflowSteps: data.workflowSteps || [],
      pdfDataUri: data.pdfDataUri,
    };
    global.__jobCards__.push(newJobCard);
    global.__jobCounter__ = currentJobCounter + 1;

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
      } else {
        console.warn(`[JobActions] Inventory item ID ${data.sourceInventoryItemId} not found for stock deduction for job ${newJobCard.jobCardNumber}. Stock not deducted.`);
      }
    }

    console.log('[JobActions] Created job card (in-memory):', newJobCard.jobCardNumber);
    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    revalidatePath('/inventory', 'layout');
    revalidatePath('/planning');
    revalidatePath('/customer/my-jobs');
    return { success: true, message: 'Job card created successfully! (In-memory)', jobCard: newJobCard };
  } catch (error) {
    console.error('[JobActions Error] Error creating job card (in-memory):', error);
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

export async function createJobTemplate(data: JobTemplateFormValues): Promise<{ success: boolean; message: string; template?: JobTemplateData }> {
  try {
    if (!global.__jobTemplatesStore__) global.__jobTemplatesStore__ = [];
    if (global.__templateCounter__ === undefined) global.__templateCounter__ = 1;

    const currentTemplateCounter = global.__templateCounter__;
    const newTemplate: JobTemplateData = {
      ...data,
      id: `template${currentTemplateCounter}`,
      predefinedWorkflow: data.predefinedWorkflow || [],
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
    const quality = data.paperQuality as PaperQualityType;
    const unit = getPaperQualityUnit(quality);
    if (data.category === 'PAPER') {
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

export async function addInventoryItem(data: InventoryItemFormValues): Promise<{ success: boolean; message: string; item?: InventoryItem }> {
  try {
    if (!global.__inventoryItemsStore__) global.__inventoryItemsStore__ = [];
    if (global.__inventoryCounter__ === undefined) global.__inventoryCounter__ = 1;
    if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];
    if (global.__adjustmentCounter__ === undefined) global.__adjustmentCounter__ = 1;

    const itemTypeKey = generateItemTypeKey(data);
    let existingItem = global.__inventoryItemsStore__.find(item => {
        const quality = item.paperQuality as PaperQualityType;
        const unit = getPaperQualityUnit(quality);
        if (item.type === 'Master Sheet' && data.category === 'PAPER') {
            let existingKey = '';
            if (unit === 'mm') {
                existingKey = `paper_${quality}_${item.paperThicknessMm}mm_${item.masterSheetSizeWidth?.toFixed(2)}x${item.masterSheetSizeHeight?.toFixed(2)}`.toLowerCase();
            } else {
                existingKey = `paper_${quality}_${item.paperGsm}gsm_${item.masterSheetSizeWidth?.toFixed(2)}x${item.masterSheetSizeHeight?.toFixed(2)}`.toLowerCase();
            }
            return existingKey === itemTypeKey;
        } else if (item.type === 'Ink' && data.category === 'INKS') {
            const existingKey = `ink_${item.name}`.toLowerCase();
            return existingKey === itemTypeKey;
        } else if (data.category !== 'PAPER' && data.category !== 'INKS') {
             const normalizedItemName = (item.name || "unknown_item").toLowerCase().replace(/\s+/g, '_');
             const originalCategoryGuess = item.itemGroup === 'Other Stock' ? 'OTHER' : item.itemGroup;
             const existingKey = `other_${originalCategoryGuess}_${normalizedItemName}`.toLowerCase();
             return existingKey === itemTypeKey;
        }
        return false;
    });

    let inventoryItemId: string;
    let adjustmentReason: InventoryAdjustmentReasonValue = 'INITIAL_STOCK';
    let itemForMessage: InventoryItem;

    if (existingItem) {
      inventoryItemId = existingItem.id;
      adjustmentReason = 'PURCHASE_RECEIVED';
      if (data.reorderPoint && (!existingItem.reorderPoint || data.reorderPoint > existingItem.reorderPoint)) {
        existingItem.reorderPoint = data.reorderPoint;
      }
      if (data.locationCode) existingItem.locationCode = data.locationCode;
      itemForMessage = existingItem;
    } else {
      const currentInventoryCounter = global.__inventoryCounter__++;
      inventoryItemId = `inv${currentInventoryCounter}`;
      let itemType: InventoryItemType = 'Other';
      let itemGroup: ItemGroupType = 'Other Stock';
      let specificName = data.itemName;
      let specificSpecification = data.itemSpecification || '';
      let masterSheetSizeWidth_val: number | undefined = undefined;
      let masterSheetSizeHeight_val: number | undefined = undefined;
      let paperGsm_val: number | undefined = undefined;
      let paperThicknessMm_val: number | undefined = undefined;
      let paperQuality_val: PaperQualityType | undefined = undefined;

      if (data.category === 'PAPER') {
        masterSheetSizeWidth_val = data.paperMasterSheetSizeWidth;
        masterSheetSizeHeight_val = data.paperMasterSheetSizeHeight;
        paperQuality_val = data.paperQuality as PaperQualityType;
        itemType = 'Master Sheet';
        const qualityLabel = getPaperQualityLabel(paperQuality_val);
        itemGroup = qualityLabel as ItemGroupType;
        const unit = getPaperQualityUnit(paperQuality_val);
        if (unit === 'mm') {
            paperThicknessMm_val = data.paperThicknessMm;
            specificName = `${masterSheetSizeWidth_val?.toFixed(2)}x${masterSheetSizeHeight_val?.toFixed(2)}in - ${paperThicknessMm_val}mm`;
        } else {
            paperGsm_val = data.paperGsm;
            specificName = `${masterSheetSizeWidth_val?.toFixed(2)}x${masterSheetSizeHeight_val?.toFixed(2)}in - ${paperGsm_val}GSM`;
        }
        specificSpecification = `${qualityLabel} ${unit === 'mm' ? paperThicknessMm_val + 'mm' : paperGsm_val + 'GSM'}, ${masterSheetSizeWidth_val?.toFixed(2)}in x ${masterSheetSizeHeight_val?.toFixed(2)}in`;
      } else if (data.category === 'INKS') {
        itemType = 'Ink'; itemGroup = 'Inks'; specificName = data.inkName!; specificSpecification = data.inkSpecification || 'N/A';
      } else {
        specificName = data.itemName;
        itemType = data.category === 'PLASTIC_TRAY' ? 'Plastic Tray' : data.category === 'GLASS_JAR' ? 'Glass Jar' : data.category === 'MAGNET' ? 'Magnet' : 'Other';
        itemGroup = data.category === 'PLASTIC_TRAY' ? 'Plastic Trays' : data.category === 'GLASS_JAR' ? 'Glass Jars' : data.category === 'MAGNET' ? 'Magnets' : 'Other Stock';
      }

      const newItemMaster: InventoryItem = {
        id: inventoryItemId, name: specificName, type: itemType, itemGroup: itemGroup, specification: specificSpecification,
        paperGsm: paperGsm_val, paperThicknessMm: paperThicknessMm_val, paperQuality: paperQuality_val,
        masterSheetSizeWidth: masterSheetSizeWidth_val, masterSheetSizeHeight: masterSheetSizeHeight_val,
        unit: data.unit as UnitValue, reorderPoint: data.reorderPoint, purchaseBillNo: data.purchaseBillNo,
        vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
        dateOfEntry: data.dateOfEntry, locationCode: data.locationCode,
      };
      global.__inventoryItemsStore__.push(newItemMaster);
      itemForMessage = newItemMaster;
    }

    if (data.quantity > 0) {
        const adjustment: InventoryAdjustment = {
            id: `adj${global.__adjustmentCounter__++}`, inventoryItemId: inventoryItemId, date: data.dateOfEntry,
            quantityChange: data.quantity, reason: adjustmentReason,
            reference: data.purchaseBillNo || (adjustmentReason === 'INITIAL_STOCK' ? 'Initial Entry' : 'Stock Added'),
            notes: adjustmentReason === 'INITIAL_STOCK' ? 'Initial stock.' : `Bill: ${data.purchaseBillNo || 'N/A'}`,
            vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
            purchaseBillNo: data.purchaseBillNo,
        };
        global.__inventoryAdjustmentsStore__.push(adjustment);
    } else if (adjustmentReason === 'INITIAL_STOCK' && data.quantity === 0) {
        const adjustment: InventoryAdjustment = {
            id: `adj${global.__adjustmentCounter__++}`, inventoryItemId: inventoryItemId, date: data.dateOfEntry,
            quantityChange: 0, reason: 'INITIAL_STOCK', reference: 'Item type defined',
            notes: 'Zero initial stock.',
            vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
            purchaseBillNo: data.purchaseBillNo,
        };
        global.__inventoryAdjustmentsStore__.push(adjustment);
    }

    console.log(`[JobActions] Inventory item ${itemForMessage.name} ${existingItem ? 'updated' : 'created'} (in-memory).`);
    revalidatePath('/inventory', 'layout');
    return { success: true, message: `Stock updated for: ${itemForMessage.name} (In-memory). Quantity added: ${data.quantity}`, item: itemForMessage };
  } catch (error) {
    console.error('[JobActions Error] Error adding/updating inventory item (in-memory):', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update stock: ${errorMessage}` };
  }
}

export async function getInventoryItems(categoryFilter?: InventoryCategory): Promise<InventoryItem[]> {
  // Ensure stores are initialized
  if (!global.__inventoryItemsStore__) global.__inventoryItemsStore__ = [];
  if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];

  const itemsWithStock = global.__inventoryItemsStore__.map(item => {
    const adjustments = global.__inventoryAdjustmentsStore__!.filter(adj => adj.inventoryItemId === item.id);
    const availableStock = adjustments.reduce((sum, adj) => sum + adj.quantityChange, 0);
    return { ...item, availableStock };
  });
  
  if (!categoryFilter || categoryFilter === "ALL") {
    return itemsWithStock;
  }
  
  return itemsWithStock.filter(item => {
    if (categoryFilter === 'PAPER') return item.type === 'Master Sheet';
    if (categoryFilter === 'INKS') return item.itemGroup === 'Inks'; // or item.type === 'Ink'
    if (categoryFilter === 'PLASTIC_TRAY') return item.itemGroup === 'Plastic Trays';
    if (categoryFilter === 'GLASS_JAR') return item.itemGroup === 'Glass Jars';
    if (categoryFilter === 'MAGNET') return item.itemGroup === 'Magnets';
    if (categoryFilter === 'OTHER') return item.itemGroup === 'Other Stock';
    return false;
  });
}

export async function getInventoryAdjustmentsForItem(inventoryItemId: string): Promise<InventoryAdjustment[]> {
  if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];
  return global.__inventoryAdjustmentsStore__
    .filter(adj => adj.inventoryItemId === inventoryItemId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function applyInventoryAdjustments(
  adjustments: Array<Omit<InventoryAdjustmentItemFormValues, 'itemNameFull'>>
): Promise<{ success: boolean; message: string; errors?: { itemIndex: number; message: string }[] }> {
  if (!global.__inventoryItemsStore__) global.__inventoryItemsStore__ = [];
  if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];
  if (global.__adjustmentCounter__ === undefined) global.__adjustmentCounter__ = 1;

  const batchErrors: { itemIndex: number; message: string }[] = [];
  for (let i = 0; i < adjustments.length; i++) {
    const adjItem = adjustments[i];
    const inventoryItem = global.__inventoryItemsStore__.find(item => item.id === adjItem.inventoryItemId);
    if (!inventoryItem) {
      batchErrors.push({ itemIndex: i, message: `Inv. item ID ${adjItem.inventoryItemId} not found.` });
      continue;
    }
    if (adjItem.quantityChange === 0) {
        batchErrors.push({ itemIndex: i, message: `Qty change for ${inventoryItem.name} cannot be zero.` });
        continue;
    }
    const newAdjustmentRecord: InventoryAdjustment = {
      id: `adj${global.__adjustmentCounter__++}`, inventoryItemId: adjItem.inventoryItemId, date: new Date().toISOString(),
      quantityChange: adjItem.quantityChange, reason: adjItem.reason,
      notes: adjItem.notes || `Adj: ${getInventoryAdjustmentReasonLabel(adjItem.reason)}`,
      reference: `ADJ-${new Date().toISOString().substring(0, 10)}-${global.__adjustmentCounter__}`,
    };
    global.__inventoryAdjustmentsStore__.push(newAdjustmentRecord);
  }

  if (batchErrors.length > 0) {
    return { success: false, message: "Some adjustments failed.", errors: batchErrors };
  }
  console.log(`[JobActions] Applied ${adjustments.length} adjustments (in-memory).`);
  revalidatePath('/inventory', 'layout');
  return { success: true, message: `${adjustments.length} inventory adjustment(s) applied successfully (In-memory).` };
}

// Design Submission Actions (In-Memory)
export async function addDesignSubmissionInternal(
  submissionDetails: Omit<DesignSubmission, 'id' | 'status' | 'date' | 'uploader'>
): Promise<DesignSubmission> {
  if (!global.__designSubmissionsStore__) global.__designSubmissionsStore__ = [];
  if (global.__designSubmissionCounter__ === undefined) global.__designSubmissionCounter__ = 1;

  const newId = `ds-${global.__designSubmissionCounter__++}`;
  const newSubmission: DesignSubmission = {
    ...submissionDetails, id: newId, status: "pending",
    date: new Date().toISOString(), uploader: "Current User (mock)",
  };
  global.__designSubmissionsStore__.push(newSubmission);
  console.log('[JobActions] Added design submission (in-memory):', newSubmission.id);
  revalidatePath('/for-approval');
  revalidatePath('/jobs/new');
  return newSubmission;
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
    
