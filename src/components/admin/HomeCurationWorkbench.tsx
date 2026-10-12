import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HeroPlate } from "@/src/components/home/HeroPlate";

type Workspace = FunctionReturnType<typeof api.homeFeature.adminWorkspace>;
type Candidate = Workspace["candidates"][number];
type Callout = { paintIndex: number; x: number; y: number };

const MAX_CAROUSEL = 12;

/**
 * Admin curation for the home page: the hero build (with paint markers placed
 * on its render) and the ordered carousel. Nothing here is public until saved.
 */
export function HomeCurationWorkbench() {
  const workspace = useQuery(api.homeFeature.adminWorkspace);
  const saveHero = useMutation(api.homeFeature.saveHero);
  const saveCarousel = useMutation(api.homeFeature.saveCarousel);

  const [loaded, setLoaded] = useState(false);
  const [heroId, setHeroId] = useState<Id<"concepts"> | null>(null);
  const [showLineArt, setShowLineArt] = useState(false);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [activePaint, setActivePaint] = useState(0);
  const [carousel, setCarousel] = useState<Id<"concepts">[]>([]);
  const [heroSearch, setHeroSearch] = useState("");
  const [carouselSearch, setCarouselSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!workspace || loaded) return;
    setHeroId(workspace.curation?.heroConceptId ?? null);
    setShowLineArt(workspace.curation?.heroShowLineArt ?? false);
    setCallouts(workspace.curation?.heroCallouts ?? []);
    setCarousel(workspace.carousel.map((item) => item.conceptId));
    setLoaded(true);
  }, [workspace, loaded]);

  const preview = useQuery(api.homeFeature.adminHeroPreview, heroId ? { conceptId: heroId } : "skip");
  const byId = useMemo(
    () => new Map((workspace?.candidates ?? []).map((candidate) => [candidate.conceptId, candidate])),
    [workspace?.candidates],
  );

  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setNotice("");
    try {
      await task();
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }

  function chooseHero(id: Id<"concepts">) {
    if (id === heroId) return;
    setHeroId(id);
    setCallouts([]);
    setActivePaint(0);
  }

  function place(point: { x: number; y: number }) {
    setCallouts((current) => [
      ...current.filter((callout) => callout.paintIndex !== activePaint),
      { paintIndex: activePaint, ...point },
    ]);
    if (preview && activePaint < preview.paints.length - 1) setActivePaint(activePaint + 1);
  }

  if (!workspace) {
    return <div className="workbench-page"><p>Loading home page curation…</p></div>;
  }

  const heroCandidates = filterCandidates(workspace.candidates.filter((c) => c.hasPaintPlan), heroSearch);
  const carouselCandidates = filterCandidates(
    workspace.candidates.filter((c) => !carousel.includes(c.conceptId)),
    carouselSearch,
  );
  const plateCallouts = preview
    ? callouts
        .filter((callout) => callout.paintIndex < preview.paints.length)
        .map((callout) => ({ ...callout, letter: preview.paints[callout.paintIndex].letter }))
    : [];

  return (
    <div className="workbench-page home-curation">
      <header className="admin-workspace-head">
        <p>Content / Home page</p>
        <h2>Home page curation</h2>
        <span>
          Pick the build that explains NeotypeLab on the home page, mark its colors, and choose the builds in the
          carousel. Until something is saved, the home page uses the newest public builds.
        </span>
      </header>
      {notice ? <p className="home-curation__notice" role="status">{notice}</p> : null}

      <section className="workbench-step">
        <div className="workbench-step-head">
          <div className="workbench-step-head__title"><span>01</span><h2>Hero build</h2></div>
          <p>
            {workspace.curation?.heroConceptId
              ? "A curated hero is live."
              : "No hero picked yet: the home page borrows the newest public build with a paint plan."}{" "}
            Only public, published builds with a paint plan can be picked.
          </p>
        </div>

        <Input
          aria-label="Search builds for the hero"
          onChange={(event) => setHeroSearch(event.target.value)}
          placeholder="Search by title, kit or style"
          value={heroSearch}
        />
        <CandidateGrid
          candidates={heroCandidates}
          isSelected={(id) => id === heroId}
          onPick={chooseHero}
        />

        {heroId && preview === null ? (
          <p className="home-curation__warning">This build can no longer carry the hero (not public, or no paint plan). Pick another.</p>
        ) : null}

        {preview ? (
          <div className="home-curation__hero">
            <div>
              <p className="home-curation__label">
                Click the render to place marker <b>{preview.paints[activePaint]?.letter}</b>. Markers are optional.
              </p>
              <HeroPlate alt={preview.title} callouts={plateCallouts} imageUrl={preview.imageUrl} onPlace={place} />
            </div>
            <div className="home-curation__side">
              <p className="home-curation__label">Paint key</p>
              <ol className="home-curation__paints">
                {preview.paints.map((paint, index) => {
                  const placed = callouts.some((callout) => callout.paintIndex === index);
                  return (
                    <li className={index === activePaint ? "is-active" : undefined} key={paint.letter}>
                      <button onClick={() => setActivePaint(index)} type="button">
                        <i className="home-swatch" style={paint.hex ? { backgroundColor: paint.hex } : undefined} />
                        <span><b>{paint.letter}</b> {paint.name}</span>
                        <small>{placed ? "placed" : "not placed"}</small>
                      </button>
                      {placed ? (
                        <button
                          aria-label={`Remove marker ${paint.letter}`}
                          className="home-curation__remove"
                          onClick={() => setCallouts((current) => current.filter((c) => c.paintIndex !== index))}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <label className="home-curation__check">
                <input
                  checked={showLineArt && Boolean(preview.lineArtUrl)}
                  disabled={!preview.lineArtUrl}
                  onChange={(event) => setShowLineArt(event.target.checked)}
                  type="checkbox"
                />
                Compare with the kit line art
                {!preview.lineArtUrl ? <small> (this kit has no full-body line art)</small> : null}
              </label>
              {showLineArt && preview.lineArtUrl ? (
                <>
                  <p className="home-curation__label">As visitors see it</p>
                  <HeroPlate
                    alt={preview.title}
                    callouts={plateCallouts}
                    imageUrl={preview.imageUrl}
                    lineArtUrl={preview.lineArtUrl}
                  />
                  <p className="home-curation__hint">Use it only when the line art lines up with the render.</p>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="home-curation__actions">
          <Button
            disabled={busy || !heroId || !preview}
            onClick={() => {
              if (!heroId) return;
              void run(() => saveHero({ conceptId: heroId, showLineArt, callouts }), "Hero saved. It is live on the home page.");
            }}
          >
            Save hero
          </Button>
          <Button
            disabled={busy || !workspace.curation?.heroConceptId}
            onClick={() => {
              void run(async () => {
                await saveHero({ conceptId: null, showLineArt: false, callouts: [] });
                setHeroId(null);
                setCallouts([]);
              }, "Hero cleared. The home page now uses the newest public build.");
            }}
            variant="outline"
          >
            Clear hero
          </Button>
          {heroId ? <a className="underline" href={`/prototype/${heroId}`} rel="noreferrer" target="_blank">Open build ↗</a> : null}
        </div>
      </section>

      <section className="workbench-step">
        <div className="workbench-step-head">
          <div className="workbench-step-head__title"><span>02</span><h2>Carousel</h2></div>
          <p>
            Up to {MAX_CAROUSEL} builds, shown in this order. Leave it empty to show the newest public builds.
            Builds that stop being public drop out automatically.
          </p>
        </div>

        {carousel.length > 0 ? (
          <ol className="home-curation__order">
            {carousel.map((id, index) => {
              const item = byId.get(id) ?? workspace.carousel.find((entry) => entry.conceptId === id)?.work ?? null;
              return (
                <li key={id}>
                  <span className="home-curation__pos">{index + 1}</span>
                  {item ? <img alt="" src={item.imageUrl} /> : <span className="home-curation__missing" />}
                  <span className="home-curation__title">
                    {item ? item.title : "No longer public"}
                    {item?.kitName ? <small>{item.kitName}</small> : null}
                  </span>
                  <Button disabled={index === 0} onClick={() => setCarousel(move(carousel, index, -1))} size="sm" type="button" variant="outline">Up</Button>
                  <Button disabled={index === carousel.length - 1} onClick={() => setCarousel(move(carousel, index, 1))} size="sm" type="button" variant="outline">Down</Button>
                  <Button onClick={() => setCarousel(carousel.filter((entry) => entry !== id))} size="sm" type="button" variant="outline">Remove</Button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="home-curation__hint">No builds picked. The carousel shows the newest public builds.</p>
        )}

        <Input
          aria-label="Search builds for the carousel"
          onChange={(event) => setCarouselSearch(event.target.value)}
          placeholder="Search by title, kit or style"
          value={carouselSearch}
        />
        <CandidateGrid
          actionLabel="Add"
          candidates={carouselCandidates}
          disabled={carousel.length >= MAX_CAROUSEL}
          isSelected={() => false}
          onPick={(id) => setCarousel([...carousel, id])}
        />

        <div className="home-curation__actions">
          <Button
            disabled={busy}
            onClick={() => {
              const valid = carousel.filter((id) => byId.has(id));
              void run(async () => {
                await saveCarousel({ conceptIds: valid });
                setCarousel(valid);
              }, valid.length ? "Carousel saved." : "Carousel cleared. It now shows the newest public builds.");
            }}
          >
            Save carousel
          </Button>
          <a className="underline" href="/" rel="noreferrer" target="_blank">Open home page ↗</a>
        </div>
      </section>
    </div>
  );
}

function CandidateGrid({
  actionLabel,
  candidates,
  disabled = false,
  isSelected,
  onPick,
}: {
  actionLabel?: string;
  candidates: Candidate[];
  disabled?: boolean;
  isSelected: (id: Id<"concepts">) => boolean;
  onPick: (id: Id<"concepts">) => void;
}) {
  if (candidates.length === 0) {
    return <p className="home-curation__hint">No matching public builds.</p>;
  }
  return (
    <ul className="home-curation__grid">
      {candidates.slice(0, 48).map((candidate) => {
        const selected = isSelected(candidate.conceptId);
        return (
          <li key={candidate.conceptId}>
            <button
              aria-pressed={actionLabel ? undefined : selected}
              className={selected ? "is-selected" : undefined}
              disabled={disabled}
              onClick={() => onPick(candidate.conceptId)}
              type="button"
            >
              <img alt="" loading="lazy" src={candidate.imageUrl} />
              <span>{candidate.title}</span>
              <small>{[candidate.kitName, candidate.styleName].filter(Boolean).join(" · ")}</small>
              {actionLabel ? <em>{actionLabel}</em> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function filterCandidates(candidates: Candidate[], search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return candidates;
  return candidates.filter((candidate) =>
    [candidate.title, candidate.kitName, candidate.styleName, candidate.creator]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle)),
  );
}

function move<T>(items: T[], index: number, delta: number) {
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
}
