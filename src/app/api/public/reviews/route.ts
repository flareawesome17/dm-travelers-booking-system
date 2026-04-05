import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, parseAndValidate, validationError } from "@/lib/api-security";
import { z } from "zod";

const reviewSchema = z.object({
  reference_number: z.string().min(1, "Booking reference is required"),
  guest_name: z.string().min(2, "Name must be at least 2 characters"),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("reviews")
    .select("id, guest_name, rating, comment, created_at")
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[REVIEWS_GET_ERROR]", error);
    return apiError("database_error", "Failed to fetch reviews", 500);
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const validated = await parseAndValidate(req, reviewSchema);
  if (!validated.success) return (validated as any).error;

  const { reference_number, guest_name, rating, comment } = validated.data;
  const supabase = getSupabaseAdmin();

  // 1. Verify booking exists and get its ID
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("reference_number", reference_number)
    .single();

  if (bookingError || !booking) {
    return apiError("not_found", "Invalid booking reference number", 404);
  }

  // 2. Optional: Only allow reviews for checked-out or confirmed bookings
  const allowedStatuses = ["Confirmed", "Checked-In", "Checked-Out"];
  if (!allowedStatuses.includes(booking.status)) {
    return apiError(
      "forbidden",
      `Reviews are only allowed for ${allowedStatuses.join(", ")} bookings. Current status: ${booking.status}`,
      403
    );
  }

  // 3. Check if a review already exists for this booking
  const { data: existingReview, error: checkError } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (existingReview) {
    return apiError("conflict", "A review has already been submitted for this booking", 409);
  }

  // 4. Insert the review (unapproved by default)
  const { error: insertError } = await supabase.from("reviews").insert({
    booking_id: booking.id,
    guest_name,
    rating,
    comment,
    is_approved: false,
  });

  if (insertError) {
    console.error("[REVIEWS_POST_ERROR]", insertError);
    return apiError("database_error", "Failed to submit review", 500);
  }

  return NextResponse.json(
    { message: "Review submitted successfully and is awaiting moderation." },
    { status: 201 }
  );
}
