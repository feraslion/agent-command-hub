import type { IncomingMessage, Server } from "http";
import type { Request as ExpressRequest } from "express";
import { WebSocket, WebSocketServer } from "ws";

import { sdk } from "./_core/sdk";

type RuntimeUpdateReason = "runner" | "request" | "approval";

type RuntimeRealtimeMessage =
  | { type: "runtime.authenticate"; token?: string }
  | { type: "runtime.ping" };

type RuntimeSubscriber = {
  socket: WebSocket;
  ownerId: number | null;
};

const subscribers = new Set<RuntimeSubscriber>();

function parseMessage(raw: unknown): RuntimeRealtimeMessage | null {
  try {
    const value = JSON.parse(String(raw)) as RuntimeRealtimeMessage;
    return value?.type === "runtime.authenticate" || value?.type === "runtime.ping" ? value : null;
  } catch {
    return null;
  }
}

async function authenticateUpgradeRequest(request: IncomingMessage, token?: string) {
  const headers = { ...request.headers } as Record<string, string | string[] | undefined>;
  if (token) headers.authorization = `Bearer ${token}`;
  return sdk.authenticateRequest({ headers } as unknown as ExpressRequest);
}

function send(socket: WebSocket, payload: Record<string, unknown>) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function isAllowedBrowserOrigin(request: IncomingMessage) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const originHost = new URL(origin).hostname;
    const requestHost = (request.headers.host ?? "").split(":")[0];
    return originHost === requestHost || originHost.replace(/^8081-/, "3000-") === requestHost;
  } catch {
    return false;
  }
}

export function broadcastRuntimeUpdate(ownerId: number, reason: RuntimeUpdateReason) {
  const payload = {
    type: "runtime.invalidate",
    reason,
    at: Date.now(),
    resources: ["isolatedRuntime", "localRunners", "approvals"],
  };
  for (const subscriber of subscribers) {
    if (subscriber.ownerId === ownerId) send(subscriber.socket, payload);
  }
}

export function registerRuntimeRealtime(server: Server) {
  const websocketServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (path !== "/api/runtime-updates" || !isAllowedBrowserOrigin(request)) {
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => websocketServer.emit("connection", websocket, request));
  });

  websocketServer.on("connection", (socket, request) => {
    const subscriber: RuntimeSubscriber = { socket, ownerId: null };
    subscribers.add(subscriber);

    const authorize = async (token?: string) => {
      try {
        const user = await authenticateUpgradeRequest(request, token);
        subscriber.ownerId = user.id;
        send(socket, { type: "runtime.ready", at: Date.now() });
      } catch {
        socket.close(4401, "Unauthorized realtime connection");
      }
    };

    if (request.headers.cookie || request.headers.authorization) void authorize();

    const authenticationTimeout = setTimeout(() => {
      if (subscriber.ownerId === null) socket.close(4401, "Realtime authentication required");
    }, 8_000);

    socket.on("message", (raw) => {
      const message = parseMessage(raw);
      if (!message) return;
      if (message.type === "runtime.authenticate") {
        void authorize(message.token);
      } else if (subscriber.ownerId !== null) {
        send(socket, { type: "runtime.pong", at: Date.now() });
      }
    });

    socket.on("close", () => {
      clearTimeout(authenticationTimeout);
      subscribers.delete(subscriber);
    });
  });

  server.once("close", () => websocketServer.close());
}
