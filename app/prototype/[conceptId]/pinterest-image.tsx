/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const size = {
  width: 1000,
  height: 1500,
};

export const contentType = "image/png";

export default async function PinterestImage({
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
            "radial-gradient(circle at top left, rgba(61,217,255,0.20), transparent 28%), radial-gradient(circle at bottom right, rgba(255,184,77,0.24), transparent 30%), #0D1117",
          color: "#E6EDF3",
          padding: "34px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
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
              justifyContent: "space-between",
              alignItems: "center",
              padding: "24px 28px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
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
              Pinterest Export
            </div>
            <div
              style={{
                display: "flex",
                color: "#3DD9FF",
                fontSize: "16px",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
              }}
            >
              NeotypeLab
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              padding: "28px",
              gap: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#9BA7B4",
                  fontSize: "18px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                }}
              >
                Share-ready vertical card
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: concept?.title && concept.title.length > 36 ? "48px" : "56px",
                  fontWeight: 700,
                  lineHeight: 1.04,
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
                  lineHeight: 1.4,
                }}
              >
                {concept
                  ? `${concept.baseModel?.name ?? "Unknown base model"} · ${concept.stylePreset?.name ?? "Unknown Style DNA"}`
                  : "This shared prototype is no longer available on a public or unlisted surface."}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                position: "relative",
                borderRadius: "28px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
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
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "26px",
                  background:
                    "linear-gradient(180deg, rgba(13,17,23,0.10) 0%, rgba(13,17,23,0.72) 100%)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <ExportPill label={concept?.weatheringLevel ?? "unknown"} />
                  <ExportPill
                    label={
                      concept
                        ? `${concept.engagement.saveCount} saves · ${concept.engagement.likeCount} likes`
                        : "NeotypeLab"
                    }
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: "#58FFB2",
                      fontSize: "20px",
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                    }}
                  >
                    Prototype reference
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "28px",
                      fontWeight: 600,
                      lineHeight: 1.16,
                    }}
                  >
                    {concept?.materialPreset?.name ?? "Unknown material profile"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      gap: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        maxWidth: "70%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          color: "#C7D0DA",
                          fontSize: "18px",
                          lineHeight: 1.4,
                        }}
                      >
                        {concept?.owner
                          ? `Pilot @${concept.owner.handle} · ${concept.remixCount} remix branch${concept.remixCount === 1 ? "" : "es"}`
                          : "Public prototype surface"}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        padding: "10px 14px",
                        borderRadius: "999px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(0,0,0,0.30)",
                        color: "#E6EDF3",
                        fontSize: "16px",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                      }}
                    >
                      Pinterest
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
        background: "rgba(0,0,0,0.30)",
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
