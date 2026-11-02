import Link from "next/link";
import { site, simulators } from "@/lib/site";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-hairline">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span className="font-heading text-lg">{site.name}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{site.tagline}</p>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            Estimates for planning and education only — not financial, tax or mortgage advice.
          </p>
        </div>
        <div>
          <p className="eyebrow">Simulators</p>
          <ul className="mt-3 space-y-2 text-sm">
            {simulators.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="text-ink-2 transition-colors hover:text-foreground">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Built with</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Recharts · Radix UI · Vitest · Gemini
          </p>
          {site.authorName && (
            <p className="mt-4 text-sm text-ink-2">
              Designed & built by{" "}
              {site.authorUrl ? (
                <a href={site.authorUrl} className="text-foreground underline decoration-hairline underline-offset-4 hover:decoration-brand">
                  {site.authorName}
                </a>
              ) : (
                <span className="text-foreground">{site.authorName}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
