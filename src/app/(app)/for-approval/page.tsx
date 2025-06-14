
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, CheckCircle, Send, Loader2, AlertTriangle, Eye, Download, Mail, Upload } from "lucide-react";
import { useState, type FormEvent, type ChangeEvent, useEffect, useCallback, useMemo, useRef } from "react";
import type { DesignSubmission, SubmitDesignInput, SubmitDesignOutput, PlateTypeValue, ColorProfileValue } from "@/lib/definitions";
import { PLATE_TYPES, COLOR_PROFILES } from "@/lib/definitions";
import { submitDesignForApproval } from "@/ai/flows/design-submission-flow";
import { getDesignSubmissions, updateDesignSubmissionStatus, getJobCardById } from "@/lib/actions/jobActions"; 
import { sendPlateEmail, type SendPlateEmailInput as SendPlateEmailFlowInput } from "@/ai/flows/send-plate-email-flow"; 


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
  
  const [allDesignSubmissions, setAllDesignSubmissions] = useState<DesignSubmission[]>([]);

  // Form state for new plate type and color profile
  const [plateType, setPlateType] = useState<PlateTypeValue>("old");
  const [colorProfile, setColorProfile] = useState<ColorProfileValue | "">("");
  const [otherColorProfileDetail, setOtherColorProfileDetail] = useState("");
  
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);


  const fetchAndSetDesigns = useCallback(async () => {
    setIsLoadingDesigns(true);
    try {
      const designsFromServer = await getDesignSubmissions();
      setAllDesignSubmissions(designsFromServer.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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
      const file = e.target.files[0];
      if (file.size === 0) {
        toast({
          title: "Empty File",
          description: "The selected PDF file is empty and cannot be processed.",
          variant: "destructive",
        });
        setSelectedFile(null);
        if (e.target) e.target.value = ""; 
        return;
      }
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleCustomUploadButtonClick = () => {
    hiddenFileInputRef.current?.click();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile || !jobName || !customerName || !plateType) {
      toast({
        title: "Missing Information",
        description: "Please select a PDF file, fill in Job Name, Customer Name, and select Plate Type.",
        variant: "destructive",
      });
      return;
    }
    if (plateType === "new" && !colorProfile) {
      toast({ title: "Missing Information", description: "Please select a Color Profile for New Plates.", variant: "destructive" });
      return;
    }
    if (plateType === "new" && colorProfile === "other" && !otherColorProfileDetail.trim()) {
      toast({ title: "Missing Information", description: "Please specify details for 'Other' Color Profile.", variant: "destructive" });
      return;
    }
    if (selectedFile.type !== "application/pdf") {
      toast({ title: "Invalid File Type", description: "Please select a PDF file.", variant: "destructive" });
      return;
    }
     if (selectedFile.size === 0) {
      toast({ title: "Empty File", description: "The selected PDF file is empty. Please choose a valid PDF.", variant: "destructive" });
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
        plateType,
        colorProfile: plateType === 'new' ? (colorProfile as ColorProfileValue) : undefined,
        otherColorProfileDetail: plateType === 'new' && colorProfile === 'other' ? otherColorProfileDetail : undefined,
      };

      const backendResponse: SubmitDesignOutput = await submitDesignForApproval(submissionInput);
      
      toast({
        title: "Design Submitted",
        description: `${selectedFile.name} has been submitted for approval. ${backendResponse.message || ''}`,
      });

      await fetchAndSetDesigns();

      // Reset form
      setJobName("");
      setCustomerName("");
      setSelectedFile(null);
      setPlateType("old");
      setColorProfile("");
      setOtherColorProfileDetail("");
      if (hiddenFileInputRef.current) hiddenFileInputRef.current.value = "";


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
      await fetchAndSetDesigns();
    } else {
      toast({
        title: "Update Failed",
        description: result.message || "Could not update design status.",
        variant: "destructive",
      });
    }
  };
  
  const handleSendEmailToPlateManufacturer = async (design: DesignSubmission) => {
    if (!design.pdfDataUri) {
        toast({ title: "Error", description: "No PDF found for this design to email.", variant: "destructive" });
        return;
    }

    const emailInput: SendPlateEmailFlowInput = {
      jobName: design.jobName,
      customerName: design.customerName,
      pdfName: design.pdfName,
      pdfDataUri: design.pdfDataUri,
      colorProfile: design.colorProfile,
      otherColorProfileDetail: design.otherColorProfileDetail,
      plateType: design.plateType,
    };

    setIsSubmitting(true); 
    try {
      const result = await sendPlateEmail(emailInput);
      if (result.success) {
        toast({ title: "Email Sent", description: result.message || "Email successfully dispatched to plate maker."});
      } else {
        toast({ title: "Email Failed", description: result.message || "Could not send email.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error calling sendPlateEmail flow:", error);
      toast({ title: "Error", description: "An error occurred while trying to send the email.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPdf = (pdfDataUri: string | undefined) => {
    if (!pdfDataUri || !pdfDataUri.startsWith('data:application/pdf;base64,')) {
      toast({ title: "Cannot View PDF", description: "The PDF data is empty or invalid for this design.", variant: "destructive" });
      return;
    }
    try {
      const base64 = pdfDataUri.split(',')[1];
      if (!base64) {
          toast({ title: "Cannot View PDF", description: "PDF data is invalid (empty content).", variant: "destructive" });
          return;
      }
      const byteCharacters = atob(base64);
      const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const pdfWindow = window.open(url, '_blank');
      if (pdfWindow) {
        pdfWindow.addEventListener('unload', () => { URL.revokeObjectURL(url); console.log("Revoked PDF Object URL:", url); });
      } else {
        URL.revokeObjectURL(url); console.warn("Could not open PDF window, revoked URL immediately:", url);
        toast({ title: "Popup Blocked?", description: "Could not open PDF. Please check if your browser blocked the popup.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to open PDF:", error);
      toast({ title: "Failed to Open PDF", description: "Something went wrong while rendering the PDF.", variant: "destructive" });
    }
  };

  const handleDownloadPdf = (pdfDataUri: string | undefined, jobName: string, customerName: string, date: string) => {
    if (!pdfDataUri || !pdfDataUri.startsWith('data:application/pdf;base64,')) {
      toast({ title: "Cannot Download PDF", description: "The PDF data is empty or invalid.", variant: "destructive" });
      return;
    }
    try {
      const base64 = pdfDataUri.split(',')[1];
      if (!base64) {
          toast({ title: "Cannot Download PDF", description: "PDF data is invalid (empty content).", variant: "destructive" });
          return;
      }
      const byteCharacters = atob(base64);
      const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const sanitizedJobName = jobName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      const sanitizedCustomer = customerName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      const formattedDate = new Date(date).toISOString().slice(0, 10);
      const fileName = `${sanitizedJobName}_${sanitizedCustomer}_${formattedDate}.pdf`;
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: "Failed to Download PDF", description: "Something went wrong while downloading the PDF.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-6">
      <Card className="rounded-2xl bg-card/60 backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" />
            Submit Design for Approval
          </CardTitle>
          <CardDescription className="font-body text-base text-muted-foreground/80">
            Designers: Fill in the details, upload your PDF artwork, and submit for manager approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="plateType" className="font-body text-base">Plate Type</Label>
              <RadioGroup value={plateType} onValueChange={(value) => setPlateType(value as PlateTypeValue)} className="flex space-x-4 mt-1">
                {PLATE_TYPES.map(pt => (
                  <div key={pt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={pt.value} id={`plateType-${pt.value}`} className="data-[state=checked]:bg-primary/70 data-[state=checked]:border-primary/50 border-white/20"/>
                    <Label htmlFor={`plateType-${pt.value}`} className="font-body text-base">{pt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {plateType === "new" && (
              <div className="space-y-4 p-4 border border-white/10 rounded-xl bg-muted/30 backdrop-blur-sm">
                 <Label className="font-body font-semibold text-base">New Plate Options</Label>
                <div>
                  <Label htmlFor="colorProfile" className="font-body text-base">Color Profile</Label>
                  <Select value={colorProfile} onValueChange={(value) => setColorProfile(value as ColorProfileValue)}>
                    <SelectTrigger id="colorProfile" className="font-body text-base bg-input/30 backdrop-blur-md border-white/20 rounded-xl">
                      <SelectValue placeholder="Select color profile" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover/80 backdrop-blur-md border-white/20">
                      {COLOR_PROFILES.map(cp => (
                        <SelectItem key={cp.value} value={cp.value} className="font-body text-base">{cp.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {colorProfile === "other" && (
                  <div>
                    <Label htmlFor="otherColorProfileDetail" className="font-body text-base">Specify Other Color Details</Label>
                    <Input 
                      id="otherColorProfileDetail" 
                      value={otherColorProfileDetail} 
                      onChange={(e) => setOtherColorProfileDetail(e.target.value)} 
                      placeholder="e.g., Pantone 123C, Special Varnish" 
                      className="font-body text-base bg-input/30 backdrop-blur-md border-white/20 rounded-xl"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="font-body text-base">Upload PDF Artwork</Label>
              <Input 
                id="pdfFile" 
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                ref={hiddenFileInputRef}
                className="hidden" 
              />
              <Button 
                type="button" 
                onClick={handleCustomUploadButtonClick} 
                className="w-full font-body text-base justify-start text-muted-foreground/80 hover:text-foreground h-12 rounded-xl
                           border border-white/15 bg-secondary/20 backdrop-blur-lg shadow-md shadow-black/10 
                           [box-shadow:inset_0_0_0_1.5px_rgba(255,255,255,0.15)] 
                           hover:bg-secondary/30"
              >
                <Upload className="mr-2 h-4 w-4" />
                {selectedFile ? selectedFile.name : "Upload File"}
              </Button>
               {selectedFile && <p className="text-sm text-muted-foreground/80 mt-1 font-body">Selected: {selectedFile.name} (Click button above to change)</p>}
            </div>
            <div>
              <Label htmlFor="jobName" className="font-body text-base">Job Name (e.g., Spring Catalog 2025)</Label>
              <Input 
                id="jobName" 
                value={jobName} 
                onChange={(e) => setJobName(e.target.value)} 
                placeholder="Enter the job name for this design" 
                className="font-body text-base bg-input/30 backdrop-blur-md border-white/20 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="customerName" className="font-body text-base">Customer Name (e.g., Acme Corp)</Label>
              <Input 
                id="customerName" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                placeholder="Enter the customer's name" 
                className="font-body text-base bg-input/30 backdrop-blur-md border-white/20 rounded-xl"
              />
            </div>
            <Button 
              type="submit" 
              className="font-body text-base h-12 px-6 rounded-xl
                         border border-primary/30 bg-primary/20 backdrop-blur-lg shadow-md shadow-black/10
                         [box-shadow:inset_0_0_0_1.5px_hsla(var(--primary-hsl)/0.3)] 
                         hover:bg-primary/30 text-primary-foreground" 
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Submitting..." : "Submit for Approval"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl bg-card/60 backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="font-headline text-xl">All Designs Awaiting Action</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDesigns ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
              <p className="font-body text-base text-muted-foreground/80">Loading designs...</p>
            </div>
          ) : allDesignSubmissions.length > 0 ? (
            <ul className="space-y-3">
              {allDesignSubmissions.map(design => (
                <li key={design.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-white/10 rounded-xl bg-card/50 backdrop-blur-md hover:shadow-sm gap-3">
                  <div className="flex items-center">
                    <FileText className="mr-3 h-6 w-6 text-muted-foreground/80 flex-shrink-0" />
                    <div>
                      <p className="font-medium font-body text-base">{design.pdfName}</p>
                      <p className="text-sm text-muted-foreground/80 font-body">
                        Job: {design.jobName} | Customer: {design.customerName}
                        {design.plateType === 'new' && design.colorProfile && (
                          <> | Color: {design.colorProfile}{design.colorProfile === 'other' && design.otherColorProfileDetail ? ` (${design.otherColorProfileDetail})` : ''}</>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground/70 font-body">
                        Uploaded by {design.uploader} on {new Date(design.date).toLocaleDateString()} - Status: 
                        <span className={`ml-1 font-semibold ${
                          design.status === 'approved' ? 'text-green-400' :
                          design.status === 'rejected' ? 'text-red-400' :
                          'text-orange-400'
                        }`}>
                          {design.status.toUpperCase()}
                        </span>
                        {design.plateType === 'new' && (
                          <Badge variant="outline" className="ml-2 text-xs py-0.5 px-1.5 border-blue-500/70 text-blue-400 bg-transparent backdrop-blur-sm">NEW</Badge>
                        )}
                        {design.plateType === 'old' && (
                          <Badge variant="outline" className="ml-2 text-xs py-0.5 px-1.5 border-orange-500/70 text-orange-400 bg-transparent backdrop-blur-sm">OLD</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 sm:mt-0 flex-shrink-0 items-center flex-wrap justify-end">
                    {design.pdfDataUri && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewPdf(design.pdfDataUri)} 
                          className="font-body text-sm rounded-xl
                                     border border-white/15 bg-foreground/5 backdrop-blur-lg shadow-md shadow-black/5 
                                     [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.1)] 
                                     hover:bg-foreground/10" 
                          title="View PDF"
                        >
                          <Eye className="mr-1 h-4 w-4" /> View PDF
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownloadPdf(design.pdfDataUri, design.jobName, design.customerName, design.date)} 
                          className="font-body text-sm rounded-xl
                                     border border-white/15 bg-foreground/5 backdrop-blur-lg shadow-md shadow-black/5 
                                     [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.1)] 
                                     hover:bg-foreground/10" 
                          title="Download PDF"
                        >
                          <Download className="mr-1 h-4 w-4" /> Download
                        </Button>
                      </>
                    )}
                    {design.status === 'approved' && design.plateType === 'new' && (
                       <Button 
                          variant="outline" 
                          size="sm" 
                          className="font-body text-sm text-blue-400 rounded-xl
                                     border border-blue-500/40 bg-blue-500/20 backdrop-blur-lg shadow-md shadow-black/5 
                                     [box-shadow:inset_0_0_0_1px_rgba(var(--color-blue-500-rgb)/0.3)] 
                                     hover:bg-blue-500/30"
                          disabled // Keep disabled for "Coming Soon"
                          title="Email Plate Maker (Coming Soon)"
                        >
                         <Mail className="mr-1 h-4 w-4" /> Email Plate Maker (Soon)
                       </Button>
                    )}
                    {design.status === 'pending' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleApproval(design.id, true)} 
                          className="font-body text-sm text-green-400 rounded-xl
                                     border border-green-500/40 bg-green-500/10 backdrop-blur-lg shadow-md shadow-black/5 
                                     [box-shadow:inset_0_0_0_1px_rgba(var(--color-green-500-rgb)/0.3)] 
                                     hover:bg-green-500/20"
                        >
                          <CheckCircle className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleApproval(design.id, false)} 
                          className="font-body text-sm text-red-400 rounded-xl
                                     border border-red-500/40 bg-red-500/10 backdrop-blur-lg shadow-md shadow-black/5 
                                     [box-shadow:inset_0_0_0_1px_rgba(var(--color-red-500-rgb)/0.3)] 
                                     hover:bg-red-500/20"
                        >
                           <AlertTriangle className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground/80 font-body text-base text-center py-4">
              No designs are currently submitted or awaiting approval.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

