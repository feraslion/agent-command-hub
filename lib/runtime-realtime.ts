import { useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { buildRuntimeWebSocketUrl, isRuntimeInvalidation, type RuntimeRealtimeMessage } from "@/lib/runtime-realtime-protocol";

export type RuntimeRealtimeState = "connecting" | "live" | "fallback";

function parseMessage(value: unknown): RuntimeRealtimeMessage | null {
  try {
    return JSON.parse(typeof value === "string" ? value : String(value)) as RuntimeRealtimeMessage;
  } catch {
    return null;
  }
}

export function useRuntimeRealtime(enabled: boolean): RuntimeRealtimeState {
  const utils = trpc.useUtils();
  const [state, setState] = useState<RuntimeRealtimeState>("fallback");
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setState("fallback");
      return;
    }

    const url = buildRuntimeWebSocketUrl(getApiBaseUrl());
    if (!url || typeof WebSocket === "undefined") {
      setState("fallback");
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const invalidateRuntime = () => {
      utils.isolatedRuntime.listForOwner.invalidate();
      utils.localRunners.list.invalidate();
      utils.approvals.inbox.invalidate();
    };

    const connect = () => {
      if (!active) return;
      setState("connecting");
      socket = new WebSocket(url);
      socket.onopen = async () => {
        attemptsRef.current = 0;
        const token = await Auth.getSessionToken();
        socket?.send(JSON.stringify({ type: "runtime.authenticate", token: token ?? undefined }));
        heartbeatTimer = setInterval(() => socket?.send(JSON.stringify({ type: "runtime.ping" })), 25_000);
      };
      socket.onmessage = (event) => {
        const message = parseMessage(event.data);
        if (message?.type === "runtime.ready") {
          setState("live");
          return;
        }
        if (isRuntimeInvalidation(message)) invalidateRuntime();
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (!active) return;
        setState("fallback");
        const delay = Math.min(10_000, 1_000 * 2 ** attemptsRef.current);
        attemptsRef.current += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      socket?.close();
    };
  }, [enabled, utils]);

  return state;
}

export { buildRuntimeWebSocketUrl, isRuntimeInvalidation } from "@/lib/runtime-realtime-protocol";
