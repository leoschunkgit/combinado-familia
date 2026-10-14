type FilhoAvatarTipo = "menino" | "menina" | null;

export type { FilhoAvatarTipo };

function iniciaisDoNome(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0] + partes[partes.length - 1]![0]).toUpperCase();
}

function BonecoMenino() {
  return (
    <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" fill="none" aria-hidden="true">
      <path d="M10.3 12.4c.7-4.2 3.4-6.4 6.1-6.4 2.8 0 5.2 1.8 5.9 5.4-2.8-.1-5.3-1-7.4-2.7-1.1 1.7-2.6 2.9-4.6 3.7Z" fill="currentColor" />
      <circle cx="16" cy="14.5" r="6.1" stroke="currentColor" strokeWidth="2" />
      <path d="M7.8 27c1.1-4.6 4.1-7 8.2-7s7.1 2.4 8.2 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13.3 14.4h.1M18.6 14.4h.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13.6 17.2c1.5 1 3.3 1 4.8 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BonecoMenina() {
  return (
    <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" fill="none" aria-hidden="true">
      <path d="M9.2 15.1c0-6.2 2.6-9.2 6.8-9.2s6.8 3 6.8 9.2v4.2c-1.2-.7-2-1.7-2.5-3-1.2 2-2.7 3.1-4.3 3.1s-3.1-1.1-4.3-3.1c-.5 1.3-1.3 2.3-2.5 3v-4.2Z" fill="currentColor" />
      <circle cx="16" cy="14.3" r="5.6" stroke="currentColor" strokeWidth="2" />
      <path d="M7.8 27c1.1-4.6 4.1-7 8.2-7s7.1 2.4 8.2 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13.3 14.2h.1M18.6 14.2h.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13.6 17.1c1.5 1 3.3 1 4.8 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function FilhoAvatar({
  nome,
  cor,
  avatar,
  className = "",
}: {
  nome: string;
  cor?: string | null;
  avatar?: FilhoAvatarTipo;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 text-white shadow-sm ${className}`}
      style={{ backgroundColor: cor?.trim() || "var(--primary)" }}
      title={nome}
    >
      {avatar === "menino" ? (
        <BonecoMenino />
      ) : avatar === "menina" ? (
        <BonecoMenina />
      ) : (
        <span className="text-[0.72em] font-bold leading-none tracking-tight">{iniciaisDoNome(nome)}</span>
      )}
    </span>
  );
}
