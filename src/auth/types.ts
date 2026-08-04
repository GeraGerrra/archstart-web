import type { ProfileRow } from "@/src/lib/supabase/database.types";

export type AuthFieldName = "firstName" | "lastName" | "email" | "password" | "passwordConfirm" | "discoverySource";

export interface AuthActionState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<AuthFieldName, string>>;
}

export const INITIAL_AUTH_ACTION_STATE: AuthActionState = Object.freeze({ status: "idle" });

export type AuthProfile = ProfileRow;

export interface AuthContext {
  userId: string;
  email: string;
  profile: AuthProfile | null;
}
