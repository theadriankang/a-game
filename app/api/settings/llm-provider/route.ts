import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";
import { LlmProvider } from "@prisma/client";

// Lets a signed-in user choose which LLM backend their own on-demand
// module-analysis requests use (the "Request analysis" button on a
// module page). Doesn't affect already-cached reports - ModuleAnalysis
// is a shared cache across every user, see schema.prisma - or AUTO_*
// requests triggered by adding a module to a plan, which always use the
// deployment-wide default instead (see resolveProviderForUser in
// lib/module-analysis.ts).
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLlmProvider: true },
    });
    return NextResponse.json({
      provider: user?.preferredLlmProvider ?? LlmProvider.ANTHROPIC,
    });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  if (provider !== LlmProvider.ANTHROPIC && provider !== LlmProvider.SOCLAAS) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { preferredLlmProvider: provider },
    });
    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
