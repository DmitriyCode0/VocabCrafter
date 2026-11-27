"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getBrowserTimeZone,
  USER_TIMEZONE_COOKIE_NAME,
} from "@/lib/lesson-timezone";

const emptySubscribe = () => () => {};

/**
 * Hydration-safe browser IANA timezone hook: returns `null` during SSR/first paint
 * and the device's IANA timezone (e.g. "Europe/Warsaw") once mounted on the client.
 */
export function useClientTimeZone(): string | null {
  return useSyncExternalStore(
    emptySubscribe,
    () => getBrowserTimeZone(),
    () => null,
  );
}

export function TimezoneCookieSync() {
  useEffect(() => {
    const tz = getBrowserTimeZone();
    if (!tz) return;
    try {
      document.cookie = `${USER_TIMEZONE_COOKIE_NAME}=${encodeURIComponent(tz)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      // Ignore cookie write failures
    }
  }, []);

  return null;
}
