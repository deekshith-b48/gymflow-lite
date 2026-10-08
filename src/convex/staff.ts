import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Version 1 is staff-only: signing in is what makes you an admin, and the
 * roster plus the check-in log are readable by nobody else. Every gym query and
 * mutation calls this first, so member data is never exposed to a signed-out
 * client even if it knows the function name.
 */
export async function requireStaff(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Sign in to open the gym desk.");
  }
  return userId;
}
