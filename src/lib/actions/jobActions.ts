
'use server';

import type { JobCardFormValues, JobCardData, JobTemplateData, JobTemplateFormValues, InventoryItem, PaperQualityType, InventorySuggestion, InventoryItemFormValues, InventoryItemType, ItemGroupType, UnitValue, OptimizeInventoryOutput, InventoryAdjustment, InventoryAdjustmentReasonValue, WorkflowStep, InventoryAdjustmentItemFormValues, DesignSubmission, SubmitDesignInput } from '@/lib/definitions';
import { PAPER_QUALITY_OPTIONS, getPaperQualityLabel, INVENTORY_ADJUSTMENT_REASONS, KAPPA_MDF_QUALITIES, getPaperQualityUnit } from '@/lib/definitions';
import { calculateUps } from '@/lib/calculateUps';
import { revalidatePath } from 'next/cache';

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

if (global.__jobCards__ === undefined) global.__jobCards__ = [];
if (global.__jobCounter__ === undefined) global.__jobCounter__ = 1;

// For new series-based job card numbering
if (global.__jobSeriesLetter__ === undefined) global.__jobSeriesLetter__ = 'A';
if (global.__jobSeriesCounter__ === undefined) global.__jobSeriesCounter__ = 1;


const initialJobTemplates: JobTemplateData[] = [
    { id: 'template1', name: 'Golden Tray (Predefined)', kindOfJob: 'METPET', coating: 'VARNISH_GLOSS', hotFoilStamping: 'GOLDEN', paperQuality: 'GOLDEN_SHEET', predefinedWorkflow: [] },
    { id: 'template2', name: 'Rigid Top and Bottom Box (Predefined)', boxMaking: 'COMBINED', pasting: 'YES', paperQuality: 'WG_KAPPA', predefinedWorkflow: [] },
    { id: 'template3', name: 'Monocarton Box (Predefined)', kindOfJob: 'NORMAL', paperQuality: 'SBS', predefinedWorkflow: [] },
];
if (global.__jobTemplatesStore__ === undefined) global.__jobTemplatesStore__ = [...initialJobTemplates];
if (global.__templateCounter__ === undefined) global.__templateCounter__ = initialJobTemplates.length + 1;

if (global.__inventoryItemsStore__ === undefined) {
  console.log('[InventoryManagement] Initializing global master inventory items store.');
  global.__inventoryItemsStore__ = [];
}
if (global.__inventoryCounter__ === undefined) {
  global.__inventoryCounter__ = 1;
}

if (global.__inventoryAdjustmentsStore__ === undefined) {
  console.log('[InventoryManagement] Initializing global inventory adjustments store.');
  global.__inventoryAdjustmentsStore__ = [];
}
if (global.__adjustmentCounter__ === undefined) {
  global.__adjustmentCounter__ = 1;
}

if (global.__designSubmissionsStore__ === undefined) global.__designSubmissionsStore__ = [];
if (global.__designSubmissionCounter__ === undefined) global.__designSubmissionCounter__ = 1;


function generateJobCardNumber(): string {
  if (global.__jobSeriesCounter__! > 999) {
    global.__jobSeriesLetter__ = String.fromCharCode(global.__jobSeriesLetter__!.charCodeAt(0) + 1);
    global.__jobSeriesCounter__ = 1;
  }

  const sequentialNumber = global.__jobSeriesCounter__!.toString().padStart(3, '0');
  const jobCardNumber = `JC-${global.__jobSeriesLetter__}-${sequentialNumber}`;
  
  global.__jobSeriesCounter__!++; // Increment for the next call

  return jobCardNumber;
}

export async function createJobCard(data: JobCardFormValues): Promise<{ success: boolean; message: string; jobCard?: JobCardData }> {
  try {
    const currentJobCounter = global.__jobCounter__!; // For internal unique ID
    const newJobCard: JobCardData = {
      ...data,
      id: currentJobCounter.toString(), // Internal unique ID
      jobCardNumber: generateJobCardNumber(), // New series-based number
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
    global.__jobCards__!.push(newJobCard);
    global.__jobCounter__ = currentJobCounter + 1; // Increment internal unique ID counter

    if (data.sourceInventoryItemId && data.totalMasterSheetsNeeded && data.totalMasterSheetsNeeded > 0) {
      const itemExists = global.__inventoryItemsStore__!.some(item => item.id === data.sourceInventoryItemId);
      if (itemExists) {
        const adjustment: InventoryAdjustment = {
          id: `adj${global.__adjustmentCounter__!++}`,
          inventoryItemId: data.sourceInventoryItemId,
          date: new Date().toISOString(),
          quantityChange: -data.totalMasterSheetsNeeded,
          reason: 'JOB_USAGE',
          reference: newJobCard.jobCardNumber,
          notes: `Used for job: ${newJobCard.jobName}`,
        };
        global.__inventoryAdjustmentsStore__!.push(adjustment);
        console.log(`[InventoryManagement] Stock adjustment for Job ${newJobCard.jobCardNumber}: Item ID ${data.sourceInventoryItemId}, Quantity: ${-data.totalMasterSheetsNeeded}`);
      } else {
        console.warn(`[JobActions] Inventory item ID ${data.sourceInventoryItemId} not found for stock deduction for job ${newJobCard.jobCardNumber}. Stock not deducted.`);
      }
    }

    console.log('[JobActions] Created job card:', newJobCard.jobCardNumber, 'with workflow:', newJobCard.workflowSteps);
    revalidatePath('/jobs');
    revalidatePath('/jobs/new');
    revalidatePath('/inventory');
    revalidatePath('/planning');
    revalidatePath('/customer/my-jobs');
    return { success: true, message: 'Job card created successfully!', jobCard: newJobCard };
  } catch (error) {
    console.error('[JobActions Error] Error creating job card:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create job card: ${errorMessage}` };
  }
}

export async function getJobCards(): Promise<JobCardData[]> {
  return [...(global.__jobCards__ || [])];
}

export async function getJobCardById(id: string): Promise<JobCardData | null> {
  const job = global.__jobCards__?.find(job => job.id === id);
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
  console.log('[JobActions TS Calc] === Get Inventory Optimization Suggestions START ===');
  console.log('[JobActions TS Calc] Job Input received:', JSON.stringify(jobInput, null, 2));

  try {
    const targetQualityUnit = getPaperQualityUnit(jobInput.paperQuality);

    if (!jobInput.paperQuality || jobInput.paperQuality === "" || !targetQualityUnit) {
        console.log('[JobActions TS Calc] Target paper quality or unit from jobInput is empty/invalid. Returning empty suggestions immediately.');
        return { suggestions: [], optimalSuggestion: undefined };
    }
    if (targetQualityUnit === 'gsm' && (jobInput.paperGsm === undefined || jobInput.paperGsm <=0)) {
        console.log('[JobActions TS Calc] Invalid target GSM for GSM-based quality. Returning empty suggestions.');
        return { suggestions: [], optimalSuggestion: undefined };
    }
    if (targetQualityUnit === 'mm' && (jobInput.paperThicknessMm === undefined || jobInput.paperThicknessMm <=0)) {
        console.log('[JobActions TS Calc] Invalid target thickness for mm-based quality. Returning empty suggestions.');
        return { suggestions: [], optimalSuggestion: undefined };
    }
    if (jobInput.jobSizeWidth <= 0 || jobInput.jobSizeHeight <= 0 || jobInput.quantityToProduce <=0) {
        console.log('[JobActions TS Calc] Invalid job dimensions or quantity to produce. Returning empty suggestions.');
        return { suggestions: [], optimalSuggestion: undefined };
    }
    
    const allInventoryMasterItems = await getInventoryItems();
    console.log(`[JobActions TS Calc] Full inventory fetched (${allInventoryMasterItems.length} master items).`);

    const targetQualityLower = jobInput.paperQuality.toLowerCase();
    const THICKNESS_TOLERANCE = 0.1; 
    const GSM_TOLERANCE_PERCENT = 5; 

    const processedSuggestions: InventorySuggestion[] = allInventoryMasterItems
      .filter(item => {
        const itemQualityUnit = getPaperQualityUnit(item.paperQuality as PaperQualityType);
        const hasRequiredSheetFields =
          item.type === 'Master Sheet' &&
          item.masterSheetSizeWidth && item.masterSheetSizeWidth > 0 &&
          item.masterSheetSizeHeight && item.masterSheetSizeHeight > 0 &&
          item.paperQuality && item.paperQuality !== '' &&
          itemQualityUnit !== null; 
        
        if (!hasRequiredSheetFields) return false;
        if ((item.availableStock || 0) <= 0) {
          console.log(`[JobActions TS Calc] Sheet ID ${item.id} (${item.name}) has 0 or less available stock. Skipping.`);
          return false;
        }

        const itemQualityLower = item.paperQuality!.toLowerCase();
        if (itemQualityLower !== targetQualityLower) return false; 

        
        if (targetQualityUnit === 'mm' && itemQualityUnit === 'mm') {
            if (item.paperThicknessMm === undefined || jobInput.paperThicknessMm === undefined) return false;
            return Math.abs(item.paperThicknessMm - jobInput.paperThicknessMm) <= THICKNESS_TOLERANCE;
        } else if (targetQualityUnit === 'gsm' && itemQualityUnit === 'gsm') {
            if (item.paperGsm === undefined || jobInput.paperGsm === undefined) return false;
            const lowerBound = jobInput.paperGsm * (1 - GSM_TOLERANCE_PERCENT / 100);
            const upperBound = jobInput.paperGsm * (1 + GSM_TOLERANCE_PERCENT / 100);
            return item.paperGsm >= lowerBound && item.paperGsm <= upperBound;
        }
        return false; 
      })
      .map(sheet => {
        const layoutInfo = calculateUps({
          jobW: jobInput.jobSizeWidth,
          jobH: jobInput.jobSizeHeight,
          sheetW: sheet.masterSheetSizeWidth!,
          sheetH: sheet.masterSheetSizeHeight!,
        });

        if (layoutInfo.ups === 0) {
          console.log(`[JobActions TS Calc] Sheet ID ${sheet.id} (${sheet.name}) yields 0 ups. Skipping.`);
          return null;
        }

        const sheetArea = sheet.masterSheetSizeWidth! * sheet.masterSheetSizeHeight!;
        const jobArea = jobInput.jobSizeWidth * jobInput.jobSizeHeight;
        const usedArea = layoutInfo.ups * jobArea;
        
        let wastagePercentage = 100;
        if (sheetArea > 0) {
            wastagePercentage = 100 - (usedArea / sheetArea) * 100;
        }

        const totalMasterSheetsNeeded = Math.ceil(jobInput.quantityToProduce / layoutInfo.ups);

        const suggestion: InventorySuggestion = {
          sourceInventoryItemId: sheet.id,
          masterSheetSizeWidth: sheet.masterSheetSizeWidth!,
          masterSheetSizeHeight: sheet.masterSheetSizeHeight!,
          paperGsm: sheet.paperGsm,
          paperThicknessMm: sheet.paperThicknessMm,
          paperQuality: sheet.paperQuality!,
          sheetsPerMasterSheet: layoutInfo.ups,
          totalMasterSheetsNeeded,
          wastagePercentage: Number(wastagePercentage.toFixed(2)),
          cuttingLayoutDescription: `${layoutInfo.cols} across x ${layoutInfo.rows} down (job ${layoutInfo.layout})`,
        };
        console.log(`[JobActions TS Calc] Processed sheet ID ${sheet.id}: Ups: ${layoutInfo.ups}, Wastage: ${suggestion.wastagePercentage}%, Layout: ${suggestion.cuttingLayoutDescription}`);
        return suggestion;
      })
      .filter((s): s is InventorySuggestion => s !== null)
      .sort((a, b) => {
        if (a.wastagePercentage === b.wastagePercentage) {
          return a.totalMasterSheetsNeeded - b.totalMasterSheetsNeeded;
        }
        return a.wastagePercentage - b.wastagePercentage;
      });
    
    console.log(`[JobActions TS Calc] TypeScript processing complete. ${processedSuggestions.length} valid suggestions found.`);

    const optimalSuggestion = processedSuggestions.length > 0 ? processedSuggestions[0] : undefined;

    if (optimalSuggestion) {
      console.log('[JobActions TS Calc] Optimal suggestion:', JSON.stringify(optimalSuggestion, null, 2));
    } else {
      console.log('[JobActions TS Calc] No optimal suggestion found.');
    }
    
    console.log('[JobActions TS Calc] === Get Inventory Optimization Suggestions END ===');
    return { suggestions: processedSuggestions, optimalSuggestion };

  } catch (error) {
    console.error('[JobActions Error] Error in getInventoryOptimizationSuggestions (TS Calc):', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions using TS calculation.';
    console.log('[JobActions TS Calc] === Get Inventory Optimization Suggestions END (Error) ===');
    return { error: `Failed to fetch inventory optimization suggestions: ${errorMessage}` };
  }
}


export async function getJobTemplates(): Promise<JobTemplateData[]> {
  return [...global.__jobTemplatesStore__!];
}

export async function createJobTemplate(data: JobTemplateFormValues): Promise<{ success: boolean; message: string; template?: JobTemplateData }> {
  try {
    const currentTemplateCounter = global.__templateCounter__!;
    const newTemplate: JobTemplateData = {
      ...data,
      id: `template${currentTemplateCounter}`,
      predefinedWorkflow: data.predefinedWorkflow || [],
    };
    global.__jobTemplatesStore__!.push(newTemplate);
    global.__templateCounter__ = currentTemplateCounter + 1;

    console.log('[JobActions] Created job template:', newTemplate.name, 'with workflow:', newTemplate.predefinedWorkflow);
    revalidatePath('/templates');
    revalidatePath('/templates/new');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Job template created successfully!', template: newTemplate };
  } catch (error) {
    console.error('[JobActions Error] Error creating job template:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to create job template: ${errorMessage}` };
  }
}

export async function getUniqueCustomerNames(): Promise<string[]> {
  const jobs = await getJobCards();
  const customerNames = new Set(jobs.map(job => job.customerName));
  return Array.from(customerNames).sort();
}

export async function getJobsByCustomerName(customerName: string): Promise<JobCardData[]> {
  const jobs = await getJobCards();
  return jobs.filter(job => job.customerName === customerName).sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateB !== dateA) {
      return dateB - dateA;
    }
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
    if (!global.__inventoryCounter__) global.__inventoryCounter__ = 1;
    if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];
    if (!global.__adjustmentCounter__) global.__adjustmentCounter__ = 1;

    const itemTypeKey = generateItemTypeKey(data);
    let existingItem = global.__inventoryItemsStore__!.find(item => {
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
      console.log(`[InventoryManagement] Existing item found (ID: ${existingItem.id}, Key: ${itemTypeKey}). Adding stock.`);
      inventoryItemId = existingItem.id;
      adjustmentReason = 'PURCHASE_RECEIVED';
      if (data.reorderPoint && (!existingItem.reorderPoint || data.reorderPoint > existingItem.reorderPoint)) {
        existingItem.reorderPoint = data.reorderPoint;
      }
      if (data.locationCode) { 
        existingItem.locationCode = data.locationCode;
      }
      itemForMessage = existingItem;
    } else {
      console.log(`[InventoryManagement] No existing item found for key: ${itemTypeKey}. Creating new master item.`);
      const currentInventoryCounter = global.__inventoryCounter__!++;
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
            specificSpecification = `${qualityLabel} ${paperThicknessMm_val}mm, ${masterSheetSizeWidth_val?.toFixed(2)}in x ${masterSheetSizeHeight_val?.toFixed(2)}in`;
        } else {
            paperGsm_val = data.paperGsm;
            specificName = `${masterSheetSizeWidth_val?.toFixed(2)}x${masterSheetSizeHeight_val?.toFixed(2)}in - ${paperGsm_val}GSM`;
            specificSpecification = `${qualityLabel} ${paperGsm_val}GSM, ${masterSheetSizeWidth_val?.toFixed(2)}in x ${masterSheetSizeHeight_val?.toFixed(2)}in`;
        }
      } else if (data.category === 'INKS') {
        itemType = 'Ink';
        itemGroup = 'Inks';
        specificName = data.inkName!;
        specificSpecification = data.inkSpecification || 'N/A';
      } else {
        specificName = data.itemName;
        itemType = data.category === 'PLASTIC_TRAY' ? 'Plastic Tray' :
                     data.category === 'GLASS_JAR' ? 'Glass Jar' :
                     data.category === 'MAGNET' ? 'Magnet' : 'Other';
        itemGroup = data.category === 'PLASTIC_TRAY' ? 'Plastic Trays' :
                      data.category === 'GLASS_JAR' ? 'Glass Jars' :
                      data.category === 'MAGNET' ? 'Magnets' : 'Other Stock';
      }

      const newItemMaster: InventoryItem = {
        id: inventoryItemId,
        name: specificName,
        type: itemType,
        itemGroup: itemGroup,
        specification: specificSpecification,
        paperGsm: paperGsm_val,
        paperThicknessMm: paperThicknessMm_val,
        paperQuality: paperQuality_val,
        masterSheetSizeWidth: masterSheetSizeWidth_val,
        masterSheetSizeHeight: masterSheetSizeHeight_val,
        unit: data.unit as UnitValue,
        reorderPoint: data.reorderPoint,
        purchaseBillNo: data.purchaseBillNo,
        vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
        dateOfEntry: data.dateOfEntry,
        locationCode: data.locationCode, 
      };
      global.__inventoryItemsStore__!.push(newItemMaster);
      itemForMessage = newItemMaster;
    }

    if (data.quantity > 0) {
        const adjustment: InventoryAdjustment = {
            id: `adj${global.__adjustmentCounter__!++}`,
            inventoryItemId: inventoryItemId,
            date: data.dateOfEntry,
            quantityChange: data.quantity,
            reason: adjustmentReason,
            reference: data.purchaseBillNo || (adjustmentReason === 'INITIAL_STOCK' ? 'Initial Entry' : 'Stock Added'),
            notes: adjustmentReason === 'INITIAL_STOCK' ? 'Initial stock for new item type.' : `Added stock. Bill: ${data.purchaseBillNo || 'N/A'}`,
            vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
            purchaseBillNo: data.purchaseBillNo,
        };
        global.__inventoryAdjustmentsStore__!.push(adjustment);
    } else if (adjustmentReason === 'INITIAL_STOCK' && data.quantity === 0) {
        const adjustment: InventoryAdjustment = {
            id: `adj${global.__adjustmentCounter__!++}`,
            inventoryItemId: inventoryItemId,
            date: data.dateOfEntry,
            quantityChange: 0,
            reason: 'INITIAL_STOCK',
            reference: 'Item type defined',
            notes: 'New item type defined with zero initial stock.',
            vendorName: data.vendorName === 'OTHER' ? data.otherVendorName : data.vendorName,
            purchaseBillNo: data.purchaseBillNo,
        };
        global.__inventoryAdjustmentsStore__!.push(adjustment);
    }


    console.log(`[InventoryManagement] ${existingItem ? 'Added to' : 'Created'} item: ${itemForMessage!.name}. Transaction Quantity: ${data.quantity}. Location: ${itemForMessage.locationCode}`);
    revalidatePath('/inventory'); 
    revalidatePath(`/inventory/${data.category.toLowerCase()}`);
    revalidatePath('/inventory/new-purchase');
    revalidatePath('/inventory/new-adjustment');
    return { success: true, message: `Stock updated for: ${itemForMessage!.name}. Quantity added: ${data.quantity}`, item: itemForMessage };
  } catch (error) {
    console.error('[InventoryManagement Error] Error adding/updating inventory item:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update stock: ${errorMessage}` };
  }
}


export async function getInventoryItems(categoryFilter?: InventoryCategory): Promise<InventoryItem[]> {
  if (!global.__inventoryItemsStore__) global.__inventoryItemsStore__ = [];
  if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];

  let itemsToProcess = global.__inventoryItemsStore__!;
  if (categoryFilter) {
    itemsToProcess = itemsToProcess.filter(item => {
        if (categoryFilter === 'PAPER') return item.type === 'Master Sheet';
        if (categoryFilter === 'INKS') return item.type === 'Ink';
        if (categoryFilter === 'PLASTIC_TRAY') return item.type === 'Plastic Tray';
        if (categoryFilter === 'GLASS_JAR') return item.type === 'Glass Jar';
        if (categoryFilter === 'MAGNET') return item.type === 'Magnet';
        if (categoryFilter === 'OTHER') return item.type === 'Other';
        return false;
    });
  }
  
  const itemsWithCalculatedStock = itemsToProcess.map(item => {
    const adjustments = global.__inventoryAdjustmentsStore__!.filter(adj => adj.inventoryItemId === item.id);
    const calculatedStock = adjustments.reduce((sum, adj) => sum + adj.quantityChange, 0);
    return { ...item, availableStock: calculatedStock };
  });
  
  console.log(`[InventoryManagement] getInventoryItems (category: ${categoryFilter || 'all'}) returning ${itemsWithCalculatedStock.length} items.`);
  return itemsWithCalculatedStock;
}

export async function getInventoryAdjustmentsForItem(inventoryItemId: string): Promise<InventoryAdjustment[]> {
  if (!global.__inventoryAdjustmentsStore__) {
    return [];
  }
  const adjustments = global.__inventoryAdjustmentsStore__!
    .filter(adj => adj.inventoryItemId === inventoryItemId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  console.log(`[InventoryManagement] Found ${adjustments.length} adjustments for item ID ${inventoryItemId}`);
  return adjustments;
}

export async function applyInventoryAdjustments(
  adjustments: Array<Omit<InventoryAdjustmentItemFormValues, 'itemNameFull'>>
): Promise<{ success: boolean; message: string; errors?: { itemIndex: number; message: string }[] }> {
  if (!global.__inventoryAdjustmentsStore__) global.__inventoryAdjustmentsStore__ = [];
  if (!global.__adjustmentCounter__) global.__adjustmentCounter__ = 1;

  const batchErrors: { itemIndex: number; message: string }[] = [];

  for (let i = 0; i < adjustments.length; i++) {
    const adjItem = adjustments[i];
    const inventoryItem = global.__inventoryItemsStore__!.find(item => item.id === adjItem.inventoryItemId);

    if (!inventoryItem) {
      batchErrors.push({ itemIndex: i, message: `Inventory item with ID ${adjItem.inventoryItemId} not found.` });
      continue;
    }
    if (adjItem.quantityChange === 0) {
        batchErrors.push({ itemIndex: i, message: `Quantity change for ${inventoryItem.name} cannot be zero.` });
        continue;
    }

    const newAdjustmentRecord: InventoryAdjustment = {
      id: `adj${global.__adjustmentCounter__!++}`,
      inventoryItemId: adjItem.inventoryItemId,
      date: new Date().toISOString(),
      quantityChange: adjItem.quantityChange,
      reason: adjItem.reason,
      notes: adjItem.notes || `Adjustment: ${getInventoryAdjustmentReasonLabel(adjItem.reason)}`,
      reference: `ADJ-${new Date().toISOString().substring(0, 10)}-${global.__adjustmentCounter__}`, // Generic reference
    };
    global.__inventoryAdjustmentsStore__!.push(newAdjustmentRecord);
    console.log(`[InventoryManagement] Applied adjustment for Item ID ${adjItem.inventoryItemId}: Qty ${adjItem.quantityChange}, Reason: ${adjItem.reason}`);
  }

  if (batchErrors.length > 0) {
    return {
      success: false,
      message: "Some adjustments could not be applied. See details.",
      errors: batchErrors,
    };
  }

  revalidatePath('/inventory', 'layout'); // Revalidate all inventory paths
  return { success: true, message: `${adjustments.length} inventory adjustment(s) applied successfully.` };
}


// Design Submission Actions
export async function addDesignSubmissionInternal(
  submissionDetails: Omit<DesignSubmission, 'id' | 'status' | 'date' | 'uploader'> & { pdfDataUri?: string }
): Promise<DesignSubmission> {
  const newId = `ds-${global.__designSubmissionCounter__!++}`;
  const newSubmission: DesignSubmission = {
    ...submissionDetails,
    id: newId,
    status: "pending",
    date: new Date().toISOString(),
    uploader: "Current User", // Or derive from auth if available
  };
  global.__designSubmissionsStore__!.push(newSubmission);
  console.log('[JobActions] Added design submission:', newSubmission.id, newSubmission.pdfName);
  revalidatePath('/for-approval');
  revalidatePath('/jobs/new'); // In case approved designs list needs update
  return newSubmission;
}

export async function updateDesignSubmissionStatus(
  id: string,
  status: "approved" | "rejected"
): Promise<{ success: boolean; submission?: DesignSubmission, message?: string }> {
  const submissionIndex = global.__designSubmissionsStore__!.findIndex(s => s.id === id);
  if (submissionIndex === -1) {
    return { success: false, message: "Submission not found." };
  }
  global.__designSubmissionsStore__![submissionIndex].status = status;
  global.__designSubmissionsStore__![submissionIndex].date = new Date().toISOString(); // Update date on status change
  
  console.log('[JobActions] Updated design submission status:', id, status);
  revalidatePath('/for-approval');
  revalidatePath('/jobs/new');
  return { success: true, submission: global.__designSubmissionsStore__![submissionIndex] };
}

export async function getDesignSubmissions(): Promise<DesignSubmission[]> {
  return [...(global.__designSubmissionsStore__ || [])];
}

export async function getApprovedDesigns(): Promise<DesignSubmission[]> {
  return (global.__designSubmissionsStore__ || []).filter(s => s.status === 'approved');
}

