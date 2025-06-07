
"use client"; // This utility runs client-side

import QRCode from 'qrcode';
import type { JobCardData, WorkflowStep } from '@/lib/definitions';
import { 
  PRODUCTION_PROCESS_STEPS, 
  KINDS_OF_JOB_OPTIONS, 
  PRINTING_MACHINE_OPTIONS, 
  COATING_OPTIONS, 
  DIE_OPTIONS, 
  DIE_MACHINE_OPTIONS, 
  HOT_FOIL_OPTIONS, 
  YES_NO_OPTIONS, 
  BOX_MAKING_OPTIONS,
  getPaperQualityLabel,
  getPaperQualityUnit
} from '@/lib/definitions';
import type { useToast } from '@/hooks/use-toast'; // For type only

type ToastFunction = ReturnType<typeof useToast>['toast'];

export const handlePrintJobCard = async (jobCard: JobCardData, toast: ToastFunction, autoPrint: boolean = true) => {
  const logoUrl = '/images/logo.png'; 
  let qrCodeDataUrl = '';

  if (jobCard.jobCardNumber) {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(jobCard.jobCardNumber, { errorCorrectionLevel: 'H', width: 80 });
    } catch (err) {
      console.error('Failed to generate QR code', err);
      toast({ title: "QR Code Error", description: "Could not generate QR code for job card.", variant: "destructive"});
    }
  }

  const formatWorkflowSteps = (steps: WorkflowStep[] | undefined) => {
    if (!steps || steps.length === 0) return '<li>No workflow defined</li>';
    return steps
      .sort((a, b) => a.order - b.order)
      .map(step => {
        const stepDef = PRODUCTION_PROCESS_STEPS.find(s => s.slug === step.stepSlug);
        return `<li>${step.order}. ${stepDef ? stepDef.name : step.stepSlug}</li>`;
      })
      .join('');
  };

  const getPaperSpecDisplay = (jc: JobCardData) => {
      let spec = `${getPaperQualityLabel(jc.paperQuality as PaperQualityType)}`;
      const unit = getPaperQualityUnit(jc.paperQuality as PaperQualityType);
      if (unit === 'gsm' && jc.paperGsm) spec += ` ${jc.paperGsm} GSM`;
      if (unit === 'mm' && jc.targetPaperThicknessMm) spec += ` ${jc.targetPaperThicknessMm}mm`;
      return spec;
  };

  const getSelectedMasterPaperSpecDisplay = (jc: JobCardData) => {
      if (!jc.selectedMasterSheetQuality) return 'N/A';
      let spec = `${getPaperQualityLabel(jc.selectedMasterSheetQuality as PaperQualityType)}`;
      const unit = getPaperQualityUnit(jc.selectedMasterSheetQuality as PaperQualityType);
      if (unit === 'gsm' && jc.selectedMasterSheetGsm) spec += ` ${jc.selectedMasterSheetGsm} GSM`;
      if (unit === 'mm' && jc.selectedMasterSheetThicknessMm) spec += ` ${jc.selectedMasterSheetThicknessMm}mm`;
      return spec;
  };

  const printWindow = window.open('', '_blank', 'height=800,width=800');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Job Card - ${jobCard.jobCardNumber || 'New Job'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; font-size: 12px; }
            .print-container { width: 100%; max-width: 750px; margin: auto; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header img.logo { max-height: 60px; data-ai-hint="company logo" }
            .header img.qr-code { max-height: 60px; width: 60px; data-ai-hint="qr code job" }
            .header h1 { margin: 0; font-size: 20px; }
            .job-details, .paper-details, .process-details, .workflow-details, .remarks-details { margin-bottom: 15px; }
            .job-details table, .paper-details table, .process-details table { width: 100%; border-collapse: collapse; }
            .job-details th, .job-details td, .paper-details th, .paper-details td, .process-details th, .process-details td { border: 1px solid #ccc; padding: 6px; text-align: left; vertical-align: top; }
            .job-details th, .paper-details th, .process-details th { background-color: #f0f0f0; font-weight: bold; }
            .section-title { font-size: 16px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;}
            .workflow-details ul { list-style: none; padding-left: 0; margin-top: 0; }
            .workflow-details li { margin-bottom: 4px; }
            .remarks-text { white-space: pre-wrap; padding: 8px; border: 1px solid #ccc; background-color: #f9f9f9; min-height: 40px;}
            td, th { word-break: break-word; }
            @media print {
              body { margin: 0; color: #000; font-size: 10pt; }
              .print-container { box-shadow: none; border: none; width: 100%; max-width: 100%; }
              .header img.logo { max-height: 50px; }
              .header img.qr-code { max-height: 50px; width: 50px; }
              .no-print { display: none; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header">
              <img src="${logoUrl}" alt="Company Logo" class="logo"/>
              <h1>Job Card</h1>
              ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="Job QR Code" class="qr-code"/>` : '<div style="width:60px; height:60px;"></div>'}
            </div>

            <div class="job-details">
              <div class="section-title">Job Information</div>
              <table>
                <tr><th style="width:150px;">Job Card No.</th><td>${jobCard.jobCardNumber || 'N/A'}</td><th style="width:100px;">Date</th><td>${new Date(jobCard.date).toLocaleDateString()}</td></tr>
                <tr><th>Job Name</th><td colspan="3">${jobCard.jobName}</td></tr>
                <tr><th>Customer Name</th><td colspan="3">${jobCard.customerName}</td></tr>
                <tr><th>Dispatch Date</th><td colspan="3">${jobCard.dispatchDate ? new Date(jobCard.dispatchDate).toLocaleDateString() : 'N/A'}</td></tr>
              </table>
            </div>

            <div class="paper-details">
              <div class="section-title">Paper & Quantity</div>
              <table>
                <tr><th style="width:150px;">Target Paper</th><td>${getPaperSpecDisplay(jobCard)}</td><th style="width:100px;">Net Qty</th><td>${jobCard.netQuantity.toLocaleString()}</td></tr>
                <tr><th>Job Size (WxH)</th><td>${jobCard.jobSizeWidth}in x ${jobCard.jobSizeHeight}in</td><th>Gross Qty</th><td>${jobCard.grossQuantity.toLocaleString()} sheets</td></tr>
                <tr><th colspan="4" style="text-align:center; background-color:#e0e0e0;">Selected Master Sheet Details (from Inventory)</th></tr>
                <tr><th>Master Sheet</th><td>${jobCard.masterSheetSizeWidth?.toFixed(2) || 'N/A'}in x ${jobCard.masterSheetSizeHeight?.toFixed(2) || 'N/A'}in</td><th>Ups / Master</th><td>${jobCard.sheetsPerMasterSheet || 'N/A'}</td></tr>
                <tr><th>Master Paper</th><td>${getSelectedMasterPaperSpecDisplay(jobCard)}</td><th>Wastage</th><td>${jobCard.wastagePercentage?.toFixed(2) || 'N/A'}%</td></tr>
                <tr><th>Cutting Layout</th><td colspan="3">${jobCard.cuttingLayoutDescription || 'N/A'}</td></tr>
              </table>
            </div>
            
            <div class="workflow-details">
              <div class="section-title">Job Workflow</div>
              <ul>${formatWorkflowSteps(jobCard.workflowSteps)}</ul>
            </div>

            <div class="process-details">
              <div class="section-title">Process Specifications</div>
              <table>
                ${jobCard.kindOfJob ? `<tr><th style="width:150px;">Kind of Job</th><td>${KINDS_OF_JOB_OPTIONS.find(o=>o.value === jobCard.kindOfJob)?.label || jobCard.kindOfJob}</td></tr>` : ''}
                ${jobCard.printingFront ? `<tr><th>Printing Front</th><td>${PRINTING_MACHINE_OPTIONS.find(o=>o.value === jobCard.printingFront)?.label || jobCard.printingFront}</td></tr>` : ''}
                ${jobCard.printingBack ? `<tr><th>Printing Back</th><td>${PRINTING_MACHINE_OPTIONS.find(o=>o.value === jobCard.printingBack)?.label || jobCard.printingBack}</td></tr>` : ''}
                ${jobCard.coating ? `<tr><th>Coating</th><td>${COATING_OPTIONS.find(o=>o.value === jobCard.coating)?.label || jobCard.coating}</td></tr>` : ''}
                ${jobCard.specialInks ? `<tr><th>Special Inks</th><td>${jobCard.specialInks}</td></tr>` : ''}
                ${jobCard.die ? `<tr><th>Die</th><td>${DIE_OPTIONS.find(o=>o.value === jobCard.die)?.label || jobCard.die}</td></tr>` : ''}
                ${jobCard.assignedDieMachine ? `<tr><th>Assigned Die Machine</th><td>${DIE_MACHINE_OPTIONS.find(o=>o.value === jobCard.assignedDieMachine)?.label || jobCard.assignedDieMachine}</td></tr>` : ''}
                ${jobCard.hotFoilStamping ? `<tr><th>Hot Foil Stamping</th><td>${HOT_FOIL_OPTIONS.find(o=>o.value === jobCard.hotFoilStamping)?.label || jobCard.hotFoilStamping}</td></tr>` : ''}
                ${jobCard.emboss ? `<tr><th>Emboss</th><td>${YES_NO_OPTIONS.find(o=>o.value === jobCard.emboss)?.label || jobCard.emboss}</td></tr>` : ''}
                ${jobCard.pasting ? `<tr><th>Pasting</th><td>${YES_NO_OPTIONS.find(o=>o.value === jobCard.pasting)?.label || jobCard.pasting}</td></tr>` : ''}
                ${jobCard.boxMaking ? `<tr><th>Box Making</th><td>${BOX_MAKING_OPTIONS.find(o=>o.value === jobCard.boxMaking)?.label || jobCard.boxMaking}</td></tr>` : ''}
              </table>
            </div>

            <div class="remarks-details">
              <div class="section-title">Remarks</div>
              <div class="remarks-text">${jobCard.remarks || 'No remarks.'}</div>
            </div>

          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    if (autoPrint) {
      setTimeout(() => {
          printWindow.print();
      }, 500); 
    }
  } else {
    toast({
      title: "Print Error",
      description: "Please allow popups for this website to print the job card.",
      variant: "destructive",
    });
  }
};
