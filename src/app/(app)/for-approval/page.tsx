
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, CheckCircle, Send, Loader2 } from "lucide-react";
import { useState, type FormEvent, type ChangeEvent } from "react";
import type { DesignSubmission, SubmitDesignInput, SubmitDesignOutput } from "@/lib/definitions"; // Updated import path
import { submitDesignForApproval } from "@/ai/flows/design-submission-flow";


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
  
  const [designs, setDesigns] = useState<DesignSubmission[]>([
    { id: "pdf1", pdfName: "Marketing Brochure Q3.pdf", jobName: "Q3 Brochure", customerName: "Client Corp", uploader: "Designer Alice", date: "2024-07-28", status: "pending" },
    { id: "pdf2", pdfName: "New Product Packaging_v2.pdf", jobName: "Super Product Box", customerName: "Retail Giant", uploader: "Designer Bob", date: "2024-07-29", status: "approved" },
  ]);

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

      const newSubmission: DesignSubmission = {
        id: backendResponse.submissionId || `local-${Date.now()}`, // Use backend ID if available
        backendSubmissionId: backendResponse.submissionId,
        pdfName: selectedFile.name,
        jobName,
        customerName,
        uploader: "Current User", // Placeholder, ideally from auth
        date: new Date().toISOString().split("T")[0],
        status: backendResponse.status as "pending" || "pending",
        // pdfDataUri: pdfDataUri, // Optionally store for local display if needed, but can be large
      };
      setDesigns(prev => [newSubmission, ...prev]);
      
      toast({
        title: "Design Submitted",
        description: `${selectedFile.name} has been submitted for approval. ${backendResponse.message || ''}`,
      });

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

  const handleApproval = (id: string, approve: boolean) => {
    setDesigns(prevDesigns =>
      prevDesigns.map(design =>
        design.id === id ? { ...design, status: approve ? "approved" : "rejected" } : design
      )
    );
    toast({
      title: approve ? "Design Approved" : "Design Rejected",
      description: `The design status has been updated to ${approve ? "approved" : "rejected"}.`,
    });
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
          {designs.length > 0 ? (
            <ul className="space-y-3">
              {designs.map(design => (
                <li key={design.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-md bg-card hover:shadow-sm gap-3">
                  <div className="flex items-center">
                    <FileText className="mr-3 h-6 w-6 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium font-body text-base">{design.pdfName}</p>
                      <p className="text-sm text-muted-foreground font-body">
                        Job: {design.jobName} | Customer: {design.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        Uploaded by {design.uploader} on {design.date} - Status: 
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
                  {design.status === 'pending' && (
                    <div className="flex gap-2 mt-2 sm:mt-0 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleApproval(design.id, true)} className="font-body">
                        <CheckCircle className="mr-1 h-4 w-4 text-green-500" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleApproval(design.id, false)} className="font-body text-red-600 border-red-600 hover:bg-red-50">
                        Reject
                      </Button>
                    </div>
                  )}
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

    
