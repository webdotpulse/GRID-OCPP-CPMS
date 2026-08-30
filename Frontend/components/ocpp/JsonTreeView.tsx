"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { SchemaViolation } from "./types";

interface Props {
  data: any;
  path?: string;
  violations?: SchemaViolation[];
  initialExpanded?: boolean;
}

export function JsonTreeView({ data, path = "", violations = [], initialExpanded = true }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied: ${text.slice(0, 30)}${text.length > 30 ? "..." : ""}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (data === null || data === undefined) {
    return <span className="font-mono text-xs text-muted-foreground/60 italic">null</span>;
  }

  if (typeof data !== "object") {
    if (typeof data === "string") {
      return (
        <span
          onClick={(e) => handleCopy(data, path, e)}
          className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          title="Click to copy string"
        >
          &quot;{data}&quot;
        </span>
      );
    }
    if (typeof data === "number") {
      return (
        <span
          onClick={(e) => handleCopy(data.toString(), path, e)}
          className="font-mono text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-semibold"
          title="Click to copy number"
        >
          {data}
        </span>
      );
    }
    if (typeof data === "boolean") {
      return (
        <span
          onClick={(e) => handleCopy(data.toString(), path, e)}
          className="font-mono text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-semibold"
          title="Click to copy boolean"
        >
          {data ? "true" : "false"}
        </span>
      );
    }
  }

  return <JsonObjectTree data={data} path={path} violations={violations} initialExpanded={initialExpanded} />;
}

function JsonObjectTree({ data, path, violations, initialExpanded }: Props) {
  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded ?? true);
  const [copied, setCopied] = useState(false);

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    toast.success("Copied object JSON to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  if (keys.length === 0) {
    return <span className="font-mono text-xs text-muted-foreground/60">{isArray ? "[]" : "{}"}</span>;
  }

  return (
    <div className="font-mono text-xs leading-relaxed select-text">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1.5 cursor-pointer py-0.5 px-1 rounded hover:bg-muted group transition-colors"
      >
        <span className="text-muted-foreground group-hover:text-foreground">
          {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>

        <span className="text-muted-foreground font-semibold">
          {isArray ? `Array(${data.length})` : `Object {${keys.length}}`}
        </span>

        <button
          onClick={handleCopyJson}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-opacity"
          title="Copy node JSON"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pl-4 border-l border-border/70 my-0.5 space-y-1">
          {keys.map((key) => {
            const currentPath = path ? `${path}.${key}` : key;
            const violation = violations?.find((v) => v.field === currentPath || v.field === key);
            const value = data[key];

            return (
              <div key={key} className="flex flex-col">
                <div className="flex items-start gap-1.5 flex-wrap">
                  <span className="text-[#54a8c7] font-semibold">{isArray ? `[${key}]` : key}:</span>

                  <JsonTreeView
                    data={value}
                    path={currentPath}
                    violations={violations}
                    initialExpanded={false}
                  />

                  {violation && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-sans font-bold ${
                        violation.severity === "error"
                          ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      <AlertCircle className="size-3" />
                      {violation.message}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
