import { FilhoAvatar } from "@/components/FilhoAvatar";
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <div className="min-w-0 space-y-1.5">
        <Label>Avatar</Label>
        <div className="flex flex-wrap gap-1">
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
              className={`flex h-8 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium transition-colors ${
                avatar === opcao.valor ? "border-primary bg-primary/5 text-primary" : "bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <FilhoAvatar nome={nome || "Filho"} cor={cor || null} avatar={opcao.valor || null} className="h-5 w-5" />
              <span>{opcao.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pl-1">
        <Label htmlFor={`${prefix}-cor`} className="shrink-0">Cor</Label>
        <input
          id={`${prefix}-cor`}
          type="color"
          value={corPicker}
          onChange={(event) => onCorChange(event.target.value)}
          className="h-8 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0"
          aria-label="Escolher cor do filho"
        />
      </div>
    </div>
  );
}
