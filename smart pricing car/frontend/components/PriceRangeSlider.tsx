"use client";

interface PriceRangeSliderProps {
  min: number;
  max: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}

export function PriceRangeSlider({ min, max, onMinChange, onMaxChange }: PriceRangeSliderProps) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Minimum Price</label>
        <input type="range" min={10} max={1000} value={min} onChange={(e) => onMinChange(Number(e.target.value))} className="w-full" />
        <p className="mt-1 text-sm text-slate-700">{min}</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Maximum Price</label>
        <input type="range" min={50} max={2000} value={max} onChange={(e) => onMaxChange(Number(e.target.value))} className="w-full" />
        <p className="mt-1 text-sm text-slate-700">{max}</p>
      </div>
    </div>
  );
}
