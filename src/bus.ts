// Tiny in-process event bus. Tools emit business events (ticket, reservation,
// viewing, lead, handoff); the SSE endpoint relays them to the live ops board.
import { EventEmitter } from "node:events";

export const bus = new EventEmitter();
bus.setMaxListeners(100);

export interface FeedEvent {
  type: string;
  at: number;
  payload: Record<string, unknown>;
}

export function emitFeed(type: string, payload: Record<string, unknown>): void {
  const event: FeedEvent = { type, at: Date.now(), payload };
  bus.emit("feed", event);
}
