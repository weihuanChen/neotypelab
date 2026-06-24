"use client";

import { CSSProperties, useMemo } from "react";

const EDGE_CLASSES = [
  "psycho-frame-border__edge--top",
  "psycho-frame-border__edge--right",
  "psycho-frame-border__edge--bottom",
  "psycho-frame-border__edge--left",
];

const MIN_SPARKS = 4;
const MAX_SPARKS = 12;

type PsychoFrameStyle = CSSProperties & {
  "--psycho-frame-color"?: string;
  "--psycho-frame-duration"?: string;
  "--psycho-frame-delay"?: string;
  "--psycho-frame-opacity"?: number;
};

export function PsychoFrameBorder({
  color = "#00E676",
  particleCount = 80,
  speedMultiplier = 1.5,
}: {
  color?: string;
  particleCount?: number;
  speedMultiplier?: number;
}) {
  const sparkCount = Math.min(
    MAX_SPARKS,
    Math.max(MIN_SPARKS, Math.round(particleCount / 10))
  );

  const sparks = useMemo(() => {
    const safeSpeed = Math.max(0.5, speedMultiplier);

    return Array.from({ length: sparkCount }).map((_, index) => ({
      edge: index % EDGE_CLASSES.length,
      id: index,
      delay: -((index % 4) * 0.28 + Math.floor(index / 4) * 0.48),
      duration: (3.2 + (index % 3) * 0.35) / safeSpeed,
      opacity: 0.42 + (index % 4) * 0.1,
    }));
  }, [sparkCount, speedMultiplier]);

  const frameStyle: PsychoFrameStyle = {
    "--psycho-frame-color": color,
  };

  return (
    <div
      aria-hidden="true"
      className="psycho-frame-border pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={frameStyle}
    >
      {EDGE_CLASSES.map((edgeClass, edgeIndex) => (
        <span
          className={`psycho-frame-border__edge ${edgeClass}`}
          key={edgeClass}
        >
          {sparks
            .filter((spark) => spark.edge === edgeIndex)
            .map((spark) => {
              const sparkStyle: PsychoFrameStyle = {
                "--psycho-frame-delay": `${spark.delay}s`,
                "--psycho-frame-duration": `${spark.duration}s`,
                "--psycho-frame-opacity": spark.opacity,
              };

              return (
                <span
                  className="psycho-frame-border__spark"
                  key={spark.id}
                  style={sparkStyle}
                />
              );
            })}
        </span>
      ))}
    </div>
  );
}
