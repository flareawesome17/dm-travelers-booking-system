import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
});

const FROM = process.env.SMTP_FROM || 'D&M Travelers Inn <noreply@example.com>';

export async function sendVerificationEmail(to: string, code: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Your D&M Travelers Inn Booking Verification Code',
    text: `Your verification code is: ${code}. It expires in 15 minutes.`,
    html: `<p>Your verification code is: <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`,
  });
}

export async function sendBookingConfirmation(
  to: string,
  reference: string,
  qrCodeDataUrl: string | null,
  checkIn: string,
  checkOut: string,
  balanceDue: number
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Booking Confirmed - ${reference} | D&M Travelers Inn`,
    html: `
      <h2>Booking Confirmed</h2>
      <p>Reference: <strong>${reference}</strong></p>
      <p>Check-in: ${checkIn} | Check-out: ${checkOut}</p>
      <p>Balance due at check-in: ₱${balanceDue.toFixed(2)}</p>
      ${qrCodeDataUrl ? `<p>Your check-in QR code:</p><img src="${qrCodeDataUrl}" alt="QR Code" width="200" />` : ''}
    `,
  });
}
