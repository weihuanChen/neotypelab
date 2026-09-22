import { Link } from "@tanstack/react-router";
import {
  getLegalDocument,
  type LegalDocumentId,
} from "@/src/components/information/legalDocuments";
import { appPaths } from "@/src/lib/appPaths";

type LegalDocumentPageProps = {
  id: LegalDocumentId;
};

export function LegalDocumentPage({ id }: LegalDocumentPageProps) {
  const document = getLegalDocument(id);

  return (
    <article className="information-doc">
      <p className="information-doc__archive">
        Legal / {document.number} · {document.title}
      </p>

      <section className="information-doc__block">
        <h2 className="information-doc__headline">{document.title}</h2>
        <p className="information-doc__lede">{document.summary}</p>
        <p className="information-doc__note">{document.updatedLabel}</p>
        <p className="information-doc__lede">
          Full document copy is being prepared. This route is live so the legal
          index and navigation can land first.
        </p>
        <Link className="information-doc__action" preload="intent" to={appPaths.legal}>
          ← All legal documents
        </Link>
      </section>
    </article>
  );
}
