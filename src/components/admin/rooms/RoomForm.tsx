import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

type RoomFormProps = {
  apiUrl: string;
  token: string;
  room?: {
    id: string;
    room_number?: string;
    room_type?: string;
    floor?: number;
    capacity?: number;
    amenities?: string[];
    rate_plans?: unknown;
  };
  onSuccess: (room: unknown) => void;
  onClose: () => void;
};

export function RoomForm({ apiUrl, token, room, onSuccess, onClose }: RoomFormProps) {
  const [roomNumber, setRoomNumber] = useState(room?.room_number ?? "");
  const [roomType, setRoomType] = useState(room?.room_type ?? "");
  const [floor, setFloor] = useState(room?.floor != null ? String(room.floor) : "");
  const [capacity, setCapacity] = useState(
    room?.capacity != null ? String(room.capacity) : "2",
  );
  const [amenities, setAmenities] = useState(
    Array.isArray(room?.amenities) ? room!.amenities!.join(", ") : "",
  );
  const [files, setFiles] = useState<FileList | null>(null);
  const existingImages = Array.isArray((room as any)?.image_urls)
    ? ((room as any).image_urls as string[])
    : [];
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  // Rate plan state
  const existingPlans = Array.isArray(room?.rate_plans) ? (room!.rate_plans as any[]) : [];
  const findPlan = (kind: string) =>
    existingPlans.find((p) => p && typeof p === "object" && p.kind === kind);

  const plan24 = findPlan("24h");
  const plan12 = findPlan("12h");
  const plan5 = findPlan("5h");
  const plan3 = findPlan("3h");
  const planPerGuest = findPlan("per_guest");

  const [enable24h, setEnable24h] = useState(plan24 ? Boolean(plan24.enabled) : true);
  const [rate24Price, setRate24Price] = useState(
    plan24 && plan24.base_price != null ? String(plan24.base_price) : "",
  );
  const [rate24EarlyFee, setRate24EarlyFee] = useState(
    plan24 && plan24.early_checkin_fee != null ? String(plan24.early_checkin_fee) : "",
  );
  const [rate24LateFee, setRate24LateFee] = useState(
    plan24 && plan24.late_checkout_fee != null ? String(plan24.late_checkout_fee) : "",
  );

  const [enable12h, setEnable12h] = useState(plan12 ? Boolean(plan12.enabled) : false);
  const [rate12Price, setRate12Price] = useState(
    plan12 && plan12.base_price != null ? String(plan12.base_price) : "",
  );
  const [rate12LateFee, setRate12LateFee] = useState(
    plan12 && plan12.late_checkout_fee != null ? String(plan12.late_checkout_fee) : "",
  );

  const [enable5h, setEnable5h] = useState(plan5 ? Boolean(plan5.enabled) : false);
  const [rate5Price, setRate5Price] = useState(
    plan5 && plan5.base_price != null ? String(plan5.base_price) : "",
  );
  const [rate5LateFee, setRate5LateFee] = useState(
    plan5 && plan5.late_checkout_fee != null ? String(plan5.late_checkout_fee) : "",
  );

  const [enable3h, setEnable3h] = useState(plan3 ? Boolean(plan3.enabled) : false);
  const [rate3Price, setRate3Price] = useState(
    plan3 && plan3.base_price != null ? String(plan3.base_price) : "",
  );
  const [rate3LateFee, setRate3LateFee] = useState(
    plan3 && plan3.late_checkout_fee != null ? String(plan3.late_checkout_fee) : "",
  );

  const [enablePerGuest, setEnablePerGuest] = useState(
    planPerGuest ? Boolean((planPerGuest as any).enabled ?? (planPerGuest as any).price_24h ?? (planPerGuest as any).price_12h) : false,
  );
  const [enablePerGuest24h, setEnablePerGuest24h] = useState(
    planPerGuest ? (Boolean((planPerGuest as any).price_24h != null) || Boolean((planPerGuest as any).base_price != null)) : false,
  );
  const [enablePerGuest12h, setEnablePerGuest12h] = useState(
    planPerGuest ? Boolean((planPerGuest as any).price_12h != null) : false,
  );
  const [ratePerGuest24hPrice, setRatePerGuest24hPrice] = useState(
    planPerGuest && (planPerGuest as any).price_24h != null
      ? String((planPerGuest as any).price_24h)
      : planPerGuest && (planPerGuest as any).base_price != null
      ? String((planPerGuest as any).base_price)
      : "",
  );
  const [ratePerGuest12hPrice, setRatePerGuest12hPrice] = useState(
    planPerGuest && (planPerGuest as any).price_12h != null
      ? String((planPerGuest as any).price_12h)
      : "",
  );

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber || !roomType) {
      toast.error("Room number and room type are required.");
      return;
    }

    // Build rate plans
    const ratePlans: Array<Record<string, unknown>> = [];

    if (enable24h) {
      if (!rate24Price) {
        toast.error("Please set a price for the 24-hour rate.");
        return;
      }
      ratePlans.push({
        kind: "24h",
        enabled: true,
        base_price: Number(rate24Price),
        early_checkin_fee: rate24EarlyFee ? Number(rate24EarlyFee) : 0,
        late_checkout_fee: rate24LateFee ? Number(rate24LateFee) : 0,
        checkin_time: "14:00",
        checkout_time: "12:00",
      });
    }

    if (enable12h) {
      if (!rate12Price) {
        toast.error("Please set a price for the 12-hour rate.");
        return;
      }
      ratePlans.push({
        kind: "12h",
        enabled: true,
        base_price: Number(rate12Price),
        late_checkout_fee: rate12LateFee ? Number(rate12LateFee) : 0,
        duration_hours: 12,
      });
    }

    if (enable5h) {
      if (!rate5Price) {
        toast.error("Please set a price for the 5-hour rate.");
        return;
      }
      ratePlans.push({
        kind: "5h",
        enabled: true,
        base_price: Number(rate5Price),
        late_checkout_fee: rate5LateFee ? Number(rate5LateFee) : 0,
        duration_hours: 5,
      });
    }

    if (enable3h) {
      if (!rate3Price) {
        toast.error("Please set a price for the 3-hour rate.");
        return;
      }
      ratePlans.push({
        kind: "3h",
        enabled: true,
        base_price: Number(rate3Price),
        late_checkout_fee: rate3LateFee ? Number(rate3LateFee) : 0,
        duration_hours: 3,
      });
    }

    if (enablePerGuest) {
      const has24 = enablePerGuest24h && ratePerGuest24hPrice;
      const has12 = enablePerGuest12h && ratePerGuest12hPrice;
      if (!has24 && !has12) {
        toast.error("Enable at least one per guest variant (24h or 12h) and set its price.");
        return;
      }
      ratePlans.push({
        kind: "per_guest",
        enabled: true,
        price_24h: has24 ? Number(ratePerGuest24hPrice) : null,
        price_12h: has12 ? Number(ratePerGuest12hPrice) : null,
      });
    }

    if (!ratePlans.length) {
      toast.error("Enable at least one rate and set its price.");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedUrls: string[] = [];

      if (files && files.length > 0) {
        const filePayloads = await Promise.all(
          Array.from(files).map(
            (file) =>
              new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve({
                    name: file.name,
                    type: file.type || "image/jpeg",
                    data: String(reader.result ?? ""),
                  });
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsDataURL(file);
              }),
          ),
        );

        const uploadRes = await fetch(`/api/rooms/upload-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ files: filePayloads }),
        });

        const uploadText = await uploadRes.text();
        let uploadData: { urls?: string[]; error?: string } = {};
        try {
          uploadData = uploadText ? JSON.parse(uploadText) : {};
        } catch {
          uploadData = {};
        }

        if (!uploadRes.ok) {
          toast.error(uploadData.error || "Failed to upload room images.");
          setSubmitting(false);
          return;
        }

        uploadedUrls = Array.isArray(uploadData.urls) ? uploadData.urls : [];
      }

      const isEdit = Boolean(room?.id);
      const endpoint = isEdit ? `/api/rooms/${room!.id}` : `/api/rooms`;
      const method = isEdit ? "PATCH" : "POST";

      // Build payload
      const payload: Record<string, unknown> = {};
      const trimmedAmenities = amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const newImagesAll =
        uploadedUrls.length > 0 ? [...existingImages, ...uploadedUrls] : existingImages;

      const flattenedRates = {
        rate_24h_enabled: enable24h,
        rate_24h_price: enable24h && rate24Price ? Number(rate24Price) : null,
        rate_24h_early_checkin_fee: enable24h && rate24EarlyFee ? Number(rate24EarlyFee) : null,
        rate_24h_late_checkout_fee: enable24h && rate24LateFee ? Number(rate24LateFee) : null,

        rate_12h_enabled: enable12h,
        rate_12h_price: enable12h && rate12Price ? Number(rate12Price) : null,
        rate_12h_late_checkout_fee: enable12h && rate12LateFee ? Number(rate12LateFee) : null,

        rate_5h_enabled: enable5h,
        rate_5h_price: enable5h && rate5Price ? Number(rate5Price) : null,
        rate_5h_late_checkout_fee: enable5h && rate5LateFee ? Number(rate5LateFee) : null,

        rate_3h_enabled: enable3h,
        rate_3h_price: enable3h && rate3Price ? Number(rate3Price) : null,
        rate_3h_late_checkout_fee: enable3h && rate3LateFee ? Number(rate3LateFee) : null,
      };

      if (!isEdit) {
        payload.room_number = roomNumber;
        payload.room_type = roomType;
        payload.floor = floor ? Number(floor) : undefined;
        payload.capacity = capacity ? Number(capacity) : undefined;
        payload.amenities = trimmedAmenities;
        payload.image_urls = uploadedUrls;
        payload.rate_plans = ratePlans;
        Object.assign(payload, flattenedRates);
      } else {
        if (roomNumber !== room?.room_number) payload.room_number = roomNumber;
        if (roomType !== room?.room_type) payload.room_type = roomType;
        if ((floor ? Number(floor) : undefined) !== room?.floor) {
          payload.floor = floor ? Number(floor) : null;
        }
        if ((capacity ? Number(capacity) : undefined) !== room?.capacity) {
          payload.capacity = capacity ? Number(capacity) : null;
        }
        if (
          JSON.stringify(trimmedAmenities) !==
          JSON.stringify(Array.isArray(room?.amenities) ? room!.amenities : [])
        ) {
          payload.amenities = trimmedAmenities;
        }
        if (uploadedUrls.length > 0) {
          payload.image_urls = newImagesAll;
        }
        const initialPlansJson = JSON.stringify(existingPlans || []);
        const newPlansJson = JSON.stringify(ratePlans);
        if (initialPlansJson !== newPlansJson) {
          payload.rate_plans = ratePlans;
        }
        Object.assign(payload, flattenedRates);
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = undefined;
      }

      if (!res.ok) {
        const err = (data as { error?: string } | undefined)?.error;
        toast.error(err || "Failed to create room.");
        return;
      }

      toast.success("Room created successfully.");
      onSuccess(data);
      onClose();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = Boolean(room?.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="room-number">Room number</Label>
          <Input
            id="room-number"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="201"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="room-type">Room type</Label>
          <Input
            id="room-type"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            placeholder="Standard, Deluxe, Family..."
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="floor">Floor</Label>
          <Input
            id="floor"
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amenities">Amenities (comma separated)</Label>
        <Input
          id="amenities"
          value={amenities}
          onChange={(e) => setAmenities(e.target.value)}
          placeholder="WiFi, Aircon, TV"
        />
      </div>

      {/* Rates */}
      <div className="space-y-4 border-t pt-4">
        <p className="text-sm font-semibold">Rates</p>

        <div className="space-y-3 rounded-md border p-4 bg-slate-50/40">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={enable24h}
              onChange={(e) => setEnable24h(e.target.checked)}
            />
            Standard 24-hour rate (Check-in 2:00 PM, Checkout 12:00 NN)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
            <div className="space-y-1">
              <Label htmlFor="rate-24-price">Price (₱)</Label>
              <Input
                id="rate-24-price"
                type="number"
                min={0}
                step="0.01"
                value={rate24Price}
                onChange={(e) => setRate24Price(e.target.value)}
                placeholder="3000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rate-24-early">Early check-in fee (₱)</Label>
              <Input
                id="rate-24-early"
                type="number"
                min={0}
                step="0.01"
                value={rate24EarlyFee}
                onChange={(e) => setRate24EarlyFee(e.target.value)}
                placeholder="500"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rate-24-late">Late checkout fee (₱)</Label>
              <Input
                id="rate-24-late"
                type="number"
                min={0}
                step="0.01"
                value={rate24LateFee}
                onChange={(e) => setRate24LateFee(e.target.value)}
                placeholder="800"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-4 bg-slate-50/40">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={enable12h}
              onChange={(e) => setEnable12h(e.target.checked)}
            />
            12-hour rate (flexible check-in time)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <div className="space-y-1">
              <Label htmlFor="rate-12-price">Price (₱)</Label>
              <Input
                id="rate-12-price"
                type="number"
                min={0}
                step="0.01"
                value={rate12Price}
                onChange={(e) => setRate12Price(e.target.value)}
                placeholder="1800"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rate-12-late">Late checkout fee (₱)</Label>
              <Input
                id="rate-12-late"
                type="number"
                min={0}
                step="0.01"
                value={rate12LateFee}
                onChange={(e) => setRate12LateFee(e.target.value)}
                placeholder="600"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-4 bg-slate-50/40">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={enable5h}
              onChange={(e) => setEnable5h(e.target.checked)}
            />
            5-hour rate (flexible check-in time)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <div className="space-y-1">
              <Label htmlFor="rate-5-price">Price (₱)</Label>
              <Input
                id="rate-5-price"
                type="number"
                min={0}
                step="0.01"
                value={rate5Price}
                onChange={(e) => setRate5Price(e.target.value)}
                placeholder="1000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rate-5-late">Late checkout fee (₱)</Label>
              <Input
                id="rate-5-late"
                type="number"
                min={0}
                step="0.01"
                value={rate5LateFee}
                onChange={(e) => setRate5LateFee(e.target.value)}
                placeholder="400"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-4 bg-slate-50/40">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={enable3h}
              onChange={(e) => setEnable3h(e.target.checked)}
            />
            3-hour rate (flexible check-in time)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <div className="space-y-1">
              <Label htmlFor="rate-3-price">Price (₱)</Label>
              <Input
                id="rate-3-price"
                type="number"
                min={0}
                step="0.01"
                value={rate3Price}
                onChange={(e) => setRate3Price(e.target.value)}
                placeholder="700"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rate-3-late">Late checkout fee (₱)</Label>
              <Input
                id="rate-3-late"
                type="number"
                min={0}
                step="0.01"
                value={rate3LateFee}
                onChange={(e) => setRate3LateFee(e.target.value)}
                placeholder="300"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-4 bg-slate-50/40">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={enablePerGuest}
              onChange={(e) => setEnablePerGuest(e.target.checked)}
            />
            Per guest rate
          </label>
          <p className="text-xs text-slate-500">
            Charge a fixed amount per guest. Configure separate per-guest prices for 24-hour and 12-hour stays.
          </p>
          {enablePerGuest && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              <div className="space-y-2 rounded-md border border-dashed p-3 bg-white/40">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={enablePerGuest24h}
                    onChange={(e) => setEnablePerGuest24h(e.target.checked)}
                  />
                  24-hour per guest rate
                </label>
                <div className="space-y-1">
                  <Label htmlFor="rate-per-guest-24-price">Price per guest (₱)</Label>
                  <Input
                    id="rate-per-guest-24-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={ratePerGuest24hPrice}
                    onChange={(e) => setRatePerGuest24hPrice(e.target.value)}
                    placeholder="600"
                    disabled={!enablePerGuest24h}
                  />
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-dashed p-3 bg-white/40">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={enablePerGuest12h}
                    onChange={(e) => setEnablePerGuest12h(e.target.checked)}
                  />
                  12-hour per guest rate
                </label>
                <div className="space-y-1">
                  <Label htmlFor="rate-per-guest-12-price">Price per guest (₱)</Label>
                  <Input
                    id="rate-per-guest-12-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={ratePerGuest12hPrice}
                    onChange={(e) => setRatePerGuest12hPrice(e.target.value)}
                    placeholder="400"
                    disabled={!enablePerGuest12h}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="images">Room images</Label>
        <Input
          id="images"
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            const list = e.target.files;
            setFiles(list);
            if (list && list.length > 0) {
              const previews: string[] = [];
              Array.from(list).forEach((file) => {
                const url = URL.createObjectURL(file);
                previews.push(url);
              });
              setNewImagePreviews(previews);
            } else {
              setNewImagePreviews([]);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Upload one or more optimized images for this room.
        </p>
        {(existingImages.length > 0 || newImagePreviews.length > 0) && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {existingImages.map((src, idx) => (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                key={`existing-${idx}`}
                src={src}
                className="h-16 w-full rounded-md object-cover border border-slate-200 bg-slate-100"
              />
            ))}
            {newImagePreviews.map((src, idx) => (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                key={`new-${idx}`}
                src={src}
                className="h-16 w-full rounded-md object-cover border border-dashed border-[#07008A]/40 bg-slate-50"
              />
            ))}
          </div>
        )}
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Update room" : "Save room"}
        </Button>
      </DialogFooter>
    </form>
  );
}

