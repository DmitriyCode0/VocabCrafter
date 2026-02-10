import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users } from "lucide-react";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Class Details</h1>
        <p className="text-muted-foreground">Class ID: {id}</p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            Class management with student roster, join codes, and assignment
            tracking is being built.
          </CardDescription>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/classes">Back to Classes</Link>
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
