"use client";

import { flushSync } from "react-dom";

type ViewTransitionLike = {
  finished: Promise<unknown>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

const THEME_TRANSITION_MS = 1000;
let fallbackTransitionTimer: number | null = null;

/**
 * Runs a DOM theme change inside a gentle View Transition crossfade (with CSS fallback)
 * so switching Dark <-> Light or Color Palettes never flashes abruptly.
 */
export function runWithThemeTransition(
  applyChange: () => void,
  onSettled?: () => void,
) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    applyChange();
    onSettled?.();
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    applyChange();
    onSettled?.();
    return;
  }

  const root = document.documentElement;
  const doc = document as DocumentWithViewTransition;

  if (typeof doc.startViewTransition === "function") {
    root.dataset.themeTransitioning = "true";

    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        applyChange();
      });
    });

    void transition.finished
      .catch(() => undefined)
      .finally(() => {
        delete root.dataset.themeTransitioning;
        onSettled?.();
      });
    return;
  }

  if (fallbackTransitionTimer !== null) {
    window.clearTimeout(fallbackTransitionTimer);
  }

  root.classList.add("theme-color-transition");
  applyChange();

  fallbackTransitionTimer = window.setTimeout(() => {
    root.classList.remove("theme-color-transition");
    fallbackTransitionTimer = null;
    onSettled?.();
  }, THEME_TRANSITION_MS + 40);
}
