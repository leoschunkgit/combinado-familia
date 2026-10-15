import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uiSpacing } from "@/lib/ui-spacing";
import { TarefaIcone } from "@/components/TarefaIcone";
import { FilhoAvatar } from "@/components/FilhoAvatar";

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
  childIcons = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: {
    value: string;
    label: string;
    status?: "andamento" | "finalizada" | "futura" | undefined;
    cor?: string | null;
    avatar?: "menino" | "menina" | null;
  }[];
  placeholder?: string;
  allLabel?: string;
  required?: boolean;
  disabled?: boolean;
  taskIcons?: boolean;
  childIcons?: boolean;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={uiSpacing.fieldStack}>
      <Label>{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          {childIcons && selectedOption ? (
            <span className="flex min-w-0 items-center gap-2">
              <FilhoAvatar
                nome={selectedOption.label}
                cor={selectedOption.cor}
                avatar={selectedOption.avatar ?? null}
                className="h-5 w-5"
              />
              <span className="min-w-0 truncate">{selectedOption.label}</span>
            </span>
          ) : taskIcons && selectedOption ? (
            <span className="flex min-w-0 items-center gap-2">
              <TarefaIcone nome={selectedOption.label} />
              <span className="min-w-0 truncate">{selectedOption.label}</span>
            </span>
          ) : (taskIcons || childIcons) && value === "all" && allLabel ? (
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
                {childIcons && (
                  <FilhoAvatar
                    nome={o.label}
                    cor={o.cor}
                    avatar={o.avatar ?? null}
                    className="h-5 w-5"
                  />
                )}
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
