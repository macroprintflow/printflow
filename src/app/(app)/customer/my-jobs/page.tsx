
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getJobCards } from "@/lib/actions/jobActions";
import { getUserDataById } from "@/lib/actions/userActions";
import { getCustomerById } from "@/lib/actions/customerActions";
import type { JobCardData, UserData, CustomerData } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ShoppingBag, Search, RefreshCw, ExternalLink, ArrowUpDown, XCircle, Eye, Briefcase, History } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { CustomerJobDetailModal } from "@/components/customer/CustomerJobDetailModal";

type SortKey = "jobName" | "date" | "status";
type SortDirection = "asc" | "desc";

interface CurrentUserDetails extends UserData {
  linkedCustomerName?: string;
}

export default function MyJobsPage() {
  const { user, loading: authLoading } = useAuth();
  const [allJobs, setAllJobs] = useState<JobCardData[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [currentUserDetails, setCurrentUserDetails] = useState<CurrentUserDetails | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { toast } = useToast();

  const [selectedJobForDetail, setSelectedJobForDetail] = useState<JobCardData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user?.uid) {
        setIsLoadingJobs(false);
        setIsLoadingUserData(false);
        setCurrentUserDetails(null);
        setAllJobs([]);
        return;
      }

      setIsLoadingJobs(true);
      setIsLoadingUserData(true);

      try {
        // Fetch all jobs
        const jobs = await getJobCards();
        setAllJobs(jobs);
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
        toast({ title: "Error", description: "Could not load jobs.", variant: "destructive" });
      } finally {
        setIsLoadingJobs(false);
      }

      // Fetch UserData and potentially linked CustomerData
      try {
        const uData = await getUserDataById(user.uid);
        if (uData) {
          if (uData.linkedCustomerId) {
            const customer = await getCustomerById(uData.linkedCustomerId);
            setCurrentUserDetails({ ...uData, linkedCustomerName: customer?.fullName });
          } else {
            setCurrentUserDetails(uData);
          }
        } else {
          setCurrentUserDetails(null);
        }
      } catch (error) {
        console.error("Failed to fetch user details:", error);
        toast({ title: "Error", description: "Could not load your user profile details.", variant: "destructive" });
      } finally {
        setIsLoadingUserData(false);
      }
    };

    if (!authLoading) {
      fetchInitialData();
    }
  }, [authLoading, user?.uid, toast]);

  const customerDisplayNameForHeader = useMemo(() => {
    if (!user) return "Guest";
    if (currentUserDetails?.linkedCustomerName) {
      return `${currentUserDetails.linkedCustomerName} (via ${user.email})`;
    }
    return user.displayName || user.email || "User";
  }, [user, currentUserDetails]);

  const processJobsForTab = (jobsToProcess: JobCardData[], active: boolean) => {
    let jobs = jobsToProcess.filter(job => {
        const isActiveStatus = job.status !== "Completed" && job.status !== "Billed";
        return active ? isActiveStatus : !isActiveStatus;
    });

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
  };

  const jobsForCurrentCustomer = useMemo(() => {
    if (!user) return [];
    if (isLoadingJobs || isLoadingUserData) return []; // Wait for data

    if (currentUserDetails?.linkedCustomerId) {
      return allJobs.filter(job => job.customerId === currentUserDetails.linkedCustomerId);
    } else if (user) {
      // Fallback: name matching (original logic for non-linked users or if UserData fetch fails)
      const fallbackIdentifier = (
        user.displayName && user.displayName !== user.email?.split('@')[0]
          ? user.displayName
          : user.email
      )?.toLowerCase();
      
      if (fallbackIdentifier) {
        return allJobs.filter(job => job.customerName?.toLowerCase() === fallbackIdentifier);
      }
    }
    return []; // Default to empty if no identification method works
  }, [allJobs, user, currentUserDetails, isLoadingJobs, isLoadingUserData]);


  const activeJobs = useMemo(() => processJobsForTab(jobsForCurrentCustomer, true), [jobsForCurrentCustomer, searchQuery, sortKey, sortDirection]);
  const pastJobs = useMemo(() => processJobsForTab(jobsForCurrentCustomer, false), [jobsForCurrentCustomer, searchQuery, sortKey, sortDirection]);


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

  const openJobDetailModal = (job: JobCardData) => {
    setSelectedJobForDetail(job);
    setIsDetailModalOpen(true);
  };

  if (authLoading || isLoadingJobs || isLoadingUserData) {
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
  
  const renderJobsTable = (jobsToList: JobCardData[], tableTitle: string) => {
    return (
        <>
         {jobsToList.length === 0 && !searchQuery ? (
            <div className="text-center py-12">
                <Image src={`https://placehold.co/300x200.png?text=No+${tableTitle.replace(/\s/g, '+')}`} alt={`No ${tableTitle}`} width={300} height={200} className="mb-6 rounded-lg mx-auto" data-ai-hint="empty state document"/>
                <h3 className="text-xl font-semibold mb-2 font-headline">No {tableTitle} Found</h3>
                <p className="text-muted-foreground font-body">
                    You currently don't have any {tableTitle.toLowerCase()}.
                </p>
            </div>
         ) : jobsToList.length === 0 && searchQuery ? (
            <div className="text-center py-12">
                 <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2 font-headline">No Results for "{searchQuery}"</h3>
                <p className="text-muted-foreground font-body">
                    Try adjusting your search terms for {tableTitle.toLowerCase()}.
                </p>
            </div>
         ) : (
            <ScrollArea className="h-[400px] border rounded-md">
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
                {jobsToList.map((job) => (
                    <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.jobCardNumber || job.id}</TableCell>
                    <TableCell className="font-medium">{job.jobName}</TableCell>
                    <TableCell className="text-xs">{format(new Date(job.createdAt || job.date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                        <Badge variant={job.status === "Completed" || job.status === "Billed" ? "secondary" : "default"}>{job.status || "N/A"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{job.dispatchDate ? format(new Date(job.dispatchDate), "dd MMM yyyy") : "N/A"}</TableCell>
                    <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => openJobDetailModal(job)}>
                            <Eye className="mr-1 h-3 w-3" /> Details
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/jobs/new?fromCustomerJobId=${job.id}`}>
                            <RefreshCw className="mr-1 h-3 w-3" /> Re-order
                          </Link>
                        </Button>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </ScrollArea>
         )}
        </>
    );
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <ShoppingBag className="mr-3 h-7 w-7 text-primary" /> My Jobs Portal
          </CardTitle>
          <CardDescription className="font-body">
            View the status of your jobs and re-order past ones. (Logged in as: {customerDisplayNameForHeader})
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

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active" className="font-body flex items-center gap-2"><Briefcase className="h-4 w-4"/>Active Jobs</TabsTrigger>
              <TabsTrigger value="past" className="font-body flex items-center gap-2"><History className="h-4 w-4"/>Past Jobs</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {renderJobsTable(activeJobs, "Active Jobs")}
            </TabsContent>
            <TabsContent value="past">
              {renderJobsTable(pastJobs, "Past Jobs")}
            </TabsContent>
          </Tabs>

        </CardContent>
      </Card>

      {selectedJobForDetail && (
        <CustomerJobDetailModal
          job={selectedJobForDetail}
          isOpen={isDetailModalOpen}
          setIsOpen={setIsDetailModalOpen}
        />
      )}
    </div>
  );
}
