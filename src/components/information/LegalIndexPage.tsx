import { Link } from "@tanstack/react-router";
import { legalDocuments } from "@/src/components/information/legalDocuments";

export function LegalIndexPage() {
  return (
    <article className="information-doc legal-index">
      <p className="information-doc__archive">Legal / N°03</p>

      <header className="information-doc__block">
        <h2 className="information-doc__headline">NeotypeLab legal documents</h2>
      </header>

      <ol className="legal-index__list">
        {legalDocuments.map((document) => (
          <li className="legal-index__item" key={document.id}>
            <p className="legal-index__number" aria-hidden="true">
              {document.number}
            </p>
            <div className="legal-index__copy">
              <h3 className="legal-index__title">{document.title}</h3>
              <p className="legal-index__summary">{document.summary}</p>
              <div className="legal-index__meta">
                <span>{document.updatedLabel}</span>
                <Link
                  className="information-doc__action"
                  preload="intent"
                  to={document.href}
                >
                  Read →
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
