import type { Metadata } from "next";
import { BreakEvenSimulator } from "@/components/break-even/break-even-simulator";

export const metadata: Metadata = {
  title: "Break-even & price optimizer",
  description:
    "Break-even analysis with a cost-volume-profit chart, margin of safety, operating leverage, a profit-maximising price from demand elasticity and a price × volume profit heatmap.",
};

export default function BreakEvenPage() {
  return <BreakEvenSimulator />;
}
