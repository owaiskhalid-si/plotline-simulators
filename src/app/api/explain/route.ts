import { buildBriefing, isSimulatorId } from "@/lib/ai/facts";
import { aiEnabled, analyse, modelName } from "@/lib/ai/gemini";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const noStore = { "cache-control": "no-store" };

/** Lets the client decide whether to show the AI analyst panel at all. */
export async function GET() {
  const enabled = aiEnabled();
  return Response.json({ enabled, model: enabled ? modelName() : null }, { headers: noStore });
}

/**
 * Explains the current scenario. The client sends only the inputs; the server
 * re-runs the pure engine and hands Gemini the computed numbers, so the model can
 * never be fed figures the simulator didn't produce.
 */
export async function POST(req: Request) {
  if (!aiEnabled()) return Response.json({ error: "The AI analyst isn't configured on this deployment." }, { status: 503, headers: noStore });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const limit = rateLimit(`${ip}:explain`);
  if (!limit.ok) {
    return Response.json(
      { error: `You've used the analyst a lot — try again in ${Math.max(1, Math.ceil(limit.retryAfter / 60))} min.` },
      { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { simulator?: unknown; inputs?: unknown } | null;
  if (!body || !isSimulatorId(body.simulator) || typeof body.inputs !== "object" || body.inputs === null) {
    return Response.json({ error: "Send { simulator, inputs }." }, { status: 400, headers: noStore });
  }

  const started = Date.now();
  try {
    const briefing = buildBriefing(body.simulator, body.inputs);
    const analysis = await analyse(briefing, AbortSignal.timeout(25_000));
    return Response.json({ ...analysis, model: modelName(), ms: Date.now() - started }, { headers: noStore });
  } catch (err) {
    console.error("[api/explain]", err);
    return Response.json({ error: "The AI analyst couldn't answer just now. Try again in a moment." }, { status: 502, headers: noStore });
  }
}
