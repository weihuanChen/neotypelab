import { SignInButton, useUser } from "@clerk/tanstack-react-start";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useWaffoReadiness } from "./useWaffoReadiness";

function checkedWaffoUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".waffo.ai")) {
    throw new Error("Waffo returned an unexpected checkout URL");
  }
  return url.toString();
}

export function WaffoSubscriptionPurchaseAction({ planType }: { planType: "pro" | "studio" }) {
  const { isLoaded, isSignedIn } = useUser();
  const viewer = useQuery(api.users.viewer);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const readiness = useWaffoReadiness();
  const createCheckout = useAction(api.waffoCheckout.createSubscriptionCheckout);
  const createUpgrade = useAction(api.waffoCheckout.createStudioUpgradeCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  if (!readiness?.products[planType] || !isLoaded) return null;
  if (!isSignedIn) {
    return <SignInButton mode="modal"><button className="pricing-plan__action pricing-plan__action--secondary" type="button">Sign in for Waffo test checkout</button></SignInButton>;
  }
  if (!viewer || subscription === undefined) return null;
  const canUpgrade = planType === "studio" && readiness.planChange &&
    viewer.entitlements.planType === "pro" && subscription?.provider === "waffo" &&
    subscription.status === "active" && subscription.currentPeriodEnd > Date.now();
  const canStart = viewer.entitlements.planType === "free" &&
    !(subscription && ["active", "canceling", "past-due"].includes(subscription.status));
  if (!canStart && !canUpgrade) return null;

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = canUpgrade
        ? await createUpgrade({ returnOrigin: window.location.origin })
        : await createCheckout({ planType, returnOrigin: window.location.origin });
      window.location.assign(checkedWaffoUrl(url));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open Waffo checkout");
      setBusy(false);
    }
  }

  return (
    <div className="pricing-plan__waffo">
      <button className="pricing-plan__action pricing-plan__action--secondary" disabled={busy} onClick={() => void startCheckout()} type="button">
        {busy ? "Opening Waffo…" : canUpgrade ? "Upgrade with Waffo · Test Mode" : "Pay with Waffo · Test Mode"} <span aria-hidden="true">→</span>
      </button>
      {error ? <p className="pricing-plan__error" role="alert">{error}</p> : null}
    </div>
  );
}

export function WaffoPackPurchaseAction({ credits }: { credits: 64 | 160 | 400 }) {
  const { isLoaded, isSignedIn } = useUser();
  const viewer = useQuery(api.users.viewer);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const readiness = useWaffoReadiness();
  const createCheckout = useAction(api.waffoCheckout.createCreditPackCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const key = `pack${credits}` as const;
  if (!readiness?.products[key] || !isLoaded || !isSignedIn || !viewer ||
      !subscription || !["active", "canceling"].includes(subscription.status) ||
      subscription.currentPeriodEnd <= Date.now()) return null;

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await createCheckout({ credits, returnOrigin: window.location.origin });
      window.location.assign(checkedWaffoUrl(url));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open Waffo checkout");
      setBusy(false);
    }
  }

  return (
    <div className="pricing-pack__waffo">
      <button className="pricing-pack__action pricing-pack__action--secondary" disabled={busy} onClick={() => void startCheckout()} type="button">
        {busy ? "Opening Waffo…" : "Waffo · Test Mode"} <span aria-hidden="true">→</span>
      </button>
      {error ? <p className="pricing-plan__error" role="alert">{error}</p> : null}
    </div>
  );
}
