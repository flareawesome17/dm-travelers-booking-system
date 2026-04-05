"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarIcon, Percent, Tag } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DiscountFormProps {
  initialData?: any;
  onSuccess: (data: any) => void;
  onCancel: () => void;
}

export default function DiscountForm({ initialData, onSuccess, onCancel }: DiscountFormProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [type, setType] = useState<"percent" | "fixed">(initialData?.type ?? "percent");
  const [value, setValue] = useState(initialData?.value?.toString() ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialData?.start_date ? new Date(initialData.start_date) : new Date()
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    initialData?.end_date ? new Date(initialData.end_date) : undefined
  );
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [applyToRooms, setApplyToRooms] = useState(initialData?.apply_to_rooms ?? false);
  const [applyToRestaurant, setApplyToRestaurant] = useState(initialData?.apply_to_restaurant ?? false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        description,
        type,
        value: parseFloat(value),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        is_active: isActive,
        apply_to_rooms: applyToRooms,
        apply_to_restaurant: applyToRestaurant,
      };

      const url = initialData ? `/api/discounts/${initialData.id}` : "/api/discounts";
      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save discount");
      }

      const saved = await res.json();
      toast.success(initialData ? "Discount updated" : "Discount created");
      onSuccess(saved);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Discount Name</Label>
            <div className="relative">
              <Tag className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Special"
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal notes or public description..."
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Discount Type</Label>
            <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setType("percent")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                  type === "percent" ? "bg-white text-[#07008A] shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Percent className="h-3.5 w-3.5" />
                Percentage
              </button>
              <button
                type="button"
                onClick={() => setType("fixed")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                  type === "fixed" ? "bg-white text-[#07008A] shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <span className="font-bold">₱</span>
                Fixed Amount
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <div className="relative">
              <Input
                id="value"
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percent" ? "10" : "500"}
                className={cn("pl-3", type === "fixed" ? "pl-7" : "")}
                required
              />
              {type === "fixed" && (
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-500">₱</span>
              )}
              {type === "percent" && (
                <span className="absolute right-3 top-2.5 text-sm font-semibold text-slate-500">%</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  // Disable dates before start date
                  disabled={(date) => startDate ? date < startDate : false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Label>Apply To</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                applyToRooms
                  ? "border-[#07008A] bg-[#07008A]/[0.03] ring-1 ring-[#07008A]"
                  : "border-slate-100 bg-slate-50 hover:border-slate-200"
              )}
              onClick={() => setApplyToRooms(!applyToRooms)}
            >
              <div className={cn(
                "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                applyToRooms ? "bg-[#07008A] border-[#07008A]" : "bg-white border-slate-300"
              )}>
                {applyToRooms && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium">All Rooms</span>
            </div>

            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                applyToRestaurant
                  ? "border-[#07008A] bg-[#07008A]/[0.03] ring-1 ring-[#07008A]"
                  : "border-slate-100 bg-slate-50 hover:border-slate-200"
              )}
              onClick={() => setApplyToRestaurant(!applyToRestaurant)}
            >
              <div className={cn(
                "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                applyToRestaurant ? "bg-[#07008A] border-[#07008A]" : "bg-white border-slate-300"
              )}>
                {applyToRestaurant && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium">Restaurant Menu</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <input
            type="checkbox"
            id="is_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#07008A] focus:ring-[#07008A]"
          />
          <Label htmlFor="is_active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Activate this discount immediately
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-[#07008A] hover:bg-[#07008A]/90"
        >
          {loading ? "Saving..." : initialData ? "Update Discount" : "Create Discount"}
        </Button>
      </div>
    </form>
  );
}
