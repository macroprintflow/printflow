
import { JobCardForm } from "@/components/job-card/JobCardForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutList } from "lucide-react";
import Link from "next/link";

export default function NewJobPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-end">
            <Button asChild variant="outline">
                <Link href="/templates">
                    <LayoutList className="mr-2 h-4 w-4" />
                    Manage Job Templates
                </Link>
            </Button>
        </div>
        <JobCardForm />
    </div>
  );
}
