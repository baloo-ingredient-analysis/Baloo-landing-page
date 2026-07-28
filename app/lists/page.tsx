import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Your lists — Baloo" };

// "My lists" (Order G4 → PP2). Lists now live on your profile's Lists tab (Pinterest-style), so a
// signed-in user with a handle is redirected there; this page only survives to guide the signed-out
// and handle-pending states to the next step.
export default async function MyListsPage() {
  const auth = await getCurrentProfile();
  if (auth?.profile) redirect(`/u/${auth.profile.handle}?tab=lists`);

  // Only signed-out / handle-pending users reach here (everyone else redirected to their profile).
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pt-8">
        <section className="mt-10 animate-fade-in">
          <h1 className="font-display text-2xl text-ink">Your lists</h1>

          {!auth ? (
            <div className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
              <p className="font-display text-lg text-ink">Keep the good stuff</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                Sign in from the top right to create lists and save products you trust.
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
              <p className="font-display text-lg text-ink">One more step</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                Choose a handle and your lists get a shareable home.
              </p>
              <Link
                href="/welcome"
                className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
              >
                Choose your handle
              </Link>
            </div>
          )}
        </section>

        <div className="mt-auto" />
      </main>
    </div>
  );
}
