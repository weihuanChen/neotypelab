import { Link } from "@tanstack/react-router";
import {
  getLegalDocument,
  type LegalDocumentId,
} from "@/src/components/information/legalDocuments";
import { appPaths } from "@/src/lib/appPaths";

type LegalDocumentPageProps = {
  id: LegalDocumentId;
};

const CONTACT_EMAIL = "hello@neotypelab.com";

export function LegalDocumentPage({ id }: LegalDocumentPageProps) {
  const document = getLegalDocument(id);

  return (
    <article className="information-doc legal-document">
      <p className="information-doc__archive">
        Legal / {document.number} · {document.title}
      </p>

      <header className="information-doc__block legal-document__header">
        <h2 className="information-doc__headline">{document.title}</h2>
        <p className="information-doc__lede">{document.summary}</p>
        <p className="information-doc__note">
          {document.effectiveLabel} · {document.updatedLabel}
        </p>
      </header>

      <nav aria-label={`${document.title} contents`} className="legal-document__toc">
        <p>Contents</p>
        <ol>
          {document.sections.map((section, index) => (
            <li key={section.title}>
              <a href={`#section-${index + 1}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="legal-document__sections">
        {document.sections.map((section, index) => (
          <section
            aria-labelledby={`section-${index + 1}-title`}
            className="legal-document__section"
            id={`section-${index + 1}`}
            key={section.title}
          >
            <p className="legal-document__section-number">
              {String(index + 1).padStart(2, "0")}
            </p>
            <div>
              <h3 id={`section-${index + 1}-title`}>{section.title}</h3>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{renderContactEmail(paragraph)}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{renderContactEmail(item)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <footer className="legal-document__footer">
        <a className="information-doc__email" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        <Link className="information-doc__action" preload="intent" to={appPaths.legal}>
          ← All legal documents
        </Link>
      </footer>
    </article>
  );
}

function renderContactEmail(text: string) {
  const [before, after] = text.split(CONTACT_EMAIL);
  if (after === undefined) return text;

  return (
    <>
      {before}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      {after}
    </>
  );
}
