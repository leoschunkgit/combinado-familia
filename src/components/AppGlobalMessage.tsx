import { Megaphone } from "lucide-react";

export function AppGlobalMessage({
  ativa,
  mensagem,
  className = "",
}: {
  ativa: boolean;
  mensagem: string | null | undefined;
  className?: string;
}) {
  const texto = mensagem?.trim();
  if (!ativa || !texto) return null;

  return (
    <div className={`flex items-start gap-3 rounded-xl border bg-accent/40 p-3 text-sm ${className}`.trim()}>
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 break-words leading-relaxed">{texto}</p>
    </div>
  );
}
