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
    <svg
      viewBox="0 0 32 32"
      className="h-[74%] w-[74%]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.1 11.2c.7-3.9 3-6.1 6.1-6.1 2.7 0 4.9 1.6 5.7 4.7-2.6.1-4.8-.7-6.7-2.2-1.2 1.6-2.9 2.8-5.1 3.6Z" />
      <circle cx="16" cy="14.2" r="5.5" />
      <path d="M7.6 27.2c.8-4.6 4.1-7.3 8.4-7.3s7.6 2.7 8.4 7.3H7.6Z" />
    </svg>
  );
}

function BonecoMenina() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-[74%] w-[74%]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8.7 16.3c0-6.8 2.8-10.8 7.3-10.8s7.3 4 7.3 10.8v3.2c-1.5-.6-2.5-1.5-3.2-2.8-.9 1.8-2.3 2.8-4.1 2.8s-3.2-1-4.1-2.8c-.7 1.3-1.7 2.2-3.2 2.8v-3.2Z" />
      <circle cx="16" cy="14.2" r="5.3" />
      <path d="M7.6 27.2c.8-4.6 4.1-7.3 8.4-7.3s7.6 2.7 8.4 7.3H7.6Z" />
      <circle cx="23.7" cy="8.2" r="1.8" />
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
        <span className="text-[0.72em] font-bold leading-none tracking-tight">
          {iniciaisDoNome(nome)}
        </span>
      )}
    </span>
  );
}
