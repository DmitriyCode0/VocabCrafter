import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review</h1>
        <p className="text-muted-foreground">
          Review student submissions and provide feedback.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">No submissions to review</CardTitle>
          <CardDescription>
            Student quiz attempts will appear here once they start completing
            your assigned activities.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
