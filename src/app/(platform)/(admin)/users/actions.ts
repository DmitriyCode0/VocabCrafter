"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/types/roles";

const VALID_ROLES: Role[] = ["student", "tutor", "superadmin"];

export async function changeUserRole(userId: string, newRole: Role) {
  // Auth check — only superadmin can call this
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "superadmin") {
    throw new Error("Forbidden");
  }

  if (!VALID_ROLES.includes(newRole)) {
    throw new Error("Invalid role");
  }

  // Use admin client to bypass RLS
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/users");
}
