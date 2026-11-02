import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { simulators } from "@/lib/site";
import { HeroPlot } from "@/components/home/hero-plot";
import { MiniBreakEven, MiniMortgage, MiniRunway } from "@/components/home/mini-charts";

const previews = {
  "/runway": MiniRunway,
  "/mortgage": MiniMortgage,
  "/break-even": MiniBreakEven,
} as const;

const features = [
  {
    label: "Monte Carlo engine",
    body: "1,000 seeded simulations per scenario, so a shared link reproduces the exact same odds on any machine.",
  },
  {
    label: "Real Canadian rules",
    body: "B-20 stress test, CMHC premiums, GDS/TDS limits and semi-annual compounding — encoded and unit-tested.",
  },
  {
    label: "Every view is a link",
    body: "Inputs are compressed into the URL. Send a scenario to a co-founder, lender or client in one click.",
  },
  {
    label: "Export anything",
    body: "Download the monthly projection or amortization schedule as CSV, or print a clean PDF report.",
  },
  {
    label: "Accessible charts",
    body: "Colour-blind-validated palette, keyboard-friendly controls, and a table view behind every chart.",
  },
  {
    label: "Tested & typed",
    body: "Pure TypeScript engines covered by Vitest, checked on every push by GitHub Actions CI.",
  },
];

const snippet = `import { monteCarlo, summarize } from "@/lib/sim/runway";

const plan = { startingCash: 1_200_000, arpu: 99, churnRate: 3, /* … */ };

summarize(plan).runwayMonths;          // 14.1
monteCarlo(plan, { runs: 1000, uncertainty: 0.2 })
  .cashOutProbability;                 // 0.9`;

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="grain relative overflow-hidden border-b border-hairline">
        <div className="bg-graph pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
        <div className="relative mx-auto max-w-[1320px] px-4 pt-14 pb-12 sm:px-6 md:pt-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:items-end">
            <div className="animate-rise">
              <p className="eyebrow">Plotline · business simulators</p>
              <h1 className="mt-4 font-heading text-[3.1rem] leading-[0.98] font-normal tracking-[-0.03em] sm:text-[4.6rem] lg:text-[5.4rem]">
                Run the numbers <em className="text-brand">before</em> they run you.
              </h1>
            </div>
            <div className="animate-rise [animation-delay:150ms] lg:pb-3">
              <p className="text-base leading-relaxed text-ink-2">
                Three interactive simulators for the decisions you can&apos;t undo — how long the cash lasts, what home you can really afford, and the price
                that actually maximises profit.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href="/runway"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85"
                >
                  Open the runway simulator <ArrowRightIcon className="size-4" aria-hidden />
                </Link>
                <a
                  href="#simulators"
                  className="inline-flex h-10 items-center rounded-lg border border-input bg-surface px-4 text-sm font-medium transition-colors hover:border-foreground"
                >
                  All simulators
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-hairline bg-surface/80 p-4 shadow-[0_30px_60px_-40px_rgb(0_0_0/0.35)] backdrop-blur-sm sm:p-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Same startup, three plans</p>
              <Link href="/runway" className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-foreground">
                Tweak these scenarios <ArrowUpRightIcon className="size-3.5" aria-hidden />
              </Link>
            </div>
            <HeroPlot />
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-4">
            {[
              ["3", "simulators"],
              ["1,000", "Monte Carlo runs per scenario"],
              ["41", "unit tests on the engines"],
              ["0", "sign-ups or tracking"],
            ].map(([v, l]) => (
              <div key={l} className="bg-surface px-4 py-4">
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="block text-[1.75rem] leading-none font-semibold tracking-tight">{v}</span>
                  <span className="mt-1.5 block text-xs text-ink-3">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Simulators */}
      <section id="simulators" className="mx-auto max-w-[1320px] scroll-mt-20 px-4 pt-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The simulators</p>
            <h2 className="mt-3 max-w-xl font-heading text-[2.4rem] leading-[1.05] tracking-[-0.02em]">Pick a question. Move the sliders. See the consequences.</h2>
          </div>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {simulators.map((s) => {
            const Preview = previews[s.href];
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-input hover:shadow-[0_24px_48px_-32px_rgb(0_0_0/0.4)]"
              >
                <div className="border-b border-hairline bg-background/40 px-5 pt-5 pb-3">
                  <Preview />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="eyebrow">
                    {s.index} <span className="mx-1 text-hairline">/</span> {s.kicker}
                  </p>
                  <h3 className="mt-2.5 font-heading text-[1.6rem] leading-tight tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-ink-2">{s.blurb}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                    Open simulator
                    <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Under the hood */}
      <section className="mx-auto max-w-[1320px] px-4 pt-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="eyebrow">Under the hood</p>
            <h2 className="mt-3 max-w-lg font-heading text-[2.4rem] leading-[1.05] tracking-[-0.02em]">
              Pure, tested engines. <em className="text-ink-2">Honest</em> charts.
            </h2>
            <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-2">
              The maths lives in framework-free TypeScript modules with no UI dependencies, so the same engine powers the charts, the CSV exports and
              the static images on this page.
            </p>
            <pre className="mt-8 overflow-x-auto rounded-xl border border-hairline bg-[#141311] p-5 font-mono text-[0.78rem] leading-relaxed text-[#e9e6dd] dark:bg-black/40">
              <code>{snippet}</code>
            </pre>
          </div>
          <dl className="grid gap-px self-start overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2">
            {features.map((f, i) => (
              <div key={f.label} className="bg-surface p-5">
                <dt className="flex items-center gap-2 text-sm font-medium">
                  <span className="font-mono text-[0.6875rem] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  {f.label}
                </dt>
                <dd className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">{f.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1320px] px-4 pt-24 sm:px-6">
        <div className="grain relative overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-background sm:px-12">
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <h2 className="max-w-2xl font-heading text-[2.2rem] leading-[1.05] tracking-[-0.02em] sm:text-[3rem]">
              Need a simulator, calculator or dashboard for <em className="text-brand">your</em> business?
            </h2>
            <p className="max-w-sm text-sm leading-relaxed opacity-75">
              Plotline is a portfolio project — the same engine-first approach works for pricing tools, ROI calculators, quoting systems and internal
              forecasting apps.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
