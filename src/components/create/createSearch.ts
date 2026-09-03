export type CreateWorkbenchSearch = {
  remix?: string;
  recommendedStyle?: string;
  recommendedMaterial?: string;
  recommendedWorkflow?: string;
  recommendedBaseModel?: string;
  recommendedMoodTags?: string;
  recommendedWeathering?: string;
  creatorPack?: string;
  creatorPackVariant?: string;
};

export function parseCreateSearch(search: Record<string, unknown>): CreateWorkbenchSearch {
  return {
    remix: parseOptionalSearchValue(search.remix),
    recommendedStyle: parseOptionalSearchValue(search.recommendedStyle),
    recommendedMaterial: parseOptionalSearchValue(search.recommendedMaterial),
    recommendedWorkflow: parseOptionalSearchValue(search.recommendedWorkflow),
    recommendedBaseModel: parseOptionalSearchValue(search.recommendedBaseModel),
    recommendedMoodTags: parseOptionalSearchValue(search.recommendedMoodTags),
    recommendedWeathering: parseOptionalSearchValue(search.recommendedWeathering),
    creatorPack: parseOptionalSearchValue(search.creatorPack),
    creatorPackVariant: parseOptionalSearchValue(search.creatorPackVariant),
  };
}

export function parseOptionalSearchValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
