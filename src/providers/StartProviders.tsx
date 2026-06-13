import { ClerkProvider, useAuth, useUser } from "@clerk/tanstack-react-start";
import {
  Authenticated,
  ConvexReactClient,
  useMutation,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { api } from "@/convex/_generated/api";

type ProviderStatus = {
  hasClerkProvider: boolean;
  hasConvexAuthBridge: boolean;
  hasConvexClient: boolean;
};

const ProviderStatusContext = createContext<ProviderStatus>({
  hasClerkProvider: false,
  hasConvexAuthBridge: false,
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
      hasConvexAuthBridge: Boolean(clerkPublishableKey && convex),
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
            <Authenticated>
              <StoreUserInDatabase />
            </Authenticated>
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

function StoreUserInDatabase() {
  const { user } = useUser();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    void storeUser();
  }, [storeUser, user?.id]);

  return null;
}
