// The canonical profile URL (L5a): the pretty vanity form `/@handle`. Middleware rewrites it to the
// real `/u/[handle]` page, so this is the ONE place the app builds profile links — keep every
// `href` to a profile going through here so the visible URL is always the `@` form.
export function profilePath(handle: string, tab?: "lists" | "pantry"): string {
  return `/@${handle}${tab ? `?tab=${tab}` : ""}`;
}
