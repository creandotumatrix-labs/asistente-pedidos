// Shared Claude tool-use runtime. The ONLY module that imports the Anthropic
// SDK. Identical loop for every business; the config decides persona + tools.
import Anthropic from "@anthropic-ai/sdk";
import type { Session, ToolContext } from "./types.ts";
import { loadConfig } from "./config.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { getToolPack, findTool, toAnthropicTools } from "./tools/index.ts";

const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const MAX_STEPS = 6; // tool-call rounds before we force a reply
const MAX_TOKENS = 1024;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY no está configurada.");
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export type Emit = (event: string, payload: Record<string, unknown>) => void;

/**
 * Run one inbound user turn through the agent. Mutates session (history, order,
 * reservations) and returns the assistant text to send back over the channel.
 */
export async function runAgent(session: Session, userText: string, emit: Emit): Promise<string[]> {
  const config = loadConfig(session.businessSlug);
  const pack = getToolPack(config.tool_pack);
  const tools = toAnthropicTools(pack);
  const system = buildSystemPrompt(config);
  const ctx: ToolContext = { session, config, emit, now: () => new Date() };

  session.messages.push({ role: "user", content: userText });
  const out: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: session.messages as Anthropic.MessageParam[],
      tools: tools as Anthropic.Tool[],
    });

    session.messages.push({ role: "assistant", content: resp.content });

    for (const block of resp.content) {
      if (block.type === "text" && block.text.trim()) out.push(block.text.trim());
    }

    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const def = findTool(pack, tu.name);
      let result: unknown;
      try {
        result = def
          ? def.handler((tu.input ?? {}) as Record<string, unknown>, ctx)
          : { ok: false, error: "tool_desconocida", name: tu.name };
      } catch (e) {
        result = { ok: false, error: "excepcion", message: e instanceof Error ? e.message : String(e) };
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    session.messages.push({ role: "user", content: results });
  }

  session.updatedAt = Date.now();
  return out.length ? out : ["Perdón, ¿me lo repites? 🙏"];
}
