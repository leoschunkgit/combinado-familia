import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uiSpacing } from "@/lib/ui-spacing";
import { TarefaIcone } from "@/components/TarefaIcone";

export function Pick({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione",
  allLabel,
  required = false,
  disabled = false,
  taskIcons = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; status?: "andamento" | "finalizada" | "futura" | undefined }[];
  placeholder?: string;
  allLabel?: string;
  required?: boolean;
  disabled?: boolean;
  taskIcons?: boolean;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={uiSpacing.fieldStack}>
      <Label>{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          {taskIcons && selectedOption ? (
            <span className="flex min-w-0 items-center gap-2">
              <TarefaIcone nome={selectedOption.label} />
              <span className="min-w-0 truncate">{selectedOption.label}</span>
            </span>
          ) : taskIcons && value === "all" && allLabel ? (
            <span className="min-w-0 truncate">{allLabel}</span>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <span className="flex min-w-0 items-center gap-2">
                {o.status && <span className={`h-2 w-2 shrink-0 rounded-full ${o.status === "andamento" ? "bg-green-300" : o.status === "finalizada" ? "bg-red-300" : "bg-gray-300"}`} aria-hidden="true" />}
                {taskIcons && <TarefaIcone nome={o.label} />}
                <span className="min-w-0 truncate">{o.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
