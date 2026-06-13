type OpenGraphImageInput = {
  accent: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  meta: string[];
  footer: string;
  imageUrl?: string | null;
};

export const openGraphImageHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "image/svg+xml; charset=utf-8",
};

export function openGraphImageResponse(input: OpenGraphImageInput) {
  return new Response(buildOpenGraphSvg(input), {
    headers: openGraphImageHeaders,
  });
}

export function buildOpenGraphSvg({
  accent,
  eyebrow,
  footer,
  imageUrl,
  meta,
  subtitle,
  title,
}: OpenGraphImageInput) {
  const titleLines = wrapSvgText(title, 25, 3);
  const subtitleLines = wrapSvgText(subtitle, 52, 2);
  const footerLines = wrapSvgText(footer, 70, 1);
  const metaItems = meta.slice(0, 3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D"/>
      <stop offset="0.52" stop-color="#10151B"/>
      <stop offset="1" stop-color="#141B21"/>
    </linearGradient>
    <linearGradient id="accent" x1="120" y1="72" x2="1040" y2="560" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${escapeXml(accent)}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${escapeXml(accent)}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="imageClip">
      <rect x="752" y="86" width="338" height="338" rx="0"/>
    </clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="38" y="38" width="1124" height="554" stroke="#2F3A43" stroke-width="2"/>
  <path d="M38 142H1162" stroke="#2F3A43" stroke-width="1"/>
  <path d="M114 38V592" stroke="#2F3A43" stroke-width="1"/>
  <circle cx="1056" cy="92" r="210" fill="url(#accent)"/>
  <g opacity="0.5">
    ${Array.from({ length: 15 })
      .map((_, index) => {
        const x = 38 + index * 80;
        return `<path d="M${x} 38V592" stroke="#1B242B" stroke-width="1"/>`;
      })
      .join("\n    ")}
    ${Array.from({ length: 7 })
      .map((_, index) => {
        const y = 62 + index * 78;
        return `<path d="M38 ${y}H1162" stroke="#1B242B" stroke-width="1"/>`;
      })
      .join("\n    ")}
  </g>
  <text x="138" y="96" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24" letter-spacing="6">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="138" y="205" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="58" letter-spacing="0">
    ${titleLines
      .map((line, index) => `<tspan x="138" dy="${index === 0 ? 0 : 66}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="140" y="${262 + Math.max(0, titleLines.length - 1) * 66}" fill="#9AAAB2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24">
    ${subtitleLines
      .map((line, index) => `<tspan x="140" dy="${index === 0 ? 0 : 34}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <g transform="translate(140 414)">
    ${metaItems
      .map((item, index) => {
        const x = index * 194;
        return `<g transform="translate(${x} 0)"><rect width="172" height="48" fill="#0C1117" stroke="#2F3A43"/><text x="18" y="31" fill="#C7D4DA" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="17">${escapeXml(item.toUpperCase())}</text></g>`;
      })
      .join("\n    ")}
  </g>
  <text x="140" y="540" fill="#71848E" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="3">
    ${footerLines.map((line) => `<tspan x="140">${escapeXml(line.toUpperCase())}</tspan>`).join("\n    ")}
  </text>
  <g>
    <rect x="728" y="62" width="386" height="386" fill="#0C1117" stroke="#2F3A43" stroke-width="2"/>
    ${
      imageUrl
        ? `<image href="${escapeXml(imageUrl)}" x="752" y="86" width="338" height="338" preserveAspectRatio="xMidYMid slice" clip-path="url(#imageClip)"/>`
        : `<rect x="752" y="86" width="338" height="338" fill="#111922"/><path d="M786 390L900 160L1056 390H786Z" fill="${escapeXml(accent)}" fill-opacity="0.22"/><circle cx="1018" cy="150" r="42" fill="${escapeXml(accent)}" fill-opacity="0.28"/>`
    }
    <rect x="752" y="86" width="338" height="338" stroke="${escapeXml(accent)}" stroke-opacity="0.55" stroke-width="2"/>
  </g>
  <text x="732" y="518" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="38">NEOTYPELAB</text>
  <text x="734" y="552" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="5">PUBLIC SURFACE</text>
</svg>`;
}

export function wrapSvgText(value: string, maxLength: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === 0) {
    lines.push(value.slice(0, maxLength));
  }

  if (words.join(" ").length > lines.join(" ").length) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].replace(/\s+$/, "")}...`;
  }

  return lines;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}
