"use client";

import { Wordmark } from "./Wordmark";
import { useT } from "@/lib/i18n/context";

export function Footer() {
  const t = useT();
  return (
    <footer className="mt-20 border-t border-line pt-8 pb-4 text-center">
      <Wordmark className="text-base" />
      <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted">{t.footer.disclaimer}</p>
      <p className="mt-2 text-xs text-muted">{t.footer.prototype}</p>
    </footer>
  );
}
