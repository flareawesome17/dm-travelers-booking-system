import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, rateLimitResponse, parseAndValidate } from "@/lib/api-security";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("A valid email is required"),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "public_contact", maxRequests: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const parsed = await parseAndValidate(req, contactSchema);
  if (parsed.success === false) return parsed.error;

  const { name, email, subject, message } = parsed.data;

  try {
    await sendMail({
      to: "info@dmtravelersinn.com",
      subject: "[Contact Form] " + subject,
      text: ["From: " + name + " <" + email + ">", "", message].join(" "),
      html: "<p><strong>From:</strong> " + name + " &lt;" + email + "&gt;</p><p>" + message + "</p>",
    });
  } catch {
    return NextResponse.json({ error: "Failed to send message. Please try again later." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}