import { SignInButton, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { assertProviderCheckoutUrl, type CheckoutOffer, type CheckoutPaymentMethod } from "@/lib/checkoutOffer";
import { appPaths } from "@/src/lib/appPaths";
import { useCreemReadiness } from "@/src/components/pricing/useCreemReadiness";
import { useWaffoReadiness } from "@/src/components/pricing/useWaffoReadiness";

export function CheckoutDesk({ offer }: { offer: CheckoutOffer }) {
  const { isLoaded, isSignedIn } = useUser();
  const viewer = useQuery(api.users.viewer);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const creem = useCreemReadiness();
  const waffo = useWaffoReadiness();
  const createCheckout = useAction(api.checkout.create);
  const [method, setMethod] = useState<CheckoutPaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [upgradePending, setUpgradePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resetAfterHistoryReturn = () => setBusy(false);
    window.addEventListener("pageshow", resetAfterHistoryReturn);
    return () => window.removeEventListener("pageshow", resetAfterHistoryReturn);
  }, []);

  const productKey = offer.kind === "plan" ? offer.plan : `pack${offer.credits}` as const;
  const pending = !isLoaded || creem === undefined || waffo === undefined ||
    (isSignedIn && (viewer === undefined || subscription === undefined));
  const cardReady = creem?.products[productKey] === true;
  const otherReady = waffo?.products[productKey] === true;
  const paymentReady = cardReady || otherReady;
  const selected: CheckoutPaymentMethod = method ?? (cardReady || !otherReady ? "card" : "other");
  const selectedReady = selected === "card" ? cardReady : otherReady;

  const effectivePlan = viewer?.entitlements.planType;
  const alreadyCovered = Boolean(
    offer.kind === "plan" && viewer && (
      effectivePlan === offer.plan || (offer.plan === "pro" && effectivePlan === "studio")
    )
  );
  const activePro = Boolean(
    effectivePlan === "pro" && subscription && subscription.status === "active" &&
    subscription.currentPeriodEnd > Date.now()
  );
  const upgradeMatchesMethod = Boolean(
    activePro && (
      (selected === "card" && subscription?.provider === "creem") ||
      (selected === "other" && subscription?.provider === "waffo" && waffo?.planChange)
    )
  );
  const canUpgrade = offer.kind === "plan" && offer.plan === "studio" && upgradeMatchesMethod;
  const blockedSubscription = Boolean(
    offer.kind === "plan" && viewer && effectivePlan !== "free" && !alreadyCovered && !canUpgrade
  );
  const packEligible = Boolean(
    offer.kind === "pack" && viewer && effectivePlan !== "free" && subscription &&
    ["active", "canceling"].includes(subscription.status) && subscription.currentPeriodEnd > Date.now()
  );
  const canPay = offer.kind === "pack" ? packEligible : !alreadyCovered && !blockedSubscription;
  const notice = canUpgrade && selected === "card"
    ? "The prorated difference is added to your next invoice."
    : blockedSubscription
      ? "Choose the payment method that matches your current subscription."
      : null;

  async function continueToPayment() {
    if (busy || !selectedReady || !canPay) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createCheckout({
        returnOrigin: window.location.origin,
        paymentMethod: selected,
        ...(offer.kind === "plan" ? { plan: offer.plan } : { credits: offer.credits }),
      });
      if (result.status === "scheduled") {
        setUpgradePending(true);
        setBusy(false);
        return;
      }
      window.location.assign(assertProviderCheckoutUrl(result.url));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start checkout");
      setBusy(false);
    }
  }

  const submitLabel = pending ? "Checking checkout…"
    : !paymentReady ? "Checkout unavailable"
    : upgradePending ? "Upgrade pending"
    : !isSignedIn ? "Sign in to continue"
    : !viewer ? "Preparing account…"
    : alreadyCovered ? "View your plan"
    : offer.kind === "pack" && !packEligible ? "Subscribers only"
    : blockedSubscription ? "Current subscription"
    : busy ? "Opening payment…"
    : "Continue to payment";

  const signedOutReady = !pending && !isSignedIn && paymentReady;
  const submitDisabled = !signedOutReady && (
    pending || busy || upgradePending || !isSignedIn || !viewer || alreadyCovered || !canPay || !selectedReady
  );

  return (
    <CheckoutForm
      cardReady={cardReady}
      error={error}
      methodsPending={pending}
      notice={upgradePending ? "Waiting for payment confirmation of your upgrade." : notice}
      offer={offer}
      onMethodChange={setMethod}
      onSubmit={() => void continueToPayment()}
      otherReady={otherReady}
      selected={selected}
      signIn={signedOutReady}
      submitDisabled={submitDisabled}
      submitLabel={submitLabel}
      viewPlan={alreadyCovered}
    />
  );
}

export function CheckoutPreview({ offer }: { offer: CheckoutOffer }) {
  return (
    <CheckoutForm
      cardReady={false}
      error={null}
      methodsPending={false}
      notice={null}
      offer={offer}
      onMethodChange={() => undefined}
      onSubmit={() => undefined}
      otherReady={false}
      selected="card"
      signIn={false}
      submitDisabled
      submitLabel="Checkout unavailable"
      viewPlan={false}
    />
  );
}

function CheckoutForm({
  cardReady,
  error,
  methodsPending,
  notice,
  offer,
  onMethodChange,
  onSubmit,
  otherReady,
  selected,
  signIn,
  submitDisabled,
  submitLabel,
  viewPlan,
}: {
  cardReady: boolean;
  error: string | null;
  methodsPending: boolean;
  notice: string | null;
  offer: CheckoutOffer;
  onMethodChange: (method: CheckoutPaymentMethod) => void;
  onSubmit: () => void;
  otherReady: boolean;
  selected: CheckoutPaymentMethod;
  signIn: boolean;
  submitDisabled: boolean;
  submitLabel: string;
  viewPlan: boolean;
}) {
  const action = viewPlan ? (
    <Link className="checkout-submit" to={appPaths.studio}>
      View your plan <span aria-hidden="true">→</span>
    </Link>
  ) : signIn ? (
    <SignInButton mode="modal">
      <button className="checkout-submit" type="button">
        Sign in to continue <span aria-hidden="true">→</span>
      </button>
    </SignInButton>
  ) : (
    <button className="checkout-submit" disabled={submitDisabled} type="submit">
      {submitLabel} <span aria-hidden="true">→</span>
    </button>
  );

  return (
    <form
      className="checkout-sheet"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="checkout-kicker">Checkout</p>
      <h2>{offer.title}</h2>
      <p className="checkout-summary">{offer.summary}</p>
      <p className="checkout-price">
        <strong>{offer.price}</strong>
        {offer.cadence ? <span>{offer.cadence}</span> : null}
      </p>
      <p className="checkout-terms">{offer.terms}</p>
      <fieldset className="checkout-methods">
        <legend>Payment method</legend>
        <MethodOption
          brands={["Visa", "Mastercard", "Amex"]}
          checked={selected === "card"}
          disabled={methodsPending || !cardReady}
          label="Credit / Debit Card"
          onChange={() => onMethodChange("card")}
          unavailable={!methodsPending && !cardReady}
          value="card"
        />
        <MethodOption
          checked={selected === "other"}
          disabled={methodsPending || !otherReady}
          label="Other payment methods"
          onChange={() => onMethodChange("other")}
          unavailable={!methodsPending && !otherReady}
          value="other"
        />
      </fieldset>
      {action}
      {notice ? <p className="checkout-notice">{notice}</p> : null}
      {error ? <p className="checkout-error" role="alert">{error}</p> : null}
      <p className="checkout-assurance">Secure payment · Taxes included</p>
    </form>
  );
}

function MethodOption({
  brands,
  checked,
  disabled,
  label,
  onChange,
  unavailable,
  value,
}: {
  brands?: string[];
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
  unavailable: boolean;
  value: CheckoutPaymentMethod;
}) {
  return (
    <label className={checked ? "checkout-method is-selected" : "checkout-method"}>
      <input
        checked={checked}
        disabled={disabled}
        name="paymentMethod"
        onChange={onChange}
        type="radio"
        value={value}
      />
      <span>
        <strong>{label}</strong>
        {brands ? <small className="checkout-brands">{brands.map((brand) => <span key={brand}>{brand}</span>)}</small> : null}
        {unavailable ? <small>Unavailable</small> : null}
      </span>
    </label>
  );
}
