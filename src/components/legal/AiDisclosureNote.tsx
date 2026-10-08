import { Link } from "@tanstack/react-router";
import { appPaths } from "@/src/lib/appPaths";
import {
  imageProviderNote,
  safetyScreeningNote,
  textProviderNote,
} from "@/src/lib/aiDisclosure";

type AiDisclosureNoteProps = {
  /** Which generation the adjacent action triggers. */
  kind: "text" | "image" | "text-and-image";
  className?: string;
};

/** Discloses the model behind an AI action and links the Acceptable Use Policy. */
export function AiDisclosureNote({ kind, className }: AiDisclosureNoteProps) {
  const providers =
    kind === "text"
      ? [textProviderNote]
      : kind === "image"
        ? [imageProviderNote]
        : [textProviderNote, imageProviderNote];

  return (
    <p className={["ai-disclosure-note", className].filter(Boolean).join(" ")}>
      {providers.join(" ")} {safetyScreeningNote}{" "}
      <Link preload="intent" to={appPaths.acceptableUse}>
        AI Acceptable Use Policy
      </Link>
    </p>
  );
}
