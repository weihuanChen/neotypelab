import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { buildCreateHref } from "@/src/lib/appPaths";

type Community = FunctionReturnType<typeof api.userStyles.community>;
type Shared = NonNullable<FunctionReturnType<typeof api.userStyles.getCommunityStyle>>;
export function CommunityStyleGallery({ styles }: { styles: Community }) {
  return <AppShell title="Community styles"><main className="style-page">
    <a className="style-back" href="/styles">← Official styles</a>
    <header className="style-intro"><p className="style-eyebrow">Community / Shared directions</p>
      <h1>Someone’s idea.<br /><em>Your next repaint.</em></h1>
      <p>Save a shared style, then see how it feels on your kit. Popular styles rise through saves and public prototypes.</p>
    </header>
    {styles.length ? <div className="style-gallery mt-8">{styles.map(style => <a className="style-study" key={style.id} href={`/c/${style.id}`}>
      {style.preview ? <img src={style.preview.imageUrl} alt={`${style.name} community prototype`} loading="lazy" /> :
        <div className="community-palette-cover"><span>Palette study</span><strong>{style.intent.palette.primary}</strong><p>{[style.intent.palette.secondary, style.intent.palette.accent].filter(Boolean).join(" / ")}</p></div>}
      <p className="style-eyebrow">By {style.creator.name}</p><h2>{style.name}</h2>
      <p>{style.intent.graphicLanguage}</p><p>{style.saveCount} saves · {style.publicPrototypeCount} public prototypes</p>
    </a>)}</div> : <section className="style-empty"><h2>A place for the next idea.</h2><p>Create a custom style and publish it from My Styles to start the collection.</p></section>}
    <aside className="style-custom"><div><h2>Bring your own direction.</h2><p>Your descriptions stay private. Share only the interpreted style when you’re ready.</p></div>
      <a className="showcase-button" href="/create">Create a style →</a></aside>
  </main></AppShell>;
}
export function CommunityStyleDetail({ style }: { style: Shared }) {
  return <AppShell title={style.name}><main className="style-page">
    <a className="style-back" href="/styles">← Official styles</a>
    <section className="style-hero"><div><p className="style-eyebrow">Community style / By {style.creator.name}</p>
      <h1>{style.name}</h1><p>{style.intent.graphicLanguage}</p>
      <dl className="style-palette">{Object.entries(style.intent.palette).map(([role, color]) =>
        <div key={role}><dt>{role}</dt><dd>{Array.isArray(color) ? color.join(" · ") : color}</dd></div>)}</dl>
      <p>{style.intent.finish} · {style.intent.weathering} · {style.intent.mood}</p>
      <p>{style.saveCount} saves · {style.publicPrototypeCount} public prototypes</p>
      <a className="showcase-button is-warm" href={buildCreateHref({ communityStyle: style.id })}>Save and apply in Create →</a>
    </div>{style.preview ? <img src={style.preview.imageUrl} alt={`${style.name} public prototype`} /> :
      <div className="community-palette-cover"><span>Style direction</span><strong>{style.intent.palette.primary}</strong><p>{style.intent.surfaceLogic}</p></div>}</section>
    <div className="style-section-heading"><p className="style-eyebrow">From a shared idea to your kit</p><h2>Make a private copy. Try a different model.</h2>
      <p>Your saved copy remains in My Styles even if the author later makes this style private. A preview and paint mapping are generated for your selected kit.</p>
      {style.promoted ? <p>This direction has been selected for an official preset draft. Official previews are reviewed separately.</p> : null}
    </div>
  </main></AppShell>;
}
export function CommunityUnavailable() {
  return <AppShell title="Community styles"><main className="style-page"><p className="style-eyebrow">Community styles</p>
    <h1>The community collection is taking a moment.</h1><p>Please try again shortly.</p>
    <a className="showcase-button" href="/styles">Browse official styles</a>
  </main></AppShell>;
}
