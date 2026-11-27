import { Resend } from "resend";

// Lazily constructed so a missing key fails loudly only when an email is
// actually about to be sent, not at import time (matches how prisma.ts and
// anthropic.ts in this codebase defer their own client setup).
let client: Resend | null = null;

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set - cannot send email.");
  }
  if (!client) client = new Resend(key);
  return client;
}

/**
 * Sends the "reset your password" email. `resetUrl` already contains the
 * raw (unhashed) token as a query param - see app/api/auth/forgot-password.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is not set - cannot send email.");
  }

  const { error } = await getClient().emails.send({
    from,
    to,
    subject: "Reset your A-Game password",
    html: passwordResetHtml(resetUrl),
    text: passwordResetText(resetUrl),
  });

  if (error) {
    // Thrown rather than swallowed: the caller (forgot-password route)
    // still returns its neutral "if that email exists..." response either
    // way, but needs to know server-side whether the send actually worked.
    throw new Error(`Resend send failed: ${error.message}`);
  }
}

function passwordResetText(resetUrl: string) {
  return [
    "Reset your A-Game password",
    "",
    "We got a request to reset the password for this email address.",
    "If this was you, open this link to choose a new password:",
    resetUrl,
    "",
    "This link expires in 30 minutes and only works once.",
    "If you didn't request this, you can safely ignore this email -",
    "your password hasn't been changed.",
  ].join("\n");
}

function passwordResetHtml(resetUrl: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="font-size: 18px; margin-bottom: 8px;">Reset your A-Game password</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #444;">
        We got a request to reset the password for this email address.
        If this was you, click the button below to choose a new one.
      </p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}"
           style="display: inline-block; background: #111827; color: #fff; text-decoration: none;
                  padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">
          Reset password
        </a>
      </p>
      <p style="font-size: 13px; color: #777; line-height: 1.5;">
        This link expires in 30 minutes and only works once.
        If you didn't request this, you can safely ignore this email —
        your password hasn't been changed.
      </p>
      <p style="font-size: 12px; color: #999; word-break: break-all; margin-top: 16px;">
        Or paste this URL into your browser:<br />${resetUrl}
      </p>
    </div>
  `;
}
