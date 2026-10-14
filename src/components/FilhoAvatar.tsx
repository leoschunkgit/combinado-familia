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
      className="h-[78%] w-[78%]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.2 11.2c.9-3.1 3.1-4.9 5.8-4.9 2.3 0 4.3 1.2 5.5 3.5l-1.8.4 1.5 1.7-1.8.4 1.2 1.7c-1.5-1.2-3.2-1.9-5.1-1.9-2 0-3.8.7-5.3 2.1l-.9-1.2 1.4-.8-1.2-1 .7-2Z"
        fill="currentColor"
      />
      <circle cx="16" cy="15.3" r="5.7" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M8.1 27c.9-4.3 3.8-6.8 7.9-6.8s7 2.5 7.9 6.8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BonecoMenina() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-[78%] w-[78%]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9.6 18.8V13c0-4.5 2.6-7.1 6.4-7.1s6.4 2.6 6.4 7.1v5.8c-1.4-.5-2.5-1.4-3.2-2.7-.8 1.5-1.9 2.4-3.2 2.4s-2.4-.9-3.2-2.4c-.7 1.3-1.8 2.2-3.2 2.7Z"
        fill="currentColor"
      />
      <circle cx="16" cy="14.7" r="5.4" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M8.1 27c.9-4.3 3.8-6.8 7.9-6.8s7 2.5 7.9 6.8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
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
