import { COMPLETE_BUILD_CREDITS, STARTER_CREDITS } from "@/lib/productPricing";
import { aiModelDisclosure } from "@/src/lib/aiDisclosure";
import { appPaths } from "@/src/lib/appPaths";

/**
 * Copy for the home page that also feeds structured data. Keep the visible FAQ
 * and the FAQPage JSON-LD on this single source so they cannot drift.
 */

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export const starterBuilds = Math.floor(STARTER_CREDITS / COMPLETE_BUILD_CREDITS);
export const starterBuildsLabel = `${NUMBER_WORDS[starterBuilds] ?? starterBuilds} complete build${starterBuilds === 1 ? "" : "s"}`;

export type HomeFaqLink = { href: string; label: string };

export type HomeFaqItem = {
  id: string;
  question: string;
  /** Paragraphs. `{link}` in a paragraph is replaced with the item's link. */
  answer: string[];
  link?: HomeFaqLink;
};

const catalogKitStory = {
  lede: "Describe a color direction in your own words and pick your kit. NeotypeLab gives you a spray-ready plan: real paints, the order to spray them, and an HD preview of your finished kit.",
  stepTitle: "Pick your kit",
  stepBody: "Choose the kit on your bench. The plan is fitted to its real armor panels and parts.",
  stepNote: null as string | null,
  description:
    "Plan spray-ready Gunpla and mecha paint schemes before you spray: describe a color direction, pick your kit, and get real paints, a painting sequence, and an HD preview.",
};

const customKitStory = {
  lede: "Describe a color direction in your own words and upload a photo of your model. NeotypeLab gives you a spray-ready plan: real paints, the order to spray them, and an HD preview of the finished build.",
  stepTitle: "Bring your model",
  stepBody: "Upload a photo of the model on your bench. The plan follows the parts the scan can see. You can still pick a catalog kit instead.",
  stepNote: "The scan price is shown before you scan",
  description:
    "Plan spray-ready Gunpla and mecha paint schemes before you spray: describe a color direction, upload your model or pick a catalog kit, and get real paints, a painting sequence, and an HD preview.",
};

/** Copy that changes with Custom Kit. Catalog wording stays on deployments where the feature is off. */
export function homeKitStory(customKit: boolean) {
  return customKit ? customKitStory : catalogKitStory;
}

export const homeFaq: HomeFaqItem[] = [
  {
    id: "kits",
    question: "Which kits can I plan for?",
    answer: [
      "Gunpla and other mecha kits from our catalog. You pick the exact kit in step two, and the plan follows its real armor panels. If yours is missing, tell us through {link} and we'll add it.",
    ],
    link: { href: appPaths.feedback, label: "Feedback" },
  },
  {
    id: "paints",
    question: "Are the paints real?",
    answer: [
      "Yes. Each color is matched to a real hobby paint from our catalog, listed by brand and product code. When no catalog paint is close enough, the plan gives you the target color to mix instead.",
      "Paint names, codes and swatch colors in our catalog are compiled from publicly available sources online, and manufacturers do change their ranges. Check the bottle or the maker's chart before you buy.",
    ],
  },
  {
    id: "experience",
    question: "Do I need painting experience?",
    answer: [
      "No. The painting sequence tells you what to prime, mask and spray, in order, and each plan rates how much masking it needs, so you can pick one that suits your first repaint.",
    ],
  },
  {
    id: "cost",
    question: "What does it cost?",
    answer: [
      `New accounts get ${STARTER_CREDITS} credits. A complete build costs ${COMPLETE_BUILD_CREDITS} credits, preset styles are free to use, and failed builds are refunded. {link} lists plans and credit packs.`,
    ],
    link: { href: appPaths.pricing, label: "Pricing" },
  },
  {
    id: "models",
    question: "Which AI models make the builds?",
    answer: [
      `Images are made with ${aiModelDisclosure.image.model}, served through ${aiModelDisclosure.image.servedVia}. Styles and paint plans are written with ${aiModelDisclosure.text.model}.`,
      "Every prompt is screened before it reaches a model. The {link} explains what isn't allowed and how we moderate.",
    ],
    link: { href: appPaths.acceptableUse, label: "Acceptable Use Policy" },
  },
  {
    id: "share",
    question: "Can I share or remix a build?",
    answer: [
      "Yes. Public builds get their own page with ready-made share images, and anyone can remix a public build into their own version from that page.",
    ],
  },
];

/** How many FAQ items start open. The rest stay folded to keep the page short. */
export const HOME_FAQ_OPEN_COUNT = 4;

const customKitFaqAnswer =
  "Start with a photo of your own mecha or robot model. One scan reads the visible parts and checks that the photo can be used. Gunpla and other kits from the catalog are still there if you would rather pick a known model. If a catalog kit is missing, tell us through {link}.";

/** Visible FAQ and FAQPage JSON-LD share this list so they cannot drift. */
export function homeFaqFor(customKit: boolean) {
  if (!customKit) return homeFaq;
  return homeFaq.map((item) => (item.id === "kits" ? { ...item, answer: [customKitFaqAnswer] } : item));
}

export function faqPlainText(item: HomeFaqItem) {
  return item.answer.map((paragraph) => paragraph.replace("{link}", item.link?.label ?? "")).join(" ");
}

export function buildHomeStructuredData(customKit = false) {
  const faq = homeFaqFor(customKit);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "NeotypeLab",
      url: "/",
      description: homeKitStory(customKit).description,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: faqPlainText(item) },
      })),
    },
  ];
}
