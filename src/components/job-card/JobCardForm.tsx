
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getNextJobCardNumber } from "@/lib/actions/jobCardUtils";
import type { JobCardFormValues, InventorySuggestion, JobTemplateData, PaperQualityType, WorkflowProcessStepDefinition, JobCardData, WorkflowStep, DesignSubmission, CustomerListItem, InventoryItem } from '@/lib/definitions';
import { JobCardSchema, KINDS_OF_JOB_OPTIONS, PRINTING_MACHINE_OPTIONS, COATING_OPTIONS, DIE_OPTIONS, DIE_MACHINE_OPTIONS, HOT_FOIL_OPTIONS, YES_NO_OPTIONS, BOX_MAKING_OPTIONS, PAPER_QUALITY_OPTIONS, getPaperQualityLabel, getPaperQualityUnit, PRODUCTION_PROCESS_STEPS, KAPPA_MDF_QUALITIES } from '@/lib/definitions';
import { createJobCard, getInventoryItems } from "@/lib/actions/jobActions";
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
import { CalendarIcon, Wand2, Link2, PlusCircle, Loader2, RotateCcw, ListOrdered, Users, Briefcase as BriefcaseIcon, Search, Archive } from "lucide-react"; // Added Archive
import { format } from "date-fns";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
// import { InventoryOptimizationModal } from "./InventoryOptimizationModal"; // Optimizer commented out
import { LinkJobsModal } from "./LinkJobsModal"; // Make sure Checkbox is imported
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";
interface DisplayWorkflowStep extends WorkflowProcessStepDefinition {
  order: number;
}
interface JobCardFormProps {
  initialJobName?: string;
  initialCustomerName?: string;
  initialJobData?: JobCardData;
}

const formatInventoryItemForDisplay = (item: InventoryItem): string => {
  if (item.type === 'Master Sheet') {
    const qualityLabel = item.paperQuality ? getPaperQualityLabel(item.paperQuality) : 'Paper';
    const unit = item.paperQuality ? getPaperQualityUnit(item.paperQuality) : null;
    let spec = '';
    if (unit === 'mm' && item.paperThicknessMm) spec = `${item.paperThicknessMm}mm`;
    else if (unit === 'gsm' && item.paperGsm) spec = `${item.paperGsm}GSM`;

    const size = (item.masterSheetSizeWidth && item.masterSheetSizeHeight)
      ? `${item.masterSheetSizeWidth}x${item.masterSheetSizeHeight}in`
      : '';
    return `${qualityLabel} ${spec} ${size}`.trim().replace(/\s\s+/g, ' ');
  }
  return item.name || "Unnamed Item";
};

export function JobCardForm({initialJobName, initialCustomerName, initialJobData}: JobCardFormProps) {
  const [nextJobCardNumber, setNextJobCardNumber] = useState<string | null>(null);
  useEffect(() => {
    const fetchNextNumber = async () => {
      const number = await getNextJobCardNumber();
      setNextJobCardNumber(number);
    };
    fetchNextNumber();
  }, []);
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

  // State for inventory items and loading
  const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [itemUpsValues, setItemUpsValues] = useState<Record<string, number | undefined>>({});
  const [selectedInventoryItemIds, setSelectedInventoryItemIds] = useState<string[]>([]); // New state for selected item IDs
  const [totalCoveredQuantity, setTotalCoveredQuantity] = useState<number>(0); // State for total quantity covered by selected inventory
  const [isSubmitted, setIsSubmitted] = useState(false); // State to track successful submission



  const form = useForm<JobCardFormValues>({
    resolver: zodResolver(JobCardSchema),
    defaultValues: initialJobData ? {
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
      kindOfJob: initialJobData.kindOfJob ?? undefined,
      printingFront: initialJobData.printingFront ?? undefined,
      printingBack: initialJobData.printingBack ?? undefined,
      coating: initialJobData.coating ?? undefined,
      specialInks: initialJobData.specialInks ?? undefined,
      die: initialJobData.die ?? undefined,
      assignedDieMachine: initialJobData.assignedDieMachine ?? undefined,
      hotFoilStamping: initialJobData.hotFoilStamping ?? undefined,
      emboss: initialJobData.emboss ?? undefined,
      pasting: initialJobData.pasting ?? undefined,
      boxMaking: initialJobData.boxMaking ?? undefined,
      remarks: initialJobData.remarks ?? undefined,
      dispatchDate: initialJobData.dispatchDate ? new Date(initialJobData.dispatchDate).toISOString() : undefined,
      workflowSteps: initialJobData.workflowSteps || [],
      linkedJobCardIds: initialJobData.linkedJobCardIds || [],
      hasPendingInventory: initialJobData.hasPendingInventory ?? false,
      pdfDataUri: initialJobData.pdfDataUri,
    } : {
      jobName: initialJobName || "",
      customerName: initialCustomerName || "",
      customerId: undefined,
      jobSizeWidth: undefined,
      jobSizeHeight: undefined,
      netQuantity: undefined,
      grossQuantity: undefined,
      paperGsm: undefined,
      targetPaperThicknessMm: undefined,
      paperQuality: undefined,
      kindOfJob: undefined,
      printingFront: undefined,
      printingBack: undefined,
      coating: undefined,
      specialInks: undefined,
      die: undefined,
      assignedDieMachine: undefined,
      hotFoilStamping: undefined,
      emboss: undefined,
      pasting: undefined,
      boxMaking: undefined,
      remarks: undefined,
      dispatchDate: undefined,
      workflowSteps: [],
      linkedJobCardIds: [],
      hasPendingInventory: false,
      pdfDataUri: undefined,
    
      },
  });
  const grossQuantity = form.getValues('grossQuantity') ?? 0;

  const totalQuantitySatisfied = selectedInventoryItemIds.reduce((acc, itemId) => {
    const ups = itemUpsValues[itemId];
    const item = allInventoryItems.find(i => i.id === itemId);
    const stock = item?.availableStock ?? 0;

    if (ups && ups > 0) {
      acc += ups * stock;
    }

    return acc;
  }, 0);
  const remainingQuantity = Math.max(grossQuantity - totalQuantitySatisfied, 0);
  const applyWorkflow = useCallback((workflowSource?: { workflowSteps?: { stepSlug: string; order: number }[] }) => {
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
      });
      setCustomerInputValue(initialJobData.customerName);
      setCurrentPdfDataUri(initialJobData.pdfDataUri);
      if (initialJobData.customerName) {
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



  const fetchInitialData = useCallback(async () => {
    setIsLoadingCustomers(true);
    try {
      const fetchedCustomers = await getCustomersList();
      setAllCustomers(fetchedCustomers);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch customer data.", variant: "destructive" });
    } finally {
      setIsLoadingCustomers(false);
    }

    setIsLoadingInventory(true);
    try {
      const items = await getInventoryItems();
      setAllInventoryItems(items);
    } catch (error) {
      toast({ title: "Error", description: "Could not load inventory items.", variant: "destructive" });
    } finally {
      setIsLoadingInventory(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);


  const watchedPaperQuality = form.watch("paperQuality");
  const watchedPaperGsm = form.watch("paperGsm");
  const watchedPaperThicknessMm = form.watch("targetPaperThicknessMm");
  const watchedCustomerName = form.watch("customerName");
  const targetPaperUnit = getPaperQualityUnit(watchedPaperQuality as PaperQualityType);

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
      setJobSuggestions(jobsForCustomer.slice(0, 10));
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
      kindOfJob: job.kindOfJob || undefined,
      printingFront: job.printingFront || undefined,
      printingBack: job.printingBack || undefined,
      coating: job.coating || undefined,
      specialInks: job.specialInks,
      die: job.die || undefined,
      assignedDieMachine: job.assignedDieMachine,
      hotFoilStamping: job.hotFoilStamping || undefined,
      emboss: job.emboss || undefined,
      pasting: job.pasting || undefined,
      boxMaking: job.boxMaking || undefined,
      remarks: job.remarks,
      dispatchDate: undefined,
      workflowSteps: job.workflowSteps || [],
      // Keep existing linked jobs when repeating, or default to empty array if initialJobData was empty
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


  const onSubmit = async (values: JobCardFormValues) => {
    setIsSubmitting(true);

    if (!nextJobCardNumber) {
      toast({
        title: "Error",
        description: "Job card number is not available. Please wait and try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const valuesToSubmit = {
      ...values,
      jobCardNumber: nextJobCardNumber, // ✅ Use the job card number from state
      workflowSteps: currentWorkflowSteps.map(s => ({ stepSlug: s.slug, order: s.order })),
      linkedJobCardIds: form.getValues('linkedJobCardIds') || [],
      pdfDataUri: currentPdfDataUri,
      createdAt: new Date().toISOString(),
      hasPendingInventory: (form.getValues('grossQuantity') ?? 0) > totalCoveredQuantity
    };

    const result = await createJobCard(valuesToSubmit);
    setIsSubmitting(false);

    if (result.success && result.jobCard) {
      toast({
        title: "Success!",
        description: result.message,
      });

      await handlePrintJobCard(result.jobCard, toast);

      // Reset form and state
      form.reset({
        jobName: initialJobName || undefined,
        customerName: initialCustomerName || undefined,
        customerId: undefined,
        jobSizeWidth: undefined,
        jobSizeHeight: undefined,
        netQuantity: undefined,
        grossQuantity: undefined,
        paperGsm: undefined,
        targetPaperThicknessMm: undefined,
        paperQuality: undefined,
        kindOfJob: undefined,
        printingFront: undefined,
        printingBack: undefined,
        coating: undefined,
        specialInks: undefined,
        die: undefined,
        assignedDieMachine: undefined,
        hotFoilStamping: undefined,
        emboss: undefined,
        pasting: undefined,
        boxMaking: undefined,
        remarks: undefined,
        dispatchDate: undefined,
        workflowSteps: [],
        linkedJobCardIds: [],
        hasPendingInventory: false,
        pdfDataUri: undefined,
      });

      setCurrentWorkflowSteps([]);
      setCustomerInputValue(initialJobData?.customerName || initialCustomerName || "");
      setJobInputValue("");
      setSelectedPastJobId("");
      setJobsForCustomer([]);
      setCurrentPdfDataUri(undefined);
      setIsSubmitted(true);

      // Redirect to job list or confirmation
      router.push(`/jobs`);
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  type ProcessField =
    | { name: keyof JobCardFormValues; label: string; options: { value: string; label: string; }[]; }
    | { name: keyof JobCardFormValues; label: string; type: "input"; };

  const processFields = [
    { name: "kindOfJob", label: "Kind of Job", options: KINDS_OF_JOB_OPTIONS },
    { name: "printingFront", label: "Printing Front", options: PRINTING_MACHINE_OPTIONS }, // Keep original line
    { name: "printingBack", label: "Printing Back", options: PRINTING_MACHINE_OPTIONS },
    { name: "coating", label: "Coating", options: COATING_OPTIONS },
    { name: "specialInks", label: "Special Inks (Pantone Code)", type: "input" },
    { name: "die", label: "Die", options: DIE_OPTIONS },
    { name: "assignedDieMachine", label: "Assign Die Machine", options: DIE_MACHINE_OPTIONS },
    { name: "hotFoilStamping", label: "Hot Foil Stamping", options: HOT_FOIL_OPTIONS },
    { name: "emboss", label: "Emboss", options: YES_NO_OPTIONS },
    { name: "pasting", label: "Pasting", options: YES_NO_OPTIONS },
    { name: "boxMaking", label: "Box Making", options: BOX_MAKING_OPTIONS },
  ];

  /* ──────────────────────────────────────────────
     1. watch linked jobs (unchanged)
  ────────────────────────────────────────────── */
  const linkedJobCardIds = form.watch("linkedJobCardIds") || [];

  /* ──────────────────────────────────────────────
     2. build the filtered list FIRST
  ────────────────────────────────────────────── */
  const filteredInventoryForDisplay = useMemo(() => {
    if (!watchedPaperQuality) return [];

    let filtered = allInventoryItems.filter(
      item =>
        item.type === "Master Sheet" &&
        item.paperQuality === watchedPaperQuality &&
        (item.availableStock ?? 0) > 0
    );

    const isGangaAcrowools = watchedCustomerName
      ?.toLowerCase()
      .includes("ganga acrowools");
    const targetGsm = watchedPaperGsm;
    const targetThickness = watchedPaperThicknessMm;

    switch (watchedPaperQuality) {
      case "SBS":
        if (isGangaAcrowools) {
          if (targetGsm) filtered = filtered.filter(i => i.paperGsm === targetGsm);
        } else if (targetGsm) {
          filtered = filtered.filter(
            i =>
              i.paperGsm &&
              i.paperGsm >= targetGsm - 10 &&
              i.paperGsm <= targetGsm + 10
          );
        }
        break;

      case "GREYBACK":
      case "WHITEBACK":
        if (targetGsm) {
          filtered = filtered.filter(
            i =>
              i.paperGsm &&
              (i.paperGsm === targetGsm ||
                (i.paperGsm >= targetGsm - 5 && i.paperGsm <= targetGsm + 5))
          );
        }
        break;

      case "ART_PAPER_GLOSS":
      case "ART_PAPER_MATT":
        if (targetGsm) filtered = filtered.filter(i => i.paperGsm === targetGsm);
        break;

      case "JAPANESE_PAPER":
      case "IMPORTED_PAPER":
      case "GOLDEN_SHEET":
      case "KRAFT_PAPER":
        if (targetGsm) filtered = filtered.filter(i => i.paperGsm === targetGsm);
        break;

      case "GG_KAPPA":
      case "WG_KAPPA":
      case "MDF":
        if (targetThickness) {
          filtered = filtered.filter(i => i.paperThicknessMm === targetThickness);
        }
        break;

      // BUTTER_PAPER or default fall-through
      default:
        if (targetPaperUnit === "gsm" && targetGsm) {
          filtered = filtered.filter(i => i.paperGsm === targetGsm);
        } else if (targetPaperUnit === "mm" && targetThickness) {
          filtered = filtered.filter(i => i.paperThicknessMm === targetThickness);
        }
        break;
    }

    /* final sort: quality → spec → area → stock */
    return filtered.sort((a, b) => {
      const qA = PAPER_QUALITY_OPTIONS.findIndex(opt => opt.value === a.paperQuality);
      const qB = PAPER_QUALITY_OPTIONS.findIndex(opt => opt.value === b.paperQuality);
      if (qA !== qB) return qA - qB;

      const specA = a.paperGsm ?? a.paperThicknessMm ?? 0;
      const specB = b.paperGsm ?? b.paperThicknessMm ?? 0;
      if (specA !== specB) return specA - specB;

      const areaA = (a.masterSheetSizeWidth || 0) * (a.masterSheetSizeHeight || 0);
      const areaB = (b.masterSheetSizeWidth || 0) * (b.masterSheetSizeHeight || 0);
      if (areaA !== areaB) return areaA - areaB;

      return (a.availableStock ?? 0) - (b.availableStock ?? 0);
    });
  }, [
    allInventoryItems,
    watchedPaperQuality,
    watchedPaperGsm,
    watchedPaperThicknessMm,
    watchedCustomerName,
    targetPaperUnit,
  ]);

  /* ──────────────────────────────────────────────
     3. EFFECT that depends on it — place AFTER memo
  ────────────────────────────────────────────── */
  // Reset itemUpsValues when the inventory list changes
  useEffect(() => {
    setItemUpsValues({});
  }, [filteredInventoryForDisplay]);

  // Calculate total master sheets for a given item
  const calculateTotalMasterSheetsNumber = (itemId: string): number => {
    const grossQuantity = form.getValues('grossQuantity');
    const ups = itemUpsValues[itemId];

    if (grossQuantity !== undefined && grossQuantity !== null && ups && ups > 0) {
      return Math.ceil(grossQuantity / ups);
    }
    return 0;
  };

  // Reset selected items if ups is missing
  useEffect(() => {
    setSelectedInventoryItemIds((prevSelected) =>
      prevSelected.filter((itemId) => {
        const ups = itemUpsValues[itemId];
        return ups !== undefined && ups !== null && ups > 0;
      })
    );
  }, [itemUpsValues]);

  // Update covered quantity (optional: if you're showing shortfall somewhere)
  useEffect(() => {
    let totalCovered = 0;
    selectedInventoryItemIds.forEach((itemId) => {
      const ups = itemUpsValues[itemId];
      if (ups && ups > 0) {
        totalCovered += ups;
      }
    });
    // You can store totalCovered in state if needed
  }, [selectedInventoryItemIds, itemUpsValues]);

  // Inventory selection handler
  const handleInventorySelect = (itemId: string, isSelected: boolean) => {
    const ups = itemUpsValues[itemId];
    if (isSelected) {
      if (!ups || ups <= 0) {
        toast({
          title: "Warning",
          description: "Please enter 'No. of Ups' before selecting an inventory item.",
          variant: "default",
        });
        return;
      }
      setSelectedInventoryItemIds((prev) => [...prev, itemId]);
    } else {
      setSelectedInventoryItemIds((prev) => prev.filter((id) => id !== itemId));
    }
  };

  // For displaying nicely formatted count
  const calculateTotalMasterSheetsForDisplay = (itemId: string) => {
    const count = calculateTotalMasterSheetsNumber(itemId);
    return count > 0 ? count.toLocaleString() : "-";
  };


  return (
    <div>
      {nextJobCardNumber ? (
        <div className="mb-6 w-full bg-white/70 backdrop-blur-sm border border-border rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between shadow-md">
          <div className="font-body text-sm text-muted-foreground">
            Date: {format(new Date(), "PPP")}
          </div>
          <div className="font-headline text-base font-semibold text-primary">
            Job Card Number: {nextJobCardNumber}
          </div>
        </div>
      ) : (
        <div className="mb-6 w-full text-muted-foreground text-sm font-body">
          Loading Job Card Number...
        </div>
      )}


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
      <Popover
        open={isCustomerPopoverOpen}
        onOpenChange={async open => {
          setIsCustomerPopoverOpen(open);
          if (open) {
            try {
              setIsLoadingCustomers(true);
              const list = await getCustomersList();
              setAllCustomers(list);
              setCustomerSuggestions(list.slice(0, 10));
            } finally {
              setIsLoadingCustomers(false);
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <FormControl>
            <Input
              placeholder="Type or select customer"
              {...field}
              value={customerInputValue}
              onChange={(e) => handleCustomerInputChange(e, field.onChange)}
              className="font-body"
              ref={customerInputRef}
            />
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
                      <FormControl>
                        <div className="relative">
                          <BriefcaseIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          {isLoadingJobsForCustomer && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}

                          <Input
                            ref={jobInputRef}
                            type="text"
                            placeholder={
                              isLoadingJobsForCustomer
                                ? "Loading jobs..."
                                : !form.getValues("customerName")
                                  ? "Type customer name above first"
                                  : jobsForCustomer.length === 0
                                    ? "No past jobs found"
                                    : "Type to search past jobs"
                            }
                            value={jobInputValue}
                            onChange={handleJobInputChange}
                            onFocus={() => {
                              if (form.getValues("customerName")) {
                                if (!jobInputValue && jobsForCustomer.length > 0) {
                                  setJobSuggestions(jobsForCustomer.slice(0, 10));
                                }
                                setIsJobPopoverOpen(true);
                              }
                            }}
                            onPointerDownCapture={(e) => {
                              const inputEl = e.currentTarget as HTMLInputElement;
                              if (!isJobPopoverOpen) {
                                e.preventDefault();
                                if (form.getValues("customerName") && jobsForCustomer.length > 0) {
                                  setJobSuggestions(jobsForCustomer.slice(0, 10));
                                }
                                setIsJobPopoverOpen(true);
                                requestAnimationFrame(() => inputEl.focus());
                              }
                            }}
                            className="pl-8 font-body"
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
                      <SelectContent className="font-body max-h-[200px]">
                        {PAPER_QUALITY_OPTIONS.map(option => (
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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:mt-0 mt-4 font-body"
                  disabled // Optimizer commented out
                >
                  <Wand2 className="mr-2 h-4 w-4" /> Optimize Master Sheet (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <Archive className="mr-2 h-5 w-5 text-primary" />
                Relevant Inventory
              </CardTitle>
              <CardDescription className="font-body">
                Shows available master sheets from inventory matching your target paper specifications.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isLoadingInventory ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <p className="text-muted-foreground font-body">Loading inventory...</p>
                </div>
              ) : !watchedPaperQuality ? (
                <p className="text-muted-foreground font-body text-center py-4">
                  Please select a 'Target Paper Quality' above to see relevant inventory.
                </p>
              ) : filteredInventoryForDisplay.length === 0 ? (
                <p className="text-muted-foreground font-body text-center py-4">
                  No master sheets found in inventory matching:{" "}
                  <span className="font-semibold">
                    {getPaperQualityLabel(watchedPaperQuality as PaperQualityType)}
                  </span>
                  {targetPaperUnit === "gsm" && watchedPaperGsm ? ` ${watchedPaperGsm}GSM` : ""}
                  {targetPaperUnit === "mm" && watchedPaperThicknessMm ? ` ${watchedPaperThicknessMm}mm` : ""}.
                  Ensure items have positive stock and match criteria.
                </p>
              ) : (
                <ScrollArea className="h-[250px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-headline">Size</TableHead>
                        <TableHead className="font-headline">Item Name</TableHead>
                        <TableHead className="font-headline">Location</TableHead>
                        <TableHead className="font-headline text-right">No. of Ups</TableHead>
                        <TableHead className="font-headline text-right">Total Masters Required</TableHead>
                        <TableHead className="font-headline text-right">Available Stock</TableHead>
                        <TableHead className="font-headline text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredInventoryForDisplay.map((item) => {
                        const ups = itemUpsValues[item.id] ?? 0;
                        const availableStock = item.availableStock ?? 0;
                        const grossQty = form.watch("grossQuantity") ?? 0;

                        // 🔁 Step 1: Find this item's position in the selection order
                        const thisItemIndex = selectedInventoryItemIds.indexOf(item.id);

                        // 🔁 Step 2: Calculate how much quantity has already been satisfied
                        const previouslySatisfied = selectedInventoryItemIds
                          .slice(0, thisItemIndex)
                          .reduce((sum, prevId) => {
                            const prevUps = itemUpsValues[prevId] ?? 0;
                            const prevItem = allInventoryItems.find(i => i.id === prevId);
                            const prevAvailable = prevItem?.availableStock ?? 0;
                            return sum + (prevUps > 0 ? prevAvailable * prevUps : 0);
                          }, 0);

                        // ✅ Step 3: Calculate what's left to fulfill
                        const remainingToSatisfy = Math.max(grossQty - previouslySatisfied, 0);

                        // ✅ Step 4: Calculate masters needed (capped by stock)
                        const mastersNeeded = ups > 0 ? Math.min(availableStock, Math.ceil(remainingToSatisfy / ups)) : 0;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-body min-w-[100px] text-base font-semibold">
                              {item.type === "Master Sheet" && item.masterSheetSizeWidth && item.masterSheetSizeHeight
                                ? `${item.masterSheetSizeWidth} x ${item.masterSheetSizeHeight} in`
                                : "-"}
                            </TableCell>

                            <TableCell className="font-body min-w-[150px]">
                              {item.paperGsm
                                ? `${item.paperGsm}gsm ${item.paperQuality || ""}`.trim()
                                : item.paperThicknessMm
                                  ? `${item.paperThicknessMm}mm ${item.paperQuality || ""}`.trim()
                                  : "-"}
                            </TableCell>

                            <TableCell className="font-body">{item.locationCode || "-"}</TableCell>

                            <TableCell className="font-body text-right">
                              <Input
                                type="number"
                                placeholder="Ups"
                                className="font-body text-right w-full !mt-0"
                                value={itemUpsValues[item.id] ?? ""}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  setItemUpsValues({
                                    ...itemUpsValues,
                                    [item.id]: isNaN(value) ? undefined : value,
                                  });
                                }}
                                onWheel={(e) => e.preventDefault()}
                              />
                            </TableCell>

                            <TableCell className="font-body text-right">
                              {mastersNeeded > 0 ? (
                                <div className={cn(
                                  "inline-flex items-center justify-center rounded-full w-12 h-6 px-2 text-xs font-bold",
                                  mastersNeeded > availableStock
                                    ? "bg-red-600 text-white"
                                    : "bg-green-600 text-white"
                                )}>
                                  {mastersNeeded}
                                </div>
                              ) : "-"}
                            </TableCell>

                            <TableCell className="font-body text-right">
                              <div className={cn(
                                "inline-flex items-center justify-center rounded-full w-12 h-6 px-2 text-xs font-bold",
                                availableStock < mastersNeeded
                                  ? "bg-red-600 text-white"
                                  : "bg-green-600 text-white"
                              )}>
                                {availableStock.toLocaleString()}
                              </div>
                            </TableCell>

                            <TableCell className="text-center w-[120px]">
                              <Button
                                variant={selectedInventoryItemIds.includes(item.id) ? "ghost" : "outline"}
                                className={cn(
                                  "font-body text-xs h-8",
                                  selectedInventoryItemIds.includes(item.id) && "p-0 border-0"
                                )}
                                onClick={() =>
                                  handleInventorySelect(item.id, !selectedInventoryItemIds.includes(item.id))
                                }
                                disabled={(itemUpsValues[item.id] ?? 0) <= 0}
                              >
                                {selectedInventoryItemIds.includes(item.id) ? (
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold">
                                    {selectedInventoryItemIds.indexOf(item.id) + 1}
                                  </div>
                                ) : (
                                  "Select"
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>




          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <Archive className="mr-2 h-5 w-5 text-primary" />
                Selected Inventory Items
              </CardTitle>
              <CardDescription className="font-body">
                These master sheets were selected for this job based on the 'No. of Ups' entered.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-headline">Item Name / Size</TableHead>
                    <TableHead className="font-headline text-right">No. of Ups</TableHead>
                    <TableHead className="font-headline text-right">Total Masters Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allInventoryItems
                    .filter(item => selectedInventoryItemIds.includes(item.id))
                    .sort((a, b) => selectedInventoryItemIds.indexOf(a.id) - selectedInventoryItemIds.indexOf(b.id))
                    .map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-body">{formatInventoryItemForDisplay(item)}</TableCell>
                        <TableCell className="font-body text-right">{itemUpsValues[item.id] ?? 0}</TableCell>
                        <TableCell className="font-body text-right">
                          {Math.min(
                            calculateTotalMasterSheetsNumber(item.id),
                            item.availableStock ?? 0
                          ).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>


              <div className="w-full mt-4 px-2">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 rounded-xl px-4 py-3 backdrop-blur-md bg-white/10 border border-white/20 shadow-sm text-sm font-body">
                    <span className="block text-xs text-white/70 mb-1 font-medium">Quantity Covered</span>
                    <span className="text-base font-semibold text-white">
                      {totalQuantitySatisfied.toLocaleString()} sheets
                    </span>
                  </div>

                  <div className="flex-1 rounded-xl px-4 py-3 backdrop-blur-md bg-white/10 border border-white/20 shadow-sm text-sm font-body relative">
                    <span className="block text-xs text-white/70 mb-1 font-medium">Remaining Quantity</span>
                    <span className={cn("text-base font-semibold", remainingQuantity > 0 ? "text-red-500" : "text-white")}>
                      {remainingQuantity.toLocaleString()} sheets
                    </span>

                    {remainingQuantity > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="absolute top-3 right-3 text-xs text-white/80 hover:text-white hover:bg-white/20 px-3 py-1 rounded-md border border-white/20"
                        onClick={() => {
                          const textToCopy = [
                            `JC: ${form.getValues("jobCardNumber") ?? "N/A"}`,
                            `Size: ${form.getValues("jobSizeWidth") ?? "?"} x ${form.getValues("jobSizeHeight") ?? "?"} in`,
                            `Quality: ${form.getValues("paperQuality") ?? "?"} ${form.getValues("paperGsm") ?? form.getValues("targetPaperThicknessMm") ?? ""}${form.getValues("paperGsm") ? " GSM" : " mm"}`,
                            `Quanity Required: ${remainingQuantity.toLocaleString()}`
                          ].join("\n");

                          navigator.clipboard.writeText(textToCopy);
                        }}
                      >
                        Copy Order
                      </Button>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><ListOrdered className="mr-2 h-5 w-5 text-primary" />Define Job Workflow</CardTitle>
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
                  <h4 className="font-medium mb-1 text-sm font-body">Selected Workflow:</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentWorkflowSteps.sort((a, b) => a.order - b.order).map(step => (
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
              {processFields.map((item) => {
                if (item.type === 'input') { // Keep original line
                  return (
                    <FormField
                      key={item.name}
                      control={form.control}
                      name={item.name as keyof JobCardFormValues}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{item.label}</FormLabel>
                          <FormControl><Input placeholder="e.g., Pantone 185 C" {...field} value={field.value as string ?? ""} className="font-body" /></FormControl>
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
                            {(item as { name: keyof JobCardFormValues; label: string; options: readonly { value: string; label: string; }[]; }).options.map((option: { value: string; label: string }) => (
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
                  <FormControl><Textarea placeholder="Any additional notes or instructions for this job." {...field} value={field.value ?? ""} className="font-body" /></FormControl>
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
                <p className="text-sm text-muted-foreground font-body mt-2">
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
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset({
                jobName: initialJobName || undefined,
                customerName: initialCustomerName || undefined,
                customerId: undefined,
                jobSizeWidth: undefined,
                jobSizeHeight: undefined,
                netQuantity: undefined,
                grossQuantity: undefined,
                paperGsm: undefined,
                targetPaperThicknessMm: undefined,
                paperQuality: undefined,
                kindOfJob: undefined,
                printingFront: undefined,
                printingBack: undefined,
                coating: undefined,
                specialInks: undefined,
                die: undefined,
                assignedDieMachine: undefined,
                hotFoilStamping: undefined,
                emboss: undefined,
                pasting: undefined,
                boxMaking: undefined,
                remarks: undefined,
                dispatchDate: undefined,
                workflowSteps: [],
                linkedJobCardIds: [],
                hasPendingInventory: false,
                pdfDataUri: undefined,
              });
              setCurrentWorkflowSteps([]);
              setCustomerInputValue(initialJobData?.customerName || initialCustomerName || "");
              setJobInputValue("");
              setSelectedPastJobId("");
              setJobsForCustomer([]);
              setCurrentPdfDataUri(undefined);
            }}
            disabled={isSubmitting}
            className="font-body"
          >
            Cancel
          </Button>

          <Button type="submit" disabled={isSubmitting} className="font-body">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            Create Job Card
          </Button>
        </div>
        </form>
    </Form> 
  </div>
  ); 
}