/**
 * Transactional email, via Brevo's HTTP API.
 *
 * The API rather than SMTP: one `fetch` against an endpoint that returns a
 * message id and a real error body, versus a stateful SMTP conversation and
 * another dependency. Supabase keeps using the SMTP relay for auth mail — that
 * is configured inside Supabase and is not ours to send.
 *
 * DELIVERABILITY WARNING. Until BREVO_SENDER is an address at a domain you own
 * and have authenticated (SPF, DKIM, DMARC) in Brevo, these messages will fail
 * DMARC alignment and land in spam. A @gmail.com sender cannot be authenticated
 * by anyone but Google. This is the same limitation the OTP mail has.
 */

export interface Mail {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
}

export class EmailNotConfigured extends Error {
  constructor(missing: string) {
    super(`${missing} is not set — cannot send email.`);
    this.name = "EmailNotConfigured";
  }
}

export function emailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER);
}

export async function sendEmail(mail: Mail): Promise<{ messageId: string }> {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER;
  if (!key) throw new EmailNotConfigured("BREVO_API_KEY");
  if (!sender) throw new EmailNotConfigured("BREVO_SENDER");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": key,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: sender, name: process.env.BREVO_SENDER_NAME || "PakFinance" },
      to: [{ email: mail.to, ...(mail.toName ? { name: mail.toName } : {}) }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
  });

  if (!response.ok) {
    // Brevo returns a JSON body with `code` and `message`; surfacing it beats a
    // bare status when the failure is "sender not verified" three weeks later.
    const body = await response.text().catch(() => "");
    throw new Error(`Brevo ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { messageId?: string };
  return { messageId: data.messageId ?? "" };
}
