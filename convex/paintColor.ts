import {
  PAINT_LAB_CONVERSION_VERSION,
  PAINT_LAB_ILLUMINANT,
  PAINT_LAB_OBSERVER,
  PAINT_RGB_COLOR_SPACE,
} from "./paintCatalogDomain";

export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type LinearRgbColor = RgbColor;

export type XyzColor = {
  x: number;
  y: number;
  z: number;
};

export type LabColor = {
  l: number;
  a: number;
  b: number;
};

export type DerivedPaintColor = {
  hex: string;
  rgb: RgbColor;
  lab: LabColor;
  rgbColorSpace: typeof PAINT_RGB_COLOR_SPACE;
  labIlluminant: typeof PAINT_LAB_ILLUMINANT;
  labObserver: typeof PAINT_LAB_OBSERVER;
  labMethod: "derived_from_srgb";
  conversionVersion: typeof PAINT_LAB_CONVERSION_VERSION;
};

const D65_REFERENCE_WHITE = {
  x: 0.95047,
  y: 1,
  z: 1.08883,
} as const;

const CIELAB_EPSILON = 216 / 24389;
const CIELAB_KAPPA = 24389 / 27;

export function normalizeHex(hex: string) {
  const normalized = hex.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new Error("HEX color must use the format #RRGGBB");
  }
  return normalized;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex(rgb: RgbColor) {
  assertRgb(rgb);
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function srgbToLinearRgb(rgb: RgbColor): LinearRgbColor {
  assertRgb(rgb);
  return {
    r: linearizeSrgbChannel(rgb.r / 255),
    g: linearizeSrgbChannel(rgb.g / 255),
    b: linearizeSrgbChannel(rgb.b / 255),
  };
}

export function linearRgbToXyzD65(rgb: LinearRgbColor): XyzColor {
  assertUnitIntervalColor(rgb, "Linear RGB");
  return {
    x: 0.4124564 * rgb.r + 0.3575761 * rgb.g + 0.1804375 * rgb.b,
    y: 0.2126729 * rgb.r + 0.7151522 * rgb.g + 0.072175 * rgb.b,
    z: 0.0193339 * rgb.r + 0.119192 * rgb.g + 0.9503041 * rgb.b,
  };
}

export function xyzD65ToLab(xyz: XyzColor): LabColor {
  assertXyz(xyz);
  const fx = labTransform(xyz.x / D65_REFERENCE_WHITE.x);
  const fy = labTransform(xyz.y / D65_REFERENCE_WHITE.y);
  const fz = labTransform(xyz.z / D65_REFERENCE_WHITE.z);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLabD65(rgb: RgbColor) {
  return xyzD65ToLab(linearRgbToXyzD65(srgbToLinearRgb(rgb)));
}

export function hexToLabD65(hex: string) {
  return rgbToLabD65(hexToRgb(hex));
}

export function derivePaintColorFromHex(hex: string): DerivedPaintColor {
  const normalizedHex = normalizeHex(hex);
  const rgb = hexToRgb(normalizedHex);
  return {
    hex: normalizedHex,
    rgb,
    lab: rgbToLabD65(rgb),
    rgbColorSpace: PAINT_RGB_COLOR_SPACE,
    labIlluminant: PAINT_LAB_ILLUMINANT,
    labObserver: PAINT_LAB_OBSERVER,
    labMethod: "derived_from_srgb",
    conversionVersion: PAINT_LAB_CONVERSION_VERSION,
  };
}

export function deltaE2000(left: LabColor, right: LabColor) {
  assertLab(left);
  assertLab(right);

  const chromaLeft = Math.hypot(left.a, left.b);
  const chromaRight = Math.hypot(right.a, right.b);
  const averageChroma = (chromaLeft + chromaRight) / 2;
  const averageChroma7 = averageChroma ** 7;
  const g = 0.5 * (1 - Math.sqrt(averageChroma7 / (averageChroma7 + 25 ** 7)));
  const aPrimeLeft = (1 + g) * left.a;
  const aPrimeRight = (1 + g) * right.a;
  const chromaPrimeLeft = Math.hypot(aPrimeLeft, left.b);
  const chromaPrimeRight = Math.hypot(aPrimeRight, right.b);
  const huePrimeLeft = hueDegrees(left.b, aPrimeLeft);
  const huePrimeRight = hueDegrees(right.b, aPrimeRight);

  const deltaLightnessPrime = right.l - left.l;
  const deltaChromaPrime = chromaPrimeRight - chromaPrimeLeft;
  const deltaHueDegrees = hueDifferenceDegrees(
    huePrimeLeft,
    huePrimeRight,
    chromaPrimeLeft,
    chromaPrimeRight
  );
  const deltaHuePrime =
    2 *
    Math.sqrt(chromaPrimeLeft * chromaPrimeRight) *
    Math.sin(degreesToRadians(deltaHueDegrees / 2));

  const averageLightnessPrime = (left.l + right.l) / 2;
  const averageChromaPrime = (chromaPrimeLeft + chromaPrimeRight) / 2;
  const averageHuePrime = averageHueDegrees(
    huePrimeLeft,
    huePrimeRight,
    chromaPrimeLeft,
    chromaPrimeRight
  );
  const t =
    1 -
    0.17 * Math.cos(degreesToRadians(averageHuePrime - 30)) +
    0.24 * Math.cos(degreesToRadians(2 * averageHuePrime)) +
    0.32 * Math.cos(degreesToRadians(3 * averageHuePrime + 6)) -
    0.2 * Math.cos(degreesToRadians(4 * averageHuePrime - 63));
  const deltaTheta =
    30 * Math.exp(-(((averageHuePrime - 275) / 25) ** 2));
  const averageChromaPrime7 = averageChromaPrime ** 7;
  const chromaRotation =
    2 * Math.sqrt(averageChromaPrime7 / (averageChromaPrime7 + 25 ** 7));
  const lightnessScale =
    1 +
    (0.015 * (averageLightnessPrime - 50) ** 2) /
      Math.sqrt(20 + (averageLightnessPrime - 50) ** 2);
  const chromaScale = 1 + 0.045 * averageChromaPrime;
  const hueScale = 1 + 0.015 * averageChromaPrime * t;
  const rotationTerm =
    -Math.sin(degreesToRadians(2 * deltaTheta)) * chromaRotation;
  const lightnessTerm = deltaLightnessPrime / lightnessScale;
  const chromaTerm = deltaChromaPrime / chromaScale;
  const hueTerm = deltaHuePrime / hueScale;

  return Math.sqrt(
    lightnessTerm ** 2 +
      chromaTerm ** 2 +
      hueTerm ** 2 +
      rotationTerm * chromaTerm * hueTerm
  );
}

function linearizeSrgbChannel(channel: number) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function labTransform(value: number) {
  return value > CIELAB_EPSILON
    ? Math.cbrt(value)
    : (CIELAB_KAPPA * value + 16) / 116;
}

function hueDegrees(b: number, aPrime: number) {
  if (aPrime === 0 && b === 0) {
    return 0;
  }
  const degrees = radiansToDegrees(Math.atan2(b, aPrime));
  return degrees >= 0 ? degrees : degrees + 360;
}

function hueDifferenceDegrees(
  leftHue: number,
  rightHue: number,
  leftChroma: number,
  rightChroma: number
) {
  if (leftChroma * rightChroma === 0) {
    return 0;
  }
  const difference = rightHue - leftHue;
  if (Math.abs(difference) <= 180) {
    return difference;
  }
  return difference > 180 ? difference - 360 : difference + 360;
}

function averageHueDegrees(
  leftHue: number,
  rightHue: number,
  leftChroma: number,
  rightChroma: number
) {
  if (leftChroma * rightChroma === 0) {
    return leftHue + rightHue;
  }
  if (Math.abs(leftHue - rightHue) <= 180) {
    return (leftHue + rightHue) / 2;
  }
  return leftHue + rightHue < 360
    ? (leftHue + rightHue + 360) / 2
    : (leftHue + rightHue - 360) / 2;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function assertRgb(rgb: RgbColor) {
  for (const [channelName, value] of Object.entries(rgb)) {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`RGB ${channelName} must be an integer from 0 through 255`);
    }
  }
}

function assertUnitIntervalColor(color: LinearRgbColor, label: string) {
  for (const [channelName, value] of Object.entries(color)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${label} ${channelName} must be between 0 and 1`);
    }
  }
}

function assertXyz(xyz: XyzColor) {
  for (const [channelName, value] of Object.entries(xyz)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`XYZ ${channelName} must be a finite non-negative number`);
    }
  }
}

function assertLab(lab: LabColor) {
  for (const [channelName, value] of Object.entries(lab)) {
    if (!Number.isFinite(value)) {
      throw new Error(`LAB ${channelName} must be a finite number`);
    }
  }
}
