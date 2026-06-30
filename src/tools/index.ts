// Tool registry. Maps a config's tool_pack to its ToolDef[] and exposes
// the plain-JSON tool schemas the Anthropic API expects. No SDK import here,
// so the packs stay runnable under `node --experimental-strip-types`.
import type { ToolDef, ToolPackName } from "../types.ts";
import { restaurantTools } from "./restaurant.ts";
import { realEstateTools } from "./realestate.ts";

export function getToolPack(name: ToolPackName): ToolDef[] {
  return name === "realestate" ? realEstateTools : restaurantTools;
}

export function findTool(pack: ToolDef[], name: string): ToolDef | undefined {
  return pack.find((t) => t.name === name);
}

export function toAnthropicTools(pack: ToolDef[]): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return pack.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
