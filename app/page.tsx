import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text0">
          A-Game
        </h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-text2">
          An open-source module planner for NUS students: semester planning,
          prerequisite checking, degree-requirement tracking, and an S/U
          budget tracker — all under your own account.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/sign-up"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Create an account
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text1"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
