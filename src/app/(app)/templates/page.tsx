
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, LayoutList, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getJobTemplates } from "@/lib/actions/jobActions";
import type { JobTemplateData } from "@/lib/definitions";

export default async function TemplatesPage() {
  const templates = await getJobTemplates();

  const getTemplateProcessSummary = (template: JobTemplateData) => {
    const processes = [
      template.kindOfJob,
      template.printingFront,
      template.printingBack,
      template.coating,
      template.die,
      template.hotFoilStamping,
      template.emboss,
      template.pasting,
      template.boxMaking,
    ].filter(Boolean); // Filter out empty or undefined values
    return processes.join(', ') || 'No processes defined';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-headline flex items-center">
              <LayoutList className="mr-2 h-6 w-6 text-primary" /> Job Templates
            </CardTitle>
            <CardDescription className="font-body">
              Manage predefined job templates to speed up job card creation.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/templates/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-headline">Template Name</TableHead>
                  <TableHead className="font-headline">Processes Overview</TableHead>
                  <TableHead className="font-headline text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium font-body">{template.name}</TableCell>
                    <TableCell className="font-body text-sm text-muted-foreground truncate max-w-md">
                      {getTemplateProcessSummary(template)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" disabled> {/* Placeholder for future view/edit */}
                        <Eye className="mr-2 h-4 w-4" /> View/Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <LayoutList className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold font-headline">No Templates Yet</h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                Create your first job template to get started.
              </p>
              <Button asChild className="mt-6">
                <Link href="/templates/new">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
