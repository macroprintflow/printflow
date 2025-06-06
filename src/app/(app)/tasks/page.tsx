import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function TasksPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center"><ClipboardList className="mr-2 h-6 w-6 text-primary" /> Departmental Tasks</CardTitle>
        <CardDescription className="font-body">
          View and manage tasks assigned to your department. Mark jobs as complete to move them to the next process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground font-body">Departmental task list will be available here.</p>
        </div>
      </CardContent>
    </Card>
  );
}
