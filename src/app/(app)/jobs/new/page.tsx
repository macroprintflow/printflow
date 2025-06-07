
import { JobCardForm } from "@/components/job-card/JobCardForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutList, FilePlus2, FileCheck2, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function NewJobPage() {
  // Placeholder for approved designs - now an empty array
  const approvedDesigns: { id: string; name: string; thumbnail: string; jobName: string; customerName: string; }[] = [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-headline font-semibold text-foreground">Start a New Job</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/templates">
            <LayoutList className="mr-2 h-4 w-4" />
            Manage Job Templates
          </Link>
        </Button>
      </div>

      {/* Section for Approved Designs */}
      <Card className="shadow-lg border-green-500 border-2">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <FileCheck2 className="mr-3 h-6 w-6 text-green-600" />
            Start from an Approved Design
          </CardTitle>
          <CardDescription className="font-body">
            Select an existing approved design. This would pre-fill Job Name and Customer Name in the form below. (Pre-fill functionality coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedDesigns.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {approvedDesigns.map(design => (
                <Card key={design.id} className="overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
                  <div className="relative h-40 w-full">
                    <Image 
                        src={design.thumbnail} 
                        alt={design.name} 
                        layout="fill" 
                        objectFit="cover"
                        data-ai-hint="product packaging design"
                    />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="font-body text-md font-semibold truncate group-hover:text-primary transition-colors">
                        {design.name}
                    </CardTitle>
                     <CardDescription className="text-xs font-body">
                        Job: {design.jobName} | Cust: {design.customerName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Button className="w-full font-body" variant="secondary" disabled> {/* Disabled until pre-fill implemented */}
                      <Sparkles className="mr-2 h-4 w-4" /> Create Job from This Design
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground font-body text-center py-6">
              No approved designs available to start from. Upload and approve designs in the 'For Approval' section.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section for creating a new job card from scratch or template */}
      <Card className="shadow-lg mt-8">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <FilePlus2 className="mr-3 h-6 w-6 text-primary" />
            Create New Job Card (Blank or from Past Job)
          </CardTitle>
          <CardDescription className="font-body">
            Fill out the details below to create a new job card. You can pre-fill from a customer's past job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobCardForm />
        </CardContent>
      </Card>
    </div>
  );
}
