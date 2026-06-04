import { DashboardButtons } from "@/app/DashboardButtons";
import { StickyHeader } from "@/components/layout/sticky-header";
import { Link } from "@/components/typography/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <>
      <StickyHeader className="px-4 py-2">
        <div className="flex justify-between items-center">
          <span>NeotypeLab</span>
          <Suspense>
            <DashboardButtons />
          </Suspense>
        </div>
      </StickyHeader>
      <main className="container max-w-4xl flex flex-col gap-8 py-12">
        <section className="rounded-3xl border border-white/10 bg-[#11161D] p-8 text-white">
          <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">
            Future Mecha R&D Terminal
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
            Prototype your next repaint before you spray.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9BA7B4] md:text-base">
            NeotypeLab is a structured repaint planning system for hobby builders.
            It combines base model data, style DNA, material presets, paint mapping,
            and credit-aware generation workflows instead of generic prompt-heavy AI.
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[#161B22] p-6 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-[#58FFB2]">
              Structured Inputs
            </p>
            <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
              Base model, style DNA, material profile, and weathering are modeled as
              first-class domain entities.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#161B22] p-6 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-[#58FFB2]">
              Spray-ready Logic
            </p>
            <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
              The product is aimed at realistic repaint planning, not open-ended AI art
              generation or social content churn.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#161B22] p-6 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-[#58FFB2]">
              Next + Convex
            </p>
            <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
              The current stack uses{" "}
              <Link href="https://nextjs.org" target="_blank">
                Next.js
              </Link>
              ,{" "}
              <Link href="https://convex.dev" target="_blank">
                Convex
              </Link>
              ,{" "}
              <Link href="https://clerk.com" target="_blank">
                Clerk
              </Link>
              , and R2-backed asset metadata.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
