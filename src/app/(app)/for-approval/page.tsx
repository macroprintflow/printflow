
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, FileText } from "lucide-react";

export default function ForApprovalPage() {
  // Placeholder for actual designs needing approval
  const designsForApproval = [
    { id: "pdf1", name: "Marketing Brochure Q3.pdf", uploader: "Designer Alice", date: "2024-07-28" },
    { id: "pdf2", name: "New Product Packaging_v2.pdf", uploader: "Designer Bob", date: "2024-07-29" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" />
            Designs Pending Approval
          </CardTitle>
          <CardDescription className="font-body">
            This section is for designers to upload their PDF artwork for manager approval.
            Approved designs will become available for job card creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button disabled> {/* Functionality to be implemented later */}
            <UploadCloud className="mr-2 h-4 w-4" /> Upload New Design PDF
          </Button>

          {/* Placeholder list of designs awaiting approval */}
          {designsForApproval.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium font-headline">Awaiting Approval:</h3>
              <ul className="space-y-3">
                {designsForApproval.map(design => (
                  <li key={design.id} className="flex items-center justify-between p-3 border rounded-md bg-card hover:shadow-sm">
                    <div className="flex items-center">
                      <FileText className="mr-3 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium font-body">{design.name}</p>
                        <p className="text-xs text-muted-foreground font-body">Uploaded by {design.uploader} on {design.date}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled>Review & Approve</Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground font-body text-center py-4">
              No designs are currently awaiting approval.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
