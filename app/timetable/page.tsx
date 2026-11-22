import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { TimetablePanel } from "./timetable-panel";

export default async function TimetablePage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  return <TimetablePanel />;
}
