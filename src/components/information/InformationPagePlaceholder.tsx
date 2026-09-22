type InformationPagePlaceholderProps = {
  body: string;
};

/** Temporary body copy until Pricing / Contact / Legal pages are filled in. */
export function InformationPagePlaceholder({
  body,
}: InformationPagePlaceholderProps) {
  return (
    <section className="information-page">
      <p className="information-page__body">{body}</p>
    </section>
  );
}
