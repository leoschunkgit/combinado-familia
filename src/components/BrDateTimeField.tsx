import { Input } from "@/components/ui/input";

export function BrDateTimeField({
  value,
  onChange,
  id,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  min?: string;
  max?: string;
}) {
  return (
    <Input
      id={id}
      type="datetime-local"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="tabular-nums"
    />
  );
}
