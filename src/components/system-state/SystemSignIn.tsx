"use client";

import { SignInButton } from "@clerk/tanstack-react-start";
import type { ReactNode } from "react";

export function SystemSignInButton({
  children = "Sign in →",
}: {
  children?: ReactNode;
}) {
  return (
    <SignInButton mode="modal">
      <button className="system-state__button" type="button">
        {children}
      </button>
    </SignInButton>
  );
}

export function SystemSignInLink({
  children = "Create account",
}: {
  children?: ReactNode;
}) {
  return (
    <SignInButton mode="modal">
      <button className="system-state__link" type="button">
        {children}
      </button>
    </SignInButton>
  );
}
