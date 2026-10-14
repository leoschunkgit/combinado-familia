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
        d="M10.3 10.8 12 7.9l2.1 1.2 2-2.3 1.9 2 2.4-1.1 1.2 3.1"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="15"
        r="6"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M8.3 27c1-4.3 3.9-6.7 7.7-6.7s6.7 2.4 7.7 6.7"
        stroke="currentColor"
        strokeWidth="2.6"
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
      <circle cx="8.2" cy="12.1" r="2.6" fill="currentColor" />
      <circle cx="23.8" cy="12.1" r="2.6" fill="currentColor" />
      <path
        d="M10.5 11.2c1.1-3 3.2-4.7 5.5-4.7s4.4 1.7 5.5 4.7"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle
        cx="16"
        cy="15"
        r="6"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M8.3 27c1-4.3 3.9-6.7 7.7-6.7s6.7 2.4 7.7 6.7"
        stroke="currentColor"
        strokeWidth="2.6"
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
