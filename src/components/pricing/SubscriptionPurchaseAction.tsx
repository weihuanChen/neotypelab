import { SignInButton, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { appPaths } from "@/src/lib/appPaths";
import { useCreemReadiness } from "./useCreemReadiness";

export function SubscriptionPurchaseAction({ planType }: { planType: "pro" | "studio" }) {
  const { isLoaded, isSignedIn } = useUser();
  const viewer = useQuery(api.users.viewer);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const createCheckout = useAction(api.creemBilling.createSubscriptionCheckout);
  const upgradeToStudio = useMutation(api.creemBilling.upgradeToStudio);
  const readiness = useCreemReadiness();
  const [busy, setBusy] = useState(false);
  const [upgradePending, setUpgradePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnedFromCheckout, setReturnedFromCheckout] = useState(false);

  useEffect(() => {
    const returned = new URLSearchParams(window.location.search).get("checkout") === "success";
    setReturnedFromCheckout(returned);
    if (returned) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?checkout=success`);
    }
  }, []);

  useEffect(() => {
    const resetAfterHistoryReturn = () => setBusy(false);
    window.addEventListener("pageshow", resetAfterHistoryReturn);
    return () => window.removeEventListener("pageshow", resetAfterHistoryReturn);
  }, []);

  if (!isLoaded || viewer === undefined || subscription === undefined || readiness === undefined) {
    return <button className="pricing-plan__action" disabled type="button">Checking checkout…</button>;
  }

  const paymentReady = readiness.products[planType];

  if (!isSignedIn) {
    if (!paymentReady) {
      return <button className="pricing-plan__action" disabled type="button">Checkout unavailable</button>;
    }
    return (
      <SignInButton mode="modal">
        <button className="pricing-plan__action" type="button">
          Sign in for {planType === "pro" ? "Pro" : "Studio"} <span aria-hidden="true">→</span>
        </button>
      </SignInButton>
    );
  }

  if (!viewer) {
    return <button className="pricing-plan__action" disabled type="button">Preparing account…</button>;
  }

  const effectivePlan = viewer.entitlements.planType;
  if (effectivePlan === planType || (planType === "pro" && effectivePlan === "studio")) {
    return <Link className="pricing-plan__action" to={appPaths.studio}>View your plan <span aria-hidden="true">→</span></Link>;
  }

  if (!paymentReady) {
    return <button className="pricing-plan__action" disabled type="button">Checkout unavailable</button>;
  }

  if (returnedFromCheckout && effectivePlan === "free") {
    return <p aria-live="polite" className="pricing-plan__notice">Payment submitted. Confirming plan access…</p>;
  }

  const canUpgrade = planType === "studio" && effectivePlan === "pro" && subscription?.status === "active";
  const unavailable = effectivePlan !== "free" && !canUpgrade;

  async function startPurchase() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (canUpgrade) {
        await upgradeToStudio({});
        setUpgradePending(true);
        setBusy(false);
        return;
      }
      const response = await createCheckout({ returnOrigin: window.location.origin, planType });
      const checkoutUrl = new URL(response.url);
      if (checkoutUrl.protocol !== "https:" || !["creem.io", "www.creem.io"].includes(checkoutUrl.hostname)) {
        throw new Error("Checkout returned an unexpected URL");
      }
      window.location.assign(checkoutUrl.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start purchase");
      setBusy(false);
    }
  }

  return (
    <div className="pricing-plan__purchase">
      <button className="pricing-plan__action" disabled={busy || unavailable || upgradePending} onClick={() => void startPurchase()} type="button">
        {upgradePending ? "Upgrade pending" : busy ? "Opening Creem…" : unavailable ? "Current subscription" :
          canUpgrade ? "Upgrade to Studio" : planType === "pro" ? "Go Pro" : "Enter Studio"}
        <span aria-hidden="true">→</span>
      </button>
      {upgradePending ? <p aria-live="polite" className="pricing-plan__notice">Waiting for Creem to confirm your upgrade.</p> : null}
      {canUpgrade && !upgradePending ? <p className="pricing-plan__notice">The prorated difference is added to your next invoice.</p> : null}
      {error ? <p className="pricing-plan__error" role="alert">{error}</p> : null}
    </div>
  );
}
