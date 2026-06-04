/* eslint-disable @next/next/no-img-element */

type OpenGraphImageCardProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  meta: string[];
  footer: string;
  accent: string;
  imageUrl?: string;
};

export function OpenGraphImageCard({
  accent,
  eyebrow,
  footer,
  imageUrl,
  meta,
  subtitle,
  title,
}: OpenGraphImageCardProps) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: "#0D1117",
        backgroundImage:
          "radial-gradient(circle at top left, rgba(61,217,255,0.18), transparent 36%), radial-gradient(circle at bottom right, rgba(255,184,77,0.18), transparent 34%)",
        color: "#E6EDF3",
        padding: "36px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "64%",
          height: "100%",
          padding: "34px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "28px",
          background: "rgba(17,22,29,0.92)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: accent,
              fontSize: "18px",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
            }}
          >
            <span>{eyebrow}</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontSize: title.length > 40 ? "52px" : "60px",
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.04em",
                maxWidth: "620px",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: "24px",
                color: "#9BA7B4",
                lineHeight: 1.45,
                maxWidth: "640px",
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {meta.map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.22)",
                  color: "#C7D0DA",
                  fontSize: "16px",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              color: "#9BA7B4",
              fontSize: "18px",
            }}
          >
            <span>{footer}</span>
            <span style={{ color: accent, letterSpacing: "0.22em", textTransform: "uppercase" }}>
              NeotypeLab
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "36%",
          height: "100%",
          paddingLeft: "26px",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            borderRadius: "28px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(180deg, rgba(17,22,29,0.96) 0%, rgba(13,17,23,1) 100%)",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "28px",
                background:
                  "linear-gradient(180deg, rgba(61,217,255,0.10) 0%, rgba(255,184,77,0.10) 100%)",
              }}
            >
              <div
                style={{
                  color: accent,
                  fontSize: "18px",
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                }}
              >
                Share Surface
              </div>
              <div
                style={{
                  color: "#9BA7B4",
                  fontSize: "22px",
                  lineHeight: 1.4,
                }}
              >
                Dynamic share card with stable type hierarchy, metadata cues, and product context.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
