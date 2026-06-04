/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const size = {
  width: 1600,
  height: 900,
};

export const contentType = "image/png";

export default async function RedditImage({
  params,
}: {
  params: { conceptId: string };
}) {
  const concept = await fetchQuery(api.showcase.getSharedConcept, {
    conceptId: params.conceptId as Id<"concepts">,
  });

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at top left, rgba(61,217,255,0.16), transparent 28%), radial-gradient(circle at bottom right, rgba(255,184,77,0.22), transparent 28%), #0D1117",
          color: "#E6EDF3",
          padding: "34px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: "32px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(17,22,29,0.94)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "44%",
              padding: "30px",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#FFB84D",
                  fontSize: "18px",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                }}
              >
                Reddit Export
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: concept?.title && concept.title.length > 34 ? "54px" : "62px",
                  fontWeight: 700,
                  lineHeight: 1.02,
                  letterSpacing: "-0.04em",
                }}
              >
                {concept?.title ?? "Shared prototype unavailable"}
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#9BA7B4",
                  fontSize: "24px",
                  lineHeight: 1.42,
                }}
              >
                {concept
                  ? `${concept.baseModel?.name ?? "Unknown base model"} · ${concept.stylePreset?.name ?? "Unknown Style DNA"} · ${concept.materialPreset?.name ?? "Unknown material profile"}`
                  : "This shared prototype is no longer available on a public or unlisted surface."}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <ExportPill label={concept?.weatheringLevel ?? "unknown"} />
                <ExportPill
                  label={
                    concept
                      ? `${concept.engagement.likeCount} likes · ${concept.engagement.saveCount} saves`
                      : "NeotypeLab"
                  }
                />
                <ExportPill
                  label={
                    concept
                      ? `${concept.remixCount} remix${concept.remixCount === 1 ? "" : "es"}`
                      : "Public share"
                  }
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "18px",
                  paddingTop: "16px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: "#58FFB2",
                      fontSize: "18px",
                      letterSpacing: "0.24em",
                      textTransform: "uppercase",
                    }}
                  >
                    Prototype discussion surface
                  </div>
                  <div
                    style={{
                      display: "flex",
                      color: "#C7D0DA",
                      fontSize: "18px",
                      lineHeight: 1.4,
                    }}
                  >
                    {concept?.owner
                      ? `Pilot @${concept.owner.handle} · Built for community remix and feedback`
                      : "NeotypeLab public concept surface"}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    padding: "10px 14px",
                    borderRadius: "999px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.28)",
                    color: "#E6EDF3",
                    fontSize: "16px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  Reddit
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: "56%",
              position: "relative",
              background:
                "linear-gradient(180deg, rgba(17,22,29,0.96) 0%, rgba(13,17,23,1) 100%)",
            }}
          >
            {concept?.previewAsset?.publicUrl ? (
              <img
                src={concept.previewAsset.publicUrl}
                alt={concept.title}
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
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9BA7B4",
                  fontSize: "24px",
                }}
              >
                Preview unavailable
              </div>
            )}

            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(13,17,23,0.06) 0%, rgba(13,17,23,0.34) 100%)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    size
  );
}

function ExportPill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.28)",
        color: "#E6EDF3",
        fontSize: "16px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}
