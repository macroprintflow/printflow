import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck2 } from "lucide-react";

export default function PlanningPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center"><CalendarCheck2 className="mr-2 h-6 w-6 text-primary" /> Production Planning</CardTitle>
        <CardDescription className="font-body">
          Assign jobs to specific processes, schedule work, and manage the overall production flow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground font-body">Production planning interface will be available here.</p>
        </div>
      </CardContent>
    </Card>
  );
}
