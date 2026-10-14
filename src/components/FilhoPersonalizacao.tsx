import { FilhoAvatar } from "@/components/FilhoAvatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FilhoAvatarOpcao = "" | "menino" | "menina";

export function corFilhoValida(valor: string) {
  const cor = valor.trim();
  if (cor === "") return true;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(cor)) return true;
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(cor);
  return Boolean(rgb && rgb.slice(1).every((parte) => Number(parte) >= 0 && Number(parte) <= 255));
}

export function FilhoPersonalizacao({
  nome,
  cor,
  avatar,
  onCorChange,
  onAvatarChange,
  prefix,
}: {
  nome: string;
  cor: string;
  avatar: FilhoAvatarOpcao;
  onCorChange: (cor: string) => void;
  onAvatarChange: (avatar: FilhoAvatarOpcao) => void;
  prefix: string;
}) {
  const corPicker = /^#[0-9a-f]{6}$/i.test(cor.trim()) ? cor.trim() : "#0C5C3C";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Avatar <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <div className="flex flex-wrap gap-1.5">
          {([
            { valor: "" as const, label: "Iniciais" },
            { valor: "menino" as const, label: "Menino" },
            { valor: "menina" as const, label: "Menina" },
          ]).map((opcao) => (
            <button
              key={opcao.label}
              type="button"
              aria-pressed={avatar === opcao.valor}
              onClick={() => onAvatarChange(opcao.valor)}
              className={`flex h-9 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors ${
                avatar === opcao.valor ? "border-primary bg-primary/5 text-primary" : "bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <FilhoAvatar nome={nome || "Filho"} cor={cor || null} avatar={opcao.valor || null} className="h-6 w-6" />
              <span>{opcao.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-cor-texto`}>Cor <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <div className="flex items-center gap-2">
          <input
            id={`${prefix}-cor`}
            type="color"
            value={corPicker}
            onChange={(event) => onCorChange(event.target.value)}
            className="h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-background p-1"
            aria-label="Escolher cor do filho"
          />
          <Input
            id={`${prefix}-cor-texto`}
            value={cor}
            onChange={(event) => onCorChange(event.target.value)}
            placeholder="#0C5C3C ou rgb(12, 92, 60)"
            maxLength={50}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}
