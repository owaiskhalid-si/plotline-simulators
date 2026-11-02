import type { Metadata } from "next";
import { MortgageSimulator } from "@/components/mortgage/mortgage-simulator";

export const metadata: Metadata = {
  title: "Canadian mortgage affordability & stress test calculator",
  description:
    "How much house can you afford in Canada? Applies the B-20 stress test, CMHC insurance premiums, GDS/TDS limits and semi-annual compounding, with amortization and renewal-shock charts.",
};

export default function MortgagePage() {
  return <MortgageSimulator />;
}
