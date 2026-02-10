import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage platform users, roles, and permissions.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            User management with role assignment, account status, and activity
            monitoring will be available here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
