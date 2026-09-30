import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CheckoutDesk, CheckoutPreview } from "@/src/components/checkout/CheckoutDesk";
import { checkoutOfferFromSearch, parseCheckoutSearch } from "@/lib/checkoutOffer";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { appPaths, noIndexRobots } from "@/src/lib/appPaths";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

export const Route = createFileRoute("/checkout")({
  validateSearch: parseCheckoutSearch,
  beforeLoad: ({ search }) => {
    if (!checkoutOfferFromSearch(search)) {
      throw redirect({ to: appPaths.pricing });
    }
  },
  head: () => ({
    meta: [
      { title: "Checkout | NeotypeLab" },
      {
        name: "description",
        content: "Confirm your NeotypeLab order and continue to payment.",
      },
      noIndexRobots,
    ],
  }),
  component: CheckoutRoute,
});

function CheckoutRoute() {
  const offer = checkoutOfferFromSearch(Route.useSearch());
  const { hasClerkProvider, hasConvexClient } = useStartProviderStatus();
  if (!offer) return null;

  return (
    <AppShell description="Confirm your order and continue to payment." title="Checkout">
      <main className="checkout-page">
        <Link className="checkout-back" to={appPaths.pricing}>Pricing</Link>
        {hasClerkProvider && hasConvexClient ? (
          <CheckoutDesk offer={offer} />
        ) : (
          <CheckoutPreview offer={offer} />
        )}
      </main>
    </AppShell>
  );
}
