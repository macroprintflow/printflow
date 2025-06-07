
"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { JobCardData, WorkflowStep } from "@/lib/definitions";
import { PRODUCTION_PROCESS_STEPS } from "@/lib/definitions";
import { format } from "date-fns";
import { Briefcase, CalendarDays, ListOrdered, Activity, Info } from "lucide-react";

interface CustomerJobDetailModalProps {
  job: JobCardData | null;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export function CustomerJobDetailModal({ job, isOpen, setIsOpen }: CustomerJobDetailModalProps) {
  if (!job) return null;

  const getStepName = (slug: string) => {
    return PRODUCTION_PROCESS_STEPS.find(s => s.slug === slug)?.name || slug;
  };

  const sortedWorkflowSteps = job.workflowSteps 
    ? [...job.workflowSteps].sort((a, b) => a.order - b.order)
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl font-body">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center text-xl">
            <Briefcase className="mr-2 h-6 w-6 text-primary" />
            Job Details: {job.jobName}
          </DialogTitle>
          <DialogDescription>
            Viewing details for Job Card No: {job.jobCardNumber || job.id}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] p-1 pr-4">
          <div className="space-y-6 my-4">
            <section>
              <h3 className="font-semibold font-headline text-lg mb-2 flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-muted-foreground"/>Dates & Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><strong className="text-muted-foreground">Created:</strong> {format(new Date(job.createdAt || job.date), "dd MMM yyyy, HH:mm")}</div>
                <div><strong className="text-muted-foreground">Dispatch:</strong> {job.dispatchDate ? format(new Date(job.dispatchDate), "dd MMM yyyy") : "N/A"}</div>
                <div><strong className="text-muted-foreground">Current Status:</strong> <Badge variant={job.status === "Completed" || job.status === "Billed" ? "secondary" : "default"}>{job.status || "N/A"}</Badge></div>
                {job.currentDepartment && (
                   <div><strong className="text-muted-foreground">Current Department:</strong> {job.currentDepartment}</div>
                )}
              </div>
            </section>
            
            {sortedWorkflowSteps.length > 0 && (
              <section>
                <h3 className="font-semibold font-headline text-lg mb-2 flex items-center"><ListOrdered className="mr-2 h-5 w-5 text-muted-foreground"/>Production Workflow</h3>
                <ul className="space-y-2">
                  {sortedWorkflowSteps.map((step, index) => (
                    <li key={index} className="flex items-center text-sm p-2 rounded-md bg-muted/50">
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3">
                        {step.order}
                      </span>
                      <span>{getStepName(step.stepSlug)}</span>
                      {job.currentDepartment === getStepName(step.stepSlug) && (
                        <Badge variant="outline" className="ml-auto text-primary border-primary">
                          <Activity className="mr-1 h-3 w-3"/> Current Stage
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="font-semibold font-headline text-lg mb-2 flex items-center"><Info className="mr-2 h-5 w-5 text-muted-foreground"/>Additional Information</h3>
              <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
                <p>
                  Please note: The "Time in Department" tracking feature is currently under development and not yet available in this view.
                  You can see the current department and overall status. For more detailed progress, please contact support.
                </p>
              </div>
            </section>

          </div>
        </ScrollArea>

        <DialogFooter className="mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
