import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { TimetablePanel } from "./timetable-panel";
import { trackSilently } from "@/lib/track";

export default async function TimetablePage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  await trackSilently(userId, "timetable");

  return <TimetablePanel />;
}
