import { useMemo, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type BrDatePickerMode = "date" | "datetime";

type Props = {
  mode: BrDatePickerMode;
  value: string;
  onChange: (value: string) => void;
  id: string;
  min?: string;
  max?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

function parseDatePart(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return undefined;
  return date;
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeValue(value?: string) {
  const match = value?.match(/T(\d{2}):(\d{2})$/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function displayValue(mode: BrDatePickerMode, value: string) {
  const date = parseDatePart(value);
  if (!date) return mode === "date" ? "DD/MM/AAAA" : "DD/MM/AAAA HH:MM";
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  if (mode === "date") return formatted;
  const time = timeValue(value);
  return time ? `${formatted} ${time}` : `${formatted} --:--`;
}

function sameDay(a?: Date, b?: Date) {
  return Boolean(
    a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate(),
  );
}

export function BrDatePicker({
  mode,
  value,
  onChange,
  id,
  min,
  max,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseDatePart(value);
  const minDate = parseDatePart(min);
  const maxDate = parseDatePart(max);
  const currentTime = timeValue(value);

  const boundaryTimes = useMemo(() => {
    if (mode !== "datetime") return {};
    return {
      minTime: sameDay(selected, minDate) ? timeValue(min) || undefined : undefined,
      maxTime: sameDay(selected, maxDate) ? timeValue(max) || undefined : undefined,
    };
  }, [mode, selected?.getTime(), minDate?.getTime(), maxDate?.getTime(), min, max]);

  const applyDate = (date: Date) => {
    const nextDate = dateValue(date);
    if (mode === "date") {
      onChange(nextDate);
      setOpen(false);
      return;
    }

    let time = currentTime || "00:00";
    if (sameDay(date, minDate) && boundaryTimes.minTime && time < boundaryTimes.minTime) {
      time = boundaryTimes.minTime;
    }
    if (sameDay(date, maxDate) && boundaryTimes.maxTime && time > boundaryTimes.maxTime) {
      time = boundaryTimes.maxTime;
    }
    onChange(`${nextDate}T${time}`);
  };

  const applyTime = (time: string) => {
    if (!selected || !time) return;
    onChange(`${dateValue(selected)}T${time}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal tabular-nums"
          aria-label={mode === "date" ? `Escolher data, ${displayValue(mode, value)}` : `Escolher data e hora, ${displayValue(mode, value)}`}
        >
          <span className="truncate">{displayValue(mode, value)}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          defaultMonth={selected ?? minDate ?? new Date()}
          disabled={(date) =>
            (minDate ? date < minDate : false) ||
            (maxDate ? date > maxDate : false)
          }
          onSelect={(date) => {
            if (date) applyDate(date);
          }}
        />

        {mode === "datetime" && (
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                type="time"
                value={currentTime}
                min={boundaryTimes.minTime}
                max={boundaryTimes.maxTime}
                disabled={!selected}
                onChange={(event) => applyTime(event.target.value)}
                className="tabular-nums"
                aria-label="Horário"
              />
              <Button
                type="button"
                size="sm"
                disabled={!selected || !currentTime}
                onClick={() => setOpen(false)}
              >
                OK
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
