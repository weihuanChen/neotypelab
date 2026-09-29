import { useEffect, useState } from "react";

export function PricingCheckoutNotice() {
  const [returned, setReturned] = useState<"creem" | "waffo" | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setReturned(params.get("provider") === "waffo" ? "waffo" : "creem");
    }
  }, []);
  return returned ? (
    <p aria-live="polite" className="pricing-checkout-notice">
      Checkout complete. Your plan or Credits update after {returned === "waffo" ? "Waffo" : "Creem"} confirms the payment.
    </p>
  ) : null;
}
