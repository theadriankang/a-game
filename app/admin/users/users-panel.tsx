"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatPill } from "@/components/stat-pill";
import { Odometer } from "@/components/odometer";

type Breakdown = { label: string; count: number };

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  programme: string | null;
  createdAt: string;
  lastActive: string | null;
  plannerEntryCount: number;
};

type Props = {
  rows: UserRow[];
  programmeBreakdown: Breakdown[];
  matricBreakdown: Breakdown[];
  mathBackgroundBreakdown: Breakdown[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function MiniBarChart({ data }: { data: Breakdown[] }) {
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fontSize: 11, fill: "var(--text1)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: "var(--seg-bg)" }}
          />
          <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UsersPanel({ rows, programmeBreakdown, matricBreakdown, mathBackgroundBreakdown }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.programme ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatPill label="Total users">
          <Odometer value={rows.length} />
        </StatPill>
        <StatPill label="Onboarding incomplete" sub="No programme set yet">
          <Odometer value={rows.filter((r) => !r.programme).length} />
        </StatPill>
        <StatPill label="Never active" sub="Signed up, no tracked activity since">
          <Odometer value={rows.filter((r) => r.lastActive === null).length} />
        </StatPill>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 text-[13px] font-semibold text-text1">By programme</div>
          <MiniBarChart data={programmeBreakdown} />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 text-[13px] font-semibold text-text1">By matriculation year</div>
          <MiniBarChart data={matricBreakdown} />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 text-[13px] font-semibold text-text1">By math background</div>
          <MiniBarChart data={mathBackgroundBreakdown} />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="text-[13px] font-semibold text-text1">All users ({filtered.length})</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, programme..."
            className="w-64 rounded-lg border border-border bg-page px-3 py-1.5 text-[13px] text-text0 placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text3">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Programme</th>
                <th className="px-4 py-2 font-semibold">Signed up</th>
                <th className="px-4 py-2 font-semibold">Last active</th>
                <th className="px-4 py-2 font-semibold">Plan entries</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const idle = daysSince(r.lastActive);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-text0">{r.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-text1">{r.email}</td>
                    <td className="px-4 py-2.5 text-text1">{r.programme ?? "Not set"}</td>
                    <td className="px-4 py-2.5 text-text2">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={idle !== null && idle > 14 ? "text-amber" : "text-text2"}>
                        {formatDate(r.lastActive)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-text2">{r.plannerEntryCount}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-text3">
                    No users match &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
