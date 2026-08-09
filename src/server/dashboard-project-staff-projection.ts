import "server-only";

import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import { PROJECT_UUID_PATTERN } from "@/src/project-workspace/policy";

export async function hasActiveProjectStaffRole(userId: string): Promise<boolean> {
  if (!PROJECT_UUID_PATTERN.test(userId)) return false;
  const secretClient = createSecretSupabaseClient();
  const { data, error } = await secretClient
    .schema("private")
    .from("project_staff_roles")
    .select("staff_role")
    .eq("user_id", userId)
    .eq("active", true)
    .in("staff_role", ["reviewer", "admin"])
    .limit(1);
  return !error && Array.isArray(data) && data.length === 1;
}
