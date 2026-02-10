import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function AssignmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <p className="text-muted-foreground">
          Create and manage quiz assignments for your classes.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">No assignments yet</CardTitle>
          <CardDescription>
            Create a class first, then assign quizzes to your students with
            deadlines and instructions.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
