
"use client";

import { JobCardForm } from "@/components/job-card/JobCardForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, FilePlus2, FileCheck2, Sparkles, Eye, Loader2 } from "lucide-react"; 
import Link from "next/link";
import Image from "next/image";
import { getApprovedDesigns, getJobCardById } from "@/lib/actions/jobActions";
import type { DesignSubmission, JobCardData } from "@/lib/definitions";
import { useState, useEffect, useRef, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { ViewAllJobsModal } from "@/components/job-card/ViewAllJobsModal";
import { useSearchParams } from "next/navigation"; 

function NewJobPageContent() {
  const searchParams = useSearchParams();
  const fromCustomerJobId = searchParams.get('fromCustomerJobId');

  const [approvedDesigns, setApprovedDesigns] = useState<DesignSubmission[]>([]);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(true);
  const [prefillJobName, setPrefillJobName] = useState<string | undefined>(undefined);
  const [prefillCustomerName, setPrefillCustomerName] = useState<string | undefined>(undefined);
  const [initialJobDataForForm, setInitialJobDataForForm] = useState<JobCardData | undefined>(undefined);
  const [isLoadingJobForPrefill, setIsLoadingJobForPrefill] = useState(false);
  const [selectedDesignPdfUri, setSelectedDesignPdfUri] = useState<string | undefined>(undefined);


  const { toast } = useToast();
  const jobFormCardRef = useRef<HTMLDivElement>(null);
  const [isViewAllJobsModalOpen, setIsViewAllJobsModalOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState(fromCustomerJobId ? "create-new" : "from-design");

  useEffect(() => {
    async function fetchDesigns() {
      setIsLoadingDesigns(true);
      try {
        const designs = await getApprovedDesigns();
        setApprovedDesigns(designs);
      } catch (error) {
        console.error("Failed to fetch approved designs:", error);
        toast({
          title: "Error",
          description: "Could not load approved designs.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingDesigns(false);
      }
    }
    fetchDesigns();
  }, [toast]);

  useEffect(() => {
    async function fetchJobForPrefill() {
      if (fromCustomerJobId) {
        setIsLoadingJobForPrefill(true);
        setInitialJobDataForForm(undefined); 
        setSelectedDesignPdfUri(undefined);
        try {
          const jobData = await getJobCardById(fromCustomerJobId);
          if (jobData) {
            const reorderJobData: JobCardData = {
              ...jobData,
              jobName: `Re-order: ${jobData.jobName}`,
              jobCardNumber: undefined, 
              date: new Date().toISOString().split('T')[0], 
              dispatchDate: undefined, 
              status: 'Pending Planning', 
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              pdfDataUri: jobData.pdfDataUri,
            };
            setInitialJobDataForForm(reorderJobData);
            setPrefillJobName(reorderJobData.jobName);
            setPrefillCustomerName(reorderJobData.customerName);
            setSelectedDesignPdfUri(jobData.pdfDataUri); 
            setActiveTab("create-new"); 
            toast({
              title: "Prefilling Form for Re-order",
              description: `Using details from job: ${jobData.jobCardNumber || jobData.jobName}`,
            });
            
            setTimeout(() => jobFormCardRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          } else {
            toast({ title: "Error", description: "Could not find job to pre-fill.", variant: "destructive" });
          }
        } catch (error) {
          console.error("Failed to fetch job for prefill:", error);
          toast({ title: "Error", description: "Could not load job data for re-order.", variant: "destructive" });
        } finally {
          setIsLoadingJobForPrefill(false);
        }
      }
    }
    fetchJobForPrefill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCustomerJobId, toast]); 


  const handleCreateFromDesign = (design: DesignSubmission) => {
    setInitialJobDataForForm(undefined); 
    setPrefillJobName(design.jobName);
    setPrefillCustomerName(design.customerName);
    setSelectedDesignPdfUri(design.pdfDataUri); 
    
    const designPrefillData: Partial<JobCardData> = {
        jobName: design.jobName,
        customerName: design.customerName,
        pdfDataUri: design.pdfDataUri,
    };
    setInitialJobDataForForm(designPrefillData as JobCardData);
    setActiveTab("create-new");

    toast({
      title: "Prefilling Form",
      description: `Using details from design: ${design.pdfName}`,
    });
    
    setTimeout(() => jobFormCardRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  if (isLoadingJobForPrefill) {
     return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 font-body">Loading job details for re-order...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
         <div>
            <h2 className="text-2xl font-headline font-semibold text-foreground">New Job Card Options</h2>
            <p className="text-sm text-muted-foreground font-body">
                Select an approved design or create a job card from scratch.
            </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/templates">
              <LayoutList className="mr-2 h-4 w-4" />
              Manage Job Templates
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsViewAllJobsModalOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View All Created Jobs
          </Button>
        </div>
      </div>

      <ViewAllJobsModal 
        isOpen={isViewAllJobsModalOpen} 
        setIsOpen={setIsViewAllJobsModalOpen} 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-14">
          <TabsTrigger 
            value="from-design" 
            className="font-body text-base py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
          >
            <FileCheck2 className="mr-2 h-5 w-5" /> Start from Approved Design
          </TabsTrigger>
          <TabsTrigger 
            value="create-new" 
            className="font-body text-base py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
          >
            <FilePlus2 className="mr-2 h-5 w-5" /> Create New Blank Job Card
          </TabsTrigger>
        </TabsList>

        <TabsContent value="from-design">
          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline flex items-center text-xl">
                    <FileCheck2 className="mr-3 h-6 w-6 text-green-600" />
                    Select an Approved Design
                </CardTitle>
                <CardDescription className="font-body">
                    Choosing a design will pre-fill Job Name, Customer Name, and link the PDF to the new job card.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingDesigns ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground font-body">Loading approved designs...</p>
                </div>
              ) : approvedDesigns.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {approvedDesigns.map(design => (
                    <Card key={design.id} className="overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
                      <div className="relative h-40 w-full">
                        <Image 
                            src={`https://placehold.co/600x400.png?text=${encodeURIComponent(design.pdfName)}`}
                            alt={design.pdfName} 
                            fill
                            style={{objectFit:"cover"}}
                            data-ai-hint="document preview"
                        />
                      </div>
                      <CardHeader className="p-4">
                        <CardTitle className="font-body text-md font-semibold truncate group-hover:text-primary transition-colors">
                            {design.pdfName}
                        </CardTitle>
                        <CardDescription className="text-xs font-body">
                            Job: {design.jobName} | Cust: {design.customerName}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <Button 
                          className="w-full font-body" 
                          variant="secondary" 
                          onClick={() => handleCreateFromDesign(design)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" /> Create Job from This
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                 <div className="text-center py-12">
                    <Image src="https://placehold.co/300x200.png?text=No+Approved+Designs" alt="No Approved Designs" width={300} height={200} className="mb-6 rounded-lg mx-auto" data-ai-hint="empty state document"/>
                    <h3 className="text-xl font-semibold mb-2 font-headline">No Approved Designs Available</h3>
                    <p className="text-muted-foreground font-body">
                    Upload and approve designs in the 'For Approval' section to start a job from them.
                    </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create-new" ref={jobFormCardRef}>
           <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline flex items-center text-xl">
                    <FilePlus2 className="mr-3 h-6 w-6 text-primary" />
                    {initialJobDataForForm?.jobName?.startsWith("Re-order:") ? "Re-order Job" : "Create New Job Card Manually"}
                </CardTitle>
                <CardDescription className="font-body">
                    {initialJobDataForForm?.jobName?.startsWith("Re-order:")
                    ? "Review and adjust details for this re-order. A new job card will be created."
                    : "Fill out the details below to create a new job card. You can pre-fill from an approved design or a customer's past job using the options above."
                    }
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <JobCardForm 
                key={initialJobDataForForm?.id || fromCustomerJobId || 'new-job'}
                initialJobName={initialJobDataForForm?.jobName || prefillJobName} 
                initialCustomerName={initialJobDataForForm?.customerName || prefillCustomerName}
                initialJobData={initialJobDataForForm}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 font-body">Loading page...</p></div>}>
      <NewJobPageContent />
    </Suspense>
  );
}

