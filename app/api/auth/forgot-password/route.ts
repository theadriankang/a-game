import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/resend";
import { dbErrorResponse } from "@/lib/api-error";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

// Same message whether or not the email has an account, and the same
// delay-free shape of response either way - this route must not become a
// way to check which emails are registered.
const NEUTRAL_RESPONSE = NextResponse.json({
  message: "If that email has an account, we've sent a reset link.",
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Deliberately return the same response whether or not a user was
    // found, and don't let a missing user short-circuit before any of the
    // work above happens - see the neutral-response comment above.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      // Overwrites any previous reset request for this user, so only the
      // most recently requested link stays valid.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`;

      // Logged but not surfaced to the client - a Resend outage shouldn't
      // reveal account existence by changing the response shape/timing.
      await sendPasswordResetEmail(email, resetUrl).catch((error) => {
        console.error("Failed to send password reset email:", error);
      });
    }

    return NEUTRAL_RESPONSE;
  } catch (error) {
    return dbErrorResponse(error);
  }
}
