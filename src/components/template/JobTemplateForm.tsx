
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JobTemplateFormValues, WorkflowStep, WorkflowProcessStepDefinition, JobCardData, PaperQualityType } from "@/lib/definitions";
import { JobTemplateSchema, KINDS_OF_JOB_OPTIONS, PRINTING_MACHINE_OPTIONS, COATING_OPTIONS, DIE_OPTIONS, HOT_FOIL_OPTIONS, YES_NO_OPTIONS, BOX_MAKING_OPTIONS, PAPER_QUALITY_OPTIONS, PRODUCTION_PROCESS_STEPS } from "@/lib/definitions";
import { createJobTemplate, getUniqueCustomerNames, getJobsByCustomerName } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2, RotateCcw, ListOrdered, Users, Briefcase } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

interface DisplayWorkflowStep extends WorkflowProcessStepDefinition {
  order: number;
}

export function JobTemplateForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [currentWorkflowSteps, setCurrentWorkflowSteps] = useState<DisplayWorkflowStep[]>([]);

  const [allCustomers, setAllCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [jobsForCustomer, setJobsForCustomer] = useState<JobCardData[]>([]);
  const [selectedPastJobId, setSelectedPastJobId] = useState<string>("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingJobsForCustomer, setIsLoadingJobsForCustomer] = useState(false);


  const form = useForm<JobTemplateFormValues>({
    resolver: zodResolver(JobTemplateSchema),
    defaultValues: {
      name: "",
      paperQuality: "",
      kindOfJob: "",
      printingFront: "",
      printingBack: "",
      coating: "",
      die: "",
      hotFoilStamping: "",
      emboss: "",
      pasting: "",
      boxMaking: "",
      predefinedWorkflow: [],
    },
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoadingCustomers(true);
      try {
        const names = await getUniqueCustomerNames();
        setAllCustomers(names);
      } catch (error) {
        toast({ title: "Error", description: "Could not fetch customer list.", variant: "destructive" });
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, [toast]);

  const handleCustomerChange = useCallback(async (customerName: string) => {
    setSelectedCustomer(customerName);
    setSelectedPastJobId(""); // Reset past job selection
    form.reset(); // Reset the form when customer changes for a fresh start
    setCurrentWorkflowSteps([]);
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
  }, [form, toast]);

  const handlePastJobChange = useCallback((jobId: string) => {
    setSelectedPastJobId(jobId);
    const job = jobsForCustomer.find(j => j.id === jobId);
    if (job) {
      form.reset({
        name: `Repeat - ${job.jobName}`,
        paperQuality: job.paperQuality || "",
        kindOfJob: job.kindOfJob || "",
        printingFront: job.printingFront || "",
        printingBack: job.printingBack || "",
        coating: job.coating || "",
        die: job.die || "",
        hotFoilStamping: job.hotFoilStamping || "",
        emboss: job.emboss || "",
        pasting: job.pasting || "",
        boxMaking: job.boxMaking || "",
        predefinedWorkflow: job.workflowSteps || [],
      });
      
      const displayWorkflow = (job.workflowSteps || [])
        .map(ws => {
          const stepDef = PRODUCTION_PROCESS_STEPS.find(s => s.slug === ws.stepSlug);
          return stepDef ? { ...stepDef, order: ws.order } : null;
        })
        .filter((s): s is DisplayWorkflowStep => s !== null)
        .sort((a, b) => a.order - b.order);
      setCurrentWorkflowSteps(displayWorkflow);

    } else {
       form.reset(); // Reset if job not found (should not happen if list is correct)
       setCurrentWorkflowSteps([]);
    }
  }, [jobsForCustomer, form]);


  useEffect(() => {
    form.setValue('predefinedWorkflow', currentWorkflowSteps.map(s => ({ stepSlug: s.slug, order: s.order })));
  }, [currentWorkflowSteps, form]);

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

  async function onSubmit(values: JobTemplateFormValues) {
    setIsSubmitting(true);
    const valuesToSubmit = {
      ...values,
      predefinedWorkflow: currentWorkflowSteps.map(s => ({ stepSlug: s.slug, order: s.order }))
    };
    const result = await createJobTemplate(valuesToSubmit);
    setIsSubmitting(false);
    if (result.success) {
      toast({
        title: "Success!",
        description: "Job template created successfully.",
      });
      form.reset();
      setCurrentWorkflowSteps([]);
      setSelectedCustomer("");
      setSelectedPastJobId("");
      setJobsForCustomer([]);
      router.push(`/templates`);
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to create job template.",
        variant: "destructive",
      });
    }
  }

  const processFields = [
    { name: "paperQuality", label: "Paper Quality", options: PAPER_QUALITY_OPTIONS },
    { name: "kindOfJob", label: "Kind of Job", options: KINDS_OF_JOB_OPTIONS },
    { name: "printingFront", label: "Printing Front", options: PRINTING_MACHINE_OPTIONS },
    { name: "printingBack", label: "Printing Back", options: PRINTING_MACHINE_OPTIONS },
    { name: "coating", label: "Coating", options: COATING_OPTIONS },
    { name: "die", label: "Die", options: DIE_OPTIONS },
    { name: "hotFoilStamping", label: "Hot Foil Stamping", options: HOT_FOIL_OPTIONS },
    { name: "emboss", label: "Emboss", options: YES_NO_OPTIONS },
    { name: "pasting", label: "Pasting", options: YES_NO_OPTIONS },
    { name: "boxMaking", label: "Box Making", options: BOX_MAKING_OPTIONS },
  ] as const;


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary"/>Pre-fill from Past Job</CardTitle>
            <CardDescription className="font-body">Select a customer and then one of their past jobs to use its details as a starting point for this template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormItem>
                <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4"/>Select Customer</FormLabel>
                <Select onValueChange={handleCustomerChange} value={selectedCustomer} disabled={isLoadingCustomers}>
                  <FormControl><SelectTrigger className="font-body">
                    <SelectValue placeholder={isLoadingCustomers ? "Loading customers..." : "Select a customer"} />
                  </SelectTrigger></FormControl>
                  <SelectContent>
                    {allCustomers.map(name => (
                      <SelectItem key={name} value={name} className="font-body">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>

              <FormItem>
                <FormLabel className="flex items-center"><Briefcase className="mr-2 h-4 w-4"/>Select Past Job</FormLabel>
                <Select onValueChange={handlePastJobChange} value={selectedPastJobId} disabled={!selectedCustomer || isLoadingJobsForCustomer || jobsForCustomer.length === 0}>
                  <FormControl><SelectTrigger className="font-body">
                    <SelectValue placeholder={
                      isLoadingJobsForCustomer ? "Loading jobs..." : 
                      !selectedCustomer ? "Select customer first" :
                      jobsForCustomer.length === 0 ? "No past jobs found" :
                      "Select a past job"
                    } />
                  </SelectTrigger></FormControl>
                  <SelectContent>
                    {jobsForCustomer.map(job => (
                      <SelectItem key={job.id} value={job.id!} className="font-body">{job.jobName} (ID: {job.jobCardNumber || job.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            </div>
          </CardContent>
        </Card>


        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Name</FormLabel>
              <FormControl><Input placeholder="e.g., Standard Monocarton with UV" {...field} className="font-body" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><ListOrdered className="mr-2 h-5 w-5 text-primary"/>Define Template Workflow</CardTitle>
            <CardDescription className="font-body">Click on steps to add them to the workflow in order. Click again to remove.</CardDescription>
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
          </CardContent>
        </Card>

        <CardTitle className="font-headline text-xl pt-4 border-t">Process Specifications</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processFields.map(item => (
            <FormField
              key={item.name}
              control={form.control}
              name={item.name as keyof JobTemplateFormValues}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{item.label}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger className="font-body"><SelectValue placeholder={`Select ${item.label.toLowerCase()}`} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {item.options.map(option => (
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
          ))}
        </div>
        
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => router.push('/templates')} disabled={isSubmitting} className="font-body">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="font-body">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Create Template
          </Button>
        </div>
      </form>
    </Form>
  );
}

