
"use client";

import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Link2 as LinkIcon, XCircle } from "lucide-react";
import type { JobCardData } from "@/lib/definitions";
import { getJobCards } from "@/lib/actions/jobActions";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface LinkJobsModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  currentLinkedJobIds: string[];
  onConfirmLinks: (selectedJobIds: string[]) => void;
}

export function LinkJobsModal({
  isOpen,
  setIsOpen,
  currentLinkedJobIds,
  onConfirmLinks,
}: LinkJobsModalProps) {
  const [allJobs, setAllJobs] = useState<JobCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set(currentLinkedJobIds));
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const fetchJobs = async () => {
        setIsLoading(true);
        try {
          const jobs = await getJobCards();
          // Sort by creation date, newest first
          jobs.sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
          setAllJobs(jobs);
          setSelectedJobIds(new Set(currentLinkedJobIds)); // Reset selection based on prop
        } catch (error) {
          console.error("Failed to fetch job cards for linking:", error);
          toast({
            title: "Error",
            description: "Could not load job cards for linking.",
            variant: "destructive",
          });
          setAllJobs([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchJobs();
    }
  }, [isOpen, currentLinkedJobIds, toast]);

  const filteredJobs = useMemo(() => {
    if (searchQuery.trim() === "") {
      return allJobs;
    }
    const lowerQuery = searchQuery.toLowerCase();
    return allJobs.filter(
      (job) =>
        job.jobName.toLowerCase().includes(lowerQuery) ||
        (job.jobCardNumber && job.jobCardNumber.toLowerCase().includes(lowerQuery)) ||
        job.customerName.toLowerCase().includes(lowerQuery)
    );
  }, [allJobs, searchQuery]);

  const handleSelectJob = (jobId: string) => {
    setSelectedJobIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(jobId)) {
        newSelected.delete(jobId);
      } else {
        newSelected.add(jobId);
      }
      return newSelected;
    });
  };

  const handleConfirm = () => {
    onConfirmLinks(Array.from(selectedJobIds));
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl font-body h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center text-xl">
            <LinkIcon className="mr-2 h-5 w-5 text-primary" /> Link Job Cards
          </DialogTitle>
          <DialogDescription>
            Select existing job cards to link with the current job. This is useful for components of a larger project.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-4 px-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Job No, Name, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full font-body h-11"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        <ScrollArea className="flex-grow border rounded-md">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground font-body">Loading jobs...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground font-body">
                {searchQuery ? "No jobs match your search." : "No job cards found."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 font-headline"></TableHead>
                  <TableHead className="font-headline">Job No.</TableHead>
                  <TableHead className="font-headline">Job Name</TableHead>
                  <TableHead className="font-headline">Customer</TableHead>
                  <TableHead className="font-headline">Date</TableHead>
                  <TableHead className="font-headline">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow
                    key={job.id}
                    onClick={() => job.id && handleSelectJob(job.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={job.id ? selectedJobIds.has(job.id) : false}
                        onCheckedChange={() => job.id && handleSelectJob(job.id)}
                        aria-label={`Select job ${job.jobCardNumber || job.jobName}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-body">{job.jobCardNumber || job.id}</TableCell>
                    <TableCell className="font-medium font-body">{job.jobName}</TableCell>
                    <TableCell className="font-body">{job.customerName}</TableCell>
                    <TableCell className="text-xs font-body">
                      {format(new Date(job.createdAt || job.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.status === "Completed" || job.status === "Billed" ? "secondary" : "default"} className="font-body">
                        {job.status || "N/A"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="font-body">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="font-body">
            <LinkIcon className="mr-2 h-4 w-4" /> Confirm Links ({selectedJobIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
