import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Platform usage metrics and performance data.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            Platform analytics with user engagement, quiz completion rates, and
            performance trends will be available here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
