
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JobCardFormValues, InventorySuggestion, JobTemplateData, PaperQualityType } from "@/lib/definitions";
import { JobCardSchema, KINDS_OF_JOB_OPTIONS, PRINTING_MACHINE_OPTIONS, COATING_OPTIONS, DIE_OPTIONS, DIE_MACHINE_OPTIONS, HOT_FOIL_OPTIONS, YES_NO_OPTIONS, BOX_MAKING_OPTIONS, PAPER_QUALITY_OPTIONS } from "@/lib/definitions";
import { createJobCard, getJobTemplates, getPaperQualityLabel } from "@/lib/actions/jobActions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, Wand2, Link2, PlusCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { InventoryOptimizationModal } from "./InventoryOptimizationModal";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function JobCardForm() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templates, setTemplates] = useState<JobTemplateData[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<JobCardFormValues>({
    resolver: zodResolver(JobCardSchema),
    defaultValues: {
      jobName: "",
      customerName: "",
      jobSizeWidth: undefined,
      jobSizeHeight: undefined,
      netQuantity: undefined,
      grossQuantity: undefined,
      paperGsm: undefined, // Target GSM
      paperQuality: "", // Target Quality
      masterSheetSizeWidth: undefined, // From suggestion
      masterSheetSizeHeight: undefined, // From suggestion
      wastagePercentage: undefined, // From suggestion
      cuttingLayoutDescription: "", // From suggestion
      selectedMasterSheetGsm: undefined, // Actual GSM from suggestion
      selectedMasterSheetQuality: "", // Actual quality from suggestion
      sourceInventoryItemId: "", // Inventory ID from suggestion
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
    },
  });

  useEffect(() => {
    async function fetchTemplates() {
      const fetchedTemplates = await getJobTemplates();
      setTemplates(fetchedTemplates);
    }
    fetchTemplates();
  }, []);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const currentValues = form.getValues();
      form.reset({
        jobName: currentValues.jobName,
        customerName: currentValues.customerName,
        jobSizeWidth: currentValues.jobSizeWidth,
        jobSizeHeight: currentValues.jobSizeHeight,
        netQuantity: currentValues.netQuantity,
        grossQuantity: currentValues.grossQuantity,
        paperGsm: currentValues.paperGsm, // Keep target GSM if already entered
        masterSheetSizeWidth: currentValues.masterSheetSizeWidth,
        masterSheetSizeHeight: currentValues.masterSheetSizeHeight,
        wastagePercentage: currentValues.wastagePercentage,
        cuttingLayoutDescription: currentValues.cuttingLayoutDescription,
        selectedMasterSheetGsm: currentValues.selectedMasterSheetGsm,
        selectedMasterSheetQuality: currentValues.selectedMasterSheetQuality,
        sourceInventoryItemId: currentValues.sourceInventoryItemId,
        
        paperQuality: template.paperQuality || "", // Apply from template
        kindOfJob: template.kindOfJob || "",
        printingFront: template.printingFront || "",
        printingBack: template.printingBack || "",
        coating: template.coating || "",
        die: template.die || "",
        hotFoilStamping: template.hotFoilStamping || "",
        emboss: template.emboss || "",
        pasting: template.pasting || "",
        boxMaking: template.boxMaking || "",
        
        specialInks: currentValues.specialInks,
        assignedDieMachine: currentValues.assignedDieMachine,
        remarks: currentValues.remarks,
        dispatchDate: currentValues.dispatchDate,
      });
    }
  };

  const handleSuggestionSelect = (suggestion: InventorySuggestion) => {
    form.setValue("masterSheetSizeWidth", suggestion.masterSheetSizeWidth);
    form.setValue("masterSheetSizeHeight", suggestion.masterSheetSizeHeight);
    form.setValue("wastagePercentage", suggestion.wastagePercentage);
    form.setValue("cuttingLayoutDescription", suggestion.cuttingLayoutDescription || "");
    form.setValue("selectedMasterSheetGsm", suggestion.paperGsm);
    form.setValue("selectedMasterSheetQuality", suggestion.paperQuality as PaperQualityType);
    form.setValue("sourceInventoryItemId", suggestion.sourceInventoryItemId || "");
  };

  async function onSubmit(values: JobCardFormValues) {
    setIsSubmitting(true);
    const result = await createJobCard(values);
    setIsSubmitting(false);
    if (result.success) {
      toast({
        title: "Success!",
        description: result.message,
      });
      form.reset();
      setSelectedTemplate('');
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
    paperQuality: form.watch("paperQuality") || undefined,
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
  const selectedMasterSheetGsm = form.watch("selectedMasterSheetGsm");
  const selectedMasterSheetQuality = form.watch("selectedMasterSheetQuality");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Job Templates</CardTitle>
            <CardDescription className="font-body">Select a pre-made template to quickly fill in process specifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleTemplateChange} value={selectedTemplate}>
              <SelectTrigger className="w-full md:w-1/2 font-body">
                <SelectValue placeholder="Select a job template" />
              </SelectTrigger>
              <SelectContent>
                {templates.filter(t => t.id !== "").map(template => (
                  <SelectItem key={template.id} value={template.id} className="font-body">{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <FormControl><Input placeholder="e.g., Chic Fragrances" {...field} className="font-body"/></FormControl>
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
            <FormField control={form.control} name="paperGsm" render={({ field }) => (
              <FormItem>
                <FormLabel>Target Paper GSM</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g., 300"
                    {...field}
                    value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                    onChange={e => {
                      const numValue = parseFloat(e.target.value);
                      field.onChange(isNaN(numValue) ? undefined : numValue);
                    }}
                    className="font-body"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField
              control={form.control}
              name="paperQuality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Paper Quality</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="font-body">
                        <SelectValue placeholder="Select paper quality" />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 1000"
                      {...field}
                       value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => {
                        const numValue = parseFloat(e.target.value);
                        field.onChange(isNaN(numValue) ? undefined : numValue);
                      }}
                      className="font-body"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="grossQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gross Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 1100"
                      {...field}
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => {
                        const numValue = parseFloat(e.target.value);
                        field.onChange(isNaN(numValue) ? undefined : numValue);
                      }}
                      className="font-body"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
             <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <FormField control={form.control} name="jobSizeWidth" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Job Size Width (in)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 8.5"
                            {...field}
                            value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                            onChange={e => {
                              const numValue = parseFloat(e.target.value);
                              field.onChange(isNaN(numValue) ? undefined : numValue);
                            }}
                            className="font-body"
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="jobSizeHeight" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Job Size Height (in)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 11"
                            {...field}
                            value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                            onChange={e => {
                              const numValue = parseFloat(e.target.value);
                              field.onChange(isNaN(numValue) ? undefined : numValue);
                            }}
                            className="font-body"
                          />
                        </FormControl>
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
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="From optimizer"
                        {...field}
                        readOnly
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        onChange={e => {
                          const numValue = parseFloat(e.target.value);
                          field.onChange(isNaN(numValue) ? undefined : numValue);
                        }}
                        className="font-body bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="masterSheetSizeHeight" render={({ field }) => (
                <FormItem>
                    <FormLabel>Selected Master Height (in)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="From optimizer"
                        {...field}
                        readOnly
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        onChange={e => {
                          const numValue = parseFloat(e.target.value);
                          field.onChange(isNaN(numValue) ? undefined : numValue);
                        }}
                        className="font-body bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="wastagePercentage" render={({ field }) => (
                <FormItem>
                    <FormLabel>Wastage (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Calculated"
                        {...field}
                        readOnly
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        onChange={e => {
                          const numValue = parseFloat(e.target.value);
                          field.onChange(isNaN(numValue) ? undefined : numValue);
                        }}
                        className="font-body bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="selectedMasterSheetGsm" render={({ field }) => (
                <FormItem>
                    <FormLabel>Selected Master GSM</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="From optimizer"
                        {...field}
                        readOnly
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                        className="font-body bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
             <FormField control={form.control} name="selectedMasterSheetQuality" render={({ field }) => (
                <FormItem>
                    <FormLabel>Selected Master Quality</FormLabel>
                    <FormControl>
                       <Input
                        placeholder="From optimizer"
                        value={field.value ? getPaperQualityLabel(field.value) : ""}
                        readOnly
                        className="font-body bg-muted"
                      />
                    </FormControl>
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
            <CardTitle className="font-headline">Process Specifications</CardTitle>
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
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="font-body">
                          <SelectValue placeholder={`Select ${item.label.toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
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
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal font-body", !field.value && "text-muted-foreground")}>
                        {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
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
          <Button type="button" variant="outline" onClick={() => { form.reset(); setSelectedTemplate(''); }} disabled={isSubmitting} className="font-body">
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

    