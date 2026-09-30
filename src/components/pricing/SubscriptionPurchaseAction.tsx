import { SignInButton, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { appPaths } from "@/src/lib/appPaths";
import { useCreemReadiness } from "./useCreemReadiness";
import { useWaffoReadiness } from "./useWaffoReadiness";

export function SubscriptionPurchaseAction({ planType }: { planType: "pro" | "studio" }) {
  const { isLoaded, isSignedIn } = useUser();
  const viewer = useQuery(api.users.viewer);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const creem = useCreemReadiness();
  const waffo = useWaffoReadiness();
  const [returnedFromCheckout, setReturnedFromCheckout] = useState(false);

  useEffect(() => {
    setReturnedFromCheckout(new URLSearchParams(window.location.search).get("checkout") === "success");
  }, []);

  if (!isLoaded || viewer === undefined || subscription === undefined || creem === undefined || waffo === undefined) {
    return <button className="pricing-plan__action" disabled type="button">Checking checkout…</button>;
  }

  const paymentReady = creem.products[planType] || waffo.products[planType];

  if (!paymentReady) {
    return <button className="pricing-plan__action" disabled type="button">Checkout unavailable</button>;
  }

  if (!isSignedIn) {
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

  if (returnedFromCheckout && effectivePlan === "free") {
    return <p aria-live="polite" className="pricing-plan__notice">Payment submitted. Confirming plan access…</p>;
  }

  const canUpgrade = planType === "studio" && effectivePlan === "pro" &&
    subscription?.status === "active" && subscription.currentPeriodEnd > Date.now();
  const unavailable = effectivePlan !== "free" && !canUpgrade;
  if (unavailable) {
    return <button className="pricing-plan__action" disabled type="button">Current subscription</button>;
  }

  return (
    <div className="pricing-plan__purchase">
      <Link className="pricing-plan__action" search={{ plan: planType }} to={appPaths.checkout}>
        {canUpgrade ? "Upgrade to Studio" : planType === "pro" ? "Go Pro" : "Enter Studio"}
        <span aria-hidden="true">→</span>
      </Link>
      {canUpgrade && subscription.provider === "creem" ? (
        <p className="pricing-plan__notice">The prorated difference is added to your next invoice.</p>
      ) : null}
    </div>
  );
}
