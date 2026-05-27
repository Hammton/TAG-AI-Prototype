import type { Audience } from "./types";

export type ChatResult = {
  reply: string;
  engine: "langchain" | "stub";
};

export async function sendChatMessage(payload: {
  message: string;
  client_id: string;
  audience: Audience;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<ChatResult> {
  const history = payload.history.slice(-12);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: payload.message,
      client_id: payload.client_id,
      audience: payload.audience,
      history,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Chat failed (${res.status})`);
  }

  return res.json() as Promise<ChatResult>;
}
