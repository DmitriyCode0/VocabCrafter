import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/types/roles";

export async function canUserEditDictionary(
  userId: string,
  role: Role | null | undefined,
) {
  if (role === "superadmin") {
    return true;
  }

  if (role !== "tutor") {
    return false;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("passive_vocabulary_dictionary_editor_permissions")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function listDictionaryEditorPermissionUserIds() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("passive_vocabulary_dictionary_editor_permissions")
    .select("user_id");

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((item) => item.user_id));
}
