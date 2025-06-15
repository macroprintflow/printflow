"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ───── Types ─────────────────────────────────────────────────────── */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: "log" | "warn" | "error" | "info" | "debug";
  message: any[];
}
interface ConsoleContextType {
  logEntries: LogEntry[];
  addLogEntry: (level: LogEntry["level"], ...args: any[]) => void;
  clearLogs: () => void;
}

/* ───── Context ───────────────────────────────────────────────────── */
const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

/* Capture first console methods so we can restore them later */
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

/* Guard flag – prevent double patching in dev strict-mode / HMR */
let consolePatched = false;

/* ───── Provider ──────────────────────────────────────────────────── */
export function ConsoleProvider({ children }: { children: ReactNode }) {
  const MAX_LOG_ENTRIES = 200;
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  /* Add a log entry (memoised) */
  const addLogEntry = useCallback(
    (level: LogEntry["level"], ...args: any[]) => {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        message: args,
      };
      setLogEntries((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
    },
    []
  );

  const clearLogs = useCallback(() => setLogEntries([]), []);

  /* Patch console.* once on mount, unpatch on unmount */
  useEffect(() => {
    if (consolePatched) return;       // already done (dev double-mount etc.)
    consolePatched = true;

    console.log  = (...a) => { originalConsole.log  (...a); addLogEntry("log",  ...a); };
    console.warn = (...a) => { originalConsole.warn (...a); addLogEntry("warn", ...a); };

    /* -------- KEEP original console.error for real stack traces ------- */
    console.error = originalConsole.error;
    /* If you still want to record errors, call addLogEntry here too:     */
    /* console.error = (...a) => {                                         */
    /*   originalConsole.error(...a);                                      */
    /*   addLogEntry("error", ...a);                                       */
    /* };                                                                  */

    console.info  = (...a) => { originalConsole.info (...a); addLogEntry("info",  ...a); };
    console.debug = (...a) => { originalConsole.debug(...a); addLogEntry("debug", ...a); };

    return () => {
      console.log  = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error= originalConsole.error;   //  ← restore on cleanup
      console.info = originalConsole.info;
      console.debug= originalConsole.debug;
      consolePatched = false;
    };
  }, [addLogEntry]);

  /* Memoised context value */
  const ctx = useMemo(
    () => ({ logEntries, addLogEntry, clearLogs }),
    [logEntries, addLogEntry, clearLogs]
  );

  return <ConsoleContext.Provider value={ctx}>{children}</ConsoleContext.Provider>;
}

/* ───── Hook ──────────────────────────────────────────────────────── */
export function useAppConsole(): ConsoleContextType {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useAppConsole must be used within a ConsoleProvider");
  return ctx;
}
