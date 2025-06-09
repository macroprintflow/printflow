
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JobCardFormValues, InventorySuggestion, JobTemplateData, PaperQualityType, WorkflowProcessStepDefinition, JobCardData, WorkflowStep, DesignSubmission, CustomerListItem, InventoryItem } from "@/lib/definitions";
import { JobCardSchema, KINDS_OF_JOB_OPTIONS, PRINTING_MACHINE_OPTIONS, COATING_OPTIONS, DIE_OPTIONS, DIE_MACHINE_OPTIONS, HOT_FOIL_OPTIONS, YES_NO_OPTIONS, BOX_MAKING_OPTIONS, PAPER_QUALITY_OPTIONS, getPaperQualityLabel, getPaperQualityUnit, PRODUCTION_PROCESS_STEPS, KAPPA_MDF_QUALITIES } from "@/lib/definitions";
import { createJobCard, getInventoryItems } from "@/lib/actions/jobActions"; // Added getInventoryItems
import { getCustomersList, getJobsByCustomerName } from "@/lib/actions/customerActions";
import { handlePrintJobCard } from "@/lib/printUtils"; 
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CalendarIcon, Wand2, Link2, PlusCircle, Loader2, RotateCcw, ListOrdered, Users, Briefcase as BriefcaseIcon, Search, Archive, Warehouse } from "lucide-react"; // Added Archive, Warehouse
import { format } from "date-fns";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
// import { InventoryOptimizationModal } from "./InventoryOptimizationModal"; // Optimizer commented out
import { LinkJobsModal } from "./LinkJobsModal";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DisplayWorkflowStep extends WorkflowProcessStepDefinition {
  order: number;
}

interface JobCardFormProps {
  initialJobName?: string;
  initialCustomerName?: string;
  initialJobData?: JobCardData; 
}

export function JobCardForm({ initialJobName, initialCustomerName, initialJobData }: JobCardFormProps) {
  // const [isModalOpen, setIsModalOpen] = useState(false); // Optimizer commented out
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [currentWorkflowSteps, setCurrentWorkflowSteps] = useState<DisplayWorkflowStep[]>([]);
  const [currentPdfDataUri, setCurrentPdfDataUri] = useState<string | undefined>(initialJobData?.pdfDataUri);

  const [allCustomers, setAllCustomers] = useState<CustomerListItem[]>([]);
  const [customerInputValue, setCustomerInputValue] = useState(initialJobData?.customerName || initialCustomerName || "");
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerListItem[]>([]);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  
  const [jobsForCustomer, setJobsForCustomer] = useState<JobCardData[]>([]);
  const [jobInputValue, setJobInputValue] = useState("");
  const [jobSuggestions, setJobSuggestions] = useState<JobCardData[]>([]);
  const [isJobPopoverOpen, setIsJobPopoverOpen] = useState(false);
  const [selectedPastJobId, setSelectedPastJobId] = useState<string>("");

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingJobsForCustomer, setIsLoadingJobsForCustomer] = useState(false);
  
  const customerInputRef = useRef<HTMLInputElement>(null);
  const jobInputRef = useRef<HTMLInputElement>(null);

  const [isLinkJobsModalOpen, setIsLinkJobsModalOpen] = useState(false);

  // State for Relevant Inventory
  const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);

  const form = useForm<JobCardFormValues>({
    resolver: zodResolver(JobCardSchema),
    defaultValues: initialJobData ? 
    { 
      jobName: initialJobData.jobName,
      customerName: initialJobData.customerName,
      customerId: initialJobData.customerId,
      jobSizeWidth: initialJobData.jobSizeWidth,
      jobSizeHeight: initialJobData.jobSizeHeight,
      netQuantity: initialJobData.netQuantity,
      grossQuantity: initialJobData.grossQuantity,
      paperQuality: initialJobData.paperQuality,
      paperGsm: getPaperQualityUnit(initialJobData.paperQuality as PaperQualityType) === 'gsm' ? initialJobData.paperGsm : undefined,
      targetPaperThicknessMm: getPaperQualityUnit(initialJobData.paperQuality as PaperQualityType) === 'mm' ? initialJobData.targetPaperThicknessMm : undefined,
      // masterSheetSizeWidth: initialJobData.masterSheetSizeWidth, // Removed
      // masterSheetSizeHeight: initialJobData.masterSheetSizeHeight, // Removed
      // wastagePercentage: initialJobData.wastagePercentage, // Removed
      // cuttingLayoutDescription: initialJobData.cuttingLayoutDescription, // Removed
      // selectedMasterSheetGsm: initialJobData.selectedMasterSheetGsm, // Removed
      // selectedMasterSheetThicknessMm: initialJobData.selectedMasterSheetThicknessMm, // Removed
      // selectedMasterSheetQuality: initialJobData.selectedMasterSheetQuality, // Removed
      // sourceInventoryItemId: initialJobData.sourceInventoryItemId, // Removed
      // sheetsPerMasterSheet: initialJobData.sheetsPerMasterSheet, // Removed
      // totalMasterSheetsNeeded: initialJobData.totalMasterSheetsNeeded, // Removed
      kindOfJob: initialJobData.kindOfJob || "",
      printingFront: initialJobData.printingFront || "",
      printingBack: initialJobData.printingBack || "",
      coating: initialJobData.coating || "",
      specialInks: initialJobData.specialInks,
      die: initialJobData.die || "",
      assignedDieMachine: initialJobData.assignedDieMachine,
      hotFoilStamping: initialJobData.hotFoilStamping || "",
      emboss: initialJobData.emboss || "",
      pasting: initialJobData.pasting || "",
      boxMaking: initialJobData.boxMaking || "",
      remarks: initialJobData.remarks,
      dispatchDate: initialJobData.dispatchDate ? new Date(initialJobData.dispatchDate).toISOString() : undefined,
      workflowSteps: initialJobData.workflowSteps || [],
      linkedJobCardIds: initialJobData.linkedJobCardIds || [],
      pdfDataUri: initialJobData.pdfDataUri,
    }
    : { 
      jobName: initialJobName || "",
      customerName: initialCustomerName || "",
      customerId: undefined,
      jobSizeWidth: undefined,
      jobSizeHeight: undefined,
      netQuantity: undefined,
      grossQuantity: undefined,
      paperGsm: undefined,
      targetPaperThicknessMm: undefined,
      paperQuality: "",
      // masterSheetSizeWidth: undefined, // Removed
      // masterSheetSizeHeight: undefined, // Removed
      // wastagePercentage: undefined, // Removed
      // cuttingLayoutDescription: "", // Removed
      // selectedMasterSheetGsm: undefined, // Removed
      // selectedMasterSheetThicknessMm: undefined, // Removed
      // selectedMasterSheetQuality: "", // Removed
      // sourceInventoryItemId: "", // Removed
      // sheetsPerMasterSheet: undefined, // Removed
      // totalMasterSheetsNeeded: undefined, // Removed
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
      linkedJobCardIds: [],
      pdfDataUri: undefined,
    },
  });
  
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

  useEffect(() => {
    if (initialJobData) {
      form.reset({
        ...initialJobData,
        dispatchDate: initialJobData.dispatchDate ? new Date(initialJobData.dispatchDate).toISOString() : undefined,
        linkedJobCardIds: initialJobData.linkedJobCardIds || [],
         // Explicitly undefined optimizer fields for reset
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
      }); 
      setCustomerInputValue(initialJobData.customerName);
      setCurrentPdfDataUri(initialJobData.pdfDataUri);
      if(initialJobData.customerName) {
        fetchJobsForThisCustomer(initialJobData.customerName);
      }
      applyWorkflow(initialJobData);
    } else {
      form.setValue("jobName", initialJobName || "");
      if (initialCustomerName) {
        form.setValue("customerName", initialCustomerName);
        setCustomerInputValue(initialCustomerName);
        fetchJobsForThisCustomer(initialCustomerName);
      }
      setCurrentPdfDataUri(undefined);
      form.setValue("linkedJobCardIds", []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobData, initialJobName, initialCustomerName, form, applyWorkflow]);


  useEffect(() => {
    async function fetchInitialData() {
      setIsLoadingCustomers(true);
      try {
        const fetchedCustomers = await getCustomersList();
        setAllCustomers(fetchedCustomers);
      } catch (error) {
        toast({ title: "Error", description: "Could not fetch customer data.", variant: "destructive" });
      } finally {
        setIsLoadingCustomers(false);
      }

      // Commenting out inventory fetch for now as per "one by one" approach
      // setIsLoadingInventory(true);
      // try {
      //   const items = await getInventoryItems();
      //   setAllInventoryItems(items);
      // } catch (error) {
      //   toast({ title: "Error", description: "Could not load inventory items.", variant: "destructive" });
      // } finally {
      //   setIsLoadingInventory(false);
      // }
    }
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount


  const watchedPaperQuality = form.watch("paperQuality");
  // const watchedPaperGsm = form.watch("paperGsm"); // For Inventory section, will be used later
  // const watchedPaperThicknessMm = form.watch("targetPaperThicknessMm"); // For Inventory section
  // const watchedCustomerName = form.watch("customerName"); // For Inventory section
  const targetPaperUnit = getPaperQualityUnit(watchedPaperQuality as PaperQualityType);

  // const handleSuggestionSelect = (suggestion: InventorySuggestion) => { // Optimizer commented out
  //   form.setValue("masterSheetSizeWidth", suggestion.masterSheetSizeWidth);
  //   form.setValue("masterSheetSizeHeight", suggestion.masterSheetSizeHeight);
  //   form.setValue("wastagePercentage", suggestion.wastagePercentage);
  //   form.setValue("cuttingLayoutDescription", suggestion.cuttingLayoutDescription || "");
    
  //   const suggestedQuality = suggestion.paperQuality as PaperQualityType;
  //   const suggestedUnit = getPaperQualityUnit(suggestedQuality);

  //   if (suggestedUnit === 'mm') {
  //     form.setValue("selectedMasterSheetThicknessMm", suggestion.paperThicknessMm);
  //     form.setValue("selectedMasterSheetGsm", undefined);
  //   } else {
  //     form.setValue("selectedMasterSheetGsm", suggestion.paperGsm);
  //     form.setValue("selectedMasterSheetThicknessMm", undefined);
  //   }
  //   form.setValue("selectedMasterSheetQuality", suggestedQuality);
  //   form.setValue("sourceInventoryItemId", suggestion.sourceInventoryItemId || "");
  //   form.setValue("sheetsPerMasterSheet", suggestion.sheetsPerMasterSheet);
  //   form.setValue("totalMasterSheetsNeeded", suggestion.totalMasterSheetsNeeded);
  //   form.setValue("grossQuantity", suggestion.totalMasterSheetsNeeded); 
  // };
  // const currentJobDetailsForModal = { // Optimizer commented out
  //   paperGsm: form.watch("paperGsm"),
  //   paperThicknessMm: form.watch("targetPaperThicknessMm"),
  //   paperQuality: form.watch("paperQuality") as PaperQualityType || undefined,
  //   jobSizeWidth: form.watch("jobSizeWidth"),
  //   jobSizeHeight: form.watch("jobSizeHeight"),
  //   quantityForOptimization: form.watch("grossQuantity") || form.watch("netQuantity") || 0,
  // };


  const fetchJobsForThisCustomer = async (customerName: string) => {
    if (!customerName) {
      setJobsForCustomer([]);
      return;
    }
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
  };

  const handleCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
    const value = e.target.value;
    setCustomerInputValue(value);
    fieldOnChange(value); 
    form.setValue("customerId", undefined); 

    if (value) {
      const filtered = allCustomers.filter(customer =>
        customer.fullName.toLowerCase().includes(value.toLowerCase())
      );
      setCustomerSuggestions(filtered);
      setIsCustomerPopoverOpen(true);
    } else {
      setCustomerSuggestions(allCustomers.slice(0, 10)); 
      setIsCustomerPopoverOpen(true);
      setJobsForCustomer([]); 
      setJobInputValue("");
      setSelectedPastJobId("");
    }
  };

  const handleCustomerSuggestionClick = (customer: CustomerListItem, fieldOnChange: (value: string) => void) => {
    setCustomerInputValue(customer.fullName);
    fieldOnChange(customer.fullName);
    form.setValue("customerId", customer.id, { shouldValidate: true });
    setIsCustomerPopoverOpen(false);
    setCustomerSuggestions([]);
    setJobInputValue(""); 
    setSelectedPastJobId("");
    fetchJobsForThisCustomer(customer.fullName);
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
      setIsJobPopoverOpen(true);
    } else if (!value && jobsForCustomer.length > 0) {
        setJobSuggestions(jobsForCustomer.slice(0,10)); 
        setIsJobPopoverOpen(true);
    } else {
      setJobSuggestions([]);
      setIsJobPopoverOpen(false);
      setSelectedPastJobId(""); 
    }
  };

  const handleJobSuggestionClick = (job: JobCardData) => {
    setJobInputValue(`${job.jobName} (${job.jobCardNumber || job.id})`);
    setSelectedPastJobId(job.id!);
    setIsJobPopoverOpen(false);
    setCurrentPdfDataUri(job.pdfDataUri);
    setCustomerInputValue(job.customerName); 

    const pastJobPaperQuality = job.paperQuality || "";
    const pastJobUnit = getPaperQualityUnit(pastJobPaperQuality as PaperQualityType);

    form.reset({ 
      jobName: `Repeat - ${job.jobName}`, 
      customerName: job.customerName,
      customerId: job.customerId,
      jobSizeWidth: job.jobSizeWidth,
      jobSizeHeight: job.jobSizeHeight,
      netQuantity: job.netQuantity,
      grossQuantity: job.grossQuantity,
      paperQuality: pastJobPaperQuality,
      paperGsm: pastJobUnit === 'gsm' ? job.paperGsm : undefined,
      targetPaperThicknessMm: pastJobUnit === 'mm' ? job.targetPaperThicknessMm : undefined,
      // masterSheetSizeWidth: job.masterSheetSizeWidth, // Removed
      // masterSheetSizeHeight: job.masterSheetSizeHeight, // Removed
      // wastagePercentage: job.wastagePercentage, // Removed
      // cuttingLayoutDescription: job.cuttingLayoutDescription, // Removed
      // selectedMasterSheetGsm: job.selectedMasterSheetGsm, // Removed
      // selectedMasterSheetThicknessMm: job.selectedMasterSheetThicknessMm, // Removed
      // selectedMasterSheetQuality: job.selectedMasterSheetQuality, // Removed
      // sourceInventoryItemId: job.sourceInventoryItemId, // Removed
      // sheetsPerMasterSheet: job.sheetsPerMasterSheet, // Removed
      // totalMasterSheetsNeeded: job.totalMasterSheetsNeeded, // Removed
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
      linkedJobCardIds: job.linkedJobCardIds || [],
      pdfDataUri: job.pdfDataUri,
    });
    applyWorkflow(job);
    form.trigger("customerName"); 
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


  async function onSubmit(values: JobCardFormValues) {
    setIsSubmitting(true);
    const valuesToSubmit = {
      ...values,
      workflowSteps: currentWorkflowSteps.map(s => ({ stepSlug: s.slug, order: s.order })),
      linkedJobCardIds: form.getValues('linkedJobCardIds') || [],
      pdfDataUri: currentPdfDataUri,
    };
    const result = await createJobCard(valuesToSubmit);
    setIsSubmitting(false);
    if (result.success && result.jobCard) {
      toast({
        title: "Success!",
        description: result.message,
      });
      await handlePrintJobCard(result.jobCard, toast); 
      form.reset({ 
        jobName: initialJobName || "",
        customerName: initialCustomerName || "",
        customerId: undefined,
        jobSizeWidth: undefined,
        jobSizeHeight: undefined,
        netQuantity: undefined,
        grossQuantity: undefined,
        paperGsm: undefined,
        targetPaperThicknessMm: undefined,
        paperQuality: "",
        // masterSheetSizeWidth: undefined, // Removed
        // masterSheetSizeHeight: undefined, // Removed
        // wastagePercentage: undefined, // Removed
        // cuttingLayoutDescription: "", // Removed
        // selectedMasterSheetGsm: undefined, // Removed
        // selectedMasterSheetThicknessMm: undefined, // Removed
        // selectedMasterSheetQuality: "", // Removed
        // sourceInventoryItemId: "", // Removed
        // sheetsPerMasterSheet: undefined, // Removed
        // totalMasterSheetsNeeded: undefined, // Removed
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
        linkedJobCardIds: [],
        pdfDataUri: undefined,
      });
      setCurrentWorkflowSteps([]);
      setCustomerInputValue(initialJobData?.customerName || initialCustomerName || "");
      setJobInputValue("");
      setSelectedPastJobId("");
      setJobsForCustomer([]); 
      setCurrentPdfDataUri(undefined);
      router.push(`/jobs`);
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  }


  const processFields = [
    { name: "kindOfJob", label: "Kind of Job", options: KINDS_OF_JOB_OPTIONS },
    { name: "printingFront", label: "Printing Front", options: PRINTING_MACHINE_OPTIONS },
    { name: "printingBack", label: "Printing Back", options: PRINTING_MACHINE_OPTIONS },
    { name: "coating", label: "Coating", options: COATING_OPTIONS },
    { name: "specialInks", label: "Special Inks (Pantone Code)", type: "input" },
    { name: "die", label: "Die", options: DIE_OPTIONS },
    { name: "assignedDieMachine", label: "Assign Die Machine", options: DIE_MACHINE_OPTIONS },
    { name: "hotFoilStamping", label: "Hot Foil Stamping", options: HOT_FOIL_OPTIONS },
    { name: "emboss", label: "Emboss", options: YES_NO_OPTIONS },
    { name: "pasting", label: "Pasting", options: YES_NO_OPTIONS },
    { name: "boxMaking", label: "Box Making", options: BOX_MAKING_OPTIONS },
  ] as const;

  const linkedJobCardIds = form.watch('linkedJobCardIds') || [];

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
                <FormField
                  control={form.control}
                  name="customerName" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <div className="relative">
                              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              {isLoadingCustomers && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                              <Input
                                ref={customerInputRef}
                                placeholder={isLoadingCustomers ? "Loading customers..." : "Type or select customer"}
                                {...field}
                                value={customerInputValue}
                                onChange={(e) => handleCustomerInputChange(e, field.onChange)}
                                onFocus={() => {
                                  if (!isLoadingCustomers) {
                                    if (!customerInputValue && allCustomers.length > 0) {
                                      setCustomerSuggestions(allCustomers.slice(0,10));
                                    } else if (customerInputValue) {
                                       const filtered = allCustomers.filter(c => c.fullName.toLowerCase().includes(customerInputValue.toLowerCase()));
                                       setCustomerSuggestions(filtered);
                                    }
                                    setIsCustomerPopoverOpen(true);
                                  }
                                }}
                                onBlur={() => setTimeout(() => setIsCustomerPopoverOpen(false), 150)}
                                className="pl-10 font-body"
                                disabled={isLoadingCustomers}
                                autoComplete="off"
                              />
                            </div>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent 
                            className="w-[--radix-popover-trigger-width] p-0" 
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()} 
                        >
                          <ScrollArea className="h-[200px]">
                            {customerSuggestions.length > 0 ? (
                              customerSuggestions.map(customer => (
                                <Button
                                  key={customer.id}
                                  variant="ghost"
                                  className="w-full justify-start font-normal font-body"
                                  onClick={() => handleCustomerSuggestionClick(customer, field.onChange)}
                                >
                                  {customer.fullName}
                                </Button>
                              ))
                            ) : (
                              <p className="p-4 text-sm text-muted-foreground font-body">
                                {isLoadingCustomers ? "Loading..." : customerInputValue ? "No matching customers." : "Type to search or select from list."}
                              </p>
                            )}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem> 
                    <FormLabel>Past Job for {form.getValues('customerName') || 'Selected Customer'}</FormLabel>
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
                                !form.getValues('customerId') ? "Select customer first" :
                                jobsForCustomer.length === 0 && form.getValues('customerId') ? "No past jobs for this customer" :
                                "Type to search past job"
                                }
                                value={jobInputValue}
                                onChange={handleJobInputChange}
                                onFocus={() => {
                                    if (!isLoadingJobsForCustomer && form.getValues('customerId')) {
                                        if (!jobInputValue && jobsForCustomer.length > 0) {
                                            setJobSuggestions(jobsForCustomer.slice(0,10));
                                        } else if (jobInputValue) {
                                            const filtered = jobsForCustomer.filter(j => j.jobName.toLowerCase().includes(jobInputValue.toLowerCase()) || (j.jobCardNumber && j.jobCardNumber.toLowerCase().includes(jobInputValue.toLowerCase())));
                                            setJobSuggestions(filtered);
                                        }
                                        setIsJobPopoverOpen(true);
                                    }
                                }}
                                onBlur={() => setTimeout(() => setIsJobPopoverOpen(false), 150)}
                                className="pl-10 font-body"
                                disabled={!form.getValues('customerId') || isLoadingJobsForCustomer}
                                autoComplete="off"
                            />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[--radix-popover-trigger-width] p-0" 
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
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
                                {!form.getValues('customerId') ? "Select a customer to see past jobs." : 
                                jobsForCustomer.length === 0 && !isLoadingJobsForCustomer ? "No past jobs found for this customer." :
                                jobInputValue ? "No jobs match your search." :
                                "Type to search for jobs."
                                }
                            </p>
                        )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                </FormItem>
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
             <FormItem>
                <FormLabel>Selected Customer</FormLabel>
                <Input value={form.watch('customerName') || "N/A (Select above)"} readOnly className="font-body bg-muted"/>
             </FormItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Paper & Quantity Specifications</CardTitle>
            <CardDescription className="font-body">Specify the target paper and job dimensions.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            {targetPaperUnit === 'gsm' && (
              <FormField control={form.control} name="paperGsm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Paper GSM</FormLabel>
                  <FormControl><Input
                      type="number" step="any" placeholder="e.g., 300" {...field}
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
                      type="number" step="any" placeholder="e.g., 1.2" {...field}
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
            <div className="md:col-span-2 lg:col-span-1 grid grid-cols-2 gap-6">
              <FormField control={form.control} name="netQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Net Quantity</FormLabel>
                  <FormControl><Input
                      type="number" step="any" placeholder="e.g., 1000" {...field}
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
                      type="number" step="any" placeholder="e.g., 1100" {...field}
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                      className="font-body"
                    /></FormControl>
                   <FormDescription className="text-xs">Total items for processing.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
             <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <FormField control={form.control} name="jobSizeWidth" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Job Size Width (in)</FormLabel>
                        <FormControl><Input
                            type="number" step="any" placeholder="e.g., 8.5" {...field}
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
                            type="number" step="any" placeholder="e.g., 11" {...field}
                            value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                            onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                            className="font-body"
                        /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <Button type="button" variant="outline" className="w-full md:mt-0 mt-4 font-body" disabled>
                    <Wand2 className="mr-2 h-4 w-4" /> Optimize Master Sheet (Coming Soon)
                 </Button>
            </div>
          </CardContent>
        </Card>

        {/*
        <InventoryOptimizationModal
            jobDetails={currentJobDetailsForModal}
            onSuggestionSelect={handleSuggestionSelect}
            isOpen={isModalOpen}
            setIsOpen={setIsModalOpen}
        />
        */}
        
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
            {processFields.map(item => {
              if (item.type === 'input') {
                return (
                  <FormField
                    key={item.name}
                    control={form.control}
                    name={item.name as keyof JobCardFormValues}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{item.label}</FormLabel>
                        <FormControl><Input placeholder="e.g., Pantone 185 C" {...field} value={field.value as string ?? ""} className="font-body"/></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              }
              return (
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
              );
            })}
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
                <FormControl><Textarea placeholder="Any additional notes or instructions for this job." {...field} value={field.value ?? ""} className="font-body"/></FormControl>
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
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsLinkJobsModalOpen(true)} 
                  className="font-body"
                >
                    <Link2 className="mr-2 h-4 w-4" /> Link Job Cards
                </Button>
                {linkedJobCardIds.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2 font-body">
                        Linked to: {linkedJobCardIds.length} job(s)
                    </p>
                )}
            </CardContent>
        </Card>

        {isLinkJobsModalOpen && (
          <LinkJobsModal
            isOpen={isLinkJobsModalOpen}
            setIsOpen={setIsLinkJobsModalOpen}
            currentLinkedJobIds={linkedJobCardIds}
            onConfirmLinks={(selectedIds) => {
              form.setValue('linkedJobCardIds', selectedIds, { shouldValidate: true });
            }}
          />
        )}
        <FormField control={form.control} name="linkedJobCardIds" render={({ field }) => (
          <FormItem className="hidden"><FormMessage /></FormItem>
        )} />


        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => { 
                form.reset({ 
                    jobName: initialJobName || "",
                    customerName: initialCustomerName || "",
                    customerId: undefined,
                    jobSizeWidth: undefined,
                    jobSizeHeight: undefined,
                    netQuantity: undefined,
                    grossQuantity: undefined,
                    paperGsm: undefined,
                    targetPaperThicknessMm: undefined,
                    paperQuality: "",
                    // masterSheetSizeWidth: undefined, // Removed
                    // masterSheetSizeHeight: undefined, // Removed
                    // wastagePercentage: undefined, // Removed
                    // cuttingLayoutDescription: "", // Removed
                    // selectedMasterSheetGsm: undefined, // Removed
                    // selectedMasterSheetThicknessMm: undefined, // Removed
                    // selectedMasterSheetQuality: "", // Removed
                    // sourceInventoryItemId: "", // Removed
                    // sheetsPerMasterSheet: undefined, // Removed
                    // totalMasterSheetsNeeded: undefined, // Removed
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
                    linkedJobCardIds: [],
                    pdfDataUri: undefined,
                }); 
                setCurrentWorkflowSteps([]); 
                setCustomerInputValue(initialJobData?.customerName || initialCustomerName || "");
                setJobInputValue("");
                setSelectedPastJobId(""); 
                setJobsForCustomer([]); 
                setCurrentPdfDataUri(undefined);
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
    
