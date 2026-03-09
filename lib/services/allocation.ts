import { supabaseAdmin } from '@/lib/supabase/server';

export async function allocateRoom(
  roomTypeRequested: string,
  checkIn: string,
  checkOut: string
): Promise<string | null> {
  const { data: rooms } = await supabaseAdmin
    .from('rooms')
    .select('id, last_checkout_date')
    .eq('room_type', roomTypeRequested)
    .eq('is_active', true)
    .in('status', ['Available', 'Clean'])
    .order('last_checkout_date', { ascending: true, nullsFirst: true });

  if (!rooms?.length) return null;

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('room_id')
    .not('status', 'in', '("Cancelled","No Show")')
    .lte('check_in_date', checkOut)
    .gte('check_out_date', checkIn);

  const bookedRoomIds = new Set((bookings || []).map((b: { room_id: string }) => b.room_id).filter(Boolean));

  for (const room of rooms) {
    if (!bookedRoomIds.has(room.id)) return room.id;
  }
  return null;
}
