import { useCallback, useEffect, useRef, useState } from "react";

export type NudgeHint = { text: string; tone: "danger" | "info"; action?: { label: string; href: string } };

/**
 * Create console validation feedback (docs/ui-direction.md · Create exception).
 * Actions stay clickable; when something is missing we give a small decaying
 * shake to the button and the missing area, a short-lived soft outline, bring
 * the area into view and say what to do in one sentence.
 */
export function useNudge() {
  const [hint, setHint] = useState<NudgeHint | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(id => window.clearTimeout(id)); }, []);

  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);

  const nudge = useCallback((options: { button?: HTMLElement | null; target?: HTMLElement | null; focus?: HTMLElement | null; text: string }) => {
    const { button, target, focus, text } = options;
    setHint({ text, tone: "danger" });
    for (const element of [button, target]) {
      if (!element) continue;
      element.classList.remove("is-nudged");
      void element.offsetWidth; // restart the animation on repeated clicks
      element.classList.add("is-nudged");
      later(() => element.classList.remove("is-nudged"), 700);
    }
    if (target) {
      target.classList.add("is-flagged");
      later(() => target.classList.remove("is-flagged"), 1800);
      const box = target.getBoundingClientRect();
      if (box.top < 80 || box.bottom > window.innerHeight) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }
    }
    focus?.focus({ preventScroll: true });
  }, [later]);

  /** For problems a shake cannot solve (credits, access, pricing): explain and offer a way forward. */
  const tell = useCallback((next: NudgeHint) => setHint(next), []);
  const clear = useCallback(() => setHint(null), []);

  return { hint, nudge, tell, clear };
}
