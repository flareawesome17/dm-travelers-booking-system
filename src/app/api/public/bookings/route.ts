import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function cmpYmd(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(`${checkIn}T00:00:00.000Z`);
  const b = new Date(`${checkOut}T00:00:00.000Z`);
  const ms = b.getTime() - a.getTime();
  const nights = Math.floor(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(nights) ? nights : 0;
}

function randomReference() {
  return `DM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function randomCode6() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

async function cancelExpiredPendingVerifications(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const nowIso = new Date().toISOString();
  await supabase
    .from("bookings")
    .update({ status: "Cancelled", updated_at: nowIso })
    .eq("status", "Pending Verification")
    .lt("verification_code_expires_at", nowIso);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const phone = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
    const roomType = typeof body.room_type_requested === "string" ? body.room_type_requested.trim() : "";
    const checkIn = typeof body.check_in_date === "string" ? body.check_in_date.trim() : "";
    const checkOut = typeof body.check_out_date === "string" ? body.check_out_date.trim() : "";
    const special = typeof body.special_requests === "string" ? body.special_requests.trim() : "";
    const adults = Number(body.num_adults || 1);
    const children = Number(body.num_children || 0);
    const ratePlan = "24h";

    if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    if (!phone) return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    if (!roomType) return NextResponse.json({ error: "Please select a room type." }, { status: 400 });
    if (!checkIn || !isYmd(checkIn)) return NextResponse.json({ error: "Check-in date is required." }, { status: 400 });
    if (!checkOut || !isYmd(checkOut)) return NextResponse.json({ error: "Check-out date is required." }, { status: 400 });
    if (cmpYmd(checkIn, checkOut) >= 0) return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    await cancelExpiredPendingVerifications(supabase);

    const { data: rooms, error: rErr } = await supabase
      .from("rooms")
      .select("id, room_number, room_type, is_active, status, rate_24h_enabled, rate_24h_price")
      .eq("room_type", roomType)
      .eq("is_active", true);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

    const candidateRooms = (rooms ?? []).filter((r: any) => String(r.status || "") !== "Maintenance");
    if (!candidateRooms.length) {
      return NextResponse.json({ error: "This room type is not available right now." }, { status: 409 });
    }

    const roomIds = candidateRooms.map((r: any) => r.id);
    const nowIso = new Date().toISOString();
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("room_id, check_in_date, check_out_date, status, verification_code_expires_at")
      .in("room_id", roomIds)
      .not("status", "in", '("Cancelled","No Show","Checked-Out")')
      .lte("check_in_date", checkOut)
      .gte("check_out_date", checkIn);
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    const bookingsByRoom = new Map<string, Array<{ check_in_date: string; check_out_date: string; status: string; verification_code_expires_at?: string | null }>>();
    for (const b of bookings ?? []) {
      const status = String((b as any).status || "");
      if (status === "Pending Verification") {
        const exp = (b as any).verification_code_expires_at ? String((b as any).verification_code_expires_at) : "";
        if (exp && exp < nowIso) continue;
      }
      const rid = String((b as any).room_id || "");
      if (!rid) continue;
      if (!bookingsByRoom.has(rid)) bookingsByRoom.set(rid, []);
      bookingsByRoom.get(rid)!.push({
        check_in_date: String((b as any).check_in_date).slice(0, 10),
        check_out_date: String((b as any).check_out_date).slice(0, 10),
        status,
        verification_code_expires_at: (b as any).verification_code_expires_at ? String((b as any).verification_code_expires_at) : null,
      });
    }

    let chosenRoom: { id: string; rate_24h_enabled?: boolean | null; rate_24h_price?: number | null } | null = null;
    for (const room of candidateRooms) {
      const rid = String(room.id);
      const bks = bookingsByRoom.get(rid) ?? [];
      let overlaps = false;
      for (const b of bks) {
        if (cmpYmd(String(b.check_in_date), checkOut) < 0 && cmpYmd(String(b.check_out_date), checkIn) > 0) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        chosenRoom = room;
        break;
      }
    }

    if (!chosenRoom) {
      return NextResponse.json({ error: "No rooms available for your selected dates." }, { status: 409 });
    }

    const rateEnabled = chosenRoom.rate_24h_enabled !== false;
    const rate = rateEnabled && chosenRoom.rate_24h_price != null ? Number(chosenRoom.rate_24h_price) : null;
    if (rate == null || !Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: "Room rate is not configured for this room type." }, { status: 400 });
    }

    const nights = nightsBetween(checkIn, checkOut);
    if (nights <= 0) return NextResponse.json({ error: "Invalid date range." }, { status: 400 });

    const totalAmount = rate * nights;
    const depositPaid = 0;
    const balanceDue = totalAmount;

    const { data: existingGuest } = await supabase
      .from("guests")
      .select("id")
      .eq("email", email)
      .eq("phone_number", phone)
      .maybeSingle();

    let guestId = existingGuest?.id as string | undefined;
    if (!guestId) {
      const { data: guest, error: gErr } = await supabase
        .from("guests")
        .insert({ full_name: fullName, email, phone_number: phone })
        .select("id")
        .single();
      if (gErr || !guest) return NextResponse.json({ error: gErr?.message || "Failed to create guest." }, { status: 500 });
      guestId = guest.id;
    }

    const verificationCode = randomCode6();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    let reference = randomReference();
    let created: any = null;
    for (let i = 0; i < 3; i++) {
      const { data: booking, error: bkErr } = await supabase
        .from("bookings")
        .insert({
          reference_number: reference,
          guest_id: guestId,
          room_id: chosenRoom.id,
          room_type_requested: roomType,
          check_in_date: checkIn,
          check_out_date: checkOut,
          num_adults: Number.isFinite(adults) && adults > 0 ? adults : 1,
          num_children: Number.isFinite(children) && children >= 0 ? children : 0,
          total_amount: totalAmount,
          deposit_paid: depositPaid,
          balance_due: balanceDue,
          status: "Pending Verification",
          rate_plan_kind: ratePlan,
          verification_code: verificationCode,
          verification_code_expires_at: expiresAt,
          special_requests: special || null,
          updated_at: new Date().toISOString(),
        })
        .select("id, reference_number, check_in_date, check_out_date, room_type_requested, total_amount, deposit_paid, balance_due, status")
        .single();
      if (!bkErr && booking) {
        created = booking;
        break;
      }
      reference = randomReference();
      if (bkErr && typeof bkErr.message === "string" && bkErr.message.toLowerCase().includes("duplicate key")) continue;
      if (bkErr) return NextResponse.json({ error: bkErr.message }, { status: 400 });
    }

    if (!created) return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });

    try {
      await sendMail({
        to: email,
        subject: "D&M Travelers Inn - Verify your booking",
        text: `Your booking reference is ${created.reference_number}.\n\nYour verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.`,
        html: `<p>Your booking reference is <strong>${created.reference_number}</strong>.</p><p>Your verification code is:</p><h2 style="letter-spacing:2px">${verificationCode}</h2><p>This code expires in 10 minutes.</p>`,
      });
    } catch (mailErr: any) {
      await supabase
        .from("bookings")
        .update({ status: "Cancelled", updated_at: new Date().toISOString() })
        .eq("id", created.id);
      return NextResponse.json(
        { error: mailErr?.message || "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      booking_id: created.id,
      reference_number: created.reference_number,
      email,
      expires_at: expiresAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
