
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

const sampleJobs = [
  { id: "JOB001", name: "Luxury Perfume Box", customer: "Chic Fragrances", status: "Printing", dispatchDate: "2024-08-15", jobSize: "3.94x1.97x5.91in", linked: 3 },
  { id: "JOB002", name: "Software Packaging", customer: "Tech Solutions Ltd.", status: "Designing", dispatchDate: "2024-08-20", jobSize: "7.87x5.91x1.97in", linked: 1 },
  { id: "JOB003", name: "Gourmet Chocolate Sleeve", customer: "Sweet Delights Co.", status: "Coating", dispatchDate: "2024-08-10", jobSize: "3.15x7.09x0.79in", linked: 1 },
  { id: "JOB004", name: "Promotional Flyers", customer: "Events Pro", status: "Completed", dispatchDate: "2024-07-30", jobSize: "A5", linked: 0 },
  { id: "JOB005", name: "Rigid Gift Box Set", customer: "Premium Gifts Inc.", status: "Die Cutting", dispatchDate: "2024-08-25", jobSize: "Multiple", linked: 5 },
];

export default function AllJobsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">All Job Cards</CardTitle>
          <CardDescription className="font-body">View, search, and manage all active and completed jobs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:w-auto flex-grow sm:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search jobs by name, ID, customer..." className="pl-10 w-full sm:w-80 font-body" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="font-body">
                <Filter className="mr-2 h-4 w-4" /> Filter
              </Button>
            </div>
          </div>

          {sampleJobs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-headline">Job ID</TableHead>
                <TableHead className="font-headline">Job Name</TableHead>
                <TableHead className="font-headline">Customer</TableHead>
                <TableHead className="font-headline">Status</TableHead>
                <TableHead className="font-headline">Dispatch Date</TableHead>
                <TableHead className="font-headline">Job Size</TableHead>
                <TableHead className="font-headline text-center">Linked Cards</TableHead>
                <TableHead className="font-headline text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-sm font-body">{job.id}</TableCell>
                  <TableCell className="font-medium font-body">{job.name}</TableCell>
                  <TableCell className="font-body">{job.customer}</TableCell>
                  <TableCell>
                    <Badge variant={job.status === "Completed" ? "secondary" : "default"} className="font-body">
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-body">{job.dispatchDate}</TableCell>
                  <TableCell className="font-body">{job.jobSize}</TableCell>
                  <TableCell className="text-center font-body">{job.linked > 0 ? job.linked : "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild className="font-body">
                      <Link href={`/jobs/${job.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Image src="https://placehold.co/300x200.png" alt="No jobs found" width={300} height={200} className="mb-6 rounded-lg" data-ai-hint="empty state illustration"/>
              <h3 className="text-xl font-semibold mb-2 font-headline">No Jobs Yet</h3>
              <p className="text-muted-foreground mb-4 font-body">Get started by creating a new job card.</p>
              <Button asChild className="font-body">
                <Link href="/jobs/new">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Job
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
