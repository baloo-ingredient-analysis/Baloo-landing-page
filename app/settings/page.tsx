import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { profilePath } from "@/lib/profilePath";
import { SiteHeader } from "@/components/SiteHeader";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = { title: "Settings — Baloo" };

// Settings (Order S7a). Today it exists for one reason — the GDPR right to erasure needed a home —
// but it's also where email/notification preferences and the one-click unsubscribe land once N2
// ships. Server component: the destructive bits live in the client island.
export default async function SettingsPage() {
  const auth = await getCurrentProfile();

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pt-8">
        <section className="mt-10 animate-fade-in">
          <h1 className="font-display text-2xl text-ink">Settings</h1>

          {!auth ? (
            <div className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
              <p className="font-display text-lg text-ink">You&rsquo;re signed out</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                Sign in from the top right to manage your account.
              </p>
            </div>
          ) : !auth.profile ? (
            <div className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
              <p className="font-display text-lg text-ink">One more step</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                Choose a handle to finish setting up your account.
              </p>
              <Link
                href="/welcome"
                className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
              >
                Choose your handle
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                Signed in as{" "}
                <Link
                  href={profilePath(auth.profile.handle)}
                  className="text-ink underline decoration-line underline-offset-2"
                >
                  @{auth.profile.handle}
                </Link>
              </p>
              <SettingsClient handle={auth.profile.handle} />
            </>
          )}
        </section>

        <div className="mt-auto" />
      </main>
    </div>
  );
}
