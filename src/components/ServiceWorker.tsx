"use client";

import { useEffect } from "react";

/** Registers the offline shell. Dev is skipped so HMR isn't fighting a cache. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // An unavailable service worker costs offline support, nothing more.
    });
  }, []);
  return null;
}
