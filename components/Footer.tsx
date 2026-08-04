import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line pt-8 pb-4 text-center">
      <Wordmark className="text-base" />
      <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted">
        Baloo explains what&apos;s in packaged food to help you understand labels — it isn&apos;t
        medical or dietary advice, and never tells you what to buy or avoid.
      </p>
      <p className="mt-2 text-xs text-muted">A prototype for the upcoming Baloo app.</p>
    </footer>
  );
}
