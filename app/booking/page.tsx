'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function BookingPage() {
  const searchParams = useSearchParams();
  const roomType = searchParams.get('room') || '';
  const [step, setStep] = useState<'form' | 'verify' | 'payment' | 'done'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [reference, setReference] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const [form, setForm] = useState({
    room_type_requested: roomType,
    check_in_date: '',
    check_out_date: '',
    num_adults: 1,
    num_children: 0,
    full_name: '',
    email: '',
    phone_number: '',
    special_requests: '',
  });
  const [code, setCode] = useState('');

  useEffect(() => {
    setForm((f) => ({ ...f, room_type_requested: roomType || f.room_type_requested }));
  }, [roomType]);

  const submitForm = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create booking');
      setBookingId(data.booking_id);
      setReference(data.reference_number || '');
      setStep('verify');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bookings/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      setStep('payment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bookings/payment/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, method: 'Stripe', payment_intent_id: 'manual-confirm' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      setQrDataUrl(data.qr_data_url || '');
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-[#07008A] text-white py-4">
        <div className="container mx-auto px-4">
          <Link href="/" className="text-xl font-bold">D&M Travelers Inn</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-lg">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-[#07008A] mb-6"
        >
          {step === 'form' && 'Book a Room'}
          {step === 'verify' && 'Verify Your Email'}
          {step === 'payment' && 'Pay Deposit (30%)'}
          {step === 'done' && 'Booking Confirmed'}
        </motion.h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">{error}</div>
        )}

        {step === 'form' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-6 rounded-xl shadow-lg space-y-4"
          >
            <input
              placeholder="Room type"
              value={form.room_type_requested}
              onChange={(e) => setForm((f) => ({ ...f, room_type_requested: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              type="date"
              placeholder="Check-in"
              value={form.check_in_date}
              onChange={(e) => setForm((f) => ({ ...f, check_in_date: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              type="date"
              placeholder="Check-out"
              value={form.check_out_date}
              onChange={(e) => setForm((f) => ({ ...f, check_out_date: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              placeholder="Full name"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              placeholder="Phone (optional)"
              value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#333] mb-1">Adults</label>
                <input
                  type="number"
                  min={1}
                  value={form.num_adults}
                  onChange={(e) => setForm((f) => ({ ...f, num_adults: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-[#333] mb-1">Children</label>
                <input
                  type="number"
                  min={0}
                  value={form.num_children}
                  onChange={(e) => setForm((f) => ({ ...f, num_children: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <textarea
              placeholder="Special requests (optional)"
              value={form.special_requests}
              onChange={(e) => setForm((f) => ({ ...f, special_requests: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
            />
            <button
              onClick={submitForm}
              disabled={loading}
              className="w-full bg-[#07008A] text-white font-semibold py-3 rounded-lg hover:bg-[#05006a] disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Continue → Send verification code'}
            </button>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-6 rounded-xl shadow-lg space-y-4"
          >
            <p className="text-[#333]">Enter the 6-digit code sent to your email.</p>
            <input
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 border rounded-lg text-center text-2xl tracking-widest"
              maxLength={6}
            />
            <button
              onClick={submitVerify}
              disabled={loading || code.length !== 6}
              className="w-full bg-[#FED501] text-[#07008A] font-semibold py-3 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </motion.div>
        )}

        {step === 'payment' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-6 rounded-xl shadow-lg space-y-4"
          >
            <p className="text-[#333]">Pay 30% deposit to confirm your booking.</p>
            <button
              onClick={submitPayment}
              disabled={loading}
              className="w-full bg-[#07008A] text-white font-semibold py-3 rounded-lg hover:bg-[#05006a] disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm deposit (Stripe)'}
            </button>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-6 rounded-xl shadow-lg space-y-4 text-center"
          >
            <p className="text-green-600 font-semibold">Booking confirmed!</p>
            <p className="text-[#333]">Reference: <strong>{reference}</strong></p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="mx-auto w-40 h-40" />}
            <Link href="/" className="inline-block bg-[#FED501] text-[#07008A] font-semibold px-6 py-2 rounded-lg">
              Back to Home
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
