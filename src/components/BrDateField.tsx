import { BrDatePicker } from "@/components/BrDatePicker";

export function BrDateField({ value, onChange, id, min, max }: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  min?: string;
  max?: string;
}) {
  return (
    <BrDatePicker
      mode="date"
      value={value}
      onChange={onChange}
      id={id}
      {...(min ? { min } : {})}
      {...(max ? { max } : {})}
    />
  );
}
