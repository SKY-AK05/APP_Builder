"use client";

import { useState, useEffect } from "react";
import { Clipboard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CodeDisplayProps {
  code: string;
  className?: string;
}

export function CodeDisplay({ code, className }: CodeDisplayProps) {
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const copyToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setHasCopied(true);
    }
  };

  const lines = code.split('\n');

  return (
    <div className={cn("relative rounded-lg bg-background h-full border font-mono text-sm text-foreground/90 overflow-auto", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground z-10"
              onClick={copyToClipboard}
              aria-label="Copy code"
            >
              {hasCopied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Clipboard className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy to clipboard</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <table className="w-full h-full text-left">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td className="w-12 pr-4 pl-4 text-right select-none text-muted-foreground bg-background/50 border-r border-border">
                {index + 1}
              </td>
              <td className="px-4 whitespace-pre-wrap break-all">
                {line}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
