import { DEFAULT_MODEL, FALLBACK_MODELS, groq } from "@/lib/orchestrator/llm";
import { isMockMode } from "@/lib/orchestrator/mock";

export const runtime = "nodejs";

// Lists Groq chat models so the presenter can switch models live (e.g. when one is rate-limited).
export async function GET() {
  const hasKey = Boolean(process.env.GROQ_API_KEY);
  const mock = isMockMode();
  if (mock) return Response.json({ hasKey, mock, default: DEFAULT_MODEL, models: [DEFAULT_MODEL] });
  try {
    const list = await groq().models.list();
    const models = list.data
      .map((m) => m.id)
      .filter((id) => !/whisper|tts|guard|playai|distil|orpheus|compound|allam/i.test(id))
      .sort();
    const def = models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : (FALLBACK_MODELS.find((m) => models.includes(m)) ?? models[0]);
    return Response.json({ hasKey, mock, default: def, models });
  } catch (err) {
    return Response.json({ hasKey, mock, default: DEFAULT_MODEL, models: [DEFAULT_MODEL], error: String(err) });
  }
}
