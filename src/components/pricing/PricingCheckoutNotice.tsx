import { useEffect, useState } from "react";

export function PricingCheckoutNotice() {
  const [returned, setReturned] = useState(false);
  useEffect(() => {
    const success = new URLSearchParams(window.location.search).get("checkout") === "success";
    setReturned(success);
    if (success) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?checkout=success`);
    }
  }, []);
  return returned ? (
    <p aria-live="polite" className="pricing-checkout-notice">
      Checkout complete. Your plan or Credits update after Creem confirms the payment.
    </p>
  ) : null;
}
