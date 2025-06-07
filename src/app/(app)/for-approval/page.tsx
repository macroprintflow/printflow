
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, CheckCircle, Send, Loader2, AlertTriangle, Eye } from "lucide-react"; // Added Eye icon
import { useState, type FormEvent, type ChangeEvent, useEffect, useCallback } from "react";
import type { DesignSubmission, SubmitDesignInput, SubmitDesignOutput } from "@/lib/definitions";
import { submitDesignForApproval } from "@/ai/flows/design-submission-flow";
import { getDesignSubmissions, updateDesignSubmissionStatus } from "@/lib/actions/jobActions";


// Helper function to convert file to Data URI
const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


export default function ForApprovalPage() {
  const { toast } = useToast();
  const [jobName, setJobName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(true);
  
  const [displayedDesigns, setDisplayedDesigns] = useState<DesignSubmission[]>([]);

  const fetchAndSetDesigns = useCallback(async () => {
    setIsLoadingDesigns(true);
    try {
      const designsFromServer = await getDesignSubmissions();
      setDisplayedDesigns(designsFromServer.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error("Failed to fetch designs:", error);
      toast({ title: "Error", description: "Could not load designs.", variant: "destructive" });
    } finally {
      setIsLoadingDesigns(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAndSetDesigns();
  }, [fetchAndSetDesigns]);


  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile || !jobName || !customerName) {
      toast({
        title: "Missing Information",
        description: "Please select a PDF file and fill in Job Name, and Customer Name.",
        variant: "destructive",
      });
      return;
    }
    if (selectedFile.type !== "application/pdf") {
      toast({
        title: "Invalid File Type",
        description: "Please select a PDF file.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const pdfDataUri = await fileToDataUri(selectedFile);
      
      const submissionInput: SubmitDesignInput = {
        pdfName: selectedFile.name,
        jobName,
        customerName,
        pdfDataUri,
      };

      const backendResponse: SubmitDesignOutput = await submitDesignForApproval(submissionInput);
      
      toast({
        title: "Design Submitted",
        description: `${selectedFile.name} has been submitted for approval. ${backendResponse.message || ''}`,
      });

      // Re-fetch designs to include the new one
      await fetchAndSetDesigns();

      // Reset form
      setJobName("");
      setCustomerName("");
      setSelectedFile(null);
      const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Could not submit design.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproval = async (id: string, approve: boolean) => {
    const newStatus = approve ? "approved" : "rejected";
    const result = await updateDesignSubmissionStatus(id, newStatus);

    if (result.success && result.submission) {
      toast({
        title: approve ? "Design Approved" : "Design Rejected",
        description: `The design status for "${result.submission.pdfName}" has been updated.`,
      });
      // Re-fetch designs to reflect the change
      await fetchAndSetDesigns();
    } else {
      toast({
        title: "Update Failed",
        description: result.message || "Could not update design status.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" />
            Submit Design for Approval
          </CardTitle>
          <CardDescription className="font-body">
            Designers: Fill in the details, upload your PDF artwork, and submit for manager approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pdfFile" className="font-body">Upload PDF Artwork</Label>
              <Input 
                id="pdfFile" 
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="font-body file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
               {selectedFile && <p className="text-xs text-muted-foreground mt-1">Selected: {selectedFile.name}</p>}
            </div>
            <div>
              <Label htmlFor="jobName" className="font-body">Job Name (e.g., Spring Catalog 2025)</Label>
              <Input 
                id="jobName" 
                value={jobName} 
                onChange={(e) => setJobName(e.target.value)} 
                placeholder="Enter the job name for this design" 
                className="font-body"
              />
            </div>
            <div>
              <Label htmlFor="customerName" className="font-body">Customer Name (e.g., Acme Corp)</Label>
              <Input 
                id="customerName" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                placeholder="Enter the customer's name" 
                className="font-body"
              />
            </div>
            <Button type="submit" className="font-body" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Submitting..." : "Submit for Approval"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Designs Awaiting Action</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDesigns ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
              <p className="font-body text-muted-foreground">Loading designs...</p>
            </div>
          ) : displayedDesigns.length > 0 ? (
            <ul className="space-y-3">
              {displayedDesigns.map(design => (
                <li key={design.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-md bg-card hover:shadow-sm gap-3">
                  <div className="flex items-center">
                    <FileText className="mr-3 h-6 w-6 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium font-body text-base">{design.pdfName}</p>
                      <p className="text-sm text-muted-foreground font-body">
                        Job: {design.jobName} | Customer: {design.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        Uploaded by {design.uploader} on {new Date(design.date).toLocaleDateString()} - Status: 
                        <span className={`ml-1 font-semibold ${
                          design.status === 'approved' ? 'text-green-600' :
                          design.status === 'rejected' ? 'text-red-600' :
                          'text-orange-500'
                        }`}>
                          {design.status.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 sm:mt-0 flex-shrink-0 items-center">
                    {design.pdfDataUri && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(design.pdfDataUri!, '_blank')}
                        className="font-body"
                        title="View PDF"
                      >
                        <Eye className="mr-1 h-4 w-4" /> View PDF
                      </Button>
                    )}
                    {design.status === 'pending' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleApproval(design.id, true)} className="font-body">
                          <CheckCircle className="mr-1 h-4 w-4 text-green-500" /> Approve
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleApproval(design.id, false)} className="font-body text-red-600 border-red-600 hover:bg-red-50">
                           <AlertTriangle className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground font-body text-center py-4">
              No designs are currently submitted or awaiting approval.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
