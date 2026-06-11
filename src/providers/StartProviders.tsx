import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

type ProviderStatus = {
  hasClerkProvider: boolean;
  hasConvexClient: boolean;
};

const ProviderStatusContext = createContext<ProviderStatus>({
  hasClerkProvider: false,
  hasConvexClient: false,
});

const clerkPublishableKey =
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const convexUrl =
  import.meta.env.NEXT_PUBLIC_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL;

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function StartProviders({ children }: { children: ReactNode }) {
  const status = useMemo(
    () => ({
      hasClerkProvider: Boolean(clerkPublishableKey),
      hasConvexClient: Boolean(convex),
    }),
    []
  );

  if (!clerkPublishableKey) {
    return (
      <ProviderStatusContext.Provider value={status}>
        {children}
      </ProviderStatusContext.Provider>
    );
  }

  return (
    <ProviderStatusContext.Provider value={status}>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        {convex ? (
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            {children}
          </ConvexProviderWithClerk>
        ) : (
          children
        )}
      </ClerkProvider>
    </ProviderStatusContext.Provider>
  );
}

export function useStartProviderStatus() {
  return useContext(ProviderStatusContext);
}
