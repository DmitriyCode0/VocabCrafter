import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreditCard } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Platform billing and cost tracking.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            AI usage costs, subscription management, and billing history will be
            available here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
