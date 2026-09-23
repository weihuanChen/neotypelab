import { encode } from "uqr";

type OpenGraphImageInput = {
  accent: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  meta: string[];
  footer: string;
  imageUrl?: string | null;
};

type PrototypeExportImageInput = {
  accent: string;
  badge: string;
  eyebrow: string;
  footer: string;
  imageUrl?: string | null;
  layout: "portrait" | "square" | "wide";
  meta: string[];
  shareUrl: string;
  subtitle: string;
  title: string;
};

export const openGraphImageHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "image/svg+xml; charset=utf-8",
};

const svgViewportStyle =
  "max-width:100vw;max-height:100vh;width:auto;height:auto;display:block";

export function openGraphImageResponse(input: OpenGraphImageInput) {
  return new Response(buildOpenGraphSvg(input), {
    headers: openGraphImageHeaders,
  });
}

export function prototypeExportImageResponse(input: PrototypeExportImageInput) {
  return new Response(buildPrototypeExportSvg(input), {
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
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg" style="${svgViewportStyle}">
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

function buildPrototypeExportSvg({
  accent,
  badge,
  eyebrow,
  footer,
  imageUrl,
  layout,
  meta,
  shareUrl,
  subtitle,
  title,
}: PrototypeExportImageInput) {
  if (layout === "wide") {
    return buildWidePrototypeExportSvg({
      accent,
      badge,
      eyebrow,
      footer,
      imageUrl,
      meta,
      shareUrl,
      subtitle,
      title,
    });
  }

  if (layout === "square") {
    return buildSquarePrototypeExportSvg({
      accent,
      badge,
      eyebrow,
      footer,
      imageUrl,
      meta,
      shareUrl,
      subtitle,
      title,
    });
  }

  return buildPortraitPrototypeExportSvg({
    accent,
    badge,
    eyebrow,
    footer,
    imageUrl,
    meta,
    shareUrl,
    subtitle,
    title,
  });
}

function buildPortraitPrototypeExportSvg({
  accent,
  badge,
  eyebrow,
  footer,
  imageUrl,
  meta,
  shareUrl,
  subtitle,
  title,
}: Omit<PrototypeExportImageInput, "layout">) {
  const titleLines = wrapSvgText(title, 18, 3);
  const subtitleLines = wrapSvgText(subtitle, 34, 2);
  const footerLines = wrapSvgText(footer, 36, 2);
  const metaItems = meta.slice(0, 3);
  const titleSize = titleLines.length > 2 ? 40 : 46;
  const titleStep = titleLines.length > 2 ? 46 : 52;
  const titleStartY = 208;
  const subtitleY =
    titleStartY + Math.max(0, titleLines.length - 1) * titleStep + 44;
  const headerBottom =
    subtitleY + Math.max(0, subtitleLines.length - 1) * 32 + 28;
  const imageTop = Math.max(390, headerBottom);
  const imageHeight = 1188 - imageTop;
  const qrSize = 148;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="1500" viewBox="0 0 1000 1500" fill="none" xmlns="http://www.w3.org/2000/svg" style="${svgViewportStyle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1000" y2="1500" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D"/>
      <stop offset="0.58" stop-color="#10151B"/>
      <stop offset="1" stop-color="#151B20"/>
    </linearGradient>
    <clipPath id="imageClip">
      <rect x="56" y="${imageTop + 12}" width="888" height="${imageHeight - 24}" rx="0"/>
    </clipPath>
  </defs>
  <rect width="1000" height="1500" fill="url(#bg)"/>
  <circle cx="82" cy="96" r="280" fill="${escapeXml(accent)}" fill-opacity="0.18"/>
  <circle cx="930" cy="1390" r="300" fill="#2C6194" fill-opacity="0.16"/>
  <g opacity="0.45">
    ${Array.from({ length: 11 })
      .map((_, index) => `<path d="M${50 + index * 90} 48V1452" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
    ${Array.from({ length: 15 })
      .map((_, index) => `<path d="M48 ${60 + index * 96}H952" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
  </g>
  <rect x="48" y="48" width="904" height="1404" stroke="#33404A" stroke-width="2"/>
  <path d="M48 158H952" stroke="#33404A" stroke-width="1"/>
  <text x="72" y="112" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24" letter-spacing="6">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="72" y="${titleStartY}" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="${titleSize}" letter-spacing="0">
    ${titleLines
      .map((line, index) => `<tspan x="72" dy="${index === 0 ? 0 : titleStep}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="74" y="${subtitleY}" fill="#9AAAB2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22">
    ${subtitleLines
      .map((line, index) => `<tspan x="74" dy="${index === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <g>
    <rect x="48" y="${imageTop}" width="904" height="${imageHeight}" fill="#0C1117" stroke="#33404A" stroke-width="2"/>
    ${
      imageUrl
        ? `<image href="${escapeXml(imageUrl)}" x="56" y="${imageTop + 12}" width="888" height="${imageHeight - 24}" preserveAspectRatio="xMidYMin slice" clip-path="url(#imageClip)"/>`
        : `<rect x="56" y="${imageTop + 12}" width="888" height="${imageHeight - 24}" fill="#111922"/><path d="M140 1120L430 560L880 1120H140Z" fill="${escapeXml(accent)}" fill-opacity="0.22"/><circle cx="820" cy="580" r="78" fill="${escapeXml(accent)}" fill-opacity="0.28"/>`
    }
    <rect x="56" y="${imageTop + 12}" width="888" height="${imageHeight - 24}" stroke="${escapeXml(accent)}" stroke-opacity="0.54" stroke-width="2"/>
  </g>
  <g transform="translate(72 1230)">
    ${metaItems
      .map((item, index) => {
        const x = index * 236;
        return `<g transform="translate(${x} 0)"><rect width="220" height="42" fill="#0C1117" stroke="#33404A"/><text x="16" y="28" fill="#C7D4DA" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="17">${escapeXml(item.toUpperCase())}</text></g>`;
      })
      .join("\n    ")}
  </g>
  <text x="72" y="1358" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="40">NEOTYPELAB</text>
  <text x="72" y="1398" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="5">${escapeXml(badge.toUpperCase())}</text>
  <text x="72" y="1438" fill="#8FA0A9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16">
    ${footerLines
      .map((line, index) => `<tspan x="72" dy="${index === 0 ? 0 : 24}">${escapeXml(line.toUpperCase())}</tspan>`)
      .join("\n    ")}
  </text>
  ${buildQrGroup(shareUrl, 780, 1308, qrSize)}
</svg>`;
}

function buildWidePrototypeExportSvg({
  accent,
  badge,
  eyebrow,
  footer,
  imageUrl,
  meta,
  shareUrl,
  subtitle,
  title,
}: Omit<PrototypeExportImageInput, "layout">) {
  const titleLines = wrapSvgText(title, 15, 4);
  const subtitleLines = wrapSvgText(subtitle, 28, 3);
  const footerLines = wrapSvgText(footer, 32, 2);
  const metaItems = meta.slice(0, 3);
  const titleSize = titleLines.length > 3 ? 36 : 42;
  const titleStep = titleLines.length > 3 ? 42 : 48;
  const titleStartY = 200;
  const subtitleY =
    titleStartY + Math.max(0, titleLines.length - 1) * titleStep + 40;
  const qrSize = 132;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1400" height="788" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg" style="${svgViewportStyle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1600" y2="900" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D"/>
      <stop offset="0.55" stop-color="#10151B"/>
      <stop offset="1" stop-color="#151B20"/>
    </linearGradient>
    <clipPath id="imageClip">
      <rect x="728" y="78" width="790" height="744" rx="0"/>
    </clipPath>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <circle cx="1390" cy="126" r="310" fill="${escapeXml(accent)}" fill-opacity="0.16"/>
  <circle cx="110" cy="805" r="280" fill="#2C6194" fill-opacity="0.14"/>
  <g opacity="0.45">
    ${Array.from({ length: 17 })
      .map((_, index) => `<path d="M${44 + index * 94} 44V856" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
    ${Array.from({ length: 10 })
      .map((_, index) => `<path d="M44 ${54 + index * 84}H1556" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
  </g>
  <rect x="44" y="44" width="1512" height="812" stroke="#33404A" stroke-width="2"/>
  <path d="M662 44V856" stroke="#33404A" stroke-width="1"/>
  <text x="82" y="112" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24" letter-spacing="6">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="82" y="${titleStartY}" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="${titleSize}" letter-spacing="0">
    ${titleLines
      .map((line, index) => `<tspan x="82" dy="${index === 0 ? 0 : titleStep}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="84" y="${subtitleY}" fill="#9AAAB2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22">
    ${subtitleLines
      .map((line, index) => `<tspan x="84" dy="${index === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <g transform="translate(84 540)">
    ${metaItems
      .map((item, index) => `<g transform="translate(0 ${index * 52})"><rect width="380" height="40" fill="#0C1117" stroke="#33404A"/><text x="16" y="27" fill="#C7D4DA" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="17">${escapeXml(item.toUpperCase())}</text></g>`)
      .join("\n    ")}
  </g>
  <text x="84" y="750" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="36">NEOTYPELAB</text>
  <text x="84" y="786" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="5">${escapeXml(badge.toUpperCase())}</text>
  <text x="84" y="824" fill="#8FA0A9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16">
    ${footerLines
      .map((line, index) => `<tspan x="84" dy="${index === 0 ? 0 : 22}">${escapeXml(line.toUpperCase())}</tspan>`)
      .join("\n    ")}
  </text>
  ${buildQrGroup(shareUrl, 500, 700, qrSize)}
  <g>
    <rect x="704" y="54" width="838" height="792" fill="#0C1117" stroke="#33404A" stroke-width="2"/>
    ${
      imageUrl
        ? `<image href="${escapeXml(imageUrl)}" x="728" y="78" width="790" height="744" preserveAspectRatio="xMidYMin slice" clip-path="url(#imageClip)"/>`
        : `<rect x="728" y="78" width="790" height="744" fill="#111922"/><path d="M790 748L1110 160L1486 748H790Z" fill="${escapeXml(accent)}" fill-opacity="0.22"/><circle cx="1438" cy="172" r="78" fill="${escapeXml(accent)}" fill-opacity="0.28"/>`
    }
    <rect x="728" y="78" width="790" height="744" stroke="${escapeXml(accent)}" stroke-opacity="0.54" stroke-width="2"/>
  </g>
</svg>`;
}

function buildSquarePrototypeExportSvg({
  accent,
  badge,
  eyebrow,
  footer,
  imageUrl,
  meta,
  shareUrl,
  subtitle,
  title,
}: Omit<PrototypeExportImageInput, "layout">) {
  const titleLines = wrapSvgText(title, 20, 2);
  const subtitleLines = wrapSvgText(subtitle, 42, 2);
  const footerLines = wrapSvgText(footer, 28, 2);
  const metaItems = meta.slice(0, 3);
  const titleSize = 42;
  const titleStep = 48;
  const titleStartY = 204;
  const subtitleY =
    titleStartY + Math.max(0, titleLines.length - 1) * titleStep + 40;
  const headerBottom =
    subtitleY + Math.max(0, subtitleLines.length - 1) * 30 + 24;
  const imageTop = Math.max(340, headerBottom);
  const imageSize = 1080 - imageTop;
  const qrSize = 168;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg" style="${svgViewportStyle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="1200" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D"/>
      <stop offset="0.56" stop-color="#10151B"/>
      <stop offset="1" stop-color="#151B20"/>
    </linearGradient>
    <clipPath id="imageClip">
      <rect x="72" y="${imageTop + 12}" width="${imageSize - 24}" height="${imageSize - 24}" rx="0"/>
    </clipPath>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <circle cx="146" cy="124" r="310" fill="${escapeXml(accent)}" fill-opacity="0.18"/>
  <circle cx="1082" cy="1104" r="290" fill="#2C6194" fill-opacity="0.16"/>
  <g opacity="0.45">
    ${Array.from({ length: 13 })
      .map((_, index) => `<path d="M${48 + index * 92} 48V1152" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
    ${Array.from({ length: 13 })
      .map((_, index) => `<path d="M48 ${48 + index * 92}H1152" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
  </g>
  <rect x="48" y="48" width="1104" height="1104" stroke="#33404A" stroke-width="2"/>
  <path d="M48 156H1152" stroke="#33404A" stroke-width="1"/>
  <text x="76" y="112" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22" letter-spacing="6">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="76" y="${titleStartY}" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="${titleSize}" letter-spacing="0">
    ${titleLines
      .map((line, index) => `<tspan x="76" dy="${index === 0 ? 0 : titleStep}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="78" y="${subtitleY}" fill="#9AAAB2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22">
    ${subtitleLines
      .map((line, index) => `<tspan x="78" dy="${index === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <g>
    <rect x="60" y="${imageTop}" width="${imageSize}" height="${imageSize}" fill="#0C1117" stroke="#33404A" stroke-width="2"/>
    ${
      imageUrl
        ? `<image href="${escapeXml(imageUrl)}" x="72" y="${imageTop + 12}" width="${imageSize - 24}" height="${imageSize - 24}" preserveAspectRatio="xMidYMin slice" clip-path="url(#imageClip)"/>`
        : `<rect x="72" y="${imageTop + 12}" width="${imageSize - 24}" height="${imageSize - 24}" fill="#111922"/><path d="M140 980L420 420L780 980H140Z" fill="${escapeXml(accent)}" fill-opacity="0.22"/><circle cx="740" cy="450" r="70" fill="${escapeXml(accent)}" fill-opacity="0.28"/>`
    }
    <rect x="72" y="${imageTop + 12}" width="${imageSize - 24}" height="${imageSize - 24}" stroke="${escapeXml(accent)}" stroke-opacity="0.54" stroke-width="2"/>
  </g>
  <g transform="translate(872 ${imageTop + 12})">
    ${metaItems
      .map((item, index) => `<g transform="translate(0 ${index * 78})"><rect width="252" height="58" fill="#0C1117" stroke="#33404A"/><text x="16" y="36" fill="#C7D4DA" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">${escapeXml(item.toUpperCase())}</text></g>`)
      .join("\n    ")}
  </g>
  ${buildQrGroup(shareUrl, 896, imageTop + 280, qrSize)}
  <text x="872" y="${imageTop + 520}" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="28">NEOTYPELAB</text>
  <text x="872" y="${imageTop + 556}" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" letter-spacing="4">${escapeXml(badge.toUpperCase())}</text>
  <text x="872" y="${imageTop + 600}" fill="#8FA0A9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15">
    ${footerLines
      .map((line, index) => `<tspan x="872" dy="${index === 0 ? 0 : 22}">${escapeXml(line.toUpperCase())}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="872" y="${imageTop + 690}" fill="#71848E" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" letter-spacing="3">SCAN CASE</text>
</svg>`;
}

function buildQrGroup(url: string, x: number, y: number, size: number) {
  const qr = encode(url, { ecc: "M", border: 2 });
  const moduleCount = qr.size;
  const cell = size / moduleCount;
  const modules: string[] = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.data[row]?.[col]) continue;
      const px = (col * cell).toFixed(2);
      const py = (row * cell).toFixed(2);
      modules.push(`M${px} ${py}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`);
    }
  }

  return `<g transform="translate(${x} ${y})">
    <rect width="${size}" height="${size}" fill="#E9F0F3" stroke="#33404A" stroke-width="2"/>
    <path fill="#07090D" d="${modules.join("")}"/>
  </g>`;
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
