const frames = [
  {
    index: "04",
    strokes: [
      "M40 60 H160",
      "M100 12 V108",
      "M70 60 H100",
    ],
    nodes: [
      { cx: 100, cy: 60, filled: true },
      { cx: 70, cy: 60, filled: false },
    ],
  },
  {
    index: "12",
    strokes: [
      "M28 28 H120",
      "M120 28 V88",
      "M72 28 V72 H156",
    ],
    nodes: [
      { cx: 120, cy: 28, filled: true },
      { cx: 72, cy: 72, filled: false },
    ],
  },
  {
    index: "07",
    strokes: [
      "M36 96 H164",
      "M100 20 V96",
      "M64 52 H100",
      "M100 52 L132 24",
    ],
    nodes: [
      { cx: 64, cy: 52, filled: true },
      { cx: 100, cy: 96, filled: false },
    ],
  },
  {
    index: "18",
    strokes: [
      "M48 40 H152",
      "M48 40 V92 H120",
      "M120 92 L156 56",
    ],
    nodes: [
      { cx: 48, cy: 40, filled: false },
      { cx: 120, cy: 92, filled: true },
    ],
  },
] as const;

export function JobPlot({ label }: { label: string }) {
  return (
    <figure className="job-plot" aria-hidden="true">
      <svg
        className="job-plot__glyph"
        fill="none"
        role="img"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="1.15"
        viewBox="0 0 200 120"
      >
        <title>{label}</title>
        {frames.map((frame) => (
          <g className="job-plot__frame" key={frame.index}>
            <text className="job-plot__index" x="168" y="22">
              {frame.index}
            </text>
            {frame.strokes.map((d) => (
              <path className="job-plot__stroke" d={d} key={d} />
            ))}
            {frame.nodes.map((node) => (
              <circle
                className={`job-plot__node${node.filled ? " is-filled" : ""}`}
                cx={node.cx}
                cy={node.cy}
                fill={node.filled ? "currentColor" : "none"}
                key={`${node.cx}-${node.cy}`}
                r="3.4"
              />
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="job-plot__caption">{label}</figcaption>
    </figure>
  );
}
