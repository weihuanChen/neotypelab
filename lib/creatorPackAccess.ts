export type CreatorPackAccessViewer =
  | {
      handle?: string | null;
      planType?: "free" | "pro" | "studio" | null;
      isAdmin?: boolean | null;
    }
  | null
  | undefined;

export function canAccessCreatorPack(input: {
  creatorHandle?: string | null;
  packType: "free" | "premium";
  viewer: CreatorPackAccessViewer;
}) {
  if (input.packType === "free") {
    return true;
  }

  const viewer = input.viewer;
  if (!viewer) {
    return false;
  }

  return Boolean(
    viewer.isAdmin ||
      viewer.handle === input.creatorHandle ||
      viewer.planType === "pro" ||
      viewer.planType === "studio"
  );
}

export function getCreatorPackAccessCopy(input: {
  creatorHandle?: string | null;
  packType: "free" | "premium";
  viewer: CreatorPackAccessViewer;
}) {
  const allowed = canAccessCreatorPack(input);

  if (input.packType === "free") {
    return {
      allowed: true,
      badge: "open access",
      message: "This creator pack is available to all pilots.",
    };
  }

  if (allowed) {
    return {
      allowed: true,
      badge: "premium unlocked",
      message: "You currently have access to this premium creator pack.",
    };
  }

  return {
    allowed: false,
    badge: "premium locked",
    message: "Premium creator packs currently require Pro or Studio access, or ownership by the creator.",
  };
}
