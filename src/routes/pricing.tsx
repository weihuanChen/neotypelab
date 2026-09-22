import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { appPaths } from "@/src/lib/appPaths";
import {
  COMPLETE_BUILD_CREDITS,
  CREDIT_COSTS,
  CREDIT_PACKS,
  PRODUCT_PLANS,
} from "@/lib/productPricing";

const pricingShell = {
  description: "Credits, plans, and how NeotypeLab generation usage is priced.",
  title: "Pricing",
} as const;

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | NeotypeLab" },
      {
        name: "description",
        content:
          "See how NeotypeLab credits and plans work for mecha repaint generation.",
      },
    ],
    links: [{ rel: "canonical", href: appPaths.pricing }],
  }),
  component: PricingRoute,
});

function PricingRoute() {
  return (
    <AppShell {...pricingShell}>
      <main className="pricing-page">
        <header className="pricing-hero">
          <p className="pricing-kicker">Pricing / N°01</p>
          <div className="pricing-hero__grid">
            <h2>Build at<br />your own pace.</h2>
            <p>
              Start with 20 credits. Subscribe when NeotypeLab becomes part of
              your workshop.
            </p>
          </div>
          <div aria-hidden="true" className="pricing-calibration">
            <span>Credit datum</span>
            <strong>{COMPLETE_BUILD_CREDITS} CR</strong>
            <span>Complete build</span>
          </div>
        </header>

        <section aria-labelledby="plans-heading" className="pricing-plans">
          <h2 className="sr-only" id="plans-heading">Plans</h2>
          {PRODUCT_PLANS.map((plan, index) => (
            <article
              className={plan.featured ? "pricing-plan is-featured" : "pricing-plan"}
              key={plan.id}
            >
              <header className="pricing-plan__head">
                <span>0{index + 1}</span>
                <h3>{plan.name}</h3>
                {plan.featured ? <em>Workshop choice</em> : null}
              </header>
              <p className="pricing-plan__price">
                <strong>{plan.price}</strong>
                {plan.priceSuffix ? <span>{plan.priceSuffix}</span> : null}
              </p>
              <dl className="pricing-plan__specs">
                <div>
                  <dt>Credits</dt>
                  <dd>{plan.credits} <span>{plan.creditCadence}</span></dd>
                </div>
                <div>
                  <dt>Build capacity</dt>
                  <dd>{plan.builds} complete builds</dd>
                </div>
                <div>
                  <dt>Workspace</dt>
                  <dd>{plan.workspace}</dd>
                </div>
                <div>
                  <dt>Originals</dt>
                  <dd>Kept for {plan.originalRetention}</dd>
                </div>
              </dl>
              {plan.available ? (
                <Link className="pricing-plan__action" to={appPaths.create}>
                  {plan.cta} <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <button className="pricing-plan__action" disabled type="button">
                  {plan.cta} <span>· Billing soon</span>
                </button>
              )}
            </article>
          ))}
        </section>

        <section aria-labelledby="packs-heading" className="pricing-section pricing-packs">
          <header className="pricing-section__head">
            <p>Need more?</p>
            <h2 id="packs-heading">Credit Packs</h2>
          </header>
          <div className="pricing-pack-list">
            {CREDIT_PACKS.map((pack) => (
              <div className="pricing-pack" key={pack.credits}>
                <strong>{pack.credits}</strong>
                <span>Credits</span>
                <small>{pack.builds} complete builds</small>
                <b>{pack.price}</b>
              </div>
            ))}
          </div>
          <div className="pricing-section__note">
            <p>Available to active subscribers when billing opens.</p>
            <p>Credits purchased separately do not expire.</p>
          </div>
        </section>

        <section aria-labelledby="costs-heading" className="pricing-section pricing-costs">
          <header className="pricing-section__head">
            <p>Credit guide</p>
            <h2 id="costs-heading">What costs credits?</h2>
          </header>
          <div className="pricing-cost-list">
            {CREDIT_COSTS.map((cost) => (
              <div className="pricing-cost" key={cost.label}>
                <span>
                  <strong>{cost.label}</strong>
                  <small>{cost.detail}</small>
                </span>
                <b>{cost.credits}</b>
              </div>
            ))}
          </div>
        </section>

        <footer className="pricing-footnotes">
          <p>
            A complete build combines the current Color Plan, Repaint
            Specification and HD Render pipeline. Failed complete builds are
            refunded under the generation failure policy.
          </p>
          <p>
            Unused monthly Credits roll over while your paid plan access remains
            active, up to twice your plan&apos;s monthly allowance. Credit Packs do
            not count toward this limit and do not expire.
          </p>
        </footer>
      </main>
    </AppShell>
  );
}
