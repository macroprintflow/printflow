
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileCheck2, 
  Scissors, 
  Printer, 
  Wand2,
  Film, 
  Crop, 
  Sparkles, 
  ClipboardPaste, 
  Box, 
  Package,
  FileSpreadsheet,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ProcessStep {
  name: string;
  icon: LucideIcon;
  jobCount: number; // Placeholder for now
  description: string;
}

const productionSteps: ProcessStep[] = [
  { name: "Job Approval", icon: FileCheck2, jobCount: 2, description: "Jobs awaiting client or internal approval." },
  { name: "Cutter", icon: Scissors, jobCount: 7, description: "Paper cutting and preparation." },
  { name: "Printing", icon: Printer, jobCount: 12, description: "Offset and digital printing jobs." },
  { name: "Texture UV", icon: Wand2, jobCount: 6, description: "Applying texture UV finishes." },
  { name: "Lamination", icon: Film, jobCount: 8, description: "Applying lamination films." },
  { name: "Die Cutting", icon: Crop, jobCount: 15, description: "Cutting and creasing sheets to shape." },
  { name: "Foil Stamping", icon: Sparkles, jobCount: 4, description: "Applying metallic foils." },
  { name: "Pasting", icon: ClipboardPaste, jobCount: 9, description: "Folder-gluer and manual pasting." },
  { name: "Box Making & Assembly", icon: Box, jobCount: 7, description: "Rigid box and other assembly." },
  { name: "Packing", icon: Package, jobCount: 10, description: "Final packing of finished goods." },
  { name: "To be Billed", icon: FileSpreadsheet, jobCount: 5, description: "Jobs completed and awaiting invoicing." },
];

export default function PlanningPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-2xl">
            <Workflow className="mr-3 h-8 w-8 text-primary" /> Production Pipeline Overview
          </CardTitle>
          <CardDescription className="font-body">
            Track and manage jobs across all production stages. Click on a stage to view detailed tasks and assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {productionSteps.map((step) => (
              <Card 
                key={step.name} 
                className="hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer bg-card/70 hover:bg-card/90 border-border/50 hover:border-primary/50"
                // onClick={() => alert(`Navigate to ${step.name} details`)} // Placeholder for navigation
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-headline flex items-start gap-3">
                    <step.icon className="h-7 w-7 text-primary flex-shrink-0 mt-0.5" />
                    <span>{step.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-4xl font-bold font-headline text-foreground">
                    {step.jobCount}
                  </div>
                  <p className="text-sm text-muted-foreground font-body">
                    Active Jobs
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

