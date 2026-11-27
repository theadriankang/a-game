import Link from "next/link";

const RAW_TABS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/engagement", label: "Engagement" },
];

// Small, deliberately low-key nav for the raw-data tier (the tables) — the
// visual Overview at /admin is where anyone lands by default; this is only
// for someone who followed "View raw data" and wants the underlying numbers.
export function AdminSubnav() {
  return (
    <div className="mb-5 flex items-center gap-3 text-[12px]">
      <Link href="/admin" className="font-semibold text-accent hover:underline">
        ← Analytics
      </Link>
      <span className="text-text3">·</span>
      <span className="text-text3">Raw data:</span>
      {RAW_TABS.map((tab, i) => (
        <span key={tab.href} className="flex items-center gap-3">
          <Link href={tab.href} className="text-text1 hover:text-text0 hover:underline">
            {tab.label}
          </Link>
          {i < RAW_TABS.length - 1 && <span className="text-text3">·</span>}
        </span>
      ))}
    </div>
  );
}
