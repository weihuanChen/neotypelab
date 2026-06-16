import type {
  ShowcaseConcept,
  ShowcaseCreatorPack,
  ShowcaseSearch,
  ShowcaseSort,
} from "./types";

export const showcaseSortOptions: Array<{
  id: ShowcaseSort;
  label: string;
  description: string;
}> = [
  {
    id: "trending",
    label: "Trending",
    description: "Fresh public prototypes weighted by remix activity.",
  },
  {
    id: "recent",
    label: "Recent",
    description: "Newest public launches across the showcase.",
  },
  {
    id: "most-remixed",
    label: "Most Remixed",
    description: "Share surfaces generating the strongest branching activity.",
  },
  {
    id: "most-saved",
    label: "Most Saved",
    description: "Community concepts people are actively holding onto for later.",
  },
];

export const defaultShowcaseSort: ShowcaseSort = "trending";

const dayMs = 1000 * 60 * 60 * 24;

export function parseShowcaseSort(value: unknown): ShowcaseSort {
  return value === "recent" ||
    value === "most-remixed" ||
    value === "most-saved"
    ? value
    : defaultShowcaseSort;
}

export function parseOptionalSearchValue(value: unknown) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export function buildShowcaseHref(
  search: ShowcaseSearch,
  updates: Partial<Record<keyof ShowcaseSearch, string | null>>,
  basePath = "/showcase"
) {
  const params = new URLSearchParams();
  const nextSearch: ShowcaseSearch = { ...search };

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") {
      delete nextSearch[key as keyof ShowcaseSearch];
    } else {
      nextSearch[key as keyof ShowcaseSearch] = value as never;
    }
  }

  if (nextSearch.sort && nextSearch.sort !== defaultShowcaseSort) {
    params.set("sort", nextSearch.sort);
  }
  if (nextSearch.baseModel) {
    params.set("baseModel", nextSearch.baseModel);
  }
  if (nextSearch.style) {
    params.set("style", nextSearch.style);
  }
  if (nextSearch.category) {
    params.set("category", nextSearch.category);
  }
  if (nextSearch.creator) {
    params.set("creator", nextSearch.creator);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function uniqueOptions(
  options: Array<{ value?: string | null; label?: string | null }>
) {
  const seen = new Set<string>();
  return options
    .filter(
      (option): option is { value: string; label: string } =>
        Boolean(option.value && option.label)
    )
    .filter((option) => {
      if (seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function compareConcepts(
  left: ShowcaseConcept,
  right: ShowcaseConcept,
  sortMode: ShowcaseSort
) {
  if (sortMode === "recent") {
    return right._creationTime - left._creationTime;
  }
  if (sortMode === "most-saved") {
    return (
      right.engagement.saveCount - left.engagement.saveCount ||
      right.engagement.likeCount - left.engagement.likeCount ||
      right._creationTime - left._creationTime
    );
  }
  if (sortMode === "most-remixed") {
    return (
      right.remixCount - left.remixCount ||
      right._creationTime - left._creationTime
    );
  }
  return (
    trendingScore(right) - trendingScore(left) ||
    right._creationTime - left._creationTime
  );
}

export function compareCreatorPacks(
  left: ShowcaseCreatorPack,
  right: ShowcaseCreatorPack,
  sortMode: ShowcaseSort
) {
  if (sortMode === "recent") {
    return right._creationTime - left._creationTime;
  }
  if (sortMode === "most-saved") {
    return (
      right.engagement.saveCount +
        right.stats.publicSaveCount -
        (left.engagement.saveCount + left.stats.publicSaveCount) ||
      right.engagement.likeCount +
        right.stats.publicLikeCount -
        (left.engagement.likeCount + left.stats.publicLikeCount) ||
      right._creationTime - left._creationTime
    );
  }
  if (sortMode === "most-remixed") {
    return (
      right.stats.publicRemixCount - left.stats.publicRemixCount ||
      right._creationTime - left._creationTime
    );
  }
  return (
    trendingPackScore(right) - trendingPackScore(left) ||
    right._creationTime - left._creationTime
  );
}

export function formatMoodTagLabel(tag: string) {
  if (tag === "command-presence") {
    return "Command Presence";
  }
  if (tag === "stealth-tension") {
    return "Stealth Tension";
  }
  if (tag === "industrial-hazard") {
    return "Industrial Hazard";
  }
  if (tag === "reactor-glow") {
    return "Reactor Glow";
  }
  if (tag === "field-fatigue") {
    return "Field Fatigue";
  }
  if (tag === "ceremonial-clean") {
    return "Ceremonial Clean";
  }
  return tag;
}

function trendingScore(concept: ShowcaseConcept) {
  const ageDays = Math.max(0, (Date.now() - concept._creationTime) / dayMs);
  const freshnessBoost = Math.max(0, 21 - ageDays);
  return (
    concept.remixCount * 24 +
    concept.engagement.saveCount * 16 +
    concept.engagement.likeCount * 8 +
    freshnessBoost
  );
}

function trendingPackScore(pack: ShowcaseCreatorPack) {
  const ageDays = Math.max(0, (Date.now() - pack._creationTime) / dayMs);
  const freshnessBoost = Math.max(0, 21 - ageDays);
  return (
    pack.stats.publicRemixCount * 24 +
    (pack.engagement.saveCount + pack.stats.publicSaveCount) * 16 +
    (pack.engagement.likeCount + pack.stats.publicLikeCount) * 8 +
    freshnessBoost
  );
}
