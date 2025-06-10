
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, Search, Filter, Eye } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { getJobCards } from "@/lib/actions/jobActions";
import type { JobCardData } from "@/lib/definitions";
import { format } from "date-fns";
import { handlePrintJobCard } from "@/lib/printUtils"; 

export default async function AllJobsPage() {
  const allJobs: JobCardData[] = await getJobCards();
  // Sort by creation date, newest first
  allJobs.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  const cardBaseStyle = "rounded-[16px] border border-white/15 bg-background/50 backdrop-blur-xl shadow-md shadow-black/10 [box-shadow:inset_0_0_0_2px_rgba(255,255,255,0.14)]";
  const buttonPrimaryStyle = "font-body text-base h-11 px-6 rounded-xl border border-primary/30 bg-primary/20 backdrop-blur-lg shadow-md shadow-black/10 [box-shadow:inset_0_0_0_1.5px_hsla(var(--primary-hsl)/0.3)] hover:bg-primary/30 text-primary-foreground";
  const buttonOutlineStyle = "font-body text-base h-11 px-6 rounded-xl border border-white/15 bg-foreground/5 backdrop-blur-lg shadow-md shadow-black/5 [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-foreground/10";
  const inputStyle = "font-body text-base bg-input/30 backdrop-blur-md border-white/20 rounded-xl h-11 pl-10";


  return (
    <div className="space-y-6">
      <Card className={cardBaseStyle}>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="font-headline text-xl">All Job Cards</CardTitle> {/* Adjusted text size */}
            <CardDescription className="font-body text-base">View, search, and manage all active and completed jobs.</CardDescription> {/* Adjusted text size */}
          </div>
          <Button asChild className={buttonPrimaryStyle}>
            <Link href="/jobs/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Job Card
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:w-auto flex-grow sm:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search jobs by name, ID, customer..." className={inputStyle} disabled /> {/* Search to be implemented */}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className={buttonOutlineStyle} disabled> {/* Filter to be implemented */}
                <Filter className="mr-2 h-4 w-4" /> Filter
              </Button>
            </div>
          </div>

          {allJobs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-headline">Job No.</TableHead>
                <TableHead className="font-headline">Job Name</TableHead>
                <TableHead className="font-headline">Customer</TableHead>
                <TableHead className="font-headline">Date</TableHead>
                <TableHead className="font-headline">Status</TableHead>
                <TableHead className="font-headline">Job Size</TableHead>
                <TableHead className="font-headline text-center">Linked Cards</TableHead>
                <TableHead className="font-headline text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allJobs.map((job: JobCardData) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-sm font-body">{job.jobCardNumber || job.id}</TableCell>
                  <TableCell className="font-medium font-body">{job.jobName}</TableCell>
                  <TableCell className="font-body">{job.customerName}</TableCell>
                  <TableCell className="font-body text-xs">{format(new Date(job.createdAt || job.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={job.status === "Completed" || job.status === "Billed" ? "secondary" : "default"} className="font-body">
                      {job.status || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-body">{job.jobSizeWidth} x {job.jobSizeHeight} in</TableCell>
                  <TableCell className="text-center font-body">{job.linkedJobCardIds?.length || "-"}</TableCell>
                  <TableCell className="text-right">
                    {/* Action buttons inside table rows are typically small and less prominent, so glass styling might be too much. Using ghost for now. */}
                    <Button variant="ghost" size="sm" asChild className="font-body" title="View Details (Coming Soon)">
                      <Link href={`/jobs/${job.id}`}> {/* Using internal ID for route key */}
                        <Eye className="mr-1 h-4 w-4" /> View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Image src="https://placehold.co/300x200.png" alt="No jobs found" width={300} height={200} className="mb-6 rounded-lg" data-ai-hint="empty state document"/>
              <h3 className="text-xl font-semibold mb-2 font-headline">No Jobs Yet</h3>
              <p className="text-muted-foreground mb-4 font-body text-base">Get started by creating a new job card.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
