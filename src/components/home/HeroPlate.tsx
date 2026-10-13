import { type CSSProperties, type MouseEvent, useEffect, useRef, useState } from "react";

export type HeroPlateCallout = { letter: string; x: number; y: number };

/**
 * The home hero plate: a build, optionally compared with the same kit before
 * painting (a pixel-aligned photo, or its line art), with instruction-manual paint markers (A, B, C…) on top.
 *
 * Also used by the admin curation screen, where `onPlace` turns a click into a
 * normalized (0–1) marker position. Both surfaces share the same cover framing
 * (4:3, or 1:1 with `square`) so a marker lands where the admin put it.
 */
export function HeroPlate({
  alt,
  callouts,
  imageUrl,
  beforeUrl,
  labels = { before: "Your kit", after: "Your build" },
  lineArtUrl,
  onPlace,
  square = false,
}: {
  alt: string;
  callouts: HeroPlateCallout[];
  imageUrl: string;
  /** A pixel-aligned photo of the same kit before painting (preferred over line art). */
  beforeUrl?: string | null;
  labels?: { before: string; after: string };
  lineArtUrl?: string | null;
  onPlace?: (point: { x: number; y: number }) => void;
  /** Square frame for square full-body photos, so nothing is cropped. */
  square?: boolean;
}) {
  const underlay = beforeUrl ?? lineArtUrl ?? null;
  const compare = Boolean(underlay) && !onPlace;
  const [split, setSplit] = useState(50);
  const [intro, setIntro] = useState(compare);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIntro(compare);
  }, [compare, imageUrl]);

  function handlePlace(event: MouseEvent<HTMLDivElement>) {
    if (!onPlace || !frameRef.current) return;
    const box = frameRef.current.getBoundingClientRect();
    onPlace({
      x: clamp((event.clientX - box.left) / box.width),
      y: clamp((event.clientY - box.top) / box.height),
    });
  }

  return (
    <div
      className={[
        "home-plate",
        compare ? "is-compare" : "",
        compare && beforeUrl ? "is-photo" : "",
        square ? "is-square" : "",
        intro ? "is-intro" : "",
        onPlace ? "is-placing" : "",
      ].filter(Boolean).join(" ")}
      onAnimationEnd={() => setIntro(false)}
      onClick={onPlace ? handlePlace : undefined}
      ref={frameRef}
      style={{ "--split": `${split}%` } as CSSProperties}
    >
      {compare && underlay ? (
        <img alt="" className={beforeUrl ? "home-plate__before" : "home-plate__line"} src={underlay} />
      ) : null}
      <img alt={alt} className="home-plate__render" src={imageUrl} />
      {compare ? (
        <>
          <div aria-hidden="true" className="home-plate__seam" />
          <span aria-hidden="true" className="home-plate__tag is-left">{labels.before}</span>
          <span aria-hidden="true" className="home-plate__tag is-right">{labels.after}</span>
        </>
      ) : null}
      <div aria-hidden="true" className="home-plate__callouts">
        {callouts.map((callout) => (
          <span
            className="home-plate__callout"
            key={callout.letter}
            style={{ left: `${callout.x * 100}%`, top: `${callout.y * 100}%` }}
          >
            {callout.letter}
          </span>
        ))}
      </div>
      {compare ? (
        <label className="home-plate__range">
          <span className="sr-only">Compare the kit before and after painting</span>
          <input
            max={100}
            min={0}
            onChange={(event) => {
              setIntro(false);
              setSplit(Number(event.target.value));
            }}
            type="range"
            value={split}
          />
        </label>
      ) : null}
    </div>
  );
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
