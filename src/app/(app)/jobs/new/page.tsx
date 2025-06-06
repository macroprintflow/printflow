import { JobCardForm } from "@/components/job-card/JobCardForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewJobPage() {
  return (
    <div className="max-w-5xl mx-auto">
        <JobCardForm />
    </div>
  );
}
