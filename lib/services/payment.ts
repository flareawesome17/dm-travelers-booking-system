import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export type PaymentMethod = 'Stripe' | 'PayPal' | 'GCash';

export async function createStripePaymentIntent(
  amountInPesos: number,
  bookingId: string,
  reference: string
): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  if (!stripe) return null;
  const amountCentavos = Math.round(amountInPesos * 100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCentavos,
    currency: 'php',
    metadata: { bookingId, reference },
    automatic_payment_methods: { enabled: true },
  });
  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

export async function confirmStripePayment(paymentIntentId: string): Promise<boolean> {
  if (!stripe) return false;
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  return pi.status === 'succeeded';
}

// PayPal / GCash: stub for server-side confirmation (implement with their SDKs in production)
export async function confirmPayPalOrder(_orderId: string): Promise<boolean> {
  return false;
}

export async function confirmGCashPayment(_paymentId: string): Promise<boolean> {
  return false;
}
