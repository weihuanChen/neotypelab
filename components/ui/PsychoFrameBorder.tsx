"use client";

import { useEffect, useRef, useState, useId } from "react";

export function PsychoFrameBorder({
  color = "#00E676", // Deepen the green, less white
  particleCount = 80,
  speedMultiplier = 1.5,
}: {
  color?: string;
  particleCount?: number;
  speedMultiplier?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const uniqueId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    
    setDimensions({
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
    });
    
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  
  if (width === 0 || height === 0) {
    return <div ref={containerRef} className="pointer-events-none absolute inset-0 z-0" />;
  }

  const pathData = `M1,1 H${width - 1} V${height - 1} H1 Z`;
  const pathId = `psycho-path-${uniqueId}`;

  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const baseDur = 5; 
    const dur = (baseDur + (i % 6)) / speedMultiplier;
    // Positive begin time means they will spawn gradually
    const begin = i * 0.12; 
    const blinkDur = 0.8 + ((i % 4) * 0.4); 
    const radius = 1.5 + (i % 3) * 0.5; 
    return { id: i, dur, begin, blinkDur, radius };
  });

  return (
    // Removed mix-blend-screen to prevent color from blowing out to white
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <filter id={`glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path id={pathId} d={pathData} fill="none" stroke="none" />
        {particles.map((p) => (
          <circle
            key={p.id}
            r="0" // Start at 0 radius so it's invisible before spawn
            fill={color}
            filter={`url(#glow-${uniqueId})`}
          >
            {/* Pop into existence at begin time */}
            <animate 
              attributeName="r" 
              values={`0;${p.radius}`} 
              begin={`${p.begin}s`} 
              dur="0.3s" 
              fill="freeze" 
            />
            {/* Opacity pulsing */}
            <animate 
              attributeName="opacity" 
              values="0.3;0.9;0.3" 
              begin={`${p.begin}s`} 
              dur={`${p.blinkDur}s`} 
              repeatCount="indefinite" 
            />
            {/* Motion path */}
            <animateMotion
              dur={`${p.dur}s`}
              repeatCount="indefinite"
              begin={`${p.begin}s`}
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
        ))}
      </svg>
    </div>
  );
}
