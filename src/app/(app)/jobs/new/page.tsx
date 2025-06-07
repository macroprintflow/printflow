
"use client";

import { JobCardForm } from "@/components/job-card/JobCardForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutList, FilePlus2, FileCheck2, Sparkles, Eye } from "lucide-react"; // Added Eye
import Link from "next/link";
import Image from "next/image";
import { getApprovedDesigns } from "@/lib/actions/jobActions";
import type { DesignSubmission } from "@/lib/definitions";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ViewAllJobsModal } from "@/components/job-card/ViewAllJobsModal"; // Import the new modal

export default function NewJobPage() {
  const [approvedDesigns, setApprovedDesigns] = useState<DesignSubmission[]>([]);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(true);
  const [prefillJobName, setPrefillJobName] = useState<string | undefined>(undefined);
  const [prefillCustomerName, setPrefillCustomerName] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const jobFormCardRef = useRef<HTMLDivElement>(null);
  const [isViewAllJobsModalOpen, setIsViewAllJobsModalOpen] = useState(false); // State for the modal

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

  const handleCreateFromDesign = (design: DesignSubmission) => {
    setPrefillJobName(design.jobName);
    setPrefillCustomerName(design.customerName);
    toast({
      title: "Prefilling Form",
      description: `Using details from design: ${design.pdfName}`,
    });
    jobFormCardRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-3xl font-headline font-semibold text-foreground">Start a New Job</h1>
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

      <Card className="shadow-lg border-green-500 border-2">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <FileCheck2 className="mr-3 h-6 w-6 text-green-600" />
            Start from an Approved Design
          </CardTitle>
          <CardDescription className="font-body">
            Select an existing approved design to pre-fill Job Name and Customer Name in the form below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDesigns ? (
             <p className="text-muted-foreground font-body text-center py-6">Loading approved designs...</p>
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
                      <Sparkles className="mr-2 h-4 w-4" /> Create Job from This Design
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground font-body text-center py-6">
              No approved designs available to start from. Upload and approve designs in the 'For Approval' section.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg mt-8" ref={jobFormCardRef}>
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <FilePlus2 className="mr-3 h-6 w-6 text-primary" />
            Create New Job Card (Blank or from Past Job)
          </CardTitle>
          <CardDescription className="font-body">
            Fill out the details below to create a new job card. You can pre-fill from a customer's past job or an approved design.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobCardForm 
            initialJobName={prefillJobName} 
            initialCustomerName={prefillCustomerName} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
