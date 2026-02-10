import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review Submission</h1>
        <p className="text-muted-foreground">Attempt ID: {id}</p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            Detailed review of student answers with AI-assisted feedback and
            manual scoring is being built.
          </CardDescription>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/review">Back to Review</Link>
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
