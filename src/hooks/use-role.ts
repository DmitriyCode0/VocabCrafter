"use client";

import { useUser } from "./use-user";
import type { Role } from "@/types/roles";

interface UseRoleReturn {
  role: Role | null;
  isLoading: boolean;
}

export function useRole(): UseRoleReturn {
  const { profile, isLoading } = useUser();

  return {
    role: profile?.role ?? null,
    isLoading,
  };
}
