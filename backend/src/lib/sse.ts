import type { Response } from "express";
import type { AgentActivityEvent } from "../agent/activity.js";

type FlushableResponse = Response & { flush?: () => void };

/** Disable Nagle buffering for streaming handlers. */
export function prepareSseResponse(res: Response): void {
  res.socket?.setNoDelay(true);
}

/** SSE comment line — keeps connections alive through proxies. */
export function writeSseKeepalive(res: Response): void {
  res.write(": ping\n\n");
  (res as FlushableResponse).flush?.();
}

/** Write one SSE event and flush so proxies/browsers show it immediately. */
export function writeSse(res: Response, event: AgentActivityEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  const flushable = res as FlushableResponse;
  flushable.flush?.();
  // Help Node send the chunk immediately (not only at end of handler).
  if (res.socket && !res.socket.destroyed) {
    res.socket.uncork?.();
  }
}
