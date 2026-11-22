import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Small shared helper: every planner/onboarding route needs the signed-in
// user's id, and repeating the session-cast in each route invites typos.
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}
