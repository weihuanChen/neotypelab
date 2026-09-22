export const COMPLETE_BUILD_CREDITS = 8;

export const STARTER_CREDITS = 20;

export const SUBSCRIPTION_CREDIT_BALANCE_MULTIPLIER = 2;

export const PRODUCT_PLAN_ENTITLEMENTS = {
  free: {
    workspaceGb: 0.5,
    originalRetentionDays: 7,
  },
  pro: {
    workspaceGb: 10,
    originalRetentionDays: 30,
  },
  studio: {
    workspaceGb: 30,
    originalRetentionDays: 90,
  },
} as const;

export const PRODUCT_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceSuffix: "",
    credits: 20,
    creditCadence: "once",
    builds: 2,
    workspace: "500 MB",
    originalRetention: "7 days",
    featured: false,
    available: true,
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.90",
    priceSuffix: "/ month",
    credits: 160,
    creditCadence: "every month",
    builds: 20,
    workspace: "10 GB",
    originalRetention: "30 days",
    featured: true,
    available: false,
    cta: "Go Pro",
  },
  {
    id: "studio",
    name: "Studio",
    price: "$29.90",
    priceSuffix: "/ month",
    credits: 320,
    creditCadence: "every month",
    builds: 40,
    workspace: "30 GB",
    originalRetention: "90 days",
    featured: false,
    available: false,
    cta: "Enter Studio",
  },
] as const;

export const CREDIT_PACKS = [
  { credits: 64, price: "$9", builds: 8 },
  { credits: 160, price: "$19", builds: 20 },
  { credits: 400, price: "$39", builds: 50 },
] as const;

export const CREDIT_COSTS = [
  {
    label: "Complete build",
    credits: "8",
    detail: "Color plan 1 · Repaint specification 2 · HD render 5",
  },
  {
    label: "Custom Style interpretation",
    credits: "1",
    detail: "Available on every plan",
  },
  {
    label: "Spray plan",
    credits: "Included",
    detail: "Generated from the approved build plan",
  },
  {
    label: "Multi-angle contact sheet",
    credits: "10",
    detail: "Additional approved-scheme views",
  },
  {
    label: "High-fidelity render",
    credits: "15",
    detail: "Premium visualization tier",
  },
  {
    label: "Keep Original",
    credits: "10 / 20 / 40",
    detail: "Based on verified Original file size",
  },
] as const;
