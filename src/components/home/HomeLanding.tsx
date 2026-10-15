import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { COMPLETE_BUILD_CREDITS, STARTER_CREDITS } from "@/lib/productPricing";
import { appPaths } from "@/src/lib/appPaths";
import { HeroPlate } from "./HeroPlate";
import { HomeCarousel } from "./HomeCarousel";
import { heroShowcase } from "./heroShowcase";
import { HOME_FAQ_OPEN_COUNT, homeFaqFor, homeKitStory, starterBuildsLabel, type HomeFaqItem } from "./homeContent";
import type { HomeData, HomeHero, HomeHeroPaint } from "./types";

/**
 * The home page explains what NeotypeLab is: positioning, what a plan contains,
 * how to make one, a few finished builds, and the questions people ask first.
 * Browsing and filtering live in the Showcase; this page only points there.
 */
export function HomeLanding({ data, customKit = false }: { data: HomeData | null; customKit?: boolean }) {
  const hero = data?.hero ?? null;
  const works = data?.works ?? [];
  const story = homeKitStory(customKit);

  return (
    <main className="home-page">
      <HeroSection lede={story.lede} />
      <PlanSection hero={hero} />
      <StepsSection story={story} />
      {works.length > 0 ? (
        <section aria-labelledby="home-works-title" className="home-section home-works">
          <div className="home-wrap">
            <header className="home-section__head">
              <h2 id="home-works-title">Built by other modelers</h2>
              <p>Open any build to see its full plan, or remix it into your own version.</p>
            </header>
          </div>
          <HomeCarousel works={works} />
          <div className="home-wrap home-works__foot">
            <Link className="home-link" to={appPaths.showcase}>Browse the showcase</Link>
          </div>
        </section>
      ) : null}
      <FaqSection items={homeFaqFor(customKit)} />
      <section aria-labelledby="home-close-title" className="home-close">
        <div className="home-wrap">
          <h2 id="home-close-title">Your kit is on the bench. Plan the paint first.</h2>
          <Link className="home-cta" to={appPaths.create}>Plan a paint scheme</Link>
        </div>
      </section>
    </main>
  );
}

function HeroSection({ lede }: { lede: string }) {
  return (
    <section aria-labelledby="home-hero-title" className="home-hero">
      <div className="home-wrap home-hero__grid">
        <div className="home-hero__copy">
          <h1 id="home-hero-title">Plan a mecha model paint scheme before you spray.</h1>
          <p className="home-hero__lede">{lede}</p>
          <div className="home-hero__actions">
            <Link className="home-cta" to={appPaths.create}>Plan a paint scheme</Link>
            <Link className="home-link" to={appPaths.showcase}>See finished builds</Link>
          </div>
          <p className="home-hero__fine">
            New accounts start with {STARTER_CREDITS} credits, enough for {starterBuildsLabel}. Preset styles are free.
          </p>
        </div>
        <figure className="home-hero__figure">
          <HeroPlate
            alt={heroShowcase.alt}
            beforeUrl={heroShowcase.beforeUrl}
            callouts={heroShowcase.callouts}
            imageUrl={heroShowcase.afterUrl}
            labels={{ before: heroShowcase.beforeLabel, after: heroShowcase.afterLabel }}
            square
          />
          <figcaption className="home-hero__caption">
            <span><b>{heroShowcase.kitName}</b>, before and after its paint plan</span>
            <span>Drag to compare</span>
          </figcaption>
          <PaintKey paints={heroShowcase.paints} />
        </figure>
      </div>
    </section>
  );
}

function PaintKey({ paints }: { paints: HomeHeroPaint[] }) {
  return (
    <ol aria-label="Paint key for this build" className="home-key">
      {paints.map((paint) => (
        <li key={paint.letter}>
          <Swatch hex={paint.hex} />
          <span className="home-key__name">
            <span className="home-key__letter">{paint.letter}</span>
            {paint.name}
          </span>
          <span className="home-key__code">{paintCode(paint)}</span>
        </li>
      ))}
    </ol>
  );
}

function PlanSection({ hero }: { hero: HomeHero | null }) {
  const parts: Array<{ id: string; title: string; body: string; specimen: ReactNode }> = [
    {
      id: "color",
      title: "Color system",
      body: "Every color in the scheme, where it goes and how much of the kit it covers.",
      specimen: hero ? <ColorSystemSpecimen paints={hero.paints} /> : null,
    },
    {
      id: "sequence",
      title: "Painting sequence",
      body: "What to prime, spray and mask, in order, so each layer goes down at the right time.",
      specimen: hero && hero.sprayNotes.length > 0 ? <SequenceSpecimen notes={hero.sprayNotes} /> : null,
    },
    {
      id: "shopping",
      title: "Shopping list",
      body: "Real hobby paints with their brand and product code, ready to buy as listed.",
      specimen: hero ? <ShoppingSpecimen paints={hero.paints} /> : null,
    },
    {
      id: "preview",
      title: "HD preview",
      body: "The scheme rendered on your kit's own shape, so you can judge it before any paint goes on.",
      specimen: hero ? (
        <div className="home-part__preview">
          <img alt={`Close-up of ${hero.title}`} loading="lazy" src={hero.imageUrl} />
          <span>HD render</span>
        </div>
      ) : null,
    },
  ];

  return (
    <section aria-labelledby="home-plan-title" className="home-section">
      <div className="home-wrap">
        <header className="home-section__head">
          <h2 id="home-plan-title">What a plan gives you</h2>
          <p>
            Every build is a working sheet for the bench, not only a picture.
            {hero ? " Here is a real one from the showcase." : null}
          </p>
        </header>
        <div className="home-parts">
          {parts.map((part) => (
            <article className="home-part" key={part.id}>
              <h3>{part.title}</h3>
              <p>{part.body}</p>
              {part.specimen ? <div className="home-part__specimen">{part.specimen}</div> : null}
            </article>
          ))}
        </div>
        {hero ? (
          <p className="home-plan__more">
            <a className="home-link" href={hero.href}>Open the full plan</a>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ColorSystemSpecimen({ paints }: { paints: HomeHeroPaint[] }) {
  const measured = paints.every((paint) => paint.coverage !== null);
  return (
    <>
      <div aria-hidden="true" className="home-ratio">
        {paints.map((paint) => (
          <i
            key={paint.letter}
            style={{ flexGrow: measured ? paint.coverage ?? 1 : 1, backgroundColor: paint.hex ?? undefined }}
          />
        ))}
      </div>
      <ul className="home-ratio__legend">
        {paints.map((paint) => (
          <li key={paint.letter}>
            <span>{paint.letter} · {paint.roleName}</span>
            <span>{measured && paint.coverage !== null ? `${Math.round(paint.coverage)}%` : paint.area ?? ""}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function SequenceSpecimen({ notes }: { notes: string[] }) {
  return (
    <ol className="home-sequence">
      {notes.map((note, index) => (
        <li key={index}>{shortNote(note)}</li>
      ))}
    </ol>
  );
}

function ShoppingSpecimen({ paints }: { paints: HomeHeroPaint[] }) {
  return (
    <table className="home-shop">
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Swatch</span></th>
          <th scope="col">Paint</th>
          <th scope="col">Code</th>
        </tr>
      </thead>
      <tbody>
        {paints.map((paint) => (
          <tr key={paint.letter}>
            <td><Swatch hex={paint.hex} /></td>
            <td>{paint.paint ? `${paint.paint.brand} ${paint.paint.colorName}` : `${paint.name} (custom mix)`}</td>
            <td className="home-shop__code">{paint.paint?.code ?? paint.hex ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StepsSection({ story }: { story: ReturnType<typeof homeKitStory> }) {
  return (
    <section aria-labelledby="home-steps-title" className="home-section">
      <div className="home-wrap">
        <header className="home-section__head">
          <h2 id="home-steps-title">From an idea to the spray booth in three steps</h2>
          <p>No color theory or prompt writing needed. Say what you want the kit to feel like.</p>
        </header>
        <ol className="home-steps">
          <li>
            <span aria-hidden="true" className="home-steps__n">1</span>
            <h3>Describe the look</h3>
            <p>
              Write it the way you&apos;d say it: <q>deep navy, worn white, a little hazard orange</q>.
              Or start from a preset style and adjust it.
            </p>
            <p className="home-steps__note">Preset styles are free</p>
          </li>
          <li>
            <span aria-hidden="true" className="home-steps__n">2</span>
            <h3>{story.stepTitle}</h3>
            <p>{story.stepBody}</p>
            {story.stepNote ? <p className="home-steps__note">{story.stepNote}</p> : null}
          </li>
          <li>
            <span aria-hidden="true" className="home-steps__n">3</span>
            <h3>Get your build</h3>
            <p>Your color plan, painting sequence, shopping list and HD preview, ready to save or share.</p>
            <p className="home-steps__note">{COMPLETE_BUILD_CREDITS} credits per build · refunded if it fails</p>
          </li>
        </ol>
        <p className="home-steps__start">
          <Link className="home-link" to={appPaths.create}>Start with step one</Link>
        </p>
      </div>
    </section>
  );
}

function FaqSection({ items }: { items: HomeFaqItem[] }) {
  return (
    <section aria-labelledby="home-faq-title" className="home-section">
      <div className="home-wrap home-faq">
        <header className="home-faq__head">
          <h2 id="home-faq-title">Questions before you start</h2>
          <p>
            Anything else? <Link className="home-link" to={appPaths.contact}>Contact us</Link>.
          </p>
        </header>
        <div className="home-faq__list">
          {items.map((item, index) => (
            <details key={item.id} open={index < HOME_FAQ_OPEN_COUNT}>
              <summary>{item.question}</summary>
              <div className="home-faq__answer">
                {item.answer.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{withLink(paragraph, item)}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function withLink(paragraph: string, item: HomeFaqItem) {
  if (!item.link || !paragraph.includes("{link}")) return paragraph;
  const [before, after] = paragraph.split("{link}");
  return (
    <Fragment>
      {before}
      <a className="home-link" href={item.link.href}>{item.link.label}</a>
      {after}
    </Fragment>
  );
}

function Swatch({ hex }: { hex: string | null }) {
  return (
    <i
      aria-hidden="true"
      className={hex ? "home-swatch" : "home-swatch is-empty"}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

function paintCode(paint: HomeHeroPaint) {
  if (paint.paint) return `${paint.paint.brand} ${paint.paint.code}`;
  return paint.hex ? `Mix ${paint.hex.toUpperCase()}` : "Custom mix";
}

/** First clause of a spray note, short enough for the specimen list. */
export function shortNote(note: string, max = 64) {
  const first = note.split(/(?<=[.;:])\s+/)[0]?.replace(/[.;:]$/, "").trim() ?? note;
  if (first.length <= max) return first;
  return `${first.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
