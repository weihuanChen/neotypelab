import { type CSSProperties, type MouseEvent, useEffect, useRef, useState } from "react";

export type HeroPlateCallout = { letter: string; x: number; y: number };

/**
 * The home hero plate: a curated build, optionally compared with its kit line
 * art, with instruction-manual paint markers (A, B, C…) on top.
 *
 * Also used by the admin curation screen, where `onPlace` turns a click into a
 * normalized (0–1) marker position. Both surfaces share the same 4:3 cover
 * framing so a marker lands where the admin put it.
 */
export function HeroPlate({
  alt,
  callouts,
  imageUrl,
  lineArtUrl,
  onPlace,
}: {
  alt: string;
  callouts: HeroPlateCallout[];
  imageUrl: string;
  lineArtUrl?: string | null;
  onPlace?: (point: { x: number; y: number }) => void;
}) {
  const compare = Boolean(lineArtUrl) && !onPlace;
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
        intro ? "is-intro" : "",
        onPlace ? "is-placing" : "",
      ].filter(Boolean).join(" ")}
      onAnimationEnd={() => setIntro(false)}
      onClick={onPlace ? handlePlace : undefined}
      ref={frameRef}
      style={{ "--split": `${split}%` } as CSSProperties}
    >
      {compare && lineArtUrl ? <img alt="" className="home-plate__line" src={lineArtUrl} /> : null}
      <img alt={alt} className="home-plate__render" src={imageUrl} />
      {compare ? (
        <>
          <div aria-hidden="true" className="home-plate__seam" />
          <span aria-hidden="true" className="home-plate__tag is-left">Your kit</span>
          <span aria-hidden="true" className="home-plate__tag is-right">Your build</span>
        </>
      ) : null}
      {callouts.map((callout) => (
        <span
          aria-hidden="true"
          className="home-plate__callout"
          key={callout.letter}
          style={{ left: `${callout.x * 100}%`, top: `${callout.y * 100}%` }}
        >
          {callout.letter}
        </span>
      ))}
      {compare ? (
        <label className="home-plate__range">
          <span className="sr-only">Compare the kit line art with the finished build</span>
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
