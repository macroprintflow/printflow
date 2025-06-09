
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: any[]; // Store all arguments passed to console.log etc.
}

interface ConsoleContextType {
  logEntries: LogEntry[];
  addLogEntry: (level: LogEntry['level'], ...args: any[]) => void;
  clearLogs: () => void;
}

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

export const ConsoleProvider = ({ children }: { children: ReactNode }) => {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const MAX_LOG_ENTRIES = 200; // Limit the number of entries to prevent performance issues

  const addLogEntry = useCallback((level: LogEntry['level'], ...args: any[]) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message: args,
    };
    setLogEntries(prevEntries => [newEntry, ...prevEntries].slice(0, MAX_LOG_ENTRIES));
  }, []);

  const clearLogs = useCallback(() => {
    setLogEntries([]);
  }, []);

  useEffect(() => {
    console.log = (...args: any[]) => {
      originalConsole.log.apply(console, args);
      addLogEntry('log', ...args);
    };
    console.warn = (...args: any[]) => {
      originalConsole.warn.apply(console, args);
      addLogEntry('warn', ...args);
    };
    console.error = (...args: any[]) => {
      originalConsole.error.apply(console, args);
      addLogEntry('error', ...args);
    };
    console.info = (...args: any[]) => {
      originalConsole.info.apply(console, args);
      addLogEntry('info', ...args);
    };
    console.debug = (...args: any[]) => {
      originalConsole.debug.apply(console, args);
      addLogEntry('debug', ...args);
    };

    // Cleanup: Restore original console methods when component unmounts
    return () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.info = originalConsole.info;
      console.debug = originalConsole.debug;
    };
  }, [addLogEntry]);

  return (
    <ConsoleContext.Provider value={{ logEntries, addLogEntry, clearLogs }}>
      {children}
    </ConsoleContext.Provider>
  );
};

export const useAppConsole = (): ConsoleContextType => {
  const context = useContext(ConsoleContext);
  if (context === undefined) {
    throw new Error('useAppConsole must be used within a ConsoleProvider');
  }
  return context;
};
