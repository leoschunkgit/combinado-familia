import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Pick({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione",
  allLabel,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; status?: "andamento" | "finalizada" }[];
  placeholder?: string;
  allLabel?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <span className="flex items-center gap-2">
                {o.status && <span className={`h-2 w-2 shrink-0 rounded-full ${o.status === "andamento" ? "bg-green-500" : "bg-red-500"}`} aria-hidden="true" />}
                <span>{o.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
