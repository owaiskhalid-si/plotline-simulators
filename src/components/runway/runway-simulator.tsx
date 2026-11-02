"use client";

import { useDeferredValue, useMemo } from "react";
import { RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, monthFromNow } from "@/lib/format";
import { downloadCsv, useToday, useUrlState } from "@/lib/share";
import { clamp, sanitize } from "@/lib/sim/fields";
import {
  DEFAULT_RUNWAY,
  monteCarlo,
  RUNWAY_FIELDS,
  RUNWAY_PRESETS,
  summarize,
  type RunwayInputs,
  type RunwayKey,
  type RunwayPresetId,
  type RunwaySummary,
} from "@/lib/sim/runway";
import { ControlGroup, Segmented, SliderField } from "@/components/sim/field";
import { Badge, HeroFigure, StatGrid, StatTile, type Tone } from "@/components/sim/stat";
import { AiAnalyst } from "@/components/sim/ai-analyst";
import { ChartFrame, CsvButton, DataTable, PrintButton, ShareButton, SimHeader, SimLayout, type Column } from "@/components/sim/frame";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CashChart, CustomersChart, FanChart, ProfitVsCostChart, SurvivalChart } from "./runway-charts";

interface Scenario extends RunwayInputs {
  name: string;
}

interface RunwayState {
  scenarios: Scenario[];
  active: number;
  compare: boolean;
  uncertainty: number;
}

const DEFAULT_STATE: RunwayState = {
  scenarios: [
    { name: "Base plan", ...DEFAULT_RUNWAY },
    { name: "Raise $2M in month 10", ...DEFAULT_RUNWAY, fundingAmount: 2_000_000, fundingMonth: 10 },
    { name: "Lean team", ...DEFAULT_RUNWAY, fixedCosts: 68_000, fixedCostGrowth: 1 },
  ],
  active: 0,
  compare: true,
  uncertainty: 0.2,
};

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
const LETTERS = ["A", "B", "C"];

function sanitizeState(raw: unknown): RunwayState {
  const r = (raw ?? {}) as Partial<RunwayState>;
  return {
    scenarios: DEFAULT_STATE.scenarios.map((d, i) => sanitize(d, RUNWAY_FIELDS, r.scenarios?.[i])),
    active: typeof r.active === "number" && r.active >= 0 && r.active <= 2 ? Math.round(r.active) : 0,
    compare: typeof r.compare === "boolean" ? r.compare : DEFAULT_STATE.compare,
    uncertainty: typeof r.uncertainty === "number" ? clamp(r.uncertainty, 0, 0.5) : DEFAULT_STATE.uncertainty,
  };
}

const GROUPS: Array<{ title: string; keys: RunwayKey[] }> = [
  { title: "Starting point", keys: ["startingCash", "startingCustomers", "arpu"] },
  { title: "Growth engine", keys: ["marketingSpend", "marketingGrowth", "cac", "organicGrowth", "churnRate"] },
  { title: "Costs", keys: ["grossMargin", "fixedCosts", "fixedCostGrowth"] },
  { title: "Fundraise", keys: ["fundingAmount", "fundingMonth"] },
  { title: "Forecast", keys: ["horizon"] },
];

const spec = (key: RunwayKey) => RUNWAY_FIELDS.find((f) => f.key === key)!;

export function RunwaySimulator() {
  const [state, setState] = useUrlState(DEFAULT_STATE, sanitizeState);
  const today = useToday();
  const active = state.scenarios[state.active];
  const color = COLORS[state.active];

  const summaries = useMemo(() => state.scenarios.map((s) => summarize(s)), [state.scenarios]);
  const summary = summaries[state.active];

  // Monte Carlo lags one frame behind the sliders so dragging stays smooth.
  const mcInputs = useDeferredValue(active);
  const mcUncertainty = useDeferredValue(state.uncertainty);
  const mc = useMemo(() => monteCarlo(mcInputs, { runs: 1000, uncertainty: mcUncertainty, seed: 7 }), [mcInputs, mcUncertainty]);

  const update = (patch: Partial<Scenario>) =>
    setState((s) => ({
      ...s,
      scenarios: s.scenarios.map((sc, i) => (i === s.active ? { ...sc, ...patch } : sc)),
    }));

  const loadPreset = (id: RunwayPresetId) => update({ ...RUNWAY_PRESETS[id].inputs, name: RUNWAY_PRESETS[id].label });

  const series = state.scenarios.map((s, i) => ({
    name: `${LETTERS[i]} · ${s.name}`,
    color: COLORS[i],
    summary: summaries[i],
    startingCash: s.startingCash,
    fundingMonth: s.fundingMonth,
    fundingAmount: s.fundingAmount,
  }));

  const exportCsv = () =>
    downloadCsv(
      `plotline-runway-${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
      summary.months.map((m) => ({
        month: m.month,
        customers: Math.round(m.customers),
        new_customers: Math.round(m.newCustomers),
        churned_customers: Math.round(m.churnedCustomers),
        mrr: Math.round(m.mrr),
        gross_profit: Math.round(m.grossProfit),
        marketing: Math.round(m.marketing),
        fixed_costs: Math.round(m.fixed),
        net_income: Math.round(m.netIncome),
        funding: Math.round(m.funding),
        cash: Math.round(m.cash),
      })),
    );

  return (
    <>
      <SimHeader
        index="01"
        kicker="Startup finance"
        title={
          <>
            How long will <em className="text-brand">the money</em> last?
          </>
        }
        actions={
          <>
            <ShareButton />
            <CsvButton onExport={exportCsv} />
            <PrintButton />
          </>
        }
      >
        Model cash runway and unit economics across three scenarios, then stress-test the plan against 1,000 randomised futures.
      </SimHeader>

      <SimLayout
        controls={
          <Controls
            state={state}
            active={active}
            onSelect={(i) => setState((s) => ({ ...s, active: i }))}
            onChange={update}
            onPreset={loadPreset}
            onReset={() => setState(DEFAULT_STATE)}
          />
        }
      >
        <PrintSummary scenario={active} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)]">
          <RunwayHero summary={summary} horizon={active.horizon} today={today} scenarioName={active.name} color={color} />
          <Kpis summary={summary} today={today} />
        </div>

        <AiAnalyst simulator="runway" inputs={{ ...active, name: undefined, uncertainty: state.uncertainty }} />

        <ChartFrame
          title="Cash in the bank"
          description={
            state.compare
              ? "All three scenarios. A dot marks the month a scenario runs out of cash."
              : `Scenario ${LETTERS[state.active]}, month by month.`
          }
          legend={state.compare ? series.map((s) => ({ label: s.name, color: s.color, shape: "line" as const })) : undefined}
          aside={
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <Switch checked={state.compare} onCheckedChange={(v) => setState((s) => ({ ...s, compare: v }))} aria-label="Compare all scenarios" />
              Compare
            </label>
          }
          table={<MonthlyTable summary={summary} />}
        >
          <CashChart scenarios={series} activeIndex={state.active} compare={state.compare} />
        </ChartFrame>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartFrame
            title="Gross profit vs. operating costs"
            description="The gap between the lines is your monthly burn."
            legend={[
              { label: "Gross profit", color, shape: "line" },
              { label: "Marketing + fixed costs", color: "var(--ink-3)", shape: "line" },
            ]}
          >
            <ProfitVsCostChart summary={summary} color={color} />
          </ChartFrame>
          <ChartFrame title="Paying customers" description="Paid + organic acquisition, net of churn.">
            <CustomersChart summary={summary} color={color} />
          </ChartFrame>
        </div>

        <MonteCarloSection
          mc={mc}
          startingCash={active.startingCash}
          horizon={active.horizon}
          color={color}
          uncertainty={state.uncertainty}
          onUncertainty={(u) => setState((s) => ({ ...s, uncertainty: u }))}
          stale={mcInputs !== active || mcUncertainty !== state.uncertainty}
        />

        <Scorecard series={series} active={state.active} />
      </SimLayout>
    </>
  );
}

function Controls({
  state,
  active,
  onSelect,
  onChange,
  onPreset,
  onReset,
}: {
  state: RunwayState;
  active: Scenario;
  onSelect: (i: number) => void;
  onChange: (patch: Partial<Scenario>) => void;
  onPreset: (id: RunwayPresetId) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="eyebrow">Editing scenario</p>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-foreground">
          <RotateCcwIcon className="size-3" aria-hidden /> Reset
        </button>
      </div>
      <div role="tablist" aria-label="Scenarios" className="mt-2.5 grid grid-cols-3 gap-1.5">
        {state.scenarios.map((s, i) => {
          const selected = i === state.active;
          return (
            <button
              key={i}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onSelect(i)}
              className={cn(
                "flex min-w-0 flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition-all",
                selected ? "border-foreground bg-surface shadow-[0_1px_0_var(--foreground)]" : "border-hairline hover:border-input",
              )}
            >
              <span className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-ink-3">
                <span className="size-2 rounded-full" style={{ background: COLORS[i] }} aria-hidden />
                {LETTERS[i]}
              </span>
              <span className="w-full truncate text-xs font-medium">{s.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2">
        <label className="text-[0.8125rem] text-ink-2" htmlFor="scenario-name">
          Scenario name
        </label>
        <input
          id="scenario-name"
          value={active.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus:border-foreground"
        />
        <Select onValueChange={(v) => onPreset(v as RunwayPresetId)}>
          <SelectTrigger className="h-8 w-full text-[0.8125rem]" aria-label="Load a template">
            <SelectValue placeholder="Load a business template…" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RUNWAY_PRESETS) as RunwayPresetId[]).map((id) => (
              <SelectItem key={id} value={id}>
                {RUNWAY_PRESETS[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 space-y-4">
        {GROUPS.map((g) => (
          <ControlGroup key={g.title} title={g.title}>
            {g.keys.map((key) => {
              const s = key === "fundingMonth" ? { ...spec(key), max: active.horizon } : spec(key);
              return (
                <SliderField
                  key={key}
                  spec={s}
                  value={active[key] as number}
                  onChange={(v) => onChange({ [key]: v } as Partial<Scenario>)}
                  disabled={key === "fundingMonth" && active.fundingAmount === 0}
                  note={key === "fundingMonth" && active.fundingMonth === 0 ? "0 = no raise" : undefined}
                />
              );
            })}
          </ControlGroup>
        ))}
      </div>
    </div>
  );
}

function RunwayHero({
  summary,
  horizon,
  today,
  scenarioName,
  color,
}: {
  summary: RunwaySummary;
  horizon: number;
  today: Date | null;
  scenarioName: string;
  color: string;
}) {
  const runsOut = summary.runwayMonths !== null;
  const badge = runsOut ? (
    <Badge tone="bad">Runs out of cash</Badge>
  ) : summary.breakEvenMonth !== null ? (
    <Badge tone="good">Default alive</Badge>
  ) : (
    <Badge tone="warn">Still burning</Badge>
  );

  let caption: React.ReactNode;
  if (runsOut) {
    caption = (
      <>
        Cash hits zero {today ? <>around <strong className="font-medium text-foreground">{monthFromNow(today, summary.runwayMonths!)}</strong></> : `in month ${summary.cashOutMonth}`}
        {summary.breakEvenMonth !== null ? `, even though monthly profit arrives in month ${summary.breakEvenMonth}.` : " — before the business reaches break-even."}
      </>
    );
  } else if (summary.breakEvenMonth !== null) {
    caption = (
      <>
        Profitable from month {summary.breakEvenMonth}
        {today && <> ({monthFromNow(today, summary.breakEvenMonth)})</>}. Cash bottoms out at{" "}
        <strong className="font-medium text-foreground">{fmt.moneyCompact(summary.lowestCash)}</strong>
        {summary.lowestCashMonth > 0 && ` in month ${summary.lowestCashMonth}`}.
      </>
    );
  } else {
    caption = `Cash lasts the full ${horizon}-month forecast, but the business is still losing money each month.`;
  }

  return (
    <HeroFigure
      eyebrow={`Runway · ${scenarioName}`}
      badge={badge}
      value={
        <span className="flex items-baseline gap-2">
          <span className="inline-block size-3 translate-y-[-0.35em] rounded-full" style={{ background: color }} aria-hidden />
          {runsOut ? fmt.dec1(summary.runwayMonths!) : `${horizon}+`}
        </span>
      }
      unit="months"
      caption={caption}
    />
  );
}

function Kpis({ summary, today }: { summary: RunwaySummary; today: Date | null }) {
  const ltvTone: Tone = summary.ltvToCac >= 3 ? "good" : summary.ltvToCac >= 1 ? "warn" : "bad";
  const paybackTone: Tone = summary.cacPaybackMonths <= 12 ? "good" : summary.cacPaybackMonths <= 24 ? "warn" : "bad";
  const bm = summary.burnMultiple;
  const burnTone: Tone = bm === null ? "good" : bm <= 1.5 ? "good" : bm <= 2.5 ? "warn" : "bad";

  return (
    <StatGrid className="grid-cols-2 sm:grid-cols-3">
      <StatTile
        label="Break-even month"
        value={summary.breakEvenMonth !== null ? `Month ${summary.breakEvenMonth}` : "Not yet"}
        note={summary.breakEvenMonth !== null ? (today ? monthFromNow(today, summary.breakEvenMonth) : "Monthly profit") : "Beyond the forecast"}
        tone={summary.breakEvenMonth !== null ? "good" : "neutral"}
      />
      <StatTile
        label="Ending MRR"
        value={fmt.moneyCompact(summary.endingMrr)}
        note={`${fmt.moneyCompact(summary.endingMrr * 12)} ARR`}
      />
      <StatTile
        label="LTV : CAC"
        value={fmt.ratio(summary.ltvToCac)}
        note={ltvTone === "good" ? "Healthy — 3× or better" : ltvTone === "warn" ? "Below the 3× benchmark" : "Each customer loses money"}
        tone={ltvTone}
      />
      <StatTile
        label="CAC payback"
        value={fmt.months(summary.cacPaybackMonths)}
        note={paybackTone === "good" ? "Under a year" : paybackTone === "warn" ? "1–2 years to recover CAC" : "Slow to recover CAC"}
        tone={paybackTone}
      />
      <StatTile
        label="Burn multiple"
        value={bm === null ? "—" : fmt.ratio(bm)}
        note={bm === null ? "Not burning cash" : burnTone === "good" ? "Efficient growth" : burnTone === "warn" ? "Acceptable for early stage" : "Burning inefficiently"}
        tone={burnTone}
      />
      <StatTile
        label="Lowest cash balance"
        value={fmt.moneyCompact(summary.lowestCash)}
        note={summary.lowestCashMonth === 0 ? "Today" : `Month ${summary.lowestCashMonth}`}
        tone={summary.lowestCash < 0 ? "bad" : "neutral"}
      />
    </StatGrid>
  );
}

function MonteCarloSection({
  mc,
  startingCash,
  horizon,
  color,
  uncertainty,
  onUncertainty,
  stale,
}: {
  mc: ReturnType<typeof monteCarlo>;
  startingCash: number;
  horizon: number;
  color: string;
  uncertainty: number;
  onUncertainty: (u: number) => void;
  stale: boolean;
}) {
  const p = mc.cashOutProbability;
  const tone: Tone = p > 0.5 ? "bad" : p > 0.2 ? "warn" : "good";
  const last = mc.bands[mc.bands.length - 1];

  return (
    <section className="print-break rounded-xl border border-hairline bg-surface">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline p-4 sm:p-5">
        <div className="max-w-xl">
          <p className="eyebrow">Stress test · Monte Carlo</p>
          <h2 className="mt-1.5 font-heading text-[1.75rem] leading-tight">{mc.runs.toLocaleString("en-CA")} possible futures</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
            Churn, CAC, organic growth and pricing are each drawn at random around your inputs, with month-to-month noise on top. The bands show where cash lands in 50% and 80% of futures.
          </p>
        </div>
        <div className="no-print flex flex-col items-start gap-1.5">
          <span className="text-xs text-ink-3">How uncertain are your inputs?</span>
          <Segmented
            ariaLabel="Uncertainty"
            value={uncertainty}
            onChange={onUncertainty}
            options={[
              { value: 0.1, label: "±10%" },
              { value: 0.2, label: "±20%" },
              { value: 0.35, label: "±35%" },
            ]}
          />
        </div>
      </header>

      <div className={cn("grid gap-0 transition-opacity lg:grid-cols-[minmax(0,1fr)_300px]", stale && "opacity-70")}>
        <div className="min-w-0 p-4 sm:p-5">
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
            <li className="flex items-center gap-1.5">
              <span className="h-[2px] w-3.5 rounded-full" style={{ background: color }} aria-hidden /> Median
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: color, opacity: 0.4 }} aria-hidden /> Middle 50%
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: color, opacity: 0.18 }} aria-hidden /> Middle 80%
            </li>
          </ul>
          <FanChart bands={mc.bands} startingCash={startingCash} color={color} />
        </div>
        <div className="flex flex-col gap-5 border-t border-hairline p-4 sm:p-5 lg:border-t-0 lg:border-l">
          <div>
            <p className="text-xs text-ink-3">Chance of running out of cash within {horizon} months</p>
            <p className="mt-1 text-[2.75rem] leading-none font-semibold tracking-tight">{Math.round(p * 100)}%</p>
            <div className="mt-2">
              <Badge tone={tone}>{tone === "good" ? "Resilient plan" : tone === "warn" ? "Meaningful risk" : "More likely than not"}</Badge>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-3">Median cash-out</dt>
              <dd className="mt-0.5 font-medium">{mc.medianCashOutMonth !== null ? `Month ${Math.round(mc.medianCashOutMonth)}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Cash at M{horizon} (median)</dt>
              <dd className="mt-0.5 font-medium">{fmt.moneyCompact(last?.p50 ?? NaN)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Worst 10%</dt>
              <dd className="mt-0.5 font-medium">{fmt.moneyCompact(last?.p10 ?? NaN)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Best 10%</dt>
              <dd className="mt-0.5 font-medium">{fmt.moneyCompact(last?.p90 ?? NaN)}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-1 text-xs text-ink-3">Share of futures still solvent</p>
            <SurvivalChart bands={mc.bands} color={color} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Scorecard({ series, active }: { series: Array<{ name: string; color: string; summary: RunwaySummary }>; active: number }) {
  const rows: Array<{ label: string; get: (s: RunwaySummary) => string }> = [
    { label: "Runway", get: (s) => (s.runwayMonths !== null ? `${fmt.dec1(s.runwayMonths)} mo` : "Full horizon") },
    { label: "Break-even", get: (s) => (s.breakEvenMonth !== null ? `Month ${s.breakEvenMonth}` : "—") },
    { label: "Ending MRR", get: (s) => fmt.moneyCompact(s.endingMrr) },
    { label: "Ending customers", get: (s) => fmt.int(s.endingCustomers) },
    { label: "LTV : CAC", get: (s) => fmt.ratio(s.ltvToCac) },
    { label: "Lowest cash", get: (s) => fmt.moneyCompact(s.lowestCash) },
    { label: "Capital raised", get: (s) => (s.totalRaised ? fmt.moneyCompact(s.totalRaised) : "—") },
  ];
  return (
    <section className="print-break overflow-hidden rounded-xl border border-hairline bg-surface">
      <header className="border-b border-hairline p-4 sm:p-5">
        <h3 className="text-[0.9375rem] font-medium tracking-tight">Scenario scorecard</h3>
        <p className="mt-0.5 text-[0.8125rem] text-ink-3">The three plans side by side.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-40 px-4 py-2.5 text-left text-xs font-medium text-ink-3 sm:px-5" />
              {series.map((s, i) => (
                <th key={i} scope="col" className={cn("px-4 py-2.5 text-right text-xs font-medium", i === active ? "text-foreground" : "text-ink-2")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-hairline">
                <th scope="row" className="px-4 py-2.5 text-left text-[0.8125rem] font-normal text-ink-2 sm:px-5">
                  {r.label}
                </th>
                {series.map((s, i) => (
                  <td key={i} className={cn("px-4 py-2.5 text-right tabular", i === active && "bg-muted/50 font-medium")}>
                    {r.get(s.summary)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const monthlyColumns: Column<RunwaySummary["months"][number]>[] = [
  { key: "month", label: "Month", align: "left", render: (r) => `M${r.month}` },
  { key: "customers", label: "Customers", render: (r) => fmt.int(r.customers) },
  { key: "mrr", label: "MRR", render: (r) => fmt.money(r.mrr) },
  { key: "gp", label: "Gross profit", render: (r) => fmt.money(r.grossProfit) },
  { key: "mkt", label: "Marketing", render: (r) => fmt.money(r.marketing) },
  { key: "fixed", label: "Fixed", render: (r) => fmt.money(r.fixed) },
  { key: "net", label: "Net income", render: (r) => fmt.money(r.netIncome) },
  { key: "cash", label: "Cash", render: (r) => fmt.money(r.cash) },
];

function MonthlyTable({ summary }: { summary: RunwaySummary }) {
  return <DataTable columns={monthlyColumns} rows={summary.months} caption="Monthly projection" />;
}

function PrintSummary({ scenario }: { scenario: Scenario }) {
  return (
    <div className="print-only">
      <p className="text-sm font-medium">Scenario: {scenario.name}</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 text-xs">
        {RUNWAY_FIELDS.map((f) => (
          <li key={f.key} className="flex justify-between border-b border-hairline py-1">
            <span>{f.label}</span>
            <span className="tabular">{f.format === "currency" ? fmt.money(scenario[f.key]) : `${scenario[f.key]}${f.format === "percent" ? "%" : ""}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
