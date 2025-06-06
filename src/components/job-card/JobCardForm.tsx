
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JobCardFormValues, InventorySuggestion, JobTemplateData, PaperQualityType, WorkflowProcessStepDefinition, JobCardData, WorkflowStep } from "@/lib/definitions";
import { JobCardSchema, KINDS_OF_JOB_OPTIONS, PRINTING_MACHINE_OPTIONS, COATING_OPTIONS, DIE_OPTIONS, DIE_MACHINE_OPTIONS, HOT_FOIL_OPTIONS, YES_NO_OPTIONS, BOX_MAKING_OPTIONS, PAPER_QUALITY_OPTIONS, getPaperQualityLabel, getPaperQualityUnit, PRODUCTION_PROCESS_STEPS } from "@/lib/definitions";
import { createJobCard, getUniqueCustomerNames, getJobsByCustomerName } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, Wand2, Link2, PlusCircle, Loader2, RotateCcw, ListOrdered, Users, Briefcase as BriefcaseIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect, useCallback, useRef } from "react";
import { InventoryOptimizationModal } from "./InventoryOptimizationModal";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DisplayWorkflowStep extends WorkflowProcessStepDefinition {
  order: number;
}

export function JobCardForm() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [currentWorkflowSteps, setCurrentWorkflowSteps] = useState<DisplayWorkflowStep[]>([]);

  const [allCustomers, setAllCustomers] = useState<string[]>([]);
  const [customerInputValue, setCustomerInputValue] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  
  const [jobsForCustomer, setJobsForCustomer] = useState<JobCardData[]>([]);
  const [jobInputValue, setJobInputValue] = useState("");
  const [jobSuggestions, setJobSuggestions] = useState<JobCardData[]>([]);
  const [isJobPopoverOpen, setIsJobPopoverOpen] = useState(false);
  const [selectedPastJobId, setSelectedPastJobId] = useState<string>("");

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingJobsForCustomer, setIsLoadingJobsForCustomer] = useState(false);
  
  const customerInputRef = useRef<HTMLInputElement>(null);
  const jobInputRef = useRef<HTMLInputElement>(null);


  const form = useForm<JobCardFormValues>({
    resolver: zodResolver(JobCardSchema),
    defaultValues: {
      jobName: "",
      customerName: "",
      jobSizeWidth: undefined,
      jobSizeHeight: undefined,
      netQuantity: undefined,
      grossQuantity: undefined,
      paperGsm: undefined,
      targetPaperThicknessMm: undefined,
      paperQuality: "",
      masterSheetSizeWidth: undefined,
      masterSheetSizeHeight: undefined,
      wastagePercentage: undefined,
      cuttingLayoutDescription: "",
      selectedMasterSheetGsm: undefined,
      selectedMasterSheetThicknessMm: undefined,
      selectedMasterSheetQuality: "",
      sourceInventoryItemId: "",
      sheetsPerMasterSheet: undefined,
      totalMasterSheetsNeeded: undefined,
      kindOfJob: "",
      printingFront: "",
      printingBack: "",
      coating: "",
      specialInks: "",
      die: "",
      assignedDieMachine: "",
      hotFoilStamping: "",
      emboss: "",
      pasting: "",
      boxMaking: "",
      remarks: "",
      dispatchDate: undefined,
      workflowSteps: [],
    },
  });

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoadingCustomers(true);
      try {
        const fetchedCustomers = await getUniqueCustomerNames();
        setAllCustomers(fetchedCustomers);
      } catch (error) {
        toast({ title: "Error", description: "Could not fetch customer data.", variant: "destructive" });
      } finally {
        setIsLoadingCustomers(false);
      }
    }
    fetchInitialData();
  }, [toast]);

  const watchedPaperQuality = form.watch("paperQuality");
  const targetPaperUnit = getPaperQualityUnit(watchedPaperQuality as PaperQualityType);

  const applyWorkflow = useCallback((workflowSource?: { workflowSteps?: { stepSlug: string; order: number }[] } ) => {
    let sourceWorkflow: { stepSlug: string; order: number }[] | undefined;

    if (workflowSource && 'workflowSteps' in workflowSource) {
      sourceWorkflow = workflowSource.workflowSteps;
    }
    
    if (sourceWorkflow && sourceWorkflow.length > 0) {
      const displayWorkflow = sourceWorkflow
        .map(ws => {
          const stepDef = PRODUCTION_PROCESS_STEPS.find(s => s.slug === ws.stepSlug);
          return stepDef ? { ...stepDef, order: ws.order } : null;
        })
        .filter((s): s is DisplayWorkflowStep => s !== null)
        .sort((a, b) => a.order - b.order);
      setCurrentWorkflowSteps(displayWorkflow);
    } else {
      setCurrentWorkflowSteps([]);
    }
  }, []);
  
  const handleCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerInputValue(value);
    if (value) {
      const filtered = allCustomers.filter(customer =>
        customer.toLowerCase().includes(value.toLowerCase())
      );
      setCustomerSuggestions(filtered);
      setIsCustomerPopoverOpen(filtered.length > 0);
    } else {
      setCustomerSuggestions([]);
      setIsCustomerPopoverOpen(false);
      setSelectedCustomer("");
      form.setValue("customerName", "");
      setJobsForCustomer([]);
      setJobInputValue("");
      setSelectedPastJobId("");
      // Potentially reset form fields here if needed
    }
  };

  const handleCustomerSuggestionClick = async (customerName: string) => {
    setCustomerInputValue(customerName);
    setSelectedCustomer(customerName);
    form.setValue("customerName", customerName);
    setIsCustomerPopoverOpen(false);
    setJobInputValue(""); // Clear job input when customer changes
    setSelectedPastJobId("");

    if (customerName) {
      setIsLoadingJobsForCustomer(true);
      try {
        const jobs = await getJobsByCustomerName(customerName);
        setJobsForCustomer(jobs);
      } catch (error) {
        toast({ title: "Error", description: `Could not fetch jobs for ${customerName}.`, variant: "destructive" });
        setJobsForCustomer([]);
      } finally {
        setIsLoadingJobsForCustomer(false);
      }
    } else {
      setJobsForCustomer([]);
    }
  };

  const handleJobInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJobInputValue(value);
    if (value && jobsForCustomer.length > 0) {
      const filtered = jobsForCustomer.filter(job =>
        job.jobName.toLowerCase().includes(value.toLowerCase()) ||
        (job.jobCardNumber && job.jobCardNumber.toLowerCase().includes(value.toLowerCase()))
      );
      setJobSuggestions(filtered);
      setIsJobPopoverOpen(filtered.length > 0);
    } else {
      setJobSuggestions([]);
      setIsJobPopoverOpen(false);
      setSelectedPastJobId("");
      // If job input is cleared, don't reset the whole form, just clear the selection.
    }
  };

  const handleJobSuggestionClick = (job: JobCardData) => {
    setJobInputValue(`${job.jobName} (${job.jobCardNumber || job.id})`);
    setSelectedPastJobId(job.id!);
    setIsJobPopoverOpen(false);

    const pastJobPaperQuality = job.paperQuality || "";
    const pastJobUnit = getPaperQualityUnit(pastJobPaperQuality as PaperQualityType);

    form.reset({ 
      jobName: `Repeat - ${job.jobName}`, 
      customerName: job.customerName,
      jobSizeWidth: job.jobSizeWidth,
      jobSizeHeight: job.jobSizeHeight,
      netQuantity: job.netQuantity,
      grossQuantity: job.grossQuantity,
      paperQuality: pastJobPaperQuality,
      paperGsm: pastJobUnit === 'gsm' ? job.paperGsm : undefined,
      targetPaperThicknessMm: pastJobUnit === 'mm' ? job.targetPaperThicknessMm : undefined,
      masterSheetSizeWidth: job.masterSheetSizeWidth,
      masterSheetSizeHeight: job.masterSheetSizeHeight,
      wastagePercentage: job.wastagePercentage,
      cuttingLayoutDescription: job.cuttingLayoutDescription,
      selectedMasterSheetGsm: job.selectedMasterSheetGsm,
      selectedMasterSheetThicknessMm: job.selectedMasterSheetThicknessMm,
      selectedMasterSheetQuality: job.selectedMasterSheetQuality,
      sourceInventoryItemId: job.sourceInventoryItemId,
      sheetsPerMasterSheet: job.sheetsPerMasterSheet,
      totalMasterSheetsNeeded: job.totalMasterSheetsNeeded,
      kindOfJob: job.kindOfJob || "",
      printingFront: job.printingFront || "",
      printingBack: job.printingBack || "",
      coating: job.coating || "",
      specialInks: job.specialInks,
      die: job.die || "",
      assignedDieMachine: job.assignedDieMachine,
      hotFoilStamping: job.hotFoilStamping || "",
      emboss: job.emboss || "",
      pasting: job.pasting || "",
      boxMaking: job.boxMaking || "",
      remarks: job.remarks,
      dispatchDate: undefined, 
      workflowSteps: job.workflowSteps || [],
    });
    applyWorkflow(job);
    setCustomerInputValue(job.customerName); // Ensure customer input also reflects this if selected via job
    setSelectedCustomer(job.customerName); // And sync the state
  };


  const handleWorkflowStepClick = (step: WorkflowProcessStepDefinition) => {
    setCurrentWorkflowSteps(prev => {
      const existingStep = prev.find(s => s.slug === step.slug);
      if (existingStep) {
        return prev.filter(s => s.slug !== step.slug).map((s, index) => ({ ...s, order: index + 1 }));
      } else {
        return [...prev, { ...step, order: prev.length + 1 }];
      }
    });
  };

  const handleClearWorkflow = () => {
    setCurrentWorkflowSteps([]);
  };
  
  useEffect(() => {
    form.setValue('workflowSteps', currentWorkflowSteps.map(s => ({ stepSlug: s.slug, order: s.order })));
  }, [currentWorkflowSteps, form]);


  const handleSuggestionSelect = (suggestion: InventorySuggestion) => {
    form.setValue("masterSheetSizeWidth", suggestion.masterSheetSizeWidth);
    form.setValue("masterSheetSizeHeight", suggestion.masterSheetSizeHeight);
    form.setValue("wastagePercentage", suggestion.wastagePercentage);
    form.setValue("cuttingLayoutDescription", suggestion.cuttingLayoutDescription || "");
    
    const suggestedQuality = suggestion.paperQuality as PaperQualityType;
    const suggestedUnit = getPaperQualityUnit(suggestedQuality);

    if (suggestedUnit === 'mm') {
      form.setValue("selectedMasterSheetThicknessMm", suggestion.paperThicknessMm);
      form.setValue("selectedMasterSheetGsm", undefined);
    } else {
      form.setValue("selectedMasterSheetGsm", suggestion.paperGsm);
      form.setValue("selectedMasterSheetThicknessMm", undefined);
    }
    form.setValue("selectedMasterSheetQuality", suggestedQuality);
    form.setValue("sourceInventoryItemId", suggestion.sourceInventoryItemId || "");
    form.setValue("sheetsPerMasterSheet", suggestion.sheetsPerMasterSheet);
    form.setValue("totalMasterSheetsNeeded", suggestion.totalMasterSheetsNeeded);
    form.setValue("grossQuantity", suggestion.totalMasterSheetsNeeded);
  };

  const handlePrintJobCard = (jobCard: JobCardData) => {
    const logoUrl = 'https://placehold.co/150x70.png'; 
  
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
              .header img { max-height: 60px; data-ai-hint="company logo" }
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
                .header img { max-height: 50px; }
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
                <img src="${logoUrl}" alt="Company Logo" />
                <h1>Job Card</h1>
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
      setTimeout(() => {
          printWindow.print();
      }, 500); 
    } else {
      toast({
        title: "Print Error",
        description: "Please allow popups for this website to print the job card.",
        variant: "destructive",
      });
    }
  };

  async function onSubmit(values: JobCardFormValues) {
    setIsSubmitting(true);
    const valuesToSubmit = {
      ...values,
      customerName: selectedCustomer || values.customerName, // Ensure selectedCustomer takes precedence if set
      workflowSteps: currentWorkflowSteps.map(s => ({ stepSlug: s.slug, order: s.order }))
    };
    const result = await createJobCard(valuesToSubmit);
    setIsSubmitting(false);
    if (result.success && result.jobCard) {
      toast({
        title: "Success!",
        description: result.message,
      });
      handlePrintJobCard(result.jobCard); 
      form.reset();
      setCurrentWorkflowSteps([]);
      setCustomerInputValue("");
      setSelectedCustomer("");
      setJobInputValue("");
      setSelectedPastJobId("");
      setJobsForCustomer([]);
      router.push(`/jobs`);
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  }

  const currentJobDetailsForModal = {
    paperGsm: form.watch("paperGsm"),
    paperThicknessMm: form.watch("targetPaperThicknessMm"),
    paperQuality: form.watch("paperQuality") as PaperQualityType || undefined,
    jobSizeWidth: form.watch("jobSizeWidth"),
    jobSizeHeight: form.watch("jobSizeHeight"),
    netQuantity: form.watch("netQuantity"),
  };

  const processFields = [
    { name: "kindOfJob", label: "Kind of Job", options: KINDS_OF_JOB_OPTIONS },
    { name: "printingFront", label: "Printing Front", options: PRINTING_MACHINE_OPTIONS },
    { name: "printingBack", label: "Printing Back", options: PRINTING_MACHINE_OPTIONS },
    { name: "coating", label: "Coating", options: COATING_OPTIONS },
    { name: "die", label: "Die", options: DIE_OPTIONS },
    { name: "assignedDieMachine", label: "Assign Die Machine", options: DIE_MACHINE_OPTIONS },
    { name: "hotFoilStamping", label: "Hot Foil Stamping", options: HOT_FOIL_OPTIONS },
    { name: "emboss", label: "Emboss", options: YES_NO_OPTIONS },
    { name: "pasting", label: "Pasting", options: YES_NO_OPTIONS },
    { name: "boxMaking", label: "Box Making", options: BOX_MAKING_OPTIONS },
  ] as const;

  const cuttingLayoutDescription = form.watch("cuttingLayoutDescription");
  const selectedMasterSheetQuality = form.watch("selectedMasterSheetQuality");
  const selectedMasterSheetUnit = getPaperQualityUnit(selectedMasterSheetQuality as PaperQualityType);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Pre-fill from Past Job</CardTitle>
            <CardDescription className="font-body">Select a customer and one of their past jobs to quickly pre-fill this job card.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       {isLoadingCustomers && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      <Input
                        ref={customerInputRef}
                        type="text"
                        placeholder={isLoadingCustomers ? "Loading customers..." : "Type to search customer"}
                        value={customerInputValue}
                        onChange={handleCustomerInputChange}
                        onFocus={() => {
                          if (customerInputValue && customerSuggestions.length > 0) setIsCustomerPopoverOpen(true);
                        }}
                        className="pl-10 font-body"
                        disabled={isLoadingCustomers}
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <ScrollArea className="h-[200px]">
                      {customerSuggestions.length > 0 ? (
                        customerSuggestions.map(name => (
                          <Button
                            key={name}
                            variant="ghost"
                            className="w-full justify-start font-normal font-body"
                            onClick={() => handleCustomerSuggestionClick(name)}
                          >
                            {name}
                          </Button>
                        ))
                      ) : (
                        <p className="p-4 text-sm text-muted-foreground font-body">No customers found.</p>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <Popover open={isJobPopoverOpen} onOpenChange={setIsJobPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <BriefcaseIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      {isLoadingJobsForCustomer && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      <Input
                        ref={jobInputRef}
                        type="text"
                        placeholder={
                          isLoadingJobsForCustomer ? "Loading jobs..." :
                          !selectedCustomer ? "Select customer first" :
                          jobsForCustomer.length === 0 && selectedCustomer ? "No past jobs for this customer" :
                          "Type to search past job"
                        }
                        value={jobInputValue}
                        onChange={handleJobInputChange}
                        onFocus={() => {
                           if (jobInputValue && jobSuggestions.length > 0) setIsJobPopoverOpen(true);
                        }}
                        className="pl-10 font-body"
                        disabled={!selectedCustomer || isLoadingJobsForCustomer}
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                     <ScrollArea className="h-[200px]">
                      {jobSuggestions.length > 0 ? (
                        jobSuggestions.map(job => (
                          <Button
                            key={job.id}
                            variant="ghost"
                            className="w-full justify-start font-normal font-body h-auto py-2 text-left"
                            onClick={() => handleJobSuggestionClick(job)}
                          >
                            <div>
                                <div>{job.jobName}</div>
                                <div className="text-xs text-muted-foreground">{job.jobCardNumber || job.id} - {new Date(job.date).toLocaleDateString()}</div>
                            </div>
                          </Button>
                        ))
                      ) : (
                         <p className="p-4 text-sm text-muted-foreground font-body">
                            {!selectedCustomer ? "Select a customer to see past jobs." : 
                             jobsForCustomer.length === 0 && !isLoadingJobsForCustomer ? "No past jobs found for this customer." :
                             jobInputValue ? "No jobs match your search." :
                             "Type to search for jobs."
                            }
                        </p>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Basic Job Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="jobName" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Name</FormLabel>
                <FormControl><Input placeholder="e.g., Luxury Perfume Box" {...field} className="font-body"/></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="customerName" render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Name</FormLabel>
                <FormControl><Input 
                    placeholder="e.g., Chic Fragrances" 
                    {...field} 
                    value={customerInputValue} // Controlled by customerInputValue
                    onFocus={() => {
                        if (customerInputValue && customerSuggestions.length > 0) setIsCustomerPopoverOpen(true);
                    }}
                    onChange={handleCustomerInputChange} // Use the new handler
                    className="font-body"
                /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Paper & Quantity Specifications</CardTitle>
            <CardDescription className="font-body">Specify the target paper and job dimensions. Then use the optimizer.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {targetPaperUnit === 'gsm' && (
              <FormField control={form.control} name="paperGsm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Paper GSM</FormLabel>
                  <FormControl><Input
                      type="number" placeholder="e.g., 300" {...field}
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                      className="font-body"
                    /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            {targetPaperUnit === 'mm' && (
              <FormField control={form.control} name="targetPaperThicknessMm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Paper Thickness (mm)</FormLabel>
                  <FormControl><Input
                      type="number" step="0.1" placeholder="e.g., 1.2" {...field}
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                      className="font-body"
                    /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            {!targetPaperUnit && (
                 <FormItem>
                    <FormLabel>Target Paper GSM/Thickness</FormLabel>
                    <FormControl><Input type="text" placeholder="Select paper quality first" readOnly className="font-body bg-muted" /></FormControl>
                 </FormItem>
            )}
            <FormField
              control={form.control}
              name="paperQuality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Paper Quality</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("paperGsm", undefined);
                        form.setValue("targetPaperThicknessMm", undefined);
                    }} 
                    value={field.value || ""}
                  >
                    <FormControl><SelectTrigger className="font-body"><SelectValue placeholder="Select paper quality" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PAPER_QUALITY_OPTIONS.filter(opt => opt.value !== "").map(option => (
                        <SelectItem key={option.value} value={option.value} className="font-body">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2 lg:col-span-1 grid grid-cols-2 gap-6">
              <FormField control={form.control} name="netQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Net Quantity</FormLabel>
                  <FormControl><Input
                      type="number" placeholder="e.g., 1000" {...field}
                       value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                      className="font-body"
                    /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="grossQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gross Quantity</FormLabel>
                  <FormControl><Input
                      type="number" placeholder="e.g., 1100" {...field}
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                      className="font-body"
                    /></FormControl>
                   <FormDescription className="text-xs">Total master sheets. Updated by optimizer.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
             <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <FormField control={form.control} name="jobSizeWidth" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Job Size Width (in)</FormLabel>
                        <FormControl><Input
                            type="number" placeholder="e.g., 8.5" {...field}
                            value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                            onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                            className="font-body"
                        /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="jobSizeHeight" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Job Size Height (in)</FormLabel>
                        <FormControl><Input
                            type="number" placeholder="e.g., 11" {...field}
                            value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                            onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                            className="font-body"
                        /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <Button type="button" onClick={() => setIsModalOpen(true)} variant="outline" className="w-full md:mt-0 mt-4 font-body">
                    <Wand2 className="mr-2 h-4 w-4" /> Optimize Master Sheet
                 </Button>
            </div>

            <CardTitle className="font-headline text-lg col-span-1 md:col-span-2 lg:col-span-3 mt-4 border-t pt-4">Optimized Sheet Details</CardTitle>
            <FormField control={form.control} name="masterSheetSizeWidth" render={({ field }) => (
                <FormItem>
                    <FormLabel>Selected Master Width (in)</FormLabel>
                    <FormControl><Input type="number" placeholder="From optimizer" {...field} readOnly value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)} className="font-body bg-muted" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="masterSheetSizeHeight" render={({ field }) => (
                <FormItem>
                    <FormLabel>Selected Master Height (in)</FormLabel>
                    <FormControl><Input type="number" placeholder="From optimizer" {...field} readOnly value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)} className="font-body bg-muted" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="wastagePercentage" render={({ field }) => (
                <FormItem>
                    <FormLabel>Wastage (%)</FormLabel>
                    <FormControl><Input type="number" placeholder="Calculated" {...field} readOnly value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)} className="font-body bg-muted" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

            {selectedMasterSheetUnit === 'gsm' && (
              <FormField control={form.control} name="selectedMasterSheetGsm" render={({ field }) => (
                  <FormItem><FormLabel>Selected Master GSM</FormLabel><FormControl><Input type="number" placeholder="From optimizer" {...field} readOnly value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)} className="font-body bg-muted" /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {selectedMasterSheetUnit === 'mm' && (
              <FormField control={form.control} name="selectedMasterSheetThicknessMm" render={({ field }) => (
                  <FormItem><FormLabel>Selected Master Thickness (mm)</FormLabel><FormControl><Input type="number" placeholder="From optimizer" {...field} readOnly value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)} className="font-body bg-muted" /></FormControl><FormMessage /></FormItem>
              )} />
            )}
             <FormField control={form.control} name="selectedMasterSheetQuality" render={({ field }) => (
                <FormItem>
                    <FormLabel>Selected Master Quality</FormLabel>
                    <FormControl><Input placeholder="From optimizer" value={field.value ? getPaperQualityLabel(field.value as PaperQualityType) : ""} readOnly className="font-body bg-muted" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="sheetsPerMasterSheet" render={({ field }) => (
                <FormItem>
                    <FormLabel>Ups / Master Sheet</FormLabel>
                    <FormControl><Input type="number" placeholder="From optimizer" {...field} readOnly value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)} className="font-body bg-muted" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />


            {cuttingLayoutDescription && (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-2 p-3 border rounded-md bg-muted/50">
                <h4 className="font-medium mb-1 font-headline text-sm">Selected Cutting Layout:</h4>
                <p className="text-sm font-body">{cuttingLayoutDescription}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <InventoryOptimizationModal
            jobDetails={currentJobDetailsForModal}
            onSuggestionSelect={handleSuggestionSelect}
            isOpen={isModalOpen}
            setIsOpen={setIsModalOpen}
        />
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><ListOrdered className="mr-2 h-5 w-5 text-primary"/>Define Job Workflow</CardTitle>
            <CardDescription className="font-body">Click production steps to add them to this job's specific workflow in order. Click again to remove. This can be pre-filled by selecting a past job.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {PRODUCTION_PROCESS_STEPS.map((step) => {
                const selectedStep = currentWorkflowSteps.find(s => s.slug === step.slug);
                return (
                  <Button
                    key={step.slug}
                    type="button"
                    variant={selectedStep ? "secondary" : "outline"}
                    onClick={() => handleWorkflowStepClick(step)}
                    className="font-body text-xs h-auto py-2 flex flex-col items-start text-left"
                  >
                     <div className="flex items-center">
                       {selectedStep && (
                        <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-1.5 leading-none">
                          {selectedStep.order}
                        </span>
                       )}
                       <step.icon className={`mr-1.5 h-4 w-4 ${selectedStep ? 'text-primary' : 'text-muted-foreground'}`} />
                       {step.name}
                    </div>
                  </Button>
                );
              })}
            </div>
            {currentWorkflowSteps.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-1 text-sm">Selected Workflow:</h4>
                <div className="flex flex-wrap gap-2">
                  {currentWorkflowSteps.sort((a,b) => a.order - b.order).map(step => (
                    <Badge key={step.slug} variant="secondary" className="font-body">
                      <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs font-semibold mr-1.5 leading-none">
                        {step.order}
                      </span>
                      {step.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={handleClearWorkflow} className="font-body text-destructive hover:text-destructive">
              <RotateCcw className="mr-2 h-4 w-4" /> Clear Workflow
            </Button>
            <FormField control={form.control} name="workflowSteps" render={({ field }) => (
              <FormItem className="hidden"><FormMessage /></FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Process Specifications</CardTitle>
             <CardDescription className="font-body">These can be pre-filled by selecting a past job.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {processFields.map(item => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name as keyof JobCardFormValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{item.label}</FormLabel>
                    <Select onValueChange={field.onChange} value={String(field.value || "")}>
                      <FormControl><SelectTrigger className="font-body"><SelectValue placeholder={`Select ${item.label.toLowerCase()}`} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {item.options.filter(opt => opt.value !== "").map(option => (
                          <SelectItem key={option.value} value={option.value} className="font-body">{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField control={form.control} name="specialInks" render={({ field }) => (
              <FormItem>
                <FormLabel>Special Inks (Pantone Code)</FormLabel>
                <FormControl><Input placeholder="e.g., Pantone 185 C" {...field} className="font-body"/></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Scheduling & Remarks</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="dispatchDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Dispatch Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal font-body", !field.value && "text-muted-foreground")}>
                      {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button></FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(date) => field.onChange(date?.toISOString())} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Remarks</FormLabel>
                <FormControl><Textarea placeholder="Any additional notes or instructions for this job." {...field} className="font-body"/></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Interlinked Job Cards</CardTitle>
                <CardDescription className="font-body">Link this job card with others for complex projects (e.g., rigid boxes).</CardDescription>
            </CardHeader>
            <CardContent>
                <Button type="button" variant="outline" disabled className="font-body">
                    <Link2 className="mr-2 h-4 w-4" /> Link Job Cards (Coming Soon)
                </Button>
            </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => { 
                form.reset(); 
                setCurrentWorkflowSteps([]); 
                setCustomerInputValue("");
                setSelectedCustomer(""); 
                setJobInputValue("");
                setSelectedPastJobId(""); 
                setJobsForCustomer([]); 
            }} disabled={isSubmitting} className="font-body">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="font-body">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Create Job Card
          </Button>
        </div>
      </form>
    </Form>
  );
}
