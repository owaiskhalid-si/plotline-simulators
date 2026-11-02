"use client";

import { useMemo } from "react";
import { RotateCcwIcon } from "lucide-react";
import { fmt } from "@/lib/format";
import { downloadCsv, useUrlState } from "@/lib/share";
import { sanitize } from "@/lib/sim/fields";
import {
  amortize,
  CA_RULES,
  DEFAULT_MORTGAGE,
  evaluateHome,
  maxAffordable,
  MORTGAGE_FIELDS,
  renewalShock,
  type Constraint,
  type HomeEvaluation,
  type MortgageInputs,
  type MortgageKey,
} from "@/lib/sim/mortgage";
import { ControlGroup, HelpTip, Segmented, SliderField } from "@/components/sim/field";
import { Badge, HeroFigure, LimitMeter, StatGrid, StatTile } from "@/components/sim/stat";
import { AiAnalyst } from "@/components/sim/ai-analyst";
import { ChartFrame, CsvButton, DataTable, PrintButton, ShareButton, SimHeader, SimLayout } from "@/components/sim/frame";
import { Switch } from "@/components/ui/switch";
import { BALANCE_COLORS, BalanceChart, RenewalChart, SPLIT_COLORS, YearlySplitChart } from "./mortgage-charts";

const spec = (key: MortgageKey) => MORTGAGE_FIELDS.find((f) => f.key === key)!;

function sanitizeMortgage(raw: unknown): MortgageInputs {
  const s = sanitize(DEFAULT_MORTGAGE, MORTGAGE_FIELDS, raw);
  return { ...s, amortizationYears: s.amortizationYears >= 30 ? 30 : 25 };
}

const CONSTRAINT_LABEL: Record<Constraint, string> = {
  downPayment: "Limited by down payment",
  gds: "Limited by GDS ratio",
  tds: "Limited by TDS ratio",
};

export function MortgageSimulator() {
  const [inputs, setInputs] = useUrlState(DEFAULT_MORTGAGE, sanitizeMortgage);
  const set = (patch: Partial<MortgageInputs>) => setInputs((s) => ({ ...s, ...patch }));

  const afford = useMemo(() => maxAffordable(inputs), [inputs]);
  const home = useMemo(() => (inputs.evaluateHome ? evaluateHome(inputs.homePrice, inputs) : afford.evaluation), [inputs, afford]);

  const monthly = useMemo(() => amortize(home.loan, inputs.rate, home.amortizationYears, "monthly"), [home.loan, inputs.rate, home.amortizationYears]);
  const biweekly = useMemo(() => amortize(home.loan, inputs.rate, home.amortizationYears, "accelerated-biweekly"), [home.loan, inputs.rate, home.amortizationYears]);
  const renewal = useMemo(() => renewalShock(home.loan, inputs.rate, home.amortizationYears), [home.loan, inputs.rate, home.amortizationYears]);

  const interestSaved = monthly.totalInterest - biweekly.totalInterest;
  const yearsSaved = monthly.payoffYears - biweekly.payoffYears;

  const exportCsv = () =>
    downloadCsv(
      "plotline-mortgage-amortization.csv",
      monthly.years.map((y, i) => ({
        year: y.year,
        principal_paid: Math.round(y.principal),
        interest_paid: Math.round(y.interest),
        balance_monthly_payments: Math.round(y.balance),
        balance_accelerated_biweekly: Math.round(biweekly.years[i]?.balance ?? 0),
      })),
    );

  return (
    <>
      <SimHeader
        index="02"
        kicker="Canadian real estate"
        title={
          <>
            What home can you <em className="text-brand">actually</em> afford?
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
        The same test Canadian lenders run — the B-20 stress test, CMHC insurance, GDS/TDS limits and semi-annual compounding — plus the payment shock waiting at renewal.
      </SimHeader>

      <SimLayout controls={<Controls inputs={inputs} set={set} onReset={() => setInputs(DEFAULT_MORTGAGE)} />}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)]">
          {inputs.evaluateHome ? (
            <EvaluateHero home={home} maxPrice={afford.maxPrice} />
          ) : (
            <AffordHero maxPrice={afford.maxPrice} home={home} binding={afford.bindingConstraint} rate={inputs.rate} />
          )}
          <StatGrid className="grid-cols-2 sm:grid-cols-3">
            <StatTile label="Monthly payment" value={fmt.money(home.paymentContract)} note={`${inputs.rate.toFixed(2)}% · ${home.amortizationYears} years`} />
            <StatTile label="Stress-test payment" value={fmt.money(home.paymentQualifying)} note={`Lenders test at ${home.qualifyingRate.toFixed(2)}%`} />
            <StatTile
              label="All-in monthly cost"
              value={fmt.money(home.housingCostActual)}
              note="With tax, heat & condo fees"
            />
            <StatTile label="Mortgage amount" value={fmt.money(home.loan)} note={home.premium > 0 ? `Incl. ${fmt.money(home.premium)} premium` : "No mortgage insurance"} />
            <StatTile
              label="CMHC insurance"
              value={home.insured ? `${home.premiumPct.toFixed(2)}%` : "None"}
              note={home.insured ? `${fmt.money(home.premium)} added to the loan` : "20%+ down — uninsured"}
              tone={home.insured ? "neutral" : "good"}
            />
            <StatTile
              label="Minimum down payment"
              value={fmt.money(home.minDownPayment)}
              note={home.downPayment + 0.5 >= home.minDownPayment ? `You have ${fmt.money(home.downPayment)}` : `Short ${fmt.money(home.minDownPayment - home.downPayment)}`}
              tone={home.downPayment + 0.5 >= home.minDownPayment ? "good" : "bad"}
            />
          </StatGrid>
        </div>

        <AiAnalyst simulator="mortgage" inputs={inputs} />

        <section className="print-break grid gap-6 rounded-xl border border-hairline bg-surface p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <LimitMeter label="Gross debt service (GDS)" value={home.gds} limit={CA_RULES.gdsLimit} max={60} help="housing ÷ income" />
          <LimitMeter label="Total debt service (TDS)" value={home.tds} limit={CA_RULES.tdsLimit} max={60} help="+ other debts" />
          <p className="text-[0.8125rem] leading-relaxed text-ink-3">
            Both ratios use the <span className="text-foreground">stress-test payment</span> at {home.qualifyingRate.toFixed(2)}%, property tax, heating and half of condo fees — not the payment you will actually make.
          </p>
        </section>

        {home.amortizationCapped && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            Insured mortgages can only use a 30-year amortization for first-time buyers and new builds, so this purchase is modelled over 25 years.
          </p>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartFrame
            title="Mortgage balance over time"
            description={
              interestSaved > 1 ? (
                <>
                  Accelerated bi-weekly payments save <strong className="font-medium text-foreground">{fmt.money(interestSaved)}</strong> in interest and finish{" "}
                  <strong className="font-medium text-foreground">{fmt.dec1(yearsSaved)} years</strong> sooner.
                </>
              ) : (
                "Remaining balance by year."
              )
            }
            legend={[
              { label: "Monthly payments", color: BALANCE_COLORS.monthly, shape: "line" },
              { label: "Accelerated bi-weekly", color: BALANCE_COLORS.biweekly, shape: "line" },
            ]}
            table={
              <DataTable
                caption="Balance by year"
                rows={monthly.years.map((y, i) => ({ year: y.year, monthly: y.balance, biweekly: biweekly.years[i]?.balance ?? 0 }))}
                columns={[
                  { key: "year", label: "Year", align: "left", render: (r) => `Year ${r.year}` },
                  { key: "m", label: "Monthly", render: (r) => fmt.money(r.monthly) },
                  { key: "b", label: "Bi-weekly", render: (r) => fmt.money(r.biweekly) },
                ]}
              />
            }
          >
            <BalanceChart monthly={monthly} biweekly={biweekly} loan={home.loan} />
          </ChartFrame>

          <ChartFrame
            title="Where each year's payments go"
            description={
              <>
                Total interest over {home.amortizationYears} years: <strong className="font-medium text-foreground">{fmt.money(monthly.totalInterest)}</strong>
              </>
            }
            legend={[
              { label: "Principal", color: SPLIT_COLORS.principal },
              { label: "Interest", color: SPLIT_COLORS.interest },
            ]}
            table={
              <DataTable
                caption="Principal and interest by year"
                rows={monthly.years}
                columns={[
                  { key: "year", label: "Year", align: "left", render: (r) => `Year ${r.year}` },
                  { key: "p", label: "Principal", render: (r) => fmt.money(r.principal) },
                  { key: "i", label: "Interest", render: (r) => fmt.money(r.interest) },
                  { key: "b", label: "Balance", render: (r) => fmt.money(r.balance) },
                ]}
              />
            }
          >
            <YearlySplitChart schedule={monthly} />
          </ChartFrame>
        </div>

        <ChartFrame
          title="Renewal shock: your payment in 5 years"
          description={`Most Canadian mortgages renew every 5 years. After the first term you'll still owe about ${fmt.money(monthly.years[4]?.balance ?? 0)} — here's the new monthly payment at different rates.`}
        >
          <RenewalChart scenarios={renewal} currentRate={inputs.rate} />
        </ChartFrame>

        <RulesCard />
      </SimLayout>
    </>
  );
}

function Controls({ inputs, set, onReset }: { inputs: MortgageInputs; set: (p: Partial<MortgageInputs>) => void; onReset: () => void }) {
  const field = (key: MortgageKey) => (
    <SliderField key={key} spec={spec(key)} value={inputs[key] as number} onChange={(v) => set({ [key]: v } as Partial<MortgageInputs>)} />
  );
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="eyebrow">Question</p>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-foreground">
          <RotateCcwIcon className="size-3" aria-hidden /> Reset
        </button>
      </div>
      <Segmented
        className="mt-2.5 flex w-full"
        ariaLabel="Mode"
        value={inputs.evaluateHome ? "evaluate" : "afford"}
        onChange={(v) => set({ evaluateHome: v === "evaluate" })}
        options={[
          { value: "afford", label: "What can I afford?" },
          { value: "evaluate", label: "Check a home" },
        ]}
      />
      {inputs.evaluateHome && <div className="mt-2">{field("homePrice")}</div>}

      <div className="mt-5 space-y-4">
        <ControlGroup title="Income & debts">
          {field("annualIncome")}
          {field("monthlyDebts")}
        </ControlGroup>
        <ControlGroup title="Mortgage">
          {field("downPayment")}
          {field("rate")}
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[0.8125rem] text-ink-2">Amortization</span>
            <Segmented
              size="sm"
              ariaLabel="Amortization"
              value={inputs.amortizationYears}
              onChange={(v) => set({ amortizationYears: v })}
              options={[
                { value: 25, label: "25 years" },
                { value: 30, label: "30 years" },
              ]}
            />
          </div>
          <label className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
              First-time buyer or new build
              <HelpTip text="Since Dec 15, 2024, first-time buyers and buyers of new builds can take a 30-year amortization on an insured mortgage." />
            </span>
            <Switch checked={inputs.firstTimeBuyer} onCheckedChange={(v) => set({ firstTimeBuyer: v })} />
          </label>
        </ControlGroup>
        <ControlGroup title="Carrying costs">
          {field("propertyTaxRate")}
          {field("heatingMonthly")}
          {field("condoFeesMonthly")}
        </ControlGroup>
      </div>
    </div>
  );
}

function AffordHero({ maxPrice, home, binding, rate }: { maxPrice: number; home: HomeEvaluation; binding: Constraint | null; rate: number }) {
  const downPct = maxPrice > 0 ? (home.downPayment / maxPrice) * 100 : 0;
  return (
    <HeroFigure
      eyebrow="Maximum purchase price"
      badge={binding ? <Badge tone="neutral">{CONSTRAINT_LABEL[binding]}</Badge> : undefined}
      value={fmt.money(maxPrice)}
      caption={
        <>
          With {fmt.money(home.downPayment)} down ({downPct.toFixed(1)}%), a {fmt.money(home.loan)} mortgage at {rate.toFixed(2)}%. Lenders test you at{" "}
          <strong className="font-medium text-foreground">{home.qualifyingRate.toFixed(2)}%</strong>.
        </>
      }
    />
  );
}

function EvaluateHero({ home, maxPrice }: { home: HomeEvaluation; maxPrice: number }) {
  const reasons = home.failures.map((f) =>
    f === "downPayment"
      ? `the down payment is ${fmt.money(home.minDownPayment - home.downPayment)} short`
      : f === "gds"
        ? `GDS is ${home.gds.toFixed(1)}% (max ${CA_RULES.gdsLimit}%)`
        : `TDS is ${home.tds.toFixed(1)}% (max ${CA_RULES.tdsLimit}%)`,
  );
  return (
    <HeroFigure
      eyebrow="This home"
      badge={home.qualifies ? <Badge tone="good">Qualifies</Badge> : <Badge tone="bad">Doesn&apos;t qualify</Badge>}
      value={fmt.money(home.price)}
      caption={
        home.qualifies ? (
          <>
            You pass the stress test with room to spare — your ceiling is <strong className="font-medium text-foreground">{fmt.money(maxPrice)}</strong>.
          </>
        ) : (
          <>
            Not yet: {reasons.join(" and ")}. Your current ceiling is <strong className="font-medium text-foreground">{fmt.money(maxPrice)}</strong>.
          </>
        )
      }
    />
  );
}

function RulesCard() {
  const rules = [
    ["Stress test", `Qualify at the greater of your rate + ${CA_RULES.stressTestBuffer} points or ${CA_RULES.stressTestFloor}% (OSFI B-20 / federal insured rules).`],
    ["Debt service limits", `GDS ≤ ${CA_RULES.gdsLimit}% and TDS ≤ ${CA_RULES.tdsLimit}% of gross income (CMHC insured limits). Some lenders are stricter for uninsured loans.`],
    ["Minimum down payment", "5% of the first $500,000, 10% of the portion up to $1.5M, and 20% for homes of $1.5M or more."],
    ["CMHC premium", "0.60%–4.00% of the loan depending on loan-to-value, added to the mortgage. +0.20% for a 30-year insured amortization."],
    ["30-year amortization", "Insured: first-time buyers and new builds only. Uninsured (20%+ down): available to anyone."],
    ["Compounding", "Fixed-rate payments use semi-annual compounding, as required by the Interest Act — not monthly."],
  ];
  return (
    <section className="print-break rounded-xl border border-hairline bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[0.9375rem] font-medium tracking-tight">Rules applied</h3>
        <p className="font-mono text-[0.6875rem] tracking-wide text-ink-3 uppercase">As of {CA_RULES.asOf}</p>
      </div>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {rules.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[0.8125rem] font-medium">{k}</dt>
            <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-ink-3">
        An educational estimate. Provincial land transfer tax, PST on CMHC premiums, closing costs and lender-specific policies are not included — confirm with a licensed mortgage professional.
      </p>
    </section>
  );
}
