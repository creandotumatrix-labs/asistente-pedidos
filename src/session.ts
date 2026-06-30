// Per-conversation session store. In-memory Map for the demo;
// swap for Redis/Postgres in prod (single interface to replace).
import type { Session } from "./types.ts";

export function newSession(id: string, businessSlug: string, profileName?: string): Session {
  const now = Date.now();
  return {
    id,
    businessSlug,
    profileName,
    messages: [],
    order: { lines: [], subtotal: 0, total: 0, status: "building" },
    reservations: [],
    ticketSeq: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export class SessionStore {
  private map = new Map<string, Session>();

  get(id: string, businessSlug: string, profileName?: string): Session {
    let s = this.map.get(id);
    if (!s || s.businessSlug !== businessSlug) {
      s = newSession(id, businessSlug, profileName);
      this.map.set(id, s);
    }
    if (profileName && !s.profileName) s.profileName = profileName;
    return s;
  }

  reset(id: string): void {
    this.map.delete(id);
  }

  count(): number {
    return this.map.size;
  }
}
