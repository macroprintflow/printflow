
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, TrendingUp, ListChecks, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
  // const cardBaseStyle = "rounded-[16px] border border-white/15 bg-background/50 backdrop-blur-xl shadow-md shadow-black/10 [box-shadow:inset_0_0_0_2px_rgba(255,255,255,0.14)]"; // Removed this line

  return (
    <div className="grid gap-6 p-6">
      {/* Dashboard Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card> {/* Removed cardBaseStyle */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Total Jobs Today</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">0</div>
            <p className="text-xs text-muted-foreground font-body">N/A</p>
          </CardContent>
        </Card>

        <Card> {/* Removed cardBaseStyle */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Jobs In Progress</CardTitle>
            <ListChecks className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">0</div>
            <p className="text-xs text-muted-foreground font-body">Across all departments</p>
          </CardContent>
        </Card>

        <Card> {/* Removed cardBaseStyle */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Completed Today</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">0</div>
            <p className="text-xs text-muted-foreground font-body">N/A</p>
          </CardContent>
        </Card>

        <Card> {/* Removed cardBaseStyle */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Avg. Wastage</CardTitle>
            <BarChart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">0.0%</div>
            <p className="text-xs text-muted-foreground font-body">N/A</p>
          </CardContent>
        </Card>
      </div>

      {/* Welcome Message */}
      <Card> {/* Removed cardBaseStyle */}
        <CardHeader>
          <CardTitle className="font-headline text-xl">Welcome to PrintFlow</CardTitle>
          <CardDescription className="font-body text-base">
            Manage your printing and packaging jobs efficiently.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-body text-base">
            This is your main dashboard. From here, you can get an overview of ongoing jobs, production status, and key performance indicators. Use the sidebar to navigate to different sections of the application.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
