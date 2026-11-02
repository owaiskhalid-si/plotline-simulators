"use client";

import { useMemo } from "react";
import { RotateCcwIcon, SparklesIcon } from "lucide-react";
import { fmt } from "@/lib/format";
import { downloadCsv, useUrlState } from "@/lib/share";
import { sanitize } from "@/lib/sim/fields";
import {
  BREAK_EVEN_FIELDS,
  BREAK_EVEN_PRESETS,
  cvpSeries,
  DEFAULT_BREAK_EVEN,
  demandAtPrice,
  priceCurve,
  profitGrid,
  summarizeBreakEven,
  type BreakEvenInputs,
  type BreakEvenKey,
  type BreakEvenPresetId,
  type BreakEvenSummary,
} from "@/lib/sim/break-even";
import { ControlGroup, SliderField } from "@/components/sim/field";
import { Badge, HeroFigure, StatGrid, StatTile, type Tone } from "@/components/sim/stat";
import { AiAnalyst } from "@/components/sim/ai-analyst";
import { ChartFrame, CsvButton, DataTable, PrintButton, ShareButton, SimHeader, SimLayout } from "@/components/sim/frame";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CVP_COLORS, CvpChart, PriceCurveChart, ProfitHeatmap } from "./break-even-charts";

const spec = (key: BreakEvenKey) => BREAK_EVEN_FIELDS.find((f) => f.key === key)!;
const sanitizeBreakEven = (raw: unknown) => sanitize(DEFAULT_BREAK_EVEN, BREAK_EVEN_FIELDS, raw);

export function BreakEvenSimulator() {
  const [inputs, setInputs] = useUrlState(DEFAULT_BREAK_EVEN, sanitizeBreakEven);
  const set = (patch: Partial<BreakEvenInputs>) => setInputs((s) => ({ ...s, ...patch }));

  const summary = useMemo(() => summarizeBreakEven(inputs), [inputs]);
  const cvp = useMemo(() => cvpSeries(inputs), [inputs]);
  const curve = useMemo(() => priceCurve(inputs), [inputs]);
  const grid = useMemo(() => profitGrid(inputs), [inputs]);

  const applyBestPrice = () => {
    if (summary.optimalPrice === null) return;
    const price = Math.round(summary.optimalPrice * 100) / 100;
    set({ price, volume: Math.round(demandAtPrice(inputs, price)) });
  };

  const exportCsv = () =>
    downloadCsv(
      "plotline-break-even-price-curve.csv",
      curve.map((p) => ({ price: p.price.toFixed(2), expected_units: Math.round(p.volume), monthly_profit: Math.round(p.profit) })),
    );

  return (
    <>
      <SimHeader
        index="03"
        kicker="Pricing & operations"
        title={
          <>
            Where do you <em className="text-brand">start</em> making money?
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
        Find your break-even point, see how far sales can fall before a month turns red, and let demand elasticity suggest the profit-maximising price.
      </SimHeader>

      <SimLayout
        controls={
          <Controls
            inputs={inputs}
            set={set}
            onPreset={(id) => setInputs(BREAK_EVEN_PRESETS[id].inputs)}
            onReset={() => setInputs(DEFAULT_BREAK_EVEN)}
          />
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)]">
          <BreakEvenHero inputs={inputs} summary={summary} />
          <Kpis inputs={inputs} summary={summary} onApplyBest={applyBestPrice} />
        </div>

        <AiAnalyst simulator="break-even" inputs={inputs} />

        <ChartFrame
          title="Cost-volume-profit"
          description="Where the revenue line crosses total costs, every extra sale is profit."
          legend={[
            { label: "Revenue", color: CVP_COLORS.revenue, shape: "line" },
            { label: "Total costs", color: CVP_COLORS.cost, shape: "line" },
          ]}
          table={
            <DataTable
              caption="Revenue and costs by volume"
              rows={cvp.filter((_, i) => i % 2 === 0)}
              columns={[
                { key: "u", label: "Units", align: "left", render: (r) => fmt.int(r.units) },
                { key: "r", label: "Revenue", render: (r) => fmt.money(r.revenue) },
                { key: "c", label: "Total costs", render: (r) => fmt.money(r.totalCost) },
                { key: "p", label: "Profit", render: (r) => fmt.money(r.revenue - r.totalCost) },
              ]}
            />
          }
        >
          <CvpChart points={cvp} inputs={inputs} summary={summary} />
        </ChartFrame>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ChartFrame
            title="Profit at every price"
            description={
              summary.optimalPrice !== null ? (
                <>
                  With a price sensitivity of {inputs.elasticity.toFixed(1)}, profit peaks at{" "}
                  <strong className="font-medium text-foreground">{fmt.price(summary.optimalPrice)}</strong>.
                </>
              ) : (
                "Demand is inelastic (sensitivity ≤ 1), so higher prices keep adding profit — until customers start to leave."
              )
            }
          >
            <PriceCurveChart points={curve} inputs={inputs} summary={summary} />
          </ChartFrame>
          <ChartFrame title="Price × volume heatmap" description="Monthly profit for every combination around today's plan. Hover a cell.">
            <ProfitHeatmap {...grid} />
          </ChartFrame>
        </div>
      </SimLayout>
    </>
  );
}

function Controls({
  inputs,
  set,
  onPreset,
  onReset,
}: {
  inputs: BreakEvenInputs;
  set: (p: Partial<BreakEvenInputs>) => void;
  onPreset: (id: BreakEvenPresetId) => void;
  onReset: () => void;
}) {
  const field = (key: BreakEvenKey) => (
    <SliderField key={key} spec={spec(key)} value={inputs[key]} onChange={(v) => set({ [key]: v } as Partial<BreakEvenInputs>)} />
  );
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="eyebrow">Business</p>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-foreground">
          <RotateCcwIcon className="size-3" aria-hidden /> Reset
        </button>
      </div>
      <Select onValueChange={(v) => onPreset(v as BreakEvenPresetId)}>
        <SelectTrigger className="mt-2.5 h-8 w-full text-[0.8125rem]" aria-label="Load an example business">
          <SelectValue placeholder="Load an example business…" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(BREAK_EVEN_PRESETS) as BreakEvenPresetId[]).map((id) => (
            <SelectItem key={id} value={id}>
              {BREAK_EVEN_PRESETS[id].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-5 space-y-4">
        <ControlGroup title="Per unit">
          {field("price")}
          {field("variableCost")}
        </ControlGroup>
        <ControlGroup title="Per month">
          {field("fixedCosts")}
          {field("volume")}
        </ControlGroup>
        <ControlGroup title="Demand">{field("elasticity")}</ControlGroup>
      </div>
    </div>
  );
}

function BreakEvenHero({ inputs, summary }: { inputs: BreakEvenInputs; summary: BreakEvenSummary }) {
  if (!Number.isFinite(summary.breakEvenUnits)) {
    return (
      <HeroFigure
        eyebrow="Break-even point"
        badge={<Badge tone="bad">Loses money on every sale</Badge>}
        value="Never"
        caption="The price is at or below the variable cost, so each sale adds to the loss. Raise the price or cut per-unit costs."
      />
    );
  }
  const above = summary.profit >= 0;
  const gapUnits = Math.abs(inputs.volume - summary.breakEvenUnits);
  return (
    <HeroFigure
      eyebrow="Break-even point"
      badge={above ? <Badge tone="good">Profitable at plan</Badge> : <Badge tone="bad">Below break-even</Badge>}
      value={fmt.int(Math.ceil(summary.breakEvenUnits))}
      unit="units / month"
      caption={
        above ? (
          <>
            That&apos;s {fmt.money(summary.breakEvenRevenue)} in monthly sales. Your plan of {fmt.int(inputs.volume)} units clears it by{" "}
            <strong className="font-medium text-foreground">{fmt.int(gapUnits)} units</strong>.
          </>
        ) : (
          <>
            You need <strong className="font-medium text-foreground">{fmt.int(Math.ceil(gapUnits))} more units</strong> a month (
            {fmt.pct((gapUnits / Math.max(1, inputs.volume)) * 100, 0)} more than plan) — or better margins.
          </>
        )
      }
    />
  );
}

function Kpis({ inputs, summary, onApplyBest }: { inputs: BreakEvenInputs; summary: BreakEvenSummary; onApplyBest: () => void }) {
  const mos = summary.marginOfSafety;
  const mosTone: Tone = !Number.isFinite(mos) || mos < 0 ? "bad" : mos < 0.1 ? "warn" : "good";
  const gain = summary.optimalProfit !== null ? summary.optimalProfit - summary.profit : 0;
  const canImprove = summary.optimalPrice !== null && Math.abs(summary.optimalPrice - inputs.price) / inputs.price > 0.01 && gain > 1;

  return (
    <StatGrid className="grid-cols-2 sm:grid-cols-3">
      <StatTile
        label="Monthly profit at plan"
        value={fmt.money(summary.profit)}
        note={summary.profit >= 0 ? `${fmt.money(summary.profit * 12)} a year` : "Losing money"}
        tone={summary.profit >= 0 ? "good" : "bad"}
      />
      <StatTile
        label="Contribution / unit"
        value={fmt.price(summary.contribution)}
        note={`${fmt.pct(summary.contributionRatio * 100, 0)} of each sale covers fixed costs`}
      />
      <StatTile
        label="Margin of safety"
        value={Number.isFinite(mos) ? fmt.pct(mos * 100, 0) : "—"}
        note={mosTone === "good" ? "Sales can fall this far and still break even" : mosTone === "warn" ? "Thin cushion" : "Already below break-even"}
        tone={mosTone}
      />
      <StatTile
        label="Operating leverage"
        value={Number.isFinite(summary.operatingLeverage) && summary.profit > 0 ? fmt.ratio(summary.operatingLeverage) : "—"}
        note={summary.profit > 0 ? `1% more sales → ${summary.operatingLeverage.toFixed(1)}% more profit` : "Needs a profitable plan"}
      />
      <StatTile
        label="Profit-maximising price"
        value={summary.optimalPrice !== null ? fmt.price(summary.optimalPrice) : "Higher"}
        note={summary.optimalPrice !== null ? `vs ${fmt.price(inputs.price)} today` : "Demand is inelastic"}
      />
      <div className="flex min-w-0 flex-col gap-1 bg-surface px-4 py-3.5">
        <p className="truncate text-xs text-ink-3">Profit at best price</p>
        <p className="truncate text-[1.375rem] leading-tight font-semibold tracking-tight">
          {summary.optimalProfit !== null ? fmt.money(summary.optimalProfit) : "—"}
        </p>
        {canImprove ? (
          <button
            type="button"
            onClick={onApplyBest}
            className="no-print mt-0.5 inline-flex w-fit items-center gap-1 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background transition-opacity hover:opacity-85"
          >
            <SparklesIcon className="size-3" aria-hidden /> Apply · +{fmt.money(gain)}/mo
          </button>
        ) : (
          <p className="text-xs text-ink-3">{summary.optimalPrice !== null ? "You're already at the best price" : "No interior optimum"}</p>
        )}
      </div>
    </StatGrid>
  );
}
