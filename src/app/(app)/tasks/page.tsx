
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
  Video, 
  XCircle 
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    let streamInstance: MediaStream | null = null;

    const requestAndSetupCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          streamInstance = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = streamInstance;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false); // Set permission status
          toast({ // Inform user
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this feature.',
          });
          // IMPORTANT: Do not call setIsCameraOpen(false) here.
          // This prevents a potential loop if errors persist.
          // User must explicitly close the camera view via the button.
        }
      } else {
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Not Supported',
          description: 'Your browser does not support camera access or it is not available on this device.',
        });
        // IMPORTANT: Do not call setIsCameraOpen(false) here.
      }
    };

    if (isCameraOpen) {
      // Reset permission state before requesting, so it always tries if 'isCameraOpen' is true
      // and permission isn't already 'true'.
      if (hasCameraPermission !== true) {
         setHasCameraPermission(null); // Indicate we are about to request/re-request
      }
      requestAndSetupCamera();
    }

    // Cleanup function: This runs when isCameraOpen changes or component unmounts.
    return () => {
      if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null; // Clear the video source
      }
      // When camera is explicitly closed (isCameraOpen becomes false),
      // we might want to reset hasCameraPermission to null if we want it to re-prompt every time.
      // For now, keeping it as is, so if permission was denied, it stays denied until browser settings change.
    };
  }, [isCameraOpen, toast]); // Only re-run if isCameraOpen or toast changes.

  const handleScanQrCode = () => {
    setIsCameraOpen(prev => !prev);
    // If we are opening the camera, reset hasCameraPermission to null
    // to ensure the effect attempts to get permission.
    if (!isCameraOpen) {
      setHasCameraPermission(null);
    }
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
                {/* Video tag is always rendered if isCameraOpen is true, 
                    but srcObject is set by useEffect.
                    This avoids hydration issues with conditional rendering based on async permission. */}
                <video ref={videoRef} className="w-full max-w-md aspect-video rounded-md bg-muted border" autoPlay playsInline muted />
                
                {hasCameraPermission === null && (
                  <Alert variant="default" className="mt-4 w-full max-w-md">
                    <AlertTitle>Requesting Camera</AlertTitle>
                    <AlertDescription>
                      Please allow camera access when prompted by your browser. If no prompt appears, check your browser's site settings for camera permissions.
                    </AlertDescription>
                  </Alert>
                )}
                {hasCameraPermission === false && (
                  <Alert variant="destructive" className="mt-4 w-full max-w-md">
                    <AlertTitle>Camera Access Denied or Unavailable</AlertTitle>
                    <AlertDescription>
                      Camera permission was denied, or no camera is available. Please enable it in your browser settings or connect a camera and try again.
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
