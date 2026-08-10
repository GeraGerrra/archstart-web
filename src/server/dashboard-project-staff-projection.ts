import "server-only";

import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import { PROJECT_UUID_PATTERN } from "@/src/project-workspace/policy";

export async function hasActiveProjectStaffRole(userId: string): Promise<boolean> {
  if (!PROJECT_UUID_PATTERN.test(userId)) return false;
  const secretClient = createSecretSupabaseClient();
  const { data, error } = await secretClient.rpc(
    "get_project_staff_roles_for_service",
    { p_user_id: userId },
  );
  return !error && Array.isArray(data) && data.length > 0;
}
