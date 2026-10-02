import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const displayFromValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : "";
};

const maskDateTime = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  let result = digits.slice(0, 2);
  if (digits.length > 2) result += "/" + digits.slice(2, 4);
  if (digits.length > 4) result += "/" + digits.slice(4, 8);
  if (digits.length > 8) result += " " + digits.slice(8, 10);
  if (digits.length > 10) result += ":" + digits.slice(10, 12);
  return result;
};

const toInternalValue = (display: string) => {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return "";

  const [, day, month, year, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  const valid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hour) &&
    date.getMinutes() === Number(minute);

  return valid ? `${year}-${month}-${day}T${hour}:${minute}` : "";
};

export function BrDateTimeField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  min?: string;
  max?: string;
}) {
  const [displayValue, setDisplayValue] = useState(() => displayFromValue(value));

  useEffect(() => {
    setDisplayValue(displayFromValue(value));
  }, [value]);

  const handleChange = (nextValue: string) => {
    const masked = maskDateTime(nextValue);
    setDisplayValue(masked);

    if (!masked) {
      onChange("");
      return;
    }

    if (masked.length === 16) {
      const internalValue = toInternalValue(masked);
      if (internalValue) onChange(internalValue);
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="DD/MM/AAAA HH:MM"
        inputMode="numeric"
        autoComplete="off"
        className="pr-11 tabular-nums"
        aria-label="Data e hora no formato DD/MM/AAAA HH:MM"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 -translate-y-1/2"
        aria-label="Abrir calendário"
        title="Escolher data e hora"
        onClick={openPicker}
      >
        <CalendarDays className="h-4 w-4" />
      </Button>
      <input
        ref={pickerRef}
        type="datetime-local"
        value={value}
        min={""}
        max={""}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );
}
