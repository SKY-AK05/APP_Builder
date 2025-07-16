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

interface CodeDisplayProps {
  code: string;
}

export function CodeDisplay({ code }: CodeDisplayProps) {
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

  const lineCount = code.split('\n').length;

  return (
    <div className="relative rounded-lg bg-background h-full border p-0 font-mono text-sm text-foreground/90 flex overflow-hidden">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
      <div className="bg-background/50 text-right pr-4 pl-2 py-4 select-none text-muted-foreground border-r">
        {Array.from({length: lineCount}, (_, i) => i + 1).join('\n')}
      </div>
      <pre className="whitespace-pre-wrap break-words h-full overflow-auto flex-1 py-4 px-2">
        <code>{code}</code>
      </pre>
    </div>
  );
}
