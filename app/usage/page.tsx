import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsagePanel } from "./usage-panel";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function UsagePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  // Platform-wide totals only — this page must never surface the
  // underlying Anthropic account's own credit balance or tier, just what
  // this app itself has logged spending on. See the architecture doc's
  // "Usage & cost page" section for why.
  const requests = await prisma.analysisRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const totals = requests.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.tokens += r.tokensUsed ?? 0;
      acc.costUsd += r.costUsd ?? 0;
      acc.byStatus[r.status] = (acc.byStatus[r.status] ?? 0) + 1;
      if (r.trigger === "ON_DEMAND") {
        acc.onDemandCount += 1;
      } else {
        acc.autoCount += 1;
      }
      return acc;
    },
    {
      count: 0,
      tokens: 0,
      costUsd: 0,
      autoCount: 0,
      onDemandCount: 0,
      byStatus: {} as Record<string, number>,
    }
  );

  const recent = requests.slice(0, 30).map((r) => ({
    id: r.id,
    moduleCode: r.moduleCode,
    trigger: r.trigger,
    status: r.status,
    tokensUsed: r.tokensUsed,
    costUsd: r.costUsd,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <>
      {/* Polls this page's own server data every few seconds so the
          numbers (and the cron/on-demand processing you're watching)
          update on their own - see auto-refresh.tsx. */}
      <AutoRefresh intervalMs={5000} />
      <UsagePanel totals={totals} recent={recent} />
    </>
  );
}
