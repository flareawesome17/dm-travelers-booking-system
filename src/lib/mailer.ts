import nodemailer from "nodemailer";

type SendMailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function hasEmailAddress(value: string | undefined | null): boolean {
  if (!value) return false;
  return /[^\s<>]+@[^\s<>]+\.[^\s<>]+/.test(value);
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMail({ to, subject, text, html }: SendMailArgs) {
  const transport = getTransport();
  if (!transport) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.");
  }

  const configuredFrom = process.env.SMTP_FROM;
  const fallbackFrom = process.env.SMTP_USER;
  const from = configuredFrom && configuredFrom.trim().length ? configuredFrom.trim() : (fallbackFrom || "").trim();

  if (!hasEmailAddress(from)) {
    throw new Error(
      "SMTP_FROM must be a valid email (or 'Name <email@domain>'). Your SMTP provider rejected a blank/invalid sender."
    );
  }

  await transport.sendMail({ from, to, subject, text, html });
}
