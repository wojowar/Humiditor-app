"use client";

import { useSyncExternalStore } from "react";

export type Theme = "system" | "dark" | "light";

const KEY = "humidor-theme";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the theme should move this one too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    // Private browsing can throw on access; system is a safe default.
    return "system";
  }
}

// Prerendering has no localStorage, and the inline script in the document head
// has already applied the stored choice by the time this hydrates.
const getServerSnapshot = (): Theme => "system";

export function useTheme(): [Theme, (next: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = (next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // A failed write costs persistence, not the current session's theme.
    }
    applyTheme(next);
    listeners.forEach((l) => l());
  };

  return [theme, setTheme];
}

export function applyTheme(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/**
 * Runs before first paint so a stored theme doesn't flash the other one.
 * Kept as a string because it has to be inlined into the document head.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}`;
