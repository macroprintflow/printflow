
"use client"; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileCheck2, 
  Scissors, 
  Printer, 
  Palette,
  Film, 
  Focus,
  Sparkles, 
  Layers,
  Box, 
  Package,
  FileSpreadsheet,
  Workflow,
  CheckSquare,
  QrCode,
  Video, // Added Video icon
  XCircle // Added XCircle icon
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react"; // Added useEffect, useRef, useState
import { useToast } from "@/hooks/use-toast"; // Added useToast
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components

interface DepartmentTaskStep {
  name: string;
  icon: LucideIcon;
  jobCount: number; 
  description: string;
}

const departmentSteps: DepartmentTaskStep[] = [
  { name: "Job Approval", icon: FileCheck2, jobCount: 0, description: "Jobs awaiting client or internal approval." },
  { name: "Cutter", icon: Scissors, jobCount: 0, description: "Paper cutting and preparation tasks." },
  { name: "Printing", icon: Printer, jobCount: 0, description: "Offset and digital printing tasks." },
  { name: "Texture UV", icon: Palette, jobCount: 0, description: "Applying texture UV finishes." },
  { name: "Lamination", icon: Film, jobCount: 0, description: "Applying lamination films." },
  { name: "Die Cutting", icon: Focus, jobCount: 0, description: "Die cutting and creasing tasks." },
  { name: "Foil Stamping", icon: Sparkles, jobCount: 0, description: "Applying metallic foils." },
  { name: "Pasting", icon: Layers, jobCount: 0, description: "Pasting and gluing tasks." },
  { name: "Box Making & Assembly", icon: Box, jobCount: 0, description: "Box making and assembly tasks." },
  { name: "Packing", icon: Package, jobCount: 0, description: "Final packing of finished goods." },
  { name: "To be Billed", icon: FileSpreadsheet, jobCount: 0, description: "Jobs completed and awaiting invoicing." },
];

export default function TasksPage() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!isCameraOpen) {
        // If camera view is closed, ensure any existing streams are stopped
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        return;
      }

      // Request camera permission only when isCameraOpen is true
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this feature.',
          });
          setIsCameraOpen(false); // Close camera view if permission is denied
        }
      } else {
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Not Supported',
          description: 'Your browser does not support camera access or it is not available on this device.',
        });
        setIsCameraOpen(false);
      }
    };

    getCameraPermission();

    // Cleanup function to stop the camera stream when the component unmounts or isCameraOpen changes to false
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen, toast]);

  const handleScanQrCode = () => {
    setIsCameraOpen(prev => !prev); // Toggle camera view
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-headline flex items-center text-2xl">
              <Workflow className="mr-3 h-8 w-8 text-primary" /> Departmental Task Queues
            </CardTitle>
            <CardDescription className="font-body">
              View tasks assigned to each department. Click on a department to see specific jobs and mark them as complete.
            </CardDescription>
          </div>
          <Button onClick={handleScanQrCode} className="font-body w-full sm:w-auto">
            {isCameraOpen ? <XCircle className="mr-2 h-5 w-5" /> : <QrCode className="mr-2 h-5 w-5" />}
            {isCameraOpen ? "Close Camera" : "Scan Job QR Code"}
          </Button>
        </CardHeader>
        <CardContent>
          {isCameraOpen && (
            <Card className="my-4">
              <CardHeader>
                <CardTitle className="font-headline flex items-center">
                  <Video className="mr-2 h-5 w-5 text-primary" /> QR Code Scanner
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <video ref={videoRef} className="w-full max-w-md aspect-video rounded-md bg-muted border" autoPlay playsInline muted />
                {hasCameraPermission === false && (
                  <Alert variant="destructive" className="mt-4 w-full max-w-md">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                      Camera permission was denied or is not available. Please enable it in your browser settings and try again.
                    </AlertDescription>
                  </Alert>
                )}
                {hasCameraPermission === null && (
                    <Alert variant="default" className="mt-4 w-full max-w-md">
                        <AlertTitle>Requesting Camera</AlertTitle>
                        <AlertDescription>
                        Please allow camera access when prompted by your browser.
                        </AlertDescription>
                    </Alert>
                )}
                 <p className="text-sm text-muted-foreground mt-2 font-body">Point the camera at a Job QR Code.</p>
                 {/* QR Code detection logic and result display would go here */}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {departmentSteps.map((step) => (
              <Card 
                key={step.name} 
                className="hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer bg-card/70 hover:bg-card/90 border-border/50 hover:border-primary/50"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-headline flex items-start gap-3">
                    <step.icon className="h-7 w-7 text-primary flex-shrink-0 mt-0.5" />
                    <span>{step.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="text-4xl font-bold font-headline text-foreground">
                    {step.jobCount}
                  </div>
                  <p className="text-sm text-muted-foreground font-body">
                    Planned Jobs
                  </p>
                  <Button variant="outline" size="sm" className="w-full font-body" disabled>
                    <CheckSquare className="mr-2 h-4 w-4" /> Mark Task Done (Soon)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
            <CardTitle className="font-headline">Detailed Task List</CardTitle>
            <CardDescription className="font-body">Selected department's tasks will appear here. (Placeholder for now)</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-center h-60 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground font-body">Select a department above to view its tasks.</p>
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
