
"use client";

import React, { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// Label is imported from ui/label but FormLabel is used from ui/form
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import type { JobCardData, PaperQualityType } from "@/lib/definitions";
import { PAPER_QUALITY_OPTIONS, getPaperQualityUnit, KAPPA_MDF_QUALITIES, createJobCard } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const Step1Schema = z.object({
  jobName: z.string().min(1, "Job name is required"),
  customerName: z.string().min(1, "Customer name is required"),
  dispatchDate: z.date().optional(),
});

const Step2Schema = z.object({
  jobSizeWidth: z.coerce.number().positive("Width must be positive"),
  jobSizeHeight: z.coerce.number().positive("Height must be positive"),
  netQuantity: z.coerce.number().int().positive("Net quantity must be positive"),
  grossQuantity: z.coerce.number().int().positive("Gross quantity must be positive"),
  paperQuality: z.enum(PAPER_QUALITY_OPTIONS.map(opt => opt.value) as [string, ...string[]]).refine(val => val !== '', { message: "Paper quality is required" }),
  paperGsm: z.coerce.number().optional(),
  targetPaperThicknessMm: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    const unit = getPaperQualityUnit(data.paperQuality as PaperQualityType);
    if (data.paperQuality && unit === 'gsm' && (data.paperGsm === undefined || data.paperGsm <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paper GSM must be positive for this quality.", path: ["paperGsm"] });
    }
    if (data.paperQuality && unit === 'mm' && (data.targetPaperThicknessMm === undefined || data.targetPaperThicknessMm <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Target paper thickness (mm) must be positive for this quality.", path: ["targetPaperThicknessMm"] });
    }
});

const Step3Schema = z.object({
  remarks: z.string().optional(),
});

const MultiStepJobSchema = Step1Schema.merge(Step2Schema).merge(Step3Schema);
type MultiStepJobFormValues = z.infer<typeof MultiStepJobSchema>;

interface NewJobMultiStepModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  initialData?: Partial<JobCardData>;
  onModalClose?: () => void;
}

const MAX_STEPS = 3;

export function NewJobMultiStepModal({
  isOpen,
  setIsOpen,
  initialData,
  onModalClose,
}: NewJobMultiStepModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MultiStepJobFormValues>({
    resolver: zodResolver(
        currentStep === 1 ? Step1Schema :
        currentStep === 2 ? Step2Schema :
        currentStep === 3 ? Step3Schema :
        MultiStepJobSchema // Fallback, though currentStep should always be 1, 2, or 3
    ),
    defaultValues: {
      jobName: initialData?.jobName || "",
      customerName: initialData?.customerName || "",
      dispatchDate: initialData?.dispatchDate ? new Date(initialData.dispatchDate) : undefined,
      jobSizeWidth: initialData?.jobSizeWidth || undefined,
      jobSizeHeight: initialData?.jobSizeHeight || undefined,
      netQuantity: initialData?.netQuantity || undefined,
      grossQuantity: initialData?.grossQuantity || undefined,
      paperQuality: (initialData?.paperQuality as typeof PAPER_QUALITY_OPTIONS[number]['value']) || "",
      paperGsm: initialData?.paperGsm || undefined,
      targetPaperThicknessMm: initialData?.targetPaperThicknessMm || undefined,
      remarks: initialData?.remarks || "",
    },
    mode: "onChange",
  });

  const watchedPaperQuality = form.watch("paperQuality");
  const targetPaperUnit = getPaperQualityUnit(watchedPaperQuality as PaperQualityType);

  useEffect(() => {
    if (initialData) {
      form.reset({
        jobName: initialData.jobName || "",
        customerName: initialData.customerName || "",
        dispatchDate: initialData.dispatchDate ? new Date(initialData.dispatchDate) : undefined,
        jobSizeWidth: initialData.jobSizeWidth || undefined,
        jobSizeHeight: initialData.jobSizeHeight || undefined,
        netQuantity: initialData.netQuantity || undefined,
        grossQuantity: initialData.grossQuantity || undefined,
        paperQuality: (initialData.paperQuality as typeof PAPER_QUALITY_OPTIONS[number]['value']) || "",
        paperGsm: initialData.paperGsm || undefined,
        targetPaperThicknessMm: initialData.targetPaperThicknessMm || undefined,
        remarks: initialData.remarks || "",
      });
    }
  }, [initialData, form]);

  const handleNext = async () => {
    let isValid = false;
    if (currentStep === 1) isValid = await form.trigger(["jobName", "customerName", "dispatchDate"]);
    else if (currentStep === 2) isValid = await form.trigger(["jobSizeWidth", "jobSizeHeight", "netQuantity", "grossQuantity", "paperQuality", "paperGsm", "targetPaperThicknessMm"]);
    // Step 3 doesn't need validation for next, it's the submit step now.
    
    if (isValid) {
      if (currentStep < MAX_STEPS) {
        setCurrentStep((prev) => prev + 1);
      }
    } else {
        toast({ title: "Validation Error", description: "Please correct the errors on the current step.", variant: "destructive" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const onSubmit = async (data: MultiStepJobFormValues) => {
    setIsSubmitting(true);
    console.log("Multi-step form submitted (Steps 1-3):", data);

    // For now, just log and close. Actual submission to createJobCard would happen here.
    const jobCardPayload: JobCardData = {
      jobName: data.jobName,
      customerName: data.customerName, 
      date: new Date().toISOString().split('T')[0],
      dispatchDate: data.dispatchDate ? format(data.dispatchDate, "yyyy-MM-dd") : undefined,
      jobSizeWidth: data.jobSizeWidth,
      jobSizeHeight: data.jobSizeHeight,
      netQuantity: data.netQuantity,
      grossQuantity: data.grossQuantity,
      paperQuality: data.paperQuality as PaperQualityType,
      paperGsm: data.paperQuality && getPaperQualityUnit(data.paperQuality as PaperQualityType) === 'gsm' ? data.paperGsm : undefined,
      targetPaperThicknessMm: data.paperQuality && getPaperQualityUnit(data.paperQuality as PaperQualityType) === 'mm' ? data.targetPaperThicknessMm : undefined,
      remarks: data.remarks,
      // Default other fields as empty or standard values as JobCardForm does
      kindOfJob: "", 
      printingFront: "",
      printingBack: "",
      coating: "",
      die: "",
      hotFoilStamping: "",
      emboss: "",
      pasting: "",
      boxMaking: "",
      workflowSteps: [], // Or a default workflow
      linkedJobCardIds: [],
    };
    
    // Simulate API call for now
    // In a real scenario, you'd call `await createJobCard(jobCardPayload);`
    setTimeout(() => { 
        toast({ title: "Form Submitted (Placeholder)", description: "Data from steps 1-3 logged to console. Actual creation pending." });
        setIsSubmitting(false);
        setIsOpen(false);
        form.reset();
        setCurrentStep(1);
        if (onModalClose) onModalClose();
        // router.push('/jobs'); // Potentially navigate after successful submission
    }, 1000);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Form {...form}>
            <form className="space-y-4">
              <FormField control={form.control} name="jobName" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="msJobName">Job Name</FormLabel>
                  <FormControl>
                    <Input id="msJobName" {...field} placeholder="e.g., Premium Product Box" 
                           value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="msCustomerName">Client / Customer Name</FormLabel>
                  <FormControl>
                    <Input id="msCustomerName" {...field} placeholder="e.g., Acme Corp" 
                           value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dispatchDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Dispatch Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
        );
      case 2:
        return (
          <Form {...form}>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="jobSizeWidth" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msJobSizeWidth">Job Width (in)</FormLabel><FormControl>
                    <Input 
                        id="msJobSizeWidth" type="number" {...field} 
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                        placeholder="e.g., 8.5" 
                    />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="jobSizeHeight" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msJobSizeHeight">Job Height (in)</FormLabel><FormControl>
                    <Input 
                        id="msJobSizeHeight" type="number" {...field} 
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                        placeholder="e.g., 11" 
                    />
                    </FormControl><FormMessage /></FormItem>
                  )} />
              </div>
               <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="netQuantity" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msNetQuantity">Net Quantity</FormLabel><FormControl>
                    <Input 
                        id="msNetQuantity" type="number" {...field} 
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                        placeholder="e.g., 1000" 
                    />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="grossQuantity" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msGrossQuantity">Gross Quantity</FormLabel><FormControl>
                    <Input 
                        id="msGrossQuantity" type="number" {...field} 
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                        placeholder="e.g., 1100" 
                    />
                    </FormControl><FormMessage /></FormItem>
                  )} />
              </div>
              <FormField control={form.control} name="paperQuality" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Paper Quality</FormLabel>
                  <Select onValueChange={(value) => { field.onChange(value); form.setValue("paperGsm", undefined); form.setValue("targetPaperThicknessMm", undefined); }} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select paper quality" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PAPER_QUALITY_OPTIONS.filter(opt => opt.value !== "").map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {targetPaperUnit === 'gsm' && (
                <FormField control={form.control} name="paperGsm" render={({ field }) => (
                  <FormItem><FormLabel htmlFor="msPaperGsm">Target Paper GSM</FormLabel><FormControl>
                  <Input 
                    id="msPaperGsm" type="number" {...field} 
                    value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                    onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                    placeholder="e.g., 300" 
                  />
                  </FormControl><FormMessage /></FormItem>
                )} />
              )}
              {targetPaperUnit === 'mm' && (
                <FormField control={form.control} name="targetPaperThicknessMm" render={({ field }) => (
                  <FormItem><FormLabel htmlFor="msPaperThicknessMm">Target Paper Thickness (mm)</FormLabel><FormControl>
                  <Input 
                    id="msPaperThicknessMm" type="number" {...field} 
                    value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                    onChange={e => { const numValue = parseFloat(e.target.value); field.onChange(isNaN(numValue) ? undefined : numValue); }}
                    placeholder="e.g., 1.2" 
                  />
                  </FormControl><FormMessage /></FormItem>
                )} />
              )}
            </form>
          </Form>
        );
      case 3:
        return (
          <Form {...form}>
            <form className="space-y-4">
              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="msRemarks">Remarks (Optional)</FormLabel>
                  <FormControl><Textarea id="msRemarks" {...field} value={field.value || ''} placeholder="Any additional notes or instructions..." rows={4} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
        );
      default:
        return null;
    }
  };

  const getDialogTitle = () => {
    switch (currentStep) {
      case 1: return "Step 1: Basic Information";
      case 2: return "Step 2: Job Specifications";
      case 3: return "Step 3: Additional Details & Submit";
      default: return "Create New Job";
    }
  };
  
  const handleDialogClose = (openState: boolean) => {
    if (!openState) {
        form.reset();
        setCurrentStep(1);
        if (onModalClose) {
            onModalClose();
        }
    }
    setIsOpen(openState);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-xl font-body">
        <DialogHeader>
          <DialogTitle className="font-headline">{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            Complete the steps to create a new job card.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
            <div className="px-1 py-4">{renderStepContent()}</div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {currentStep < MAX_STEPS ? (
            <Button onClick={handleNext} disabled={isSubmitting}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Submitting..." : "Submit (Placeholder)"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
