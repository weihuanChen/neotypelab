export type AdminTemplatesSearch = {
  template?: string;
  version?: string;
};

export type AdminPromptLabSearch = AdminTemplatesSearch & {
  run?: string;
  feedback?: string;
  concept?: string;
};

export type AdminUsersSearch = {
  user?: string;
  tab?: "overview" | "activity" | "credits" | "feedback" | "access";
};

export type AdminFeedbackSearch = { report?: string };
export type AdminGenerationsSearch = { run?: string };

export function parseAdminTemplatesSearch(
  search: Record<string, unknown>
): AdminTemplatesSearch {
  return {
    template: optionalSearchString(search.template),
    version: optionalSearchString(search.version),
  };
}

export function parseAdminPromptLabSearch(
  search: Record<string, unknown>
): AdminPromptLabSearch {
  return {
    ...parseAdminTemplatesSearch(search),
    run: optionalSearchString(search.run),
    feedback: optionalSearchString(search.feedback),
    concept: optionalSearchString(search.concept),
  };
}

export function parseAdminUsersSearch(search: Record<string, unknown>): AdminUsersSearch {
  const tab = optionalSearchString(search.tab);
  return {
    user: optionalSearchString(search.user),
    tab: tab === "activity" || tab === "credits" || tab === "feedback" || tab === "access"
      ? tab
      : "overview",
  };
}

export function parseAdminFeedbackSearch(search: Record<string, unknown>): AdminFeedbackSearch {
  return { report: optionalSearchString(search.report) };
}

export function parseAdminGenerationsSearch(search: Record<string, unknown>): AdminGenerationsSearch {
  return { run: optionalSearchString(search.run) };
}

function optionalSearchString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}
