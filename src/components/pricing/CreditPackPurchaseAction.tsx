import { SignInButton, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { appPaths } from "@/src/lib/appPaths";
import { useCreemReadiness } from "./useCreemReadiness";
import { useWaffoReadiness } from "./useWaffoReadiness";

export function CreditPackPurchaseAction({ credits }: { credits: 64 | 160 | 400 }) {
  const { isLoaded, isSignedIn } = useUser();
  const viewer = useQuery(api.users.viewer);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const creem = useCreemReadiness();
  const waffo = useWaffoReadiness();
  const packKey = `pack${credits}` as const;
  const paymentReady = creem?.products[packKey] === true || waffo?.products[packKey] === true;
  const eligible = Boolean(
    paymentReady &&
    viewer && viewer.entitlements.planType !== "free" && subscription &&
    ["active", "canceling"].includes(subscription.status) && subscription.currentPeriodEnd > Date.now()
  );

  if (creem && waffo && !paymentReady) {
    return <button className="pricing-pack__action" disabled type="button">Checkout unavailable</button>;
  }

  if (isLoaded && !isSignedIn && paymentReady) {
    return (
      <SignInButton mode="modal">
        <button className="pricing-pack__action" type="button">Sign in to buy <span aria-hidden="true">→</span></button>
      </SignInButton>
    );
  }

  if (!isLoaded || viewer === undefined || subscription === undefined || creem === undefined || waffo === undefined) {
    return <button className="pricing-pack__action" disabled type="button">Checking…</button>;
  }

  if (!eligible) {
    return <button className="pricing-pack__action" disabled type="button">Subscribers only</button>;
  }

  return (
    <Link className="pricing-pack__action" search={{ pack: credits }} to={appPaths.checkout}>
      Buy pack <span aria-hidden="true">→</span>
    </Link>
  );
}
