"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export function DashboardOverview() {
  const viewer = useQuery(api.users.viewer);
  const createOptions = useQuery(api.catalog.listCreateOptions);
  const concepts = useQuery(api.concepts.listMine);
  const feedback = useQuery(api.feedback.listMine);
  const redeemActivationCode = useMutation(api.creditCampaigns.redeemActivationCode);
  const [activationCode, setActivationCode] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const stats = [
    {
      label: "Base Models",
      value: createOptions?.baseModels.length ?? 0,
      detail: "Structured kit silhouettes ready for prototype flows",
    },
    {
      label: "Style DNA",
      value: createOptions?.stylePresets.length ?? 0,
      detail: "Reusable style presets seeded into the domain catalog",
    },
    {
      label: "Saved Concepts",
      value: concepts?.length ?? 0,
      detail: "Generated concepts owned by the current pilot account",
    },
    {
      label: "Open Reports",
      value: feedback?.length ?? 0,
      detail: "Feedback entries still waiting for triage or resolution",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line-secondary bg-panel p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">
          System State
        </p>
        <h2 className="mt-3 text-3xl font-semibold">
          {viewer?.fullName ?? "Initializing operator profile"}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
          The terminal keeps model catalog, style DNA, material presets, credits,
          concept records, feedback reports, and R2-backed asset metadata in one
          authenticated workspace.
        </p>
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article className="rounded-3xl border border-line-secondary bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">
            Credit Capacity
          </p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-5xl font-semibold">{viewer?.credits.balance ?? 0}</p>
              <p className="mt-2 text-sm text-ink-secondary">
                Granted {viewer?.credits.lifetimeGranted ?? 0} / spent{" "}
                {viewer?.credits.lifetimeSpent ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-line-secondary bg-main px-4 py-3 text-sm text-ink-secondary">
              @{viewer?.handle ?? "syncing"}
            </div>
          </div>
        </article>
        <article className="rounded-3xl border border-line-secondary bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">
            Activation Code
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setRedeemStatus(null);
              setRedeemError(null);
              setIsRedeeming(true);
              void redeemActivationCode({ code: activationCode })
                .then((response) => {
                  setRedeemStatus(
                    `${response.campaignName}: +${response.creditAmount} credits / balance ${response.balanceAfter}`
                  );
                  setActivationCode("");
                })
                .catch((error) => {
                  setRedeemError(error instanceof Error ? error.message : "Activation failed");
                })
                .finally(() => setIsRedeeming(false));
            }}
          >
            <Input
              value={activationCode}
              onChange={(event) => setActivationCode(event.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              className="h-12 border-line-secondary bg-main font-mono text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-orange"
            />
            <Button
              type="submit"
              disabled={isRedeeming || activationCode.trim().length === 0}
              className="h-11 w-full rounded-2xl border border-accent-orange bg-[#241A0E] text-[#FFE0AD] hover:bg-[#302313]"
            >
              {isRedeeming ? "Redeeming" : "Redeem Credits"}
            </Button>
          </form>
          {redeemStatus ? (
            <p className="mt-3 rounded-2xl border border-accent-teal bg-accent-teal/10 p-3 text-sm text-accent-teal">
              {redeemStatus}
            </p>
          ) : null}
          {redeemError ? (
            <p className="mt-3 rounded-2xl border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
              {redeemError}
            </p>
          ) : null}
        </article>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-line-secondary bg-surface p-5"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-accent-teal">
              {stat.label}
            </p>
            <p className="mt-4 text-4xl font-semibold">{stat.value}</p>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">{stat.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
