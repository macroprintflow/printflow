
import { JobTemplateForm } from "@/components/template/JobTemplateForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutList } from "lucide-react";

export default function NewJobTemplatePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <LayoutList className="mr-2 h-6 w-6 text-primary" /> Create New Job Template
          </CardTitle>
          <CardDescription className="font-body">
            Define a new template with pre-selected process steps for quick job card creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobTemplateForm />
        </CardContent>
      </Card>
    </div>
  );
}
