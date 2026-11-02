"use client";

import { useEffect, useState } from "react";
import { LoaderCircleIcon, RefreshCwIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SimulatorId } from "@/lib/ai/facts";

interface Analysis {
  headline: string;
  insights: string[];
  risks: string[];
  recommendation: string;
  model: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; analysis: Analysis; forKey: string }
  | { kind: "error"; message: string };

/**
 * "AI analyst" panel: one click sends the current inputs to /api/explain, which
 * re-runs the engine and asks Gemini for a short read. Renders nothing when the
 * deployment has no Gemini key.
 */
export function AiAnalyst({ simulator, inputs, className }: { simulator: SimulatorId; inputs: object; className?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const key = JSON.stringify(inputs);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/explain", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => setEnabled(Boolean(j.enabled)))
      .catch(() => {
        if (!ctrl.signal.aborted) setEnabled(false);
      });
    return () => ctrl.abort();
  }, []);

  if (enabled !== true) return null;

  const stale = status.kind === "ready" && status.forKey !== key;
  const loading = status.kind === "loading";

  const run = async () => {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: key && `{"simulator":${JSON.stringify(simulator)},"inputs":${key}}`,
      });
      const json = (await res.json().catch(() => ({}))) as Partial<Analysis> & { error?: string };
      if (!res.ok || !json.headline) throw new Error(json.error ?? `The analyst returned an error (${res.status}).`);
      setStatus({ kind: "ready", analysis: json as Analysis, forKey: key });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  return (
    <section className={cn("print-break rounded-xl border border-hairline bg-surface", status.kind !== "ready" && "no-print", className)} aria-label="AI analyst">
      <header className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 max-w-xl">
          <p className="eyebrow flex items-center gap-1.5">
            <SparklesIcon className="size-3 text-brand" aria-hidden /> AI analyst · Gemini
          </p>
          <h2 className="mt-1.5 font-heading text-[1.5rem] leading-tight text-balance">
            {status.kind === "ready" ? status.analysis.headline : "What does this scenario actually mean?"}
          </h2>
          {status.kind !== "ready" && (
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
              Three insights, two risks and one next move — written from the numbers on this page and nothing else.
            </p>
          )}
          {stale && <p className="mt-1 text-xs text-ink-3">The inputs have changed since this was written.</p>}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="no-print inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[0.8125rem] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
          ) : status.kind === "ready" ? (
            <RefreshCwIcon className="size-3.5" aria-hidden />
          ) : (
            <SparklesIcon className="size-3.5" aria-hidden />
          )}
          {loading ? "Thinking…" : status.kind === "ready" ? (stale ? "Re-analyse" : "Refresh") : status.kind === "error" ? "Try again" : "Explain this scenario"}
        </button>
      </header>

      {loading && (
        <div className="space-y-2.5 border-t border-hairline p-4 sm:p-5" aria-hidden>
          {[88, 72, 80, 56].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {status.kind === "error" && (
        <p className="flex items-start gap-2 border-t border-hairline px-4 py-3 text-sm text-critical-text sm:px-5">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {status.message}
        </p>
      )}

      {status.kind === "ready" && (
        <div className={cn("grid border-t border-hairline transition-opacity lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]", stale && "opacity-60")}>
          <div className="p-4 sm:p-5">
            <p className="eyebrow">Insights</p>
            <ol className="mt-3 space-y-3">
              {status.analysis.insights.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                  <span className="mt-0.5 shrink-0 font-mono text-[0.6875rem] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-5 border-t border-hairline p-4 sm:p-5 lg:border-t-0 lg:border-l">
            <div>
              <p className="eyebrow">Watch out for</p>
              <ul className="mt-3 space-y-2.5">
                {status.analysis.risks.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-2">
                    <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border-l-2 border-brand bg-background/70 px-3.5 py-3">
              <p className="eyebrow">Try next</p>
              <p className="mt-1.5 text-sm leading-relaxed">{status.analysis.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-hairline px-4 py-2.5 text-xs leading-relaxed text-ink-3 sm:px-5">
        {status.kind === "ready" ? `Written by ${status.analysis.model} from the numbers above.` : "Runs on Google Gemini."} AI output for education only — not financial, tax or
        mortgage advice.
      </footer>
    </section>
  );
}
