
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Palette, 
  Layers, 
  Printer, 
  Film, 
  Scissors, 
  Sparkles, 
  ChevronsUpDown, 
  ClipboardPaste, // Changed from Glue
  Box, 
  ShieldCheck, 
  Truck,
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
  { name: "Pre-press & Design", icon: Palette, jobCount: 5, description: "Artwork finalization and proofing." },
  { name: "Plate Making", icon: Layers, jobCount: 3, description: "Creating printing plates." },
  { name: "Printing", icon: Printer, jobCount: 12, description: "Offset and digital printing jobs." },
  { name: "Coating & Lamination", icon: Film, jobCount: 8, description: "Applying finishes like UV, varnish, lamination." },
  { name: "Die Cutting & Creasing", icon: Scissors, jobCount: 15, description: "Cutting and creasing sheets to shape." },
  { name: "Foil Stamping", icon: Sparkles, jobCount: 4, description: "Applying metallic foils." },
  { name: "Embossing & Debossing", icon: ChevronsUpDown, jobCount: 2, description: "Creating raised or recessed designs." },
  { name: "Pasting & Gluing", icon: ClipboardPaste, jobCount: 9, description: "Folder-gluer and manual pasting." }, // Changed icon here
  { name: "Box Making & Assembly", icon: Box, jobCount: 7, description: "Rigid box and other assembly." },
  { name: "Quality Check", icon: ShieldCheck, jobCount: 22, description: "Final inspection of finished goods." },
  { name: "Dispatch", icon: Truck, jobCount: 18, description: "Jobs ready for delivery or awaiting pickup." },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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

