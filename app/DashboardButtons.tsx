"use client";

import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import {
  ClerkLoading,
  ClerkProvider,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import Link from "next/link";

export function DashboardButtons() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <Link href="/t" className="animate-[fade-in_0.2s]">
        <Button>Terminal Preview</Button>
      </Link>
    );
  }

  return (
    <ErrorBoundary>
      <ClerkProvider>
        <ClerkLoading>
          <div className="w-40 h-9" />
        </ClerkLoading>
        <SignedIn>
          <OpenDashboardLinkButton />
        </SignedIn>
        <SignedOut>
          <div className="flex gap-4 animate-[fade-in_0.2s]">
            <SignInButton mode="modal" redirectUrl="/t">
              <Button variant="ghost">Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal" redirectUrl="/t">
              <Button>Sign up</Button>
            </SignUpButton>
          </div>
        </SignedOut>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

function OpenDashboardLinkButton() {
  return (
    <Link href="/t" className="animate-[fade-in_0.2s]">
      <Button>Open Terminal</Button>
    </Link>
  );
}
