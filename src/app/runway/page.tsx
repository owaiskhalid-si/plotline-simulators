import type { Metadata } from "next";
import { RunwaySimulator } from "@/components/runway/runway-simulator";

export const metadata: Metadata = {
  title: "Cash runway & unit economics simulator",
  description:
    "Model startup cash runway, LTV:CAC, CAC payback and burn multiple across three scenarios, then stress-test the plan with 1,000 Monte Carlo simulations.",
};

export default function RunwayPage() {
  return <RunwaySimulator />;
}
