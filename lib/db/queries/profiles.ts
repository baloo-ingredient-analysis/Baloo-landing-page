// Profile queries (Order G1). G2 (auth) creates profiles on signup via upsertProfile; public
// profile pages (G5) read via getProfileByHandle.

import { eq } from "drizzle-orm";
import type { Db } from "../index";
import { handleRedirects, profiles, type Profile } from "../schema";

export async function getProfileByHandle(dbi: Db, handle: string): Promise<Profile | null> {
  const [row] = await dbi.select().from(profiles).where(eq(profiles.handle, handle)).limit(1);
  return row ?? null;
}

// L5b: resolve an OLD handle to its owner's CURRENT profile, so `/@oldhandle` can permanent-redirect
// to the live `/@newhandle`. Returns null when the handle was never a previous handle of anyone.
export async function getProfileByOldHandle(dbi: Db, oldHandle: string): Promise<Profile | null> {
  const [row] = await dbi
    .select({ p: profiles })
    .from(handleRedirects)
    .innerJoin(profiles, eq(profiles.id, handleRedirects.profileId))
    .where(eq(handleRedirects.oldHandle, oldHandle))
    .limit(1);
  return row?.p ?? null;
}

// Change a user's handle (L5b) and keep the old one as a permanent redirect, atomically:
//  • point the profile at the new handle (+ refresh displayName),
//  • the new handle can no longer be a redirect (someone reclaiming a freed handle),
//  • the old handle now redirects here (upsert; a chain A→B→C leaves both A and B pointing at us).
export async function changeHandle(
  dbi: Db,
  userId: string,
  oldHandle: string,
  newHandle: string,
  displayName: string,
): Promise<Profile> {
  return dbi.transaction(async (tx) => {
    const [row] = await tx
      .update(profiles)
      .set({ handle: newHandle, displayName })
      .where(eq(profiles.id, userId))
      .returning();
    await tx.delete(handleRedirects).where(eq(handleRedirects.oldHandle, newHandle));
    await tx
      .insert(handleRedirects)
      .values({ oldHandle, profileId: userId })
      .onConflictDoUpdate({ target: handleRedirects.oldHandle, set: { profileId: userId } });
    return row;
  });
}

export async function getProfileById(dbi: Db, id: string): Promise<Profile | null> {
  const [row] = await dbi.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return row ?? null;
}

// Id-conflict upsert: G2 calls this on signup/login with id = auth.users.id, so repeated
// sign-ins refresh the display fields without duplicating identity.
export async function upsertProfile(
  dbi: Db,
  values: { id?: string; handle: string; displayName: string; avatarUrl?: string; bio?: string },
): Promise<Profile> {
  const [row] = await dbi
    .insert(profiles)
    .values({
      ...(values.id ? { id: values.id } : {}),
      handle: values.handle,
      displayName: values.displayName,
      avatarUrl: values.avatarUrl ?? null,
      bio: values.bio ?? null,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { displayName: values.displayName, avatarUrl: values.avatarUrl ?? null },
    })
    .returning();
  return row;
}
