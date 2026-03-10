import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

type RoomFormProps = {
  apiUrl: string;
  token: string;
  onSuccess: (room: unknown) => void;
  onClose: () => void;
};

export function RoomForm({ apiUrl, token, onSuccess, onClose }: RoomFormProps) {
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [basePrice, setBasePrice] = useState("");
  const [amenities, setAmenities] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  // Rate plan state
  const [enable24h, setEnable24h] = useState(true);
  const [rate24Price, setRate24Price] = useState("");
  const [rate24EarlyFee, setRate24EarlyFee] = useState("");
  const [rate24LateFee, setRate24LateFee] = useState("");

  const [enable12h, setEnable12h] = useState(false);
  const [rate12Price, setRate12Price] = useState("");
  const [rate12LateFee, setRate12LateFee] = useState("");

  const [enable5h, setEnable5h] = useState(false);
  const [rate5Price, setRate5Price] = useState("");
  const [rate5LateFee, setRate5LateFee] = useState("");

  const [enable3h, setEnable3h] = useState(false);
  const [rate3Price, setRate3Price] = useState("");
  const [rate3LateFee, setRate3LateFee] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber || !roomType || !basePrice) {
      toast.error("Room number, type, and base price are required.");
      return;
    }

    // Build rate plans
    const ratePlans: Array<Record<string, unknown>> = [];

    if (enable24h) {
      const price = rate24Price || basePrice;
      if (!price) {
        toast.error("Please set a price for the 24-hour rate or the base price.");
        return;
      }
      ratePlans.push({
        kind: "24h",
        enabled: true,
        base_price: Number(price),
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

        const uploadRes = await fetch(`${apiUrl}/api/rooms/upload-image`, {
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

      const res = await fetch(`${apiUrl}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_number: roomNumber,
          room_type: roomType,
          floor: floor ? Number(floor) : undefined,
          capacity: capacity ? Number(capacity) : undefined,
          base_price_per_night: Number(basePrice),
          amenities: amenities
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          image_urls: uploadedUrls,
          rate_plans: ratePlans,
        }),
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
        <div className="space-y-2">
          <Label htmlFor="base-price">Base price / night (₱)</Label>
          <Input
            id="base-price"
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            required
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
                placeholder={basePrice || "3000"}
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
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="images">Room images</Label>
        <Input
          id="images"
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(e.target.files)}
        />
        <p className="text-xs text-muted-foreground">
          Upload one or more optimized images for this room.
        </p>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save room"}
        </Button>
      </DialogFooter>
    </form>
  );
}

