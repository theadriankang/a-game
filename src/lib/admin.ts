import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Gate for every /admin page. Mirrors the getServerSession + redirect
// pattern already used in app/planner/page.tsx and app/usage/page.tsx,
// plus an isAdmin check — /usage has no gate at all today, but a page with
// per-user demographics and activity needs more than "signed in".
//
// isAdmin is never settable from the UI (see the field's own comment in
// schema.prisma) — this function only ever reads it.
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isAdmin) {
    redirect("/planner");
  }

  return user;
}
