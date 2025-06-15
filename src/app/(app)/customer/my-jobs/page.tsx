
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getJobCards } from "@/lib/actions/jobActions";
import { getUserDataById } from "@/lib/actions/userActions";
import { getCustomerById } from "@/lib/actions/customerActions";
import type { JobCardData, UserData as MockUserData, CustomerData } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ShoppingBag, Search, RefreshCw, Eye, Briefcase, History, XCircle, ChevronDown, LinkIcon as LinkIconLucide } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { CustomerJobDetailModal } from "@/components/customer/CustomerJobDetailModal";

type SortKey = "jobName" | "date" | "status";
type SortDirection = "asc" | "desc";

interface CurrentUserDetails extends MockUserData {
  linkedCustomerName?: string;
}

interface DisplayableJobItem {
  id: string; // Use main job's ID as the key
  isGroup: boolean;
  mainJob: JobCardData;
  componentJobs?: JobCardData[];
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
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

  const fetchInitialData = useCallback(async () => {
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
      const jobs = await getJobCards();
      setAllJobs(jobs);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      toast({ title: "Error", description: "Could not load jobs.", variant: "destructive" });
    } finally {
      setIsLoadingJobs(false);
    }

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
  }, [user?.uid, toast]);


  useEffect(() => {
    if (!authLoading) {
      fetchInitialData();
    }
  }, [authLoading, fetchInitialData]);


  const customerDisplayNameForHeader = useMemo(() => {
    if (!user) return "Guest";
    if (currentUserDetails?.linkedCustomerName) {
      return `${currentUserDetails.linkedCustomerName} (via ${user.email})`;
    }
    return user.displayName || user.email || "User";
  }, [user, currentUserDetails]);

  const jobsForCurrentCustomer = useMemo(() => {
    if (!user) return [];
    if (isLoadingJobs || isLoadingUserData) return [];

    if (currentUserDetails?.linkedCustomerId) {
      return allJobs.filter(job => job.customerId === currentUserDetails.linkedCustomerId);
    } else if (user) {
      const fallbackIdentifier = (
        currentUserDetails?.displayName ||
        user.displayName ||
        user.email
      )?.toLowerCase();

      if (fallbackIdentifier) {
        return allJobs.filter(job => job.customerName?.toLowerCase() === fallbackIdentifier);
      }
    }
    return [];
  }, [allJobs, user, currentUserDetails, isLoadingJobs, isLoadingUserData]);


  const processAndGroupJobs = useCallback((jobsToProcess: JobCardData[], active: boolean): DisplayableJobItem[] => {
    let filteredCustomerJobs = jobsToProcess.filter(job => {
      const isActiveStatus = job.status !== "Completed" && job.status !== "Billed";
      return active ? isActiveStatus : !isActiveStatus;
    });

    const componentJobIds = new Set<string>();
    filteredCustomerJobs.forEach(job => {
      job.linkedJobCardIds?.forEach(id => componentJobIds.add(id));
    });

    const displayableItems: DisplayableJobItem[] = [];

    filteredCustomerJobs.forEach(job => {
      if (componentJobIds.has(job.id!)) {
        // This job is a component of another, so it will be handled when processing its parent.
        return;
      }

      let mainJob = job;
      let componentJobs: JobCardData[] = [];

      if (mainJob.linkedJobCardIds && mainJob.linkedJobCardIds.length > 0) {
        componentJobs = mainJob.linkedJobCardIds
          .map(linkedId => allJobs.find(j => j.id === linkedId))
          .filter((j): j is JobCardData => j !== undefined);
      }

      const isGroup = componentJobs.length > 0;

      // Apply search query
      if (searchQuery.trim() !== "") {
        const lowerQuery = searchQuery.toLowerCase();
        const mainJobMatches = mainJob.jobName.toLowerCase().includes(lowerQuery) ||
          (mainJob.jobCardNumber && mainJob.jobCardNumber.toLowerCase().includes(lowerQuery)) ||
          (mainJob.status && mainJob.status.toLowerCase().includes(lowerQuery));

        if (!mainJobMatches && isGroup) {
          const componentMatches = componentJobs.some(comp =>
            comp.jobName.toLowerCase().includes(lowerQuery) ||
            (comp.jobCardNumber && comp.jobCardNumber.toLowerCase().includes(lowerQuery))
          );
          if (!componentMatches) return; // Skip if neither main nor any component matches
        } else if (!mainJobMatches && !isGroup) {
          return; // Skip if single job doesn't match
        }
      }

      displayableItems.push({
        id: mainJob.id!,
        isGroup: isGroup,
        mainJob: mainJob,
        componentJobs: componentJobs,
      });
    });

    // Sort displayableItems based on the mainJob
    displayableItems.sort((a, b) => {
      let valA: string | number | Date | undefined;
      let valB: string | number | Date | undefined;

      if (sortKey === "date") {
        valA = new Date(a.mainJob.createdAt || a.mainJob.date);
        valB = new Date(b.mainJob.createdAt || b.mainJob.date);
      } else {
        const rawValA = a.mainJob[sortKey as keyof JobCardData];
        valA = (typeof rawValA === "string" || typeof rawValA === "number" || rawValA instanceof Date)
          ? rawValA
          : undefined;
        const rawValB = b.mainJob[sortKey as keyof JobCardData];
        valB = (typeof rawValB === "string" || typeof rawValB === "number" || rawValB instanceof Date)
          ? rawValB
          : undefined;
      }

      if (valA instanceof Date && valB instanceof Date) {
        return sortDirection === "asc" ? valA.getTime() - valB.getTime() : valB.getTime() - valA.getTime();
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });

    return displayableItems;
  }, [allJobs, searchQuery, sortKey, sortDirection]);

  const activeJobs = useMemo(() => processAndGroupJobs(jobsForCurrentCustomer, true), [jobsForCurrentCustomer, processAndGroupJobs]);
  const pastJobs = useMemo(() => processAndGroupJobs(jobsForCurrentCustomer, false), [jobsForCurrentCustomer, processAndGroupJobs]);


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
        <CardHeader><CardTitle className="font-headline">Access Denied</CardTitle></CardHeader>
        <CardContent><p className="font-body">Please log in to view your jobs.</p></CardContent>
      </Card>
    );
  }

  const renderJobRow = (job: JobCardData, isComponentJob: boolean = false) => (
    <TableRow key={job.id} className={isComponentJob ? "bg-muted/30 hover:bg-muted/50" : ""}>
      <TableCell className={`font-mono text-xs ${isComponentJob ? 'pl-8' : ''}`}>{job.jobCardNumber || job.id}</TableCell>
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
        {!isComponentJob && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/new?fromCustomerJobId=${job.id}`}>
              <RefreshCw className="mr-1 h-3 w-3" /> Re-order
            </Link>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );

  const renderJobsDisplay = (items: DisplayableJobItem[], tableTitle: string) => {
    if (items.length === 0 && !searchQuery) {
      return (
        <div className="text-center py-12">
          <Image src={`https://placehold.co/300x200.png?text=No+${tableTitle.replace(/\s/g, '+')}`} alt={`No ${tableTitle}`} width={300} height={200} className="mb-6 rounded-lg mx-auto" data-ai-hint="empty state document" />
          <h3 className="text-xl font-semibold mb-2 font-headline">No {tableTitle} Found</h3>
          <p className="text-muted-foreground font-body">You currently don't have any {tableTitle.toLowerCase()}.</p>
        </div>
      );
    }
    if (items.length === 0 && searchQuery) {
      return (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2 font-headline">No Results for "{searchQuery}"</h3>
          <p className="text-muted-foreground font-body">Try adjusting your search terms for {tableTitle.toLowerCase()}.</p>
        </div>
      );
    }

    return (
      <Accordion
        type="multiple"
        value={openAccordionItems}
        onValueChange={setOpenAccordionItems}
        className="w-full"
      >
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
        </Table>
        {items.map(item => {
          if (!item.isGroup || !item.componentJobs || item.componentJobs.length === 0) {
            return (
              <Table key={item.id} className="border-b"> {/* Single item in its own table for border consistency */}
                <TableBody>{renderJobRow(item.mainJob)}</TableBody>
              </Table>
            );
          }
          return (
            <AccordionItem value={item.id} key={item.id} className="border-b">
              <Table><TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <AccordionTrigger className="w-full hover:no-underline px-4 py-3">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <LinkIconLucide className="h-4 w-4 mr-2 text-primary" />
                          <span className="font-medium">{item.mainJob.jobName}</span>
                          <span className="text-xs text-muted-foreground ml-2">({item.mainJob.jobCardNumber || item.mainJob.id}) - Click to expand</span>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </AccordionTrigger>
                  </TableCell>
                  <TableCell className="text-right space-x-1 p-0 pr-4">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openJobDetailModal(item.mainJob); }}>
                      <Eye className="mr-1 h-3 w-3" /> Main Details
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/jobs/new?fromCustomerJobId=${item.mainJob.id}`}>
                        <RefreshCw className="mr-1 h-3 w-3" /> Re-order Group
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody></Table>
              <AccordionContent className="p-0">
                <div className="pl-4 pr-2 py-2 bg-muted/20">
                  <Table>
                    <TableHeader className="sr-only">
                      <TableRow><TableHead>Comp. Job No.</TableHead><TableHead>Comp. Job Name</TableHead><TableHead>Comp. Date</TableHead><TableHead>Comp. Status</TableHead><TableHead>Comp. Dispatch</TableHead><TableHead>Comp. Actions</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.componentJobs.map(compJob => renderJobRow(compJob, true))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl"><ShoppingBag className="mr-3 h-7 w-7 text-primary" /> My Jobs Portal</CardTitle>
          <CardDescription className="font-body">Viewing for: {customerDisplayNameForHeader}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="relative w-full sm:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by Job Name, No, Status..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 w-full font-body h-11" />
              {searchQuery && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery("")} aria-label="Clear search"><XCircle className="h-4 w-4 text-muted-foreground" /></Button>}
            </div>
            <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => handleSort("jobName")} className="font-body h-11">Name{getSortIndicator("jobName")}</Button>
              <Button variant="outline" onClick={() => handleSort("date")} className="font-body h-11">Date{getSortIndicator("date")}</Button>
              <Button variant="outline" onClick={() => handleSort("status")} className="font-body h-11">Status{getSortIndicator("status")}</Button>
            </div>
          </div>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active" className="font-body flex items-center gap-2"><Briefcase className="h-4 w-4" />Active Jobs</TabsTrigger>
              <TabsTrigger value="past" className="font-body flex items-center gap-2"><History className="h-4 w-4" />Past Jobs</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {renderJobsDisplay(activeJobs, "Active Jobs")}
            </TabsContent>
            <TabsContent value="past">
              {renderJobsDisplay(pastJobs, "Past Jobs")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {selectedJobForDetail && <CustomerJobDetailModal job={selectedJobForDetail} isOpen={isDetailModalOpen} setIsOpen={setIsDetailModalOpen} />}
    </div>
  );
}
