
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getJobCards } from "@/lib/actions/jobActions";
import type { JobCardData } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShoppingBag, Search, RefreshCw, ExternalLink, ArrowUpDown, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

type SortKey = "jobName" | "date" | "status";
type SortDirection = "asc" | "desc";

export default function MyJobsPage() {
  const { user, loading: authLoading } = useAuth();
  const [allJobs, setAllJobs] = useState<JobCardData[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { toast } = useToast();

  const customerIdentifier = useMemo(() => {
    if (!user) return null;
    // Prioritize displayName, fallback to email if displayName is generic or unset
    if (user.displayName && user.displayName !== user.email?.split('@')[0]) {
      return user.displayName;
    }
    return user.email; // Could refine this to extract a name part if needed
  }, [user]);

  const fetchJobs = async () => {
    if (!customerIdentifier) {
      setIsLoadingJobs(false);
      return;
    }
    setIsLoadingJobs(true);
    try {
      const jobs = await getJobCards();
      const customerJobs = jobs.filter(
        (job) => job.customerName?.toLowerCase() === customerIdentifier.toLowerCase() &&
                 job.status !== "Completed" && job.status !== "Billed" // Show active jobs
      );
      setAllJobs(customerJobs);
    } catch (error) {
      console.error("Failed to fetch customer jobs:", error);
      toast({
        title: "Error",
        description: "Could not load your jobs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingJobs(false);
    }
  };
  
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, customerIdentifier]);


  const filteredAndSortedJobs = useMemo(() => {
    let jobs = [...allJobs];
    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      jobs = jobs.filter(
        (job) =>
          job.jobName.toLowerCase().includes(lowerQuery) ||
          (job.jobCardNumber && job.jobCardNumber.toLowerCase().includes(lowerQuery)) ||
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
      setSortDirection("asc"); // Default to ascending when changing sort key
    }
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey === key) {
      return sortDirection === "asc" ? " (Asc)" : " (Desc)";
    }
    return "";
  };

  if (authLoading || isLoadingJobs) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 font-body">Loading your jobs...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-body">Please log in to view your jobs.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <ShoppingBag className="mr-3 h-7 w-7 text-primary" /> My Active Jobs
          </CardTitle>
          <CardDescription className="font-body">
            View the status of your ongoing jobs and re-order past ones. (Logged in as: {customerIdentifier})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="relative w-full sm:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Job Name, No, Status..."
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
              <Button variant="outline" onClick={() => handleSort("jobName")} className="font-body h-11">
                <ArrowUpDown className="mr-2 h-4 w-4" /> Name{getSortIndicator("jobName")}
              </Button>
              <Button variant="outline" onClick={() => handleSort("date")} className="font-body h-11">
                <ArrowUpDown className="mr-2 h-4 w-4" /> Date{getSortIndicator("date")}
              </Button>
               <Button variant="outline" onClick={() => handleSort("status")} className="font-body h-11">
                <ArrowUpDown className="mr-2 h-4 w-4" /> Status{getSortIndicator("status")}
              </Button>
            </div>
          </div>

          {filteredAndSortedJobs.length === 0 ? (
            <div className="text-center py-12">
              <Image src="https://placehold.co/300x200.png?text=No+Active+Jobs" alt="No active jobs" width={300} height={200} className="mb-6 rounded-lg mx-auto" data-ai-hint="empty state illustration" />
              <h3 className="text-xl font-semibold mb-2 font-headline">No Active Jobs Found</h3>
              <p className="text-muted-foreground font-body">
                You currently don't have any active jobs, or your search returned no results.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-headline">Job No.</TableHead>
                    <TableHead className="font-headline">Job Name</TableHead>
                    <TableHead className="font-headline">Date</TableHead>
                    <TableHead className="font-headline">Status</TableHead>
                    <TableHead className="font-headline">Dispatch Date</TableHead>
                    <TableHead className="font-headline text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">{job.jobCardNumber || job.id}</TableCell>
                      <TableCell className="font-medium">{job.jobName}</TableCell>
                      <TableCell className="text-xs">{format(new Date(job.createdAt || job.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{job.status || "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{job.dispatchDate ? format(new Date(job.dispatchDate), "dd MMM yyyy") : "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/jobs/new?fromCustomerJobId=${job.id}`}>
                            <RefreshCw className="mr-2 h-3 w-3" /> Re-order
                          </Link>
                        </Button>
                        {/* Future: Link to a customer-specific job detail view */}
                        {/* <Button variant="ghost" size="sm" asChild className="ml-2">
                          <Link href={`/customer/jobs/${job.id}`}><ExternalLink className="mr-2 h-3 w-3"/> Details</Link>
                        </Button> */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
