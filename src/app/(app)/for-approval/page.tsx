
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, CheckCircle, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

interface DesignSubmission {
  id: string;
  pdfName: string;
  jobName: string;
  customerName: string;
  uploader: string; // Placeholder
  date: string;
  status: "pending" | "approved" | "rejected";
}

export default function ForApprovalPage() {
  const { toast } = useToast();
  const [pdfName, setPdfName] = useState("");
  const [jobName, setJobName] = useState("");
  const [customerName, setCustomerName] = useState("");
  
  const [designs, setDesigns] = useState<DesignSubmission[]>([
    { id: "pdf1", pdfName: "Marketing Brochure Q3.pdf", jobName: "Q3 Brochure", customerName: "Client Corp", uploader: "Designer Alice", date: "2024-07-28", status: "pending" },
    { id: "pdf2", pdfName: "New Product Packaging_v2.pdf", jobName: "Super Product Box", customerName: "Retail Giant", uploader: "Designer Bob", date: "2024-07-29", status: "approved" },
  ]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pdfName || !jobName || !customerName) {
      toast({
        title: "Missing Information",
        description: "Please fill in PDF Name, Job Name, and Customer Name.",
        variant: "destructive",
      });
      return;
    }

    const newSubmission: DesignSubmission = {
      id: `design-${Date.now()}`,
      pdfName,
      jobName,
      customerName,
      uploader: "Current Designer", // Placeholder
      date: new Date().toISOString().split("T")[0],
      status: "pending",
    };
    setDesigns(prev => [newSubmission, ...prev]);
    toast({
      title: "Design Submitted",
      description: `${pdfName} has been submitted for approval.`,
    });
    setPdfName("");
    setJobName("");
    setCustomerName("");
  };

  const handleApproval = (id: string, approve: boolean) => {
    setDesigns(prevDesigns =>
      prevDesigns.map(design =>
        design.id === id ? { ...design, status: approve ? "approved" : "rejected" } : design
      )
    );
    toast({
      title: approve ? "Design Approved" : "Design Rejected",
      description: `The design has been ${approve ? "approved" : "rejected"}.`,
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
            Designers: Fill in the details and submit your PDF artwork for manager approval.
            Approved designs will become available for job card creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pdfName" className="font-body">PDF File Name (e.g., final_brochure_v3.pdf)</Label>
              <Input 
                id="pdfName" 
                value={pdfName} 
                onChange={(e) => setPdfName(e.target.value)} 
                placeholder="Enter PDF file name" 
                className="font-body"
              />
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
            <Button type="submit" className="font-body">
              <Send className="mr-2 h-4 w-4" /> Submit for Approval
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
