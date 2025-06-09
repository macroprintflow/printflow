
"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppConsole, type LogEntry } from "@/contexts/ConsoleContext";
import { Terminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsoleLogViewerProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

function formatLogMessage(args: any[]): React.ReactNode {
  return args.map((arg, index) => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return <pre key={index} className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(arg, null, 2)}</pre>;
      } catch (e) {
        return <span key={index} className="text-xs">[Unserializable Object]</span>;
      }
    }
    return <span key={index} className="text-xs">{String(arg)} </span>;
  }).reduce((prev, curr, index) => <>{prev}{index > 0 && ' '}{curr}</>, <></>);
}

export function ConsoleLogViewer({ isOpen, setIsOpen }: ConsoleLogViewerProps) {
  const { logEntries, clearLogs } = useAppConsole();

  const getLogLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-500 dark:text-red-400 border-l-red-500';
      case 'warn': return 'text-yellow-500 dark:text-yellow-400 border-l-yellow-500';
      case 'info': return 'text-blue-500 dark:text-blue-400 border-l-blue-500';
      case 'debug': return 'text-gray-500 dark:text-gray-400 border-l-gray-500';
      default: return 'text-foreground border-l-gray-300 dark:border-l-gray-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="font-headline flex items-center">
            <Terminal className="mr-2 h-5 w-5 text-primary" /> Live Application Console
          </DialogTitle>
          <DialogDescription>
            View console logs captured from the application. Newest logs appear at the top.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow px-6 py-4 bg-muted/20 dark:bg-background/30">
          {logEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No logs yet. Interact with the app to see logs here.</p>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {logEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn("p-2 border-l-4 rounded-r-sm bg-card", getLogLevelClass(entry.level))}
                >
                  <span className="font-semibold mr-2 text-muted-foreground">{entry.timestamp}</span>
                  <span className={cn("font-bold uppercase mr-2", 
                    entry.level === 'error' && 'text-red-600 dark:text-red-500',
                    entry.level === 'warn' && 'text-yellow-600 dark:text-yellow-500'
                  )}>{entry.level}:</span>
                  {formatLogMessage(entry.message)}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-4 border-t sm:justify-between">
          <Button variant="outline" onClick={clearLogs} className="font-body">
            <Trash2 className="mr-2 h-4 w-4" /> Clear Logs
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="default" className="font-body">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
