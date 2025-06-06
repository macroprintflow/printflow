
"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListChecks, Send } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';

// Helper to get display name from slug (you might want to move this to a util or share the productionSteps array)
const departmentDetails: Record<string, { name: string, icon?: any }> = {
  "job-approval": { name: "Job Approval" },
  "cutter": { name: "Cutter" },
  "printing": { name: "Printing" },
  "texture-uv": { name: "Texture UV" },
  "lamination": { name: "Lamination" },
  "die-cutting": { name: "Die Cutting" },
  "foil-stamping": { name: "Foil Stamping" },
  "pasting": { name: "Pasting" },
  "box-making-assembly": { name: "Box Making & Assembly" },
  "packing": { name: "Packing" },
  "to-be-billed": { name: "To be Billed" },
};

const getDepartmentDisplayName = (slug: string | string[] | undefined): string => {
  if (typeof slug !== 'string') return "Department";
  return departmentDetails[slug]?.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Placeholder for job data type
type Job = {
  id: string;
  jobCardNumber: string;
  jobName: string;
  customerName: string;
  status: string; // e.g., 'Pending Planning', 'Ready for [DeptName]'
  dispatchDate: string;
  netQuantity: number;
};

// Placeholder job data
const sampleJobs: Job[] = [
  { id: 'job1', jobCardNumber: 'JC-240701-001', jobName: 'Luxury Box A', customerName: 'Prestige Co.', status: 'Pending Planning', dispatchDate: '2024-07-15', netQuantity: 500 },
  { id: 'job2', jobCardNumber: 'JC-240701-002', jobName: 'Retail Sleeve B', customerName: 'ShopSmart', status: 'Pending Planning', dispatchDate: '2024-07-20', netQuantity: 2000 },
];


export default function DepartmentPlanningPage() {
  const params = useParams();
  const departmentSlug = params.departmentName as string;
  const departmentDisplayName = getDepartmentDisplayName(departmentSlug);

  // In a real app, you would:
  // 1. Fetch jobs relevant to this department (e.g., jobs whose 'currentDepartment' is this department OR jobs that AI suggests for this department)
  // 2. Implement selection logic for jobs
  // 3. Implement the "Forward to Departmental Tasks" action (e.g., update job status, create tasks)
  const jobsForDepartment: Job[] = sampleJobs; // Using sampleJobs as a placeholder

  return (
    <div className="space-y-6">
      <Button variant="outline" asChild className="font-body">
        <Link href="/planning">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Production Pipeline
        </Link>
      </Button>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-2xl">
            <ListChecks className="mr-3 h-8 w-8 text-primary" />
            Planning for: {departmentDisplayName}
          </CardTitle>
          <CardDescription className="font-body">
            Review jobs assigned or suggested for the {departmentDisplayName.toLowerCase()} department. Select jobs and forward them to the departmental task queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-6">
            <Button disabled className="font-body">
              <Send className="mr-2 h-4 w-4" /> Forward Selected to Tasks (Coming Soon)
            </Button>
          </div>

          {jobsForDepartment.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] font-headline">Job ID</TableHead>
                  <TableHead className="font-headline">Job Name</TableHead>
                  <TableHead className="font-headline">Customer</TableHead>
                  <TableHead className="font-headline">Quantity</TableHead>
                  <TableHead className="font-headline">Dispatch Date</TableHead>
                  <TableHead className="font-headline">Status</TableHead>
                  {/* Add a checkbox column for selection if needed */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobsForDepartment.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-sm font-body">{job.jobCardNumber}</TableCell>
                    <TableCell className="font-medium font-body">{job.jobName}</TableCell>
                    <TableCell className="font-body">{job.customerName}</TableCell>
                    <TableCell className="font-body">{job.netQuantity.toLocaleString()}</TableCell>
                    <TableCell className="font-body">{new Date(job.dispatchDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === "Pending Planning" ? "default" : "secondary"} className="font-body">
                        {job.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Image src="https://placehold.co/300x200.png" alt="No jobs for this department" width={300} height={200} className="mb-6 rounded-lg" data-ai-hint="empty state clipboard"/>
              <h3 className="text-xl font-semibold mb-2 font-headline">No Jobs for {departmentDisplayName}</h3>
              <p className="text-muted-foreground mb-4 font-body">
                There are currently no jobs assigned or suggested for this department, or all jobs have been processed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
