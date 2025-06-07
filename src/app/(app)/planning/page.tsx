
"use client";

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import {
  FileCheck2,
  Scissors,
  Printer,
  Palette, // Changed from Wand2
  Film,
  Focus, // Changed from Crop
  Sparkles,
  Layers, // Changed from ClipboardPaste
  Box,
  Package,
  FileSpreadsheet,
  Workflow,
  Brain,
  Loader2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from 'react';
import { getJobCards } from '@/lib/actions/jobActions';
import { suggestProductionPlan, type ProductionPlanningInput, type ProductionPlanningOutput } from '@/ai/flows/production-planning-flow';
import type { JobCardData } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

interface ProcessStep {
  name: string;
  slug: string;
  icon: LucideIcon;
  jobCount: number; 
  description: string;
  capacityPerDay?: number; 
  currentQueueJobIds?: string[]; 
}

const initialProductionSteps: ProcessStep[] = [
  { name: "Job Approval", slug: "job-approval", icon: FileCheck2, jobCount: 0, description: "Jobs awaiting client or internal approval.", capacityPerDay: 10, currentQueueJobIds: [] },
  { name: "Cutter", slug: "cutter", icon: Scissors, jobCount: 0, description: "Paper cutting and preparation.", capacityPerDay: 20, currentQueueJobIds: [] },
  { name: "Printing", slug: "printing", icon: Printer, jobCount: 0, description: "Offset and digital printing jobs.", capacityPerDay: 15, currentQueueJobIds: [] },
  { name: "Texture UV", slug: "texture-uv", icon: Palette, jobCount: 0, description: "Applying texture UV finishes.", capacityPerDay: 8, currentQueueJobIds: [] },
  { name: "Lamination", slug: "lamination", icon: Film, jobCount: 0, description: "Applying lamination films.", capacityPerDay: 10, currentQueueJobIds: [] },
  { name: "Die Cutting", slug: "die-cutting", icon: Focus, jobCount: 0, description: "Cutting and creasing sheets to shape.", capacityPerDay: 25, currentQueueJobIds: [] },
  { name: "Foil Stamping", slug: "foil-stamping", icon: Sparkles, jobCount: 0, description: "Applying metallic foils.", capacityPerDay: 5, currentQueueJobIds: [] },
  { name: "Pasting", slug: "pasting", icon: Layers, jobCount: 0, description: "Folder-gluer and manual pasting.", capacityPerDay: 12, currentQueueJobIds: [] },
  { name: "Box Making & Assembly", slug: "box-making-assembly", icon: Box, jobCount: 0, description: "Rigid box and other assembly.", capacityPerDay: 10, currentQueueJobIds: [] },
  { name: "Packing", slug: "packing", icon: Package, jobCount: 0, description: "Final packing of finished goods.", capacityPerDay: 30, currentQueueJobIds: [] },
  { name: "To be Billed", slug: "to-be-billed", icon: FileSpreadsheet, jobCount: 0, description: "Jobs completed and awaiting invoicing.", capacityPerDay: 50, currentQueueJobIds: [] },
];

export default function PlanningPage() {
  const [productionSteps, setProductionSteps] = useState<ProcessStep[]>(initialProductionSteps);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ProductionPlanningOutput | null>(null);
  const { toast } = useToast();

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setAiSuggestions(null);
    // Reset job counts on initial steps before fetching new plan
    setProductionSteps(initialProductionSteps.map(step => ({ ...step, jobCount: 0 })));

    try {
      const allJobs = await getJobCards();
      
      const jobsToPlan: JobCardData[] = allJobs.filter(job =>
        job.status !== 'Completed' && job.status !== 'To be Billed' && job.status !== 'Billed'
      );

      if (jobsToPlan.length === 0) {
        toast({
          title: "No Jobs to Plan",
          description: "There are no active jobs currently requiring production planning.",
        });
        setIsLoading(false);
        return;
      }

      const planningJobsInput = jobsToPlan.map(job => ({
        id: job.id!,
        jobName: job.jobName,
        jobCardNumber: job.jobCardNumber || `JC-${job.id}`,
        date: job.createdAt || job.date, 
        customerName: job.customerName,
        netQuantity: job.netQuantity,
        dispatchDate: job.dispatchDate,
        currentDepartment: job.currentDepartment, 
        status: job.status || 'Pending Planning',
        linkedJobCardIds: job.linkedJobCardIds || [],
      }));

      const departmentStatusInput = productionSteps.map(step => ({
        departmentName: step.name,
        currentQueueJobIds: step.currentQueueJobIds || [],
        capacityPerDay: step.capacityPerDay || 10, 
      }));

      const planningInput: ProductionPlanningInput = {
        jobsToPlan: planningJobsInput,
        departmentStatus: departmentStatusInput,
        planningHorizonDays: 2, 
        planningDate: new Date().toISOString().split('T')[0],
      };

      const suggestions = await suggestProductionPlan(planningInput);
      setAiSuggestions(suggestions);

      // Update job counts based on all assignments in the suggestion, not just for planningInput.planningDate
      const updatedSteps = initialProductionSteps.map(step => {
        const count = suggestions.suggestedAssignments.filter(
          sa => sa.assignedDepartment === step.name
        ).length;
        return { ...step, jobCount: count };
      });
      setProductionSteps(updatedSteps);


      toast({
        title: "AI Plan Generated",
        description: suggestions.planningSummary || "Review the suggested assignments below.",
      });

    } catch (error) {
      console.error("Error generating production plan:", error);
      toast({
        title: "Error",
        description: "Failed to generate production plan. " + (error instanceof Error ? error.message : "Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-2xl">
            <Workflow className="mr-3 h-8 w-8 text-primary" /> Production Pipeline Overview
          </CardTitle>
          <CardDescription className="font-body">
            Track jobs across production stages. Generate an AI-powered plan or click a stage to view details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {productionSteps.map((step) => (
              <Link key={step.slug} href={`/planning/${step.slug}`} passHref>
                <Card
                  className="hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer bg-card/70 hover:bg-card/90 border-border/50 hover:border-primary/50 h-full flex flex-col"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-headline flex items-start gap-3">
                      <step.icon className="h-7 w-7 text-primary flex-shrink-0 mt-0.5" />
                      <span>{step.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex-grow flex flex-col justify-between">
                    <div>
                      <div className="text-4xl font-bold font-headline text-foreground">
                        {step.jobCount}
                      </div>
                      <p className="text-sm text-muted-foreground font-body">
                        Active Jobs
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-body mt-2">{step.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
            <Button onClick={handleGeneratePlan} disabled={isLoading} size="lg" className="w-full md:w-auto">
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Brain className="mr-2 h-5 w-5" />}
              {isLoading ? "Generating Plan..." : "Generate Production Plan with AI"}
            </Button>
        </CardFooter>
      </Card>

      {aiSuggestions && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">AI Suggested Production Plan</CardTitle>
            {aiSuggestions.planningSummary && (
              <CardDescription className="font-body">{aiSuggestions.planningSummary}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {aiSuggestions.suggestedAssignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-headline">Job ID / Number</TableHead>
                    <TableHead className="font-headline">Assigned Department</TableHead>
                    <TableHead className="font-headline">Target Date</TableHead>
                    <TableHead className="font-headline text-center">Priority</TableHead>
                    <TableHead className="font-headline">Reasoning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiSuggestions.suggestedAssignments.map((assignment, index) => (
                    <TableRow key={assignment.jobId + index}>
                      <TableCell className="font-mono text-xs font-body">
                        {assignment.jobCardNumber || assignment.jobId}
                      </TableCell>
                      <TableCell className="font-body">
                        <Badge variant="secondary">{assignment.assignedDepartment}</Badge>
                      </TableCell>
                      <TableCell className="font-body">{new Date(assignment.targetDate + 'T00:00:00').toLocaleDateString()}</TableCell>
                      <TableCell className="font-body text-center">{assignment.priority}</TableCell>
                      <TableCell className="font-body text-xs">{assignment.reasoning}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground font-body">No specific job assignments were suggested by the AI for the current set of jobs and parameters.</p>
            )}
          </CardContent>
           <CardFooter className="border-t pt-4">
            <p className="text-xs text-muted-foreground font-body">
              Note: This is an AI-generated suggestion. Review and adjust as needed before finalizing. Finalizing and forwarding actions are not yet implemented.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
