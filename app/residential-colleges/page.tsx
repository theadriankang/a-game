import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ALL_COLLEGES } from "@/lib/residential-colleges/registry";
import { ResidentialCollegesPanel } from "./residential-colleges-panel";
import { trackSilently } from "@/lib/track";

export default async function ResidentialCollegesPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/sign-in");
  }

  await trackSilently(userId, "residential_colleges");

  return <ResidentialCollegesPanel colleges={ALL_COLLEGES} currentCollegeId={user.residentialCollege} />;
}
