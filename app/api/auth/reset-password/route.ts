import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function findValidTokenUser(rawToken: string) {
  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: hashToken(rawToken) },
    select: { id: true, passwordResetTokenExpiresAt: true },
  });

  if (
    !user ||
    !user.passwordResetTokenExpiresAt ||
    user.passwordResetTokenExpiresAt < new Date()
  ) {
    return null;
  }

  return user;
}

// Lets the reset-password page check a token the moment it loads, so an
// expired/already-used link shows a clear message immediately instead of
// only failing once the user has typed a new password and hit submit.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  try {
    const user = await findValidTokenUser(token);
    return NextResponse.json({ valid: !!user });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  try {
    const user = await findValidTokenUser(token);
    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Single-use: clear the token so this link can't be replayed.
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return NextResponse.json({ message: "Password updated." });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
