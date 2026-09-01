"use client";

import React, { useState, useEffect, useRef } from "react";
import { ResponsiveContainer, ResponsiveContainerProps } from "recharts";

export interface SafeResponsiveContainerProps extends ResponsiveContainerProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SafeResponsiveContainer wraps Recharts ResponsiveContainer to guarantee
 * that it only renders once the parent container has positive, laid-out dimensions.
 * This prevents the console warning:
 * "The width(-1) and height(-1) of chart should be greater than 0..."
 */
export function SafeResponsiveContainer({
  children,
  width = "100%",
  height = "100%",
  minWidth = 0,
  minHeight = 0,
  className,
  style,
  ...props
}: SafeResponsiveContainerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasDimensions, setHasDimensions] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const el = containerRef.current;
    if (!el) return;

    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setHasDimensions(true);
    }

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            setHasDimensions(true);
          }
        }
      });
      resizeObserver.observe(el);
      return () => resizeObserver.disconnect();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={className || "w-full h-full min-w-0 min-h-0"}
      style={{ width: "100%", height: "100%", ...style }}
    >
      {isMounted && hasDimensions ? (
        <ResponsiveContainer
          width={width}
          height={height}
          minWidth={minWidth}
          minHeight={minHeight}
          {...props}
        >
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
