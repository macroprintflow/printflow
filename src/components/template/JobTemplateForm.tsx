
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JobTemplateFormValues, WorkflowStep, WorkflowProcessStepDefinition } from "@/lib/definitions";
import { JobTemplateSchema, KINDS_OF_JOB_OPTIONS, PRINTING_MACHINE_OPTIONS, COATING_OPTIONS, DIE_OPTIONS, HOT_FOIL_OPTIONS, YES_NO_OPTIONS, BOX_MAKING_OPTIONS, PAPER_QUALITY_OPTIONS, PRODUCTION_PROCESS_STEPS } from "@/lib/definitions";
import { createJobTemplate } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2, RotateCcw, ListOrdered } from "lucide-react";
import { useState, useEffect } from "react";
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

  const form = useForm<JobTemplateFormValues>({
    resolver: zodResolver(JobTemplateSchema),
    defaultValues: {
      name: undefined,
      paperQuality: undefined,
      kindOfJob: undefined,
      printingFront: undefined,
      printingBack: undefined,
      coating: undefined,
      die: undefined,
      hotFoilStamping: undefined,
      emboss: undefined,
      pasting: undefined,
      boxMaking: undefined,
      predefinedWorkflow: [],
    },
  });

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
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
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
