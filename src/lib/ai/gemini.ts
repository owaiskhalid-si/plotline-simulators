// Server-only: asks Gemini for a short, structured read of a simulator scenario.
// Plain REST (no SDK) so the dependency footprint stays zero.
import type { Briefing } from "./facts";

export interface Analysis {
  headline: string;
  insights: string[];
  risks: string[];
  recommendation: string;
}

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);
export const modelName = () => process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

const SYSTEM = [
  "You are a concise, numerate business analyst reviewing one scenario from an interactive simulator.",
  "Reason only from the numbers you are given — never invent figures, benchmarks or market data.",
  "Write for a founder, small-business owner or home buyer in plain Canadian English. Quote the numbers that matter.",
  "headline: under 12 words, the single most important takeaway.",
  "insights: exactly 3, one sentence each, each anchored to a specific number.",
  "risks: exactly 2, one sentence each — what could make this scenario worse than it looks.",
  "recommendation: one or two sentences with one concrete next move the person can test in the simulator.",
  "This is educational analysis, not financial, tax or mortgage advice — do not add disclaimers, the UI shows one.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    insights: { type: "ARRAY", items: { type: "STRING" } },
    risks: { type: "ARRAY", items: { type: "STRING" } },
    recommendation: { type: "STRING" },
  },
  required: ["headline", "insights", "risks", "recommendation"],
  propertyOrdering: ["headline", "insights", "risks", "recommendation"],
};

export function briefingToPrompt(b: Briefing): string {
  return [`Simulator: ${b.title}`, "", "Inputs:", ...b.inputs.map((l) => `- ${l}`), "", "Computed results:", ...b.results.map((l) => `- ${l}`)].join("\n");
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => clean(x, 320)).filter(Boolean).slice(0, n) : []);

/** Validates the model's JSON so the UI never renders a half-formed answer. */
export function parseAnalysis(raw: unknown): Analysis {
  const o = (raw ?? {}) as Record<string, unknown>;
  const analysis = {
    headline: clean(o.headline, 160),
    insights: list(o.insights, 4),
    risks: list(o.risks, 3),
    recommendation: clean(o.recommendation, 600),
  };
  if (!analysis.headline || analysis.insights.length < 2 || analysis.risks.length < 1 || !analysis.recommendation) {
    throw new Error("Incomplete analysis from the model");
  }
  return analysis;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export async function analyse(briefing: Briefing, signal?: AbortSignal): Promise<Analysis> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = modelName();

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: briefingToPrompt(briefing) }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 3000, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
    signal,
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message ?? "request failed"}`);
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini returned no text (${data.candidates?.[0]?.finishReason ?? "no candidate"})`);
  return parseAnalysis(JSON.parse(text));
}
