import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { HomeWork } from "./types";

const DWELL_MS = 6500;

/**
 * Horizontal carousel of curated builds: native scroll-snap (so swipe and
 * trackpad just work), plus a slow auto-advance that yields to the visitor —
 * it pauses on hover, focus, or when the carousel is off screen, and never
 * runs under prefers-reduced-motion.
 */
export function HomeCarousel({ works }: { works: HomeWork[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cycle, setCycle] = useState(0);
  const count = works.length;
  const playing = count > 1 && visible && !hovered && !focused && !reduceMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const offsetOf = useCallback((target: number) => {
    const first = slideRefs.current[0];
    const slide = slideRefs.current[target];
    return first && slide ? slide.offsetLeft - first.offsetLeft : 0;
  }, []);

  const go = useCallback((target: number) => {
    if (count === 0) return;
    const next = (target + count) % count;
    setIndex(next);
    setCycle((value) => value + 1);
    trackRef.current?.scrollTo({ left: offsetOf(next), behavior: reduceMotion ? "auto" : "smooth" });
  }, [count, offsetOf, reduceMotion]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => go(index + 1), DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [go, index, playing, cycle]);

  // Manual swipes settle on the nearest slide.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let settle = 0;
    const onScroll = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        let best = 0;
        let distance = Infinity;
        slideRefs.current.forEach((_, slideIndex) => {
          const gap = Math.abs(offsetOf(slideIndex) - track.scrollLeft);
          if (gap < distance) {
            distance = gap;
            best = slideIndex;
          }
        });
        setIndex((current) => (current === best ? current : best));
      }, 120);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(settle);
      track.removeEventListener("scroll", onScroll);
    };
  }, [offsetOf]);

  if (count === 0) return null;

  const filled = ((index + (playing ? 0 : 1)) / count) * 100;

  return (
    <div
      className="home-carousel"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onFocus={() => setFocused(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        aria-label="Builds from the showcase"
        aria-roledescription="carousel"
        className="home-carousel__track"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(index + 1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(index - 1);
          }
        }}
        ref={trackRef}
        role="region"
        tabIndex={0}
      >
        {works.map((work, slideIndex) => (
          <a
            aria-label={`${work.title}${work.styleName ? `, ${work.styleName}` : ""}, ${slideIndex + 1} of ${count}`}
            className={slideIndex === index ? "home-slide is-active" : "home-slide"}
            href={work.href}
            key={work.conceptId}
            ref={(node) => {
              slideRefs.current[slideIndex] = node;
            }}
          >
            <div className="home-slide__image">
              <img alt="" loading={slideIndex < 3 ? "eager" : "lazy"} src={work.imageUrl} />
            </div>
            <div className="home-slide__caption">
              <span className="home-slide__title">{work.kitName ?? work.title}</span>
              <span className="home-slide__style">{work.styleName ?? work.title}</span>
              {work.creator ? <span className="home-slide__by">by {work.creator}</span> : null}
            </div>
          </a>
        ))}
      </div>
      <div className="home-carousel__bar">
        <p aria-live="polite" className="home-carousel__count">
          <b>{index + 1}</b> / {count}
        </p>
        <div aria-hidden="true" className="home-carousel__progress">
          <i
            key={`${index}-${cycle}-${playing ? "run" : "hold"}`}
            style={{
              "--from": `${(index / count) * 100}%`,
              "--to": `${((index + 1) / count) * 100}%`,
              width: playing ? undefined : `${filled}%`,
              animationDuration: `${DWELL_MS}ms`,
            } as CSSProperties}
            className={playing ? "is-running" : undefined}
          />
        </div>
        <div className="home-carousel__buttons">
          <button aria-label="Previous build" onClick={() => go(index - 1)} type="button">
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
          </button>
          <button aria-label="Next build" onClick={() => go(index + 1)} type="button">
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
