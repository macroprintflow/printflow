
"use client"; // Ensure this is a client component for onClick handlers

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
  QrCode // Added QrCode icon
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

  const handleScanQrCode = () => {
    console.log("Scan QR Code button clicked. Functionality to be implemented.");
    // Future implementation would involve camera access and QR code reading logic.
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
            <QrCode className="mr-2 h-5 w-5" /> Scan QR Code
          </Button>
        </CardHeader>
        <CardContent>
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
