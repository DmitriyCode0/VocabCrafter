import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Role } from "@/types/roles";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, PlusCircle, Users } from "lucide-react";

export default async function ClassesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as Role;

  if (role === "tutor" || role === "superadmin") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
            <p className="text-muted-foreground">
              Create and manage your classes, invite students, and assign
              quizzes.
            </p>
          </div>
          <Button disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Class
          </Button>
        </div>

        <Card>
          <CardHeader className="items-center text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No classes yet</CardTitle>
            <CardDescription>
              Create your first class to start managing students and assigning
              vocabulary activities.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Classes</h1>
        <p className="text-muted-foreground">
          Join classes and access assigned quizzes from your tutors.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">No classes yet</CardTitle>
          <CardDescription>
            Ask your tutor for a join code to get started with assigned quizzes
            and activities.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
