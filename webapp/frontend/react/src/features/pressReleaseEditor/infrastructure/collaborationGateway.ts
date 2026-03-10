import type { RealtimeMessage } from "../types";

export function openPressReleaseCollaborationSocket(url: string): WebSocket {
  return new WebSocket(url);
}

export function isCollaborationSocketOpen(socket: WebSocket | null): socket is WebSocket {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}

export function sendCollaborationMessage(socket: WebSocket | null, payload: unknown): void {
  if (!isCollaborationSocketOpen(socket)) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

export function parseRealtimeMessage(raw: string): RealtimeMessage {
  return JSON.parse(raw) as RealtimeMessage;
}
