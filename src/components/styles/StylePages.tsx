import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { absoluteUrl } from "@/lib/site";
import { buildCreateHref } from "@/src/lib/appPaths";
import { AppShell } from "@/src/components/app-shell/AppShell";
import type { StyleIntent } from "@/convex/creativeContracts";
import stylesCss from "@/src/styles/styles.css?url";

type Gallery = FunctionReturnType<typeof api.styleEditorial.gallery>;
type Detail = NonNullable<FunctionReturnType<typeof api.styleEditorial.getStyle>>;
type Pair = NonNullable<FunctionReturnType<typeof api.styleEditorial.getPair>>;

export function styleHead(title: string, path: string, description: string, indexable: boolean, image?: string) {
  const url = absoluteUrl(path);
  return {
    meta: [
      { title: title + " | NeotypeLab" }, { name: "description", content: description },
      { name: "robots", content: indexable ? "index, follow" : "noindex, follow" },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { property: "og:url", content: url },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
    ],
    links: [{ rel: "canonical", href: url }, { rel: "stylesheet", href: stylesCss }],
  };
}
function JsonLd({ name, path, description, image }: { name: string; path: string; description: string; image?: string }) {
  const data = { "@context": "https://schema.org", "@type": "CollectionPage", name, url: absoluteUrl(path), description, image };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
function Palette({ intent }: { intent: StyleIntent }) {
  return <dl className="style-palette">{Object.entries(intent.palette).map(([role, color]) =>
    <div key={role}><dt>{role}</dt><dd>{Array.isArray(color) ? color.join(" · ") : color}</dd></div>)}</dl>;
}
export function StylesUnavailable() {
  return <AppShell title="Styles"><main className="style-page">
    <p className="style-eyebrow">Style studies</p><h1>The collection is taking a moment.</h1>
    <p>Please try again shortly.</p><a className="showcase-button" href="/styles">Reload styles</a>
  </main></AppShell>;
}
export function StyleGallery({ styles }: { styles: Gallery }) {
  const [filter, setFilter] = useState("all");
  const categories = Array.from(new Set(styles.map(style => style.category)));
  const visible = styles.filter(style => filter === "all" || (filter === "featured" ? style.featured : style.category === filter));
  return <AppShell title="Styles"><main className="style-page">
    <JsonLd name="Repaint styles" path="/styles" description="Choose a repaint language, then apply it to a kit." />
    <header className="style-intro"><p className="style-eyebrow">01 / The style collection</p>
      <h1>A different kit.<br /><em>The same feeling.</em></h1>
      <p>Choose a repaint language, then apply it to a kit. <a href="/community/styles">Explore community directions →</a></p>
    </header>
    <nav className="style-filters" aria-label="Filter styles">
      {[["all", "All styles"], ["featured", "Featured"], ...categories.map(c => [c, c])].map(([value, label]) =>
        <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
    </nav>
    {visible.length ? <div className="style-gallery">{visible.map(style =>
      <a className="style-study" href={`/styles/${style.slug}`} key={style.id}>
        <img src={style.imageUrl} alt={`${style.name} repaint preview`} loading="lazy" />
        <p className="style-eyebrow">{style.category} / {style.modelCount} kit{style.modelCount === 1 ? "" : "s"}</p>
        <h2>{style.name}</h2><p>{Object.values(style.intent.palette).flat().join(" · ")}</p><p>{style.description}</p>
      </a>)}</div> : <div className="style-empty"><h2>{styles.length ? "No styles in this selection yet." : "The first style studies are on their way."}</h2>
      <p>Each study brings together a repaint direction, a reviewed preview and a practical paint mapping.</p></div>}
    <aside className="style-custom"><div><p className="style-eyebrow">Your own direction</p><h2>Have a different feeling in mind?</h2>
      <p>Describe it in Create and turn it into a reusable style.</p></div>
      <a className="showcase-button" href="/create">Create your own style →</a></aside>
  </main></AppShell>;
}
export function StyleDetail({ detail }: { detail: Detail }) {
  const { style, pairs } = detail;
  return <AppShell title={style.name}><main className="style-page">
    <a className="style-back" href="/styles">← All styles</a>
    <JsonLd name={style.name} path={`/styles/${style.slug}`} description={style.description} image={pairs[0].imageUrl} />
    <section className="style-hero"><div><p className="style-eyebrow">Official style / {style.category}</p>
      <h1>{style.name}</h1><p>{style.description}</p><Palette intent={style.intent} />
      <p>{style.intent.finish} · {style.intent.weathering} · {style.intent.graphicLanguage}</p>
      <a className="showcase-button is-warm" href={buildCreateHref({ recommendedStyle: style.slug })}>Apply this style →</a>
    </div><img src={pairs[0].imageUrl} alt={`${style.name} on ${pairs[0].model.name}`} /></section>
    <div className="style-section-heading"><p className="style-eyebrow">02 / Model studies</p><h2>Which kit should wear this style?</h2></div>
    <div className="style-gallery">{pairs.map(pair =>
      <a className="style-study" href={`/styles/${style.slug}/${pair.model.slug}`} key={pair.model.id}>
        <img src={pair.imageUrl} alt={`${style.name} on ${pair.model.name}`} loading="lazy" />
        <p className="style-eyebrow">{[pair.model.grade, pair.model.scale].filter(Boolean).join(" / ")}</p>
        <h2>{pair.model.name}</h2><p>Reviewed preview + paint mapping →</p>
      </a>)}</div>
  </main></AppShell>;
}
export function StyleModelDetail({ pair }: { pair: Pair }) {
  const { style, model } = pair;
  return <AppShell title={`${style.name} / ${model.name}`}><main className="style-page">
    <a className="style-back" href={`/styles/${style.slug}`}>← {style.name}</a>
    <JsonLd name={`${style.name} on ${model.name}`} path={`/styles/${style.slug}/${model.slug}`} description={style.description} image={pair.imageUrl} />
    <section className="style-hero"><div><p className="style-eyebrow">Official model study</p>
      <h1>{style.name}<br /><em>on {model.name}</em></h1><Palette intent={style.intent} />
      <p>{style.intent.finish} · {style.intent.weathering}</p>
      <a className="showcase-button is-warm" href={buildCreateHref({ recommendedStyle: style.slug, recommendedBaseModel: model.slug })}>Create this pairing →</a>
    </div><img src={pair.imageUrl} alt={`${model.name} painted in ${style.name}`} /></section>
    <div className="style-section-heading"><p className="style-eyebrow">03 / From preview to paint</p><h2>The paint mapping</h2>
      <p>Reviewed catalog matches for this study. Screen previews and physical paint can differ.</p></div>
    <div className="style-paints">{pair.palette.entries.map(entry => <article key={entry.roleSlug}>
      <span className="style-paint-chip" style={{ backgroundColor: entry.suggestedPaint.hexPreview ?? "transparent" }} aria-hidden="true" />
      <div><p className="style-eyebrow">{entry.roleName}</p><h3>{entry.suggestedPaint.colorName}</h3>
        <p>{entry.suggestedPaint.brand} · {entry.suggestedPaint.code}</p><p>{entry.rationale}</p></div>
    </article>)}</div>
    <a className="showcase-button" href={`/prototype/${pair.conceptId}`}>Open the original prototype →</a>
  </main></AppShell>;
}
