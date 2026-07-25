"use client";

// useAsync — one state machine for every async call (server action or fetch):
// idle → loading → success | error, with a built-in OFFLINE guard at the
// network layer so a dropped connection surfaces as a clear error, not a hang.

import { useCallback, useRef, useState } from "react";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
  offline: boolean;
  isLoading: boolean;
  run: (fn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

const OFFLINE_MSG = "You appear to be offline. Check your connection and try again.";

export function useAsync<T>(): AsyncState<T> {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const call = useRef(0);

  const reset = useCallback(() => { setStatus("idle"); setData(null); setError(null); setOffline(false); }, []);

  const run = useCallback(async (fn: () => Promise<T>) => {
    const id = ++call.current;
    setError(null); setOffline(false); setStatus("loading");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (id === call.current) { setOffline(true); setError(OFFLINE_MSG); setStatus("error"); }
      return null;
    }
    try {
      const result = await fn();
      if (id !== call.current) return result; // superseded by a newer call
      setData(result); setStatus("success");
      return result;
    } catch (e) {
      if (id !== call.current) return null;
      const isNet = e instanceof TypeError || /network|fetch|Failed to fetch/i.test(String((e as Error)?.message));
      setOffline(isNet); setError(isNet ? OFFLINE_MSG : (e instanceof Error ? e.message : "Something went wrong."));
      setStatus("error");
      return null;
    }
  }, []);

  return { status, data, error, offline, isLoading: status === "loading", run, reset };
}
