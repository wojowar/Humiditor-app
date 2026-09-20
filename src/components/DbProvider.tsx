"use client";

import { useEffect, useState } from "react";
import { ensureSeeded } from "@/lib/db";

/**
 * IndexedDB only exists in the browser, so every read has to wait for mount.
 * Gating the tree here means individual pages can assume the store is ready
 * and seeded instead of each guarding for it.
 */
export function DbProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded().then(
      () => setReady(true),
      (e: unknown) =>
        setError(
          e instanceof Error
            ? e.message
            : "Could not open local storage. Private browsing can block it.",
        ),
    );
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="rounded-lg border p-4 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Opening humidor...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
