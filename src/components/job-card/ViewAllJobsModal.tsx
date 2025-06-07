
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ArrowUpDown, XCircle, Printer, FileText } from "lucide-react";
import type { JobCardData } from "@/lib/definitions";
import { getJobCards } from "@/lib/actions/jobActions";
import { handlePrintJobCard } from "@/lib/printUtils"; // Import print utility
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ViewAllJobsModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onJobSelect?: (jobId: string) => void; 
}

type SortKey = "jobCardNumber" | "jobName" | "date";
type SortDirection = "asc" | "desc";

export function ViewAllJobsModal({ isOpen, setIsOpen, onJobSelect }: ViewAllJobsModalProps) {
  const [allJobs, setAllJobs] = useState<JobCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const fetchJobs = async () => {
        setIsLoading(true);
        try {
          const jobs = await getJobCards();
          setAllJobs(jobs);
        } catch (error) {
          console.error("Failed to fetch job cards:", error);
          toast({
            title: "Error",
            description: "Could not load job cards.",
            variant: "destructive",
          });
          setAllJobs([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchJobs();
    }
  }, [isOpen, toast]);

  const filteredAndSortedJobs = useMemo(() => {
    let jobs = [...allJobs];

    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      jobs = jobs.filter(
        (job) =>
          job.jobName.toLowerCase().includes(lowerQuery) ||
          (job.jobCardNumber && job.jobCardNumber.toLowerCase().includes(lowerQuery)) ||
          job.customerName.toLowerCase().includes(lowerQuery) ||
          (job.status && job.status.toLowerCase().includes(lowerQuery))
      );
    }

    jobs.sort((a, b) => {
      let valA: string | number | undefined;
      let valB: string | number | undefined;

      if (sortKey === "date") {
        valA = new Date(a.createdAt || a.date).getTime();
        valB = new Date(b.createdAt || b.date).getTime();
      } else {
        valA = a[sortKey as keyof JobCardData] || "";
        valB = b[sortKey as keyof JobCardData] || "";
      }
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
         return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });

    return jobs;
  }, [allJobs, searchQuery, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey === key) {
      return sortDirection === "asc" ? " (Asc)" : " (Desc)";
    }
    return "";
  };
  
  const handleDialogClose = (openState: boolean) => {
    setIsOpen(openState);
  };

  const onViewJobPdf = (pdfDataUri: string | undefined) => {
    if (pdfDataUri) {
      window.open(pdfDataUri, '_blank');
    } else {
      toast({
        title: "No PDF",
        description: "No PDF is associated with this job.",
        variant: "default",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl font-body h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">All Created Job Cards</DialogTitle>
          <DialogDescription>
            View, search, and sort through all job cards in the system.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-center gap-4 my-4 px-1">
          <div className="relative w-full sm:flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Job No, Name, Customer, Status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full font-body h-11"
            />
             {searchQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={() => handleSort("jobCardNumber")}
              className="font-body h-11"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" /> Sort by Job No{getSortIndicator("jobCardNumber")}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSort("jobName")}
              className="font-body h-11"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" /> Sort by Job Name{getSortIndicator("jobName")}
            </Button>
             <Button
              variant="outline"
              onClick={() => handleSort("date")}
              className="font-body h-11"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" /> Sort by Date{getSortIndicator("date")}
            </Button>
          </div>
        </div>
        
        <ScrollArea className="flex-grow border rounded-md">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading jobs...</p>
            </div>
          ) : filteredAndSortedJobs.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {searchQuery ? "No jobs match your search criteria." : "No job cards found."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-headline">Job No.</TableHead>
                  <TableHead className="font-headline">Job Name</TableHead>
                  <TableHead className="font-headline">Customer</TableHead>
                  <TableHead className="font-headline">Date & Time</TableHead>
                  <TableHead className="font-headline">Status</TableHead>
                  <TableHead className="font-headline text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.jobCardNumber}</TableCell>
                    <TableCell className="font-medium">{job.jobName}</TableCell>
                    <TableCell>{job.customerName}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(job.createdAt || job.date), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.status === "Completed" ? "secondary" : "default"}>
                        {job.status || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handlePrintJobCard(job, toast)}
                          title="Print Job Card Again"
                        >
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => onViewJobPdf(job.pdfDataUri)}
                          disabled={!job.pdfDataUri}
                          title={job.pdfDataUri ? "View Associated PDF" : "No PDF Associated"}
                        >
                            <FileText className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
