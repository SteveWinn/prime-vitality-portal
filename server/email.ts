import nodemailer from "nodemailer";

// ─── TRANSPORT ────────────────────────────────────────────────────────────────
// Supports SendGrid (SMTP relay), generic SMTP, or a no-op "log" mode for dev.
// Required env vars:
//   SMTP_HOST  (e.g. "smtp.sendgrid.net")
//   SMTP_PORT  (e.g. "587")
//   SMTP_USER  (e.g. "apikey" for SendGrid)
//   SMTP_PASS  (SMTP password or SendGrid API key)
//   EMAIL_FROM (e.g. "care@myprimevitality.com")

const FROM = process.env.EMAIL_FROM || "Prime Vitality <care@myprimevitality.com>";
const FRONTEND = (process.env.FRONTEND_URL || "https://prime-vitality-portal.netlify.app").replace(/\/+$/, "");

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Dev / not-yet-configured — log emails instead of sending
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EMAIL DEV LOG] To: ${to} | Subject: ${subject}`);
    return;
  }
  await transport.sendMail({ from: FROM, to, subject, html });
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

function baseLayout(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#f4f6fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #0d4f3c 0%, #1a7a5e 100%); padding:28px 32px; }
  .header h1 { margin:0; color:#fff; font-size:18px; font-weight:700; letter-spacing:-0.3px; }
  .header p { margin:4px 0 0; color:rgba(255,255,255,0.75); font-size:13px; }
  .body { padding:28px 32px; }
  .body p { margin:0 0 16px; color:#374151; font-size:14px; line-height:1.6; }
  .body h2 { margin:0 0 12px; color:#111827; font-size:16px; font-weight:600; }
  .btn { display:inline-block; background:#1a7a5e; color:#fff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:600; margin:8px 0 20px; }
  .divider { border:none; border-top:1px solid #e5e7eb; margin:20px 0; }
  .footer { padding:16px 32px; background:#f9fafb; border-top:1px solid #e5e7eb; }
  .footer p { margin:0; color:#9ca3af; font-size:12px; line-height:1.5; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Prime Vitality</h1>
    <p>Personalized TRT &amp; Men's Health · myprimevitality.com</p>
  </div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>Prime Vitality · (801) 821-2531 · care@myprimevitality.com<br>
    You're receiving this because you have an account at Prime Vitality.</p>
  </div>
</div>
</body></html>`;
}

// 1. Password reset
export async function sendPasswordResetEmail(to: string, firstName: string, token: string): Promise<void> {
  const link = `${FRONTEND}/#/reset-password?token=${token}`;
  await sendMail(
    to,
    "Reset Your Prime Vitality Password",
    baseLayout(`
      <h2>Password Reset Request</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset the password for your Prime Vitality account. Click the button below to choose a new password:</p>
      <a href="${link}" class="btn">Reset My Password</a>
      <hr class="divider">
      <p style="font-size:12px;color:#6b7280;">This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
    `)
  );
}

// 2. New lab results uploaded
export async function sendLabUploadedEmail(to: string, firstName: string, reportTitle: string): Promise<void> {
  const link = `${FRONTEND}/#/dashboard`;
  await sendMail(
    to,
    "Your Lab Results Are Ready — Prime Vitality",
    baseLayout(`
      <h2>New Lab Results Available</h2>
      <p>Hi ${firstName},</p>
      <p>Your provider has uploaded new lab results to your Prime Vitality dashboard:</p>
      <p><strong>${reportTitle}</strong></p>
      <a href="${link}" class="btn">View My Results</a>
      <hr class="divider">
      <p style="font-size:12px;color:#6b7280;">Log in and go to the <strong>Lab Results</strong> or <strong>Progress Charts</strong> tab to review your results and track your progress over time.</p>
    `)
  );
}

// 3. New message from provider
export async function sendNewMessageEmail(to: string, firstName: string, preview: string): Promise<void> {
  const link = `${FRONTEND}/#/dashboard`;
  const safePreview = preview.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 160);
  await sendMail(
    to,
    "New Message from Your Provider — Prime Vitality",
    baseLayout(`
      <h2>You Have a New Message</h2>
      <p>Hi ${firstName},</p>
      <p>Your care team sent you a message:</p>
      <blockquote style="border-left:3px solid #1a7a5e;margin:0 0 16px;padding:10px 16px;background:#f0fdf4;border-radius:0 6px 6px 0;color:#374151;font-size:14px;font-style:italic;">
        "${safePreview}${preview.length > 160 ? "…" : ""}"
      </blockquote>
      <a href="${link}" class="btn">Reply in Dashboard</a>
    `)
  );
}

// 4. Subscription status emails
export async function sendSubscriptionEmail(
  to: string,
  firstName: string,
  type: "activated" | "cancelled" | "payment_failed" | "renewed"
): Promise<void> {
  const link = `${FRONTEND}/#/dashboard`;

  const content: Record<string, { subject: string; body: string }> = {
    activated: {
      subject: "Welcome to Prime Vitality — Subscription Confirmed",
      body: `
        <h2>You're All Set!</h2>
        <p>Hi ${firstName},</p>
        <p>Your Prime Vitality subscription is now active. Your provider will be in touch shortly to schedule your initial consultation.</p>
        <a href="${link}" class="btn">Go to My Dashboard</a>
      `,
    },
    renewed: {
      subject: "Subscription Renewed — Prime Vitality",
      body: `
        <h2>Subscription Renewed</h2>
        <p>Hi ${firstName},</p>
        <p>Your Prime Vitality subscription has been successfully renewed. Your care continues uninterrupted.</p>
        <a href="${link}" class="btn">Go to My Dashboard</a>
      `,
    },
    cancelled: {
      subject: "Your Prime Vitality Subscription Has Been Cancelled",
      body: `
        <h2>Subscription Cancelled</h2>
        <p>Hi ${firstName},</p>
        <p>Your Prime Vitality subscription has been cancelled. You'll retain access through the end of your current billing period.</p>
        <p>If you change your mind or cancelled by mistake, you can resubscribe anytime from your dashboard.</p>
        <a href="${link}" class="btn">Resubscribe</a>
      `,
    },
    payment_failed: {
      subject: "Action Required: Payment Failed — Prime Vitality",
      body: `
        <h2>Payment Failed</h2>
        <p>Hi ${firstName},</p>
        <p>We weren't able to process your most recent Prime Vitality payment. To avoid any interruption to your care, please update your payment method.</p>
        <a href="${link}" class="btn">Update Payment Method</a>
        <hr class="divider">
        <p style="font-size:12px;color:#6b7280;">If you've already resolved this, you can ignore this email. Contact us at care@myprimevitality.com if you need help.</p>
      `,
    },
  };

  const { subject, body } = content[type];
  await sendMail(to, subject, baseLayout(body));
}
