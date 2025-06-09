
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; // Added missing imports
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import type { JobCardData, PaperQualityType } from "@/lib/definitions";
import { PAPER_QUALITY_OPTIONS, getPaperQualityUnit, KAPPA_MDF_QUALITIES, createJobCard } from "@/lib/definitions"; // Assuming createJobCard is from definitions for now
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const Step1Schema = z.object({
  jobName: z.string().min(1, "Job name is required"),
  customerName: z.string().min(1, "Customer name is required"), // Simplified for now
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

// Combine all step schemas for the final form data type
const MultiStepJobSchema = Step1Schema.merge(Step2Schema).merge(Step3Schema);
type MultiStepJobFormValues = z.infer<typeof MultiStepJobSchema>;

interface NewJobMultiStepModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  initialData?: Partial<JobCardData>; // For potential pre-filling later
  onModalClose?: () => void;
}

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
        MultiStepJobSchema // For review step, or could be a different schema
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
    mode: "onChange", // Validate on change for better UX
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
    else if (currentStep === 3) isValid = await form.trigger(["remarks"]);
    
    if (isValid) {
      if (currentStep < 4) {
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
    console.log("Multi-step form submitted:", data);

    // Map to JobCardFormValues for the existing createJobCard action
    const jobCardPayload: JobCardData = {
      jobName: data.jobName,
      customerName: data.customerName, // customerId would need to be handled if customer selection is implemented
      date: new Date().toISOString().split('T')[0], // Assuming creation date
      dispatchDate: data.dispatchDate ? format(data.dispatchDate, "yyyy-MM-dd") : undefined,
      jobSizeWidth: data.jobSizeWidth,
      jobSizeHeight: data.jobSizeHeight,
      netQuantity: data.netQuantity,
      grossQuantity: data.grossQuantity,
      paperQuality: data.paperQuality as PaperQualityType,
      paperGsm: data.paperQuality && getPaperQualityUnit(data.paperQuality as PaperQualityType) === 'gsm' ? data.paperGsm : undefined,
      targetPaperThicknessMm: data.paperQuality && getPaperQualityUnit(data.paperQuality as PaperQualityType) === 'mm' ? data.targetPaperThicknessMm : undefined,
      remarks: data.remarks,
      // Default other required fields or handle them if added to modal
      kindOfJob: "", 
      printingFront: "",
      printingBack: "",
      coating: "",
      die: "",
      hotFoilStamping: "",
      emboss: "",
      pasting: "",
      boxMaking: "",
      workflowSteps: [], // Or allow defining this in the modal
      linkedJobCardIds: [],
    };

    // For now, just log and close. Replace with actual submission later.
    // const result = await createJobCard(jobCardPayload); // This would be the actual call
    // setIsSubmitting(false);
    // if (result.success) {
    //   toast({ title: "Job Created", description: "New job card created successfully via multi-step form." });
    //   setIsOpen(false);
    //   form.reset();
    //   setCurrentStep(1);
    //   router.push('/jobs'); // Or relevant page
    // } else {
    //   toast({ title: "Error", description: result.message || "Failed to create job card.", variant: "destructive" });
    // }
    
    setTimeout(() => { // Simulate API call
        toast({ title: "Form Submitted (Placeholder)", description: "Data logged to console. Actual creation pending." });
        setIsSubmitting(false);
        setIsOpen(false);
        form.reset();
        setCurrentStep(1);
        if (onModalClose) onModalClose();
    }, 1000);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Basic Info
        return (
          <Form {...form}> {/* Form provider added here */}
            <form className="space-y-4">
              <FormField control={form.control} name="jobName" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="msJobName">Job Name</FormLabel>
                  <FormControl>
                    <Input id="msJobName" {...field} placeholder="e.g., Premium Product Box" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="msCustomerName">Client / Customer Name</FormLabel>
                  <FormControl>
                    <Input id="msCustomerName" {...field} placeholder="e.g., Acme Corp" />
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
      case 2: // Job Specifications
        return (
          <Form {...form}> {/* Form provider added here */}
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="jobSizeWidth" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msJobSizeWidth">Job Width (in)</FormLabel><FormControl><Input id="msJobSizeWidth" type="number" {...field} placeholder="e.g., 8.5" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="jobSizeHeight" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msJobSizeHeight">Job Height (in)</FormLabel><FormControl><Input id="msJobSizeHeight" type="number" {...field} placeholder="e.g., 11" /></FormControl><FormMessage /></FormItem>
                  )} />
              </div>
               <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="netQuantity" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msNetQuantity">Net Quantity</FormLabel><FormControl><Input id="msNetQuantity" type="number" {...field} placeholder="e.g., 1000" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="grossQuantity" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="msGrossQuantity">Gross Quantity</FormLabel><FormControl><Input id="msGrossQuantity" type="number" {...field} placeholder="e.g., 1100" /></FormControl><FormMessage /></FormItem>
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
                  <FormItem><FormLabel htmlFor="msPaperGsm">Target Paper GSM</FormLabel><FormControl><Input id="msPaperGsm" type="number" {...field} placeholder="e.g., 300" /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              {targetPaperUnit === 'mm' && (
                <FormField control={form.control} name="targetPaperThicknessMm" render={({ field }) => (
                  <FormItem><FormLabel htmlFor="msPaperThicknessMm">Target Paper Thickness (mm)</FormLabel><FormControl><Input id="msPaperThicknessMm" type="number" {...field} placeholder="e.g., 1.2" /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </form>
          </Form>
        );
      case 3: // Additional Details
        return (
          <Form {...form}> {/* Form provider added here */}
            <form className="space-y-4">
              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="msRemarks">Remarks (Optional)</FormLabel>
                  <FormControl><Textarea id="msRemarks" {...field} placeholder="Any additional notes or instructions..." rows={4} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
        );
      case 4: // Review & Submit
        const formData = form.getValues();
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-lg">Review Your Job Details</h4>
            <p><strong>Job Name:</strong> {formData.jobName}</p>
            <p><strong>Customer:</strong> {formData.customerName}</p>
            <p><strong>Dispatch Date:</strong> {formData.dispatchDate ? format(formData.dispatchDate, "PPP") : "N/A"}</p>
            <p><strong>Size:</strong> {formData.jobSizeWidth}in x {formData.jobSizeHeight}in</p>
            <p><strong>Quantity:</strong> Net {formData.netQuantity}, Gross {formData.grossQuantity}</p>
            <p><strong>Material:</strong> {PAPER_QUALITY_OPTIONS.find(o => o.value === formData.paperQuality)?.label}
                {targetPaperUnit === 'gsm' && formData.paperGsm ? ` ${formData.paperGsm}GSM` : ''}
                {targetPaperUnit === 'mm' && formData.targetPaperThicknessMm ? ` ${formData.targetPaperThicknessMm}mm` : ''}
            </p>
            <p><strong>Remarks:</strong> {formData.remarks || "N/A"}</p>
          </div>
        );
      default:
        return null;
    }
  };

  const getDialogTitle = () => {
    switch (currentStep) {
      case 1: return "Step 1: Basic Information";
      case 2: return "Step 2: Job Specifications";
      case 3: return "Step 3: Additional Details";
      case 4: return "Step 4: Review & Submit";
      default: return "Create New Job";
    }
  };
  
  const handleDialogClose = (openState: boolean) => {
    if (!openState) { // If closing
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
      <DialogContent className="sm:max-w-lg font-body">
        <DialogHeader>
          <DialogTitle className="font-headline">{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            Complete the steps to create a new job card.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] p-1 pr-4 -mr-2">
            <div className="py-4">{renderStepContent()}</div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={isSubmitting}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Submitting..." : "Submit Job Card"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
