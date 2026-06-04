/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const size = {
  width: 1200,
  height: 1500,
};

export const contentType = "image/png";

export default async function WatermarkedImage({
  params,
}: {
  params: { conceptId: string };
}) {
  const concept = await fetchQuery(api.showcase.getSharedConcept, {
    conceptId: params.conceptId as Id<"concepts">,
  });

  const title = concept?.title ?? "Shared prototype unavailable";
  const subtitle = concept
    ? `${concept.baseModel?.name ?? "Unknown base model"} · ${concept.stylePreset?.name ?? "Unknown Style DNA"}`
    : "This shared prototype is no longer available on a public or unlisted surface.";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          background:
            "radial-gradient(circle at top left, rgba(61,217,255,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(255,184,77,0.22), transparent 30%), #0D1117",
          color: "#E6EDF3",
          padding: "42px",
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
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "32px",
            overflow: "hidden",
            background: "rgba(17,22,29,0.94)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "26px 30px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#58FFB2",
                fontSize: "18px",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              Prototype Export
            </div>
            <div
              style={{
                display: "flex",
                color: "#3DD9FF",
                fontSize: "16px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              NeotypeLab
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              padding: "32px",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#9BA7B4",
                  fontSize: "18px",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                }}
              >
                Watermarked Share Preview
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: title.length > 38 ? "52px" : "60px",
                  fontWeight: 700,
                  lineHeight: 1.04,
                  letterSpacing: "-0.04em",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  color: "#9BA7B4",
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                borderRadius: "28px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                background:
                  "linear-gradient(180deg, rgba(17,22,29,0.96) 0%, rgba(13,17,23,1) 100%)",
                position: "relative",
              }}
            >
              {concept?.previewAsset?.publicUrl ? (
                <img
                  src={concept.previewAsset.publicUrl}
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
                    "linear-gradient(180deg, rgba(13,17,23,0.14) 0%, rgba(13,17,23,0.68) 100%)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "14px",
                  }}
                >
                  <WatermarkPill label={concept?.weatheringLevel ?? "unknown"} />
                  <WatermarkPill
                    label={
                      concept
                        ? `${concept.engagement.likeCount} likes · ${concept.engagement.saveCount} saves`
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
                      alignItems: "center",
                      gap: "12px",
                      color: "#58FFB2",
                      fontSize: "20px",
                      letterSpacing: "0.24em",
                      textTransform: "uppercase",
                    }}
                  >
                    Share-ready export
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "20px",
                      alignItems: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        maxWidth: "70%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          fontSize: "28px",
                          fontWeight: 600,
                          lineHeight: 1.15,
                        }}
                      >
                        {concept?.owner ? `Pilot @${concept.owner.handle}` : "Public concept surface"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          fontSize: "18px",
                          color: "#C7D0DA",
                          lineHeight: 1.4,
                        }}
                      >
                        {concept
                          ? `${concept.remixCount} remix branch${concept.remixCount === 1 ? "" : "es"} · Public prototype surface`
                          : "NeotypeLab public prototype surface"}
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
                      NeotypeLab
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

function WatermarkPill({ label }: { label: string }) {
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
