// A quiet three-step explainer for the idle state. Disappears once an analysis starts,
// keeping the homepage tool-first. Consumer language — no mention of the tech underneath.
const STEPS = [
  {
    title: "Paste a link",
    body: "Copy a product page from a supported supermarket and drop it in above.",
    icon: LinkIcon,
  },
  {
    title: "We read the label",
    body: "Baloo pulls the full ingredient list, kept in the exact order it's printed.",
    icon: LabelIcon,
  },
  {
    title: "See it explained",
    body: "What each ingredient is, why it's in there, and whether it's natural or processed.",
    icon: LeafIcon,
  },
];

export function HowItWorks() {
  return (
    <section className="mt-16 animate-fade-in border-t border-line pt-10 sm:mt-20">
      {/* Quiet by design — no visible title, but a heading keeps the h1→h2→h3 order intact and
          gives screen-reader users a section landmark. */}
      <h2 className="sr-only">How it works</h2>
      <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="text-center sm:text-left">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-natural-soft text-natural">
              <step.icon />
            </span>
            <h3 className="mt-4 flex items-center justify-center gap-2 font-display text-lg text-ink sm:justify-start">
              <span className="text-sm tabular-nums text-muted">{i + 1}</span>
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-5 w-5",
};

function LinkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 15l6-6" />
      <path d="M11 7l1-1a3.5 3.5 0 015 5l-1 1" />
      <path d="M13 17l-1 1a3.5 3.5 0 01-5-5l1-1" />
    </svg>
  );
}

function LabelIcon() {
  return (
    <svg {...iconProps}>
      <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h4" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z" />
      <path d="M8 16c3-3 6-6 9-9" />
    </svg>
  );
}
