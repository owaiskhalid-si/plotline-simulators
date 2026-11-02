"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { site, simulators } from "@/lib/site";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { GithubIcon } from "./github-icon";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${site.name} home`}>
          <LogoMark className="size-6" />
          <span className="font-heading text-[1.35rem] leading-none font-medium tracking-tight">{site.name}</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Simulators">
          {simulators.map((s) => {
            const active = pathname === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-[0.8125rem] text-ink-2 transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                <span className="mr-1.5 font-mono text-[0.6875rem] text-ink-3">{s.index}</span>
                {s.short}
                {active && <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {site.repoUrl && (
            <a
              href={site.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="grid size-8 place-items-center rounded-md text-ink-2 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Source code on GitHub"
            >
              <GithubIcon className="size-4" />
            </a>
          )}
          <ThemeToggle />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-hairline px-4 py-1.5 md:hidden" aria-label="Simulators">
        {simulators.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={pathname === s.href ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs text-ink-2",
              pathname === s.href && "bg-muted text-foreground",
            )}
          >
            <span className="mr-1 font-mono text-[0.625rem] text-ink-3">{s.index}</span>
            {s.short}
          </Link>
        ))}
      </nav>
    </header>
  );
}
