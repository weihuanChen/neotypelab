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
  subtitle: string;
  title: string;
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

function buildPrototypeExportSvg({
  accent,
  badge,
  eyebrow,
  footer,
  imageUrl,
  layout,
  meta,
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
  subtitle,
  title,
}: Omit<PrototypeExportImageInput, "layout">) {
  const titleLines = wrapSvgText(title, 24, 4);
  const subtitleLines = wrapSvgText(subtitle, 38, 2);
  const footerLines = wrapSvgText(footer, 42, 2);
  const metaItems = meta.slice(0, 3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="1500" viewBox="0 0 1000 1500" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1000" y2="1500" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D"/>
      <stop offset="0.58" stop-color="#10151B"/>
      <stop offset="1" stop-color="#151B20"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="470" x2="0" y2="1250" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D" stop-opacity="0"/>
      <stop offset="1" stop-color="#07090D" stop-opacity="0.86"/>
    </linearGradient>
    <clipPath id="imageClip">
      <rect x="78" y="530" width="844" height="760" rx="0"/>
    </clipPath>
  </defs>
  <rect width="1000" height="1500" fill="url(#bg)"/>
  <circle cx="82" cy="96" r="280" fill="${escapeXml(accent)}" fill-opacity="0.18"/>
  <circle cx="930" cy="1390" r="300" fill="#FFB84D" fill-opacity="0.16"/>
  <g opacity="0.45">
    ${Array.from({ length: 11 })
      .map((_, index) => `<path d="M${50 + index * 90} 48V1452" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
    ${Array.from({ length: 15 })
      .map((_, index) => `<path d="M48 ${60 + index * 96}H952" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
  </g>
  <rect x="48" y="48" width="904" height="1404" stroke="#33404A" stroke-width="2"/>
  <path d="M48 170H952" stroke="#33404A" stroke-width="1"/>
  <text x="78" y="116" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28" letter-spacing="7">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="78" y="246" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="${titleLines.length > 3 ? 58 : 68}" letter-spacing="0">
    ${titleLines
      .map((line, index) => `<tspan x="78" dy="${index === 0 ? 0 : titleLines.length > 3 ? 66 : 76}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="80" y="${322 + Math.max(0, titleLines.length - 1) * (titleLines.length > 3 ? 66 : 76)}" fill="#9AAAB2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28">
    ${subtitleLines
      .map((line, index) => `<tspan x="80" dy="${index === 0 ? 0 : 39}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <g>
    <rect x="64" y="516" width="872" height="788" fill="#0C1117" stroke="#33404A" stroke-width="2"/>
    ${
      imageUrl
        ? `<image href="${escapeXml(imageUrl)}" x="78" y="530" width="844" height="760" preserveAspectRatio="xMidYMid slice" clip-path="url(#imageClip)"/>`
        : `<rect x="78" y="530" width="844" height="760" fill="#111922"/><path d="M156 1210L452 650L844 1210H156Z" fill="${escapeXml(accent)}" fill-opacity="0.22"/><circle cx="792" cy="670" r="86" fill="${escapeXml(accent)}" fill-opacity="0.28"/>`
    }
    <rect x="78" y="530" width="844" height="760" fill="url(#fade)"/>
    <rect x="78" y="530" width="844" height="760" stroke="${escapeXml(accent)}" stroke-opacity="0.54" stroke-width="2"/>
  </g>
  <g transform="translate(90 1182)">
    ${metaItems
      .map((item, index) => `<g transform="translate(0 ${index * 58})"><rect width="360" height="42" fill="#0C1117" fill-opacity="0.82" stroke="#33404A"/><text x="18" y="28" fill="#C7D4DA" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">${escapeXml(item.toUpperCase())}</text></g>`)
      .join("\n    ")}
  </g>
  <text x="80" y="1370" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="42">NEOTYPELAB</text>
  <text x="80" y="1410" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="5">${escapeXml(badge.toUpperCase())}</text>
  <text x="482" y="1372" fill="#8FA0A9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">
    ${footerLines
      .map((line, index) => `<tspan x="482" dy="${index === 0 ? 0 : 28}">${escapeXml(line.toUpperCase())}</tspan>`)
      .join("\n    ")}
  </text>
</svg>`;
}

function buildWidePrototypeExportSvg({
  accent,
  badge,
  eyebrow,
  footer,
  imageUrl,
  meta,
  subtitle,
  title,
}: Omit<PrototypeExportImageInput, "layout">) {
  const titleLines = wrapSvgText(title, 22, 4);
  const subtitleLines = wrapSvgText(subtitle, 34, 3);
  const footerLines = wrapSvgText(footer, 42, 2);
  const metaItems = meta.slice(0, 3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  <circle cx="110" cy="805" r="280" fill="#FFB84D" fill-opacity="0.14"/>
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
  <text x="82" y="112" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="27" letter-spacing="7">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="82" y="218" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="${titleLines.length > 3 ? 56 : 64}" letter-spacing="0">
    ${titleLines
      .map((line, index) => `<tspan x="82" dy="${index === 0 ? 0 : titleLines.length > 3 ? 62 : 72}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="84" y="${294 + Math.max(0, titleLines.length - 1) * (titleLines.length > 3 ? 62 : 72)}" fill="#9AAAB2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="27">
    ${subtitleLines
      .map((line, index) => `<tspan x="84" dy="${index === 0 ? 0 : 37}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <g transform="translate(84 596)">
    ${metaItems
      .map((item, index) => `<g transform="translate(0 ${index * 58})"><rect width="410" height="42" fill="#0C1117" stroke="#33404A"/><text x="18" y="28" fill="#C7D4DA" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">${escapeXml(item.toUpperCase())}</text></g>`)
      .join("\n    ")}
  </g>
  <text x="84" y="798" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="42">NEOTYPELAB</text>
  <text x="84" y="836" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="5">${escapeXml(badge.toUpperCase())}</text>
  <text x="336" y="804" fill="#8FA0A9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">
    ${footerLines
      .map((line, index) => `<tspan x="336" dy="${index === 0 ? 0 : 28}">${escapeXml(line.toUpperCase())}</tspan>`)
      .join("\n    ")}
  </text>
  <g>
    <rect x="704" y="54" width="838" height="792" fill="#0C1117" stroke="#33404A" stroke-width="2"/>
    ${
      imageUrl
        ? `<image href="${escapeXml(imageUrl)}" x="728" y="78" width="790" height="744" preserveAspectRatio="xMidYMid slice" clip-path="url(#imageClip)"/>`
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
  subtitle,
  title,
}: Omit<PrototypeExportImageInput, "layout">) {
  const titleLines = wrapSvgText(title, 24, 3);
  const subtitleLines = wrapSvgText(subtitle, 42, 2);
  const footerLines = wrapSvgText(footer, 46, 2);
  const metaItems = meta.slice(0, 3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="1200" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D"/>
      <stop offset="0.56" stop-color="#10151B"/>
      <stop offset="1" stop-color="#151B20"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="510" x2="0" y2="1010" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07090D" stop-opacity="0"/>
      <stop offset="1" stop-color="#07090D" stop-opacity="0.78"/>
    </linearGradient>
    <clipPath id="imageClip">
      <rect x="90" y="424" width="1020" height="610" rx="0"/>
    </clipPath>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <circle cx="146" cy="124" r="310" fill="${escapeXml(accent)}" fill-opacity="0.18"/>
  <circle cx="1082" cy="1104" r="290" fill="#FFB84D" fill-opacity="0.16"/>
  <g opacity="0.45">
    ${Array.from({ length: 13 })
      .map((_, index) => `<path d="M${48 + index * 92} 48V1152" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
    ${Array.from({ length: 13 })
      .map((_, index) => `<path d="M48 ${48 + index * 92}H1152" stroke="#1D2730" stroke-width="1"/>`)
      .join("\n    ")}
  </g>
  <rect x="48" y="48" width="1104" height="1104" stroke="#33404A" stroke-width="2"/>
  <path d="M48 168H1152" stroke="#33404A" stroke-width="1"/>
  <text x="88" y="116" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="27" letter-spacing="7">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="88" y="226" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="${titleLines.length > 2 ? 58 : 66}" letter-spacing="0">
    ${titleLines
      .map((line, index) => `<tspan x="88" dy="${index === 0 ? 0 : titleLines.length > 2 ? 64 : 74}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <text x="90" y="${300 + Math.max(0, titleLines.length - 1) * (titleLines.length > 2 ? 64 : 74)}" fill="#9AAAB2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="26">
    ${subtitleLines
      .map((line, index) => `<tspan x="90" dy="${index === 0 ? 0 : 36}">${escapeXml(line)}</tspan>`)
      .join("\n    ")}
  </text>
  <g>
    <rect x="72" y="406" width="1056" height="646" fill="#0C1117" stroke="#33404A" stroke-width="2"/>
    ${
      imageUrl
        ? `<image href="${escapeXml(imageUrl)}" x="90" y="424" width="1020" height="610" preserveAspectRatio="xMidYMid slice" clip-path="url(#imageClip)"/>`
        : `<rect x="90" y="424" width="1020" height="610" fill="#111922"/><path d="M160 982L520 520L1052 982H160Z" fill="${escapeXml(accent)}" fill-opacity="0.22"/><circle cx="1012" cy="544" r="78" fill="${escapeXml(accent)}" fill-opacity="0.28"/>`
    }
    <rect x="90" y="424" width="1020" height="610" fill="url(#fade)"/>
    <rect x="90" y="424" width="1020" height="610" stroke="${escapeXml(accent)}" stroke-opacity="0.54" stroke-width="2"/>
  </g>
  <g transform="translate(92 918)">
    ${metaItems
      .map((item, index) => `<g transform="translate(${index * 306} 0)"><rect width="280" height="44" fill="#0C1117" fill-opacity="0.82" stroke="#33404A"/><text x="18" y="29" fill="#C7D4DA" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">${escapeXml(item.toUpperCase())}</text></g>`)
      .join("\n    ")}
  </g>
  <text x="90" y="1102" fill="#E9F0F3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="800" font-size="42">NEOTYPELAB</text>
  <text x="90" y="1140" fill="${escapeXml(accent)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="5">${escapeXml(badge.toUpperCase())}</text>
  <text x="494" y="1106" fill="#8FA0A9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">
    ${footerLines
      .map((line, index) => `<tspan x="494" dy="${index === 0 ? 0 : 28}">${escapeXml(line.toUpperCase())}</tspan>`)
      .join("\n    ")}
  </text>
</svg>`;
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
