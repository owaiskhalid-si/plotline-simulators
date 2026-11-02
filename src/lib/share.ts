"use client";

import { useEffect, useRef, useState } from "react";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export function encodeState(value: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(value));
}

export function decodeState(encoded: string): unknown {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

/**
 * State that lives in the URL (`?s=…`) so every view is a shareable link.
 * The page prerenders with defaults; a shared link is applied after mount.
 */
export function useUrlState<T>(defaults: T, sanitize: (raw: unknown) => T) {
  const [state, setState] = useState<T>(defaults);
  const ready = useRef(false);
  const sanitizeRef = useRef(sanitize);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("s");
    const raw = encoded ? decodeState(encoded) : null;
    ready.current = true;
    // Applying external (URL) state once on mount is the intended use of an effect here.
    if (raw) setState(sanitizeRef.current(raw));
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    const id = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const encoded = encodeState(state);
      if (encoded === encodeState(defaults)) url.searchParams.delete("s");
      else url.searchParams.set("s", encoded);
      window.history.replaceState(window.history.state, "", url);
    }, 250);
    return () => window.clearTimeout(id);
  }, [state, defaults]);

  return [state, setState] as const;
}

/** The current date, only after mount — avoids prerender/hydration mismatches. */
export function useToday(): Date | null {
  const [today, setToday] = useState<Date | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToday(new Date()), []);
  return today;
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
