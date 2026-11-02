export const site = {
  name: "Plotline",
  tagline: "Business simulators for the decisions you can't undo.",
  description:
    "Interactive business simulators: startup cash runway with Monte Carlo, Canadian mortgage affordability & stress test, and break-even & pricing. Built with Next.js, TypeScript and Recharts.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Shown in the footer when set — keep personal details out of the repo. */
  authorName: process.env.NEXT_PUBLIC_AUTHOR_NAME ?? "",
  authorUrl: process.env.NEXT_PUBLIC_AUTHOR_URL ?? "",
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL ?? "",
};

export const simulators = [
  {
    href: "/runway",
    short: "Runway",
    index: "01",
    kicker: "Startup finance",
    title: "Cash runway & unit economics",
    blurb: "Three scenarios side by side, LTV:CAC, burn multiple, and 1,000 Monte Carlo futures that show the real odds of running out of cash.",
  },
  {
    href: "/mortgage",
    short: "Mortgage",
    index: "02",
    kicker: "Canadian real estate",
    title: "Mortgage affordability & stress test",
    blurb: "The federal B-20 stress test, CMHC insurance, GDS/TDS limits and semi-annual compounding — plus what happens to your payment at renewal.",
  },
  {
    href: "/break-even",
    short: "Break-even",
    index: "03",
    kicker: "Pricing & operations",
    title: "Break-even & price optimizer",
    blurb: "Cost-volume-profit analysis, a profit-maximising price from demand elasticity, and a price × volume heatmap of every outcome.",
  },
] as const;
