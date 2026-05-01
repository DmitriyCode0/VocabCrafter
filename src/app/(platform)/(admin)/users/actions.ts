"use server";

import { ALL_CEFR_LEVELS, getAllowedCefrLevels } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/types/roles";
import type { CEFRLevel } from "@/types/quiz";

const VALID_ROLES: Role[] = ["student", "tutor", "superadmin"];

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "superadmin") {
    throw new Error("Forbidden");
  }
}

export async function changeUserRole(userId: string, newRole: Role) {
  await requireSuperadmin();

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

export async function changeUserCefrLevel(
  userId: string,
  newCefrLevel: CEFRLevel,
) {
  await requireSuperadmin();

  if (!ALL_CEFR_LEVELS.includes(newCefrLevel)) {
    throw new Error("Invalid CEFR level");
  }

  const admin = createAdminClient();
  const { data: targetProfile, error: targetProfileError } = await admin
    .from("profiles")
    .select("role, preferred_language")
    .eq("id", userId)
    .single();

  if (targetProfileError || !targetProfile) {
    throw new Error(targetProfileError?.message ?? "Student not found");
  }

  if (targetProfile.role !== "student") {
    throw new Error("Only student CEFR levels can be changed");
  }

  const allowedCefrLevels = getAllowedCefrLevels(
    targetProfile.preferred_language,
  );

  if (!allowedCefrLevels.includes(newCefrLevel)) {
    throw new Error("Invalid CEFR level for the student's language");
  }

  const { error } = await admin
    .from("profiles")
    .update({ cefr_level: newCefrLevel })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/users");
}

export async function setGrammarArticleEditorPermission(
  userId: string,
  enabled: boolean,
) {
  await requireSuperadmin();

  const admin = createAdminClient();
  const { data: targetProfile, error: targetProfileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (targetProfileError || !targetProfile) {
    throw new Error(targetProfileError?.message ?? "User not found");
  }

  if (targetProfile.role !== "tutor") {
    throw new Error("Only tutors can receive article editor access");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (enabled) {
    const { error } = await admin
      .from("grammar_article_editor_permissions")
      .upsert({
        user_id: userId,
        granted_by: user.id,
      });

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await admin
      .from("grammar_article_editor_permissions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/users");
  revalidatePath("/library");
}

export async function setDictionaryEditorPermission(
  userId: string,
  enabled: boolean,
) {
  await requireSuperadmin();

  const admin = createAdminClient();
  const { data: targetProfile, error: targetProfileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (targetProfileError || !targetProfile) {
    throw new Error(targetProfileError?.message ?? "User not found");
  }

  if (targetProfile.role !== "tutor") {
    throw new Error("Only tutors can receive dictionary editor access");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (enabled) {
    const { error } = await admin
      .from("passive_vocabulary_dictionary_editor_permissions")
      .upsert({
        user_id: userId,
        granted_by: user.id,
      });

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await admin
      .from("passive_vocabulary_dictionary_editor_permissions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/users");
  revalidatePath("/library");
}
