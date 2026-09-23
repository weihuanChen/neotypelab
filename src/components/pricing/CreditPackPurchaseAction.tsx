import { SignInButton, useUser } from "@clerk/tanstack-react-start";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

export function CreditPackPurchaseAction({ credits }: { credits: 64 | 160 | 400 }) {
  const { isLoaded, isSignedIn } = useUser();
  const viewer = useQuery(api.users.viewer);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const createCheckout = useAction(api.creemBilling.createCreditPackCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = Boolean(
    viewer && viewer.entitlements.planType !== "free" && subscription &&
    ["active", "canceling"].includes(subscription.status) && subscription.currentPeriodEnd > Date.now()
  );

  useEffect(() => {
    const resetAfterHistoryReturn = () => setBusy(false);
    window.addEventListener("pageshow", resetAfterHistoryReturn);
    return () => window.removeEventListener("pageshow", resetAfterHistoryReturn);
  }, []);

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await createCheckout({ credits, returnOrigin: window.location.origin });
      const checkoutUrl = new URL(response.url);
      if (checkoutUrl.protocol !== "https:" || !["creem.io", "www.creem.io"].includes(checkoutUrl.hostname)) {
        throw new Error("Checkout returned an unexpected URL");
      }
      window.location.assign(checkoutUrl.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start checkout");
      setBusy(false);
    }
  }

  if (isLoaded && !isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="pricing-pack__action" type="button">Sign in to buy <span aria-hidden="true">→</span></button>
      </SignInButton>
    );
  }

  const label = !isLoaded || viewer === undefined || subscription === undefined ? "Checking…"
    : !eligible ? "Subscribers only"
    : busy ? "Opening…" : "Buy pack";

  return (
    <div className="pricing-pack__purchase">
      <button className="pricing-pack__action" disabled={!eligible || busy} onClick={() => void startCheckout()} type="button">
        {label} <span aria-hidden="true">→</span>
      </button>
      {error ? <p className="pricing-plan__error" role="alert">{error}</p> : null}
    </div>
  );
}
