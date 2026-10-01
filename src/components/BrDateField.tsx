import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function fromDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return undefined;
  const date = new Date(year, month - 1, day);
  return fromDate(date) === value ? date : undefined;
}

function brDate(value: string) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "DD/MM/AAAA";
}

export function BrDateField({ value, onChange, id, min, max }: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = min ? toDate(min) : undefined;
  const maxDate = max ? toDate(max) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="w-full justify-between font-normal tabular-nums" aria-label={`Escolher data, ${brDate(value)}`}>
          <span>{brDate(value)}</span><CalendarDays className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          defaultMonth={selected ?? minDate ?? new Date()}
          disabled={(date) => (minDate ? date < minDate : false) || (maxDate ? date > maxDate : false)}
          onSelect={(date) => { if (date) { onChange(fromDate(date)); setOpen(false); } }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function BrDateTimeField({ value, onChange, id }: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16) || "00:00";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <BrDateField id={id} value={date} onChange={(next) => onChange(`${next}T${time}`)} />
      <Input type="time" lang="pt-BR" aria-label="Hora" value={date ? time : ""} onChange={(e) => { if (date) onChange(`${date}T${e.target.value}`); }} />
    </div>
  );
}