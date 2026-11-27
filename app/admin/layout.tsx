import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

// Gates every /admin/* page via requireAdmin() (redirects non-admins to
// /planner — see src/lib/admin.ts). No tab bar here anymore: /admin itself
// (the Overview) is the landing page everyone sees from the main "Analytics"
// nav link, and the raw-data pages (users/modules/engagement) carry their
// own small subnav (see src/components/admin-subnav.tsx) rather than
// promoting tables to the same level as the visual overview.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-page text-text0">
      <header className="flex items-center justify-between border-b border-border bg-surface px-7 py-4">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-text3">
            A-Game
          </div>
          <div className="text-lg font-bold tracking-tight">Analytics</div>
        </div>
        <Link
          href="/planner"
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
        >
          Back to planner
        </Link>
      </header>

      <main className="animate-fade-in p-6">{children}</main>
    </div>
  );
}
