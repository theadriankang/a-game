import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text0">
          Set up your plan
        </h1>
        <p className="mt-1 text-sm text-text2">
          This is yours alone — your programme, exemptions, and S/U budget
          aren&apos;t shared with anyone else using A-Game.
        </p>
      </div>
      <OnboardingForm />
    </main>
  );
}
