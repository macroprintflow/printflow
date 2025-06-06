
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JobTemplateFormValues } from "@/lib/definitions";
import { JobTemplateSchema, KINDS_OF_JOB_OPTIONS, PRINTING_MACHINE_OPTIONS, COATING_OPTIONS, DIE_OPTIONS, HOT_FOIL_OPTIONS, YES_NO_OPTIONS, BOX_MAKING_OPTIONS, PAPER_QUALITY_OPTIONS } from "@/lib/definitions";
import { createJobTemplate } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function JobTemplateForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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
    },
  });

  async function onSubmit(values: JobTemplateFormValues) {
    setIsSubmitting(true);
    const result = await createJobTemplate(values);
    setIsSubmitting(false);
    if (result.success) {
      toast({
        title: "Success!",
        description: "Job template created successfully.",
      });
      form.reset();
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
              <FormControl>
                <Input placeholder="e.g., Standard Monocarton with UV" {...field} className="font-body" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    <FormControl>
                      <SelectTrigger className="font-body">
                        <SelectValue placeholder={`Select ${item.label.toLowerCase()}`} />
                      </SelectTrigger>
                    </FormControl>
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

