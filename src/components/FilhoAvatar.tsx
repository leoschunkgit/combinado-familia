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
      className="h-[72%] w-[72%]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.4 12.1c.3-4 2.8-6.6 6.1-6.6 3.1 0 5.4 2 5.9 5.3-2.6-.2-4.8-1-6.6-2.5-1.3 1.8-3 3-5.4 3.8Z"
        fill="currentColor"
        opacity=".96"
      />
      <path
        d="M10.2 13.1c0 4.1 2.5 7.1 5.8 7.1s5.8-3 5.8-7.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8.2 27c.8-3.8 3.8-6.2 7.8-6.2s7 2.4 7.8 6.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M13.6 14.1h.1M18.3 14.1h.1"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M14.2 17.1c1.1.7 2.5.7 3.6 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BonecoMenina() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-[72%] w-[72%]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8.8 16.2c0-6.7 2.7-10.6 7.2-10.6s7.2 3.9 7.2 10.6v3.6c-1.2-.5-2.1-1.3-2.8-2.5-.9 1.8-2.4 2.9-4.4 2.9s-3.5-1.1-4.4-2.9c-.7 1.2-1.6 2-2.8 2.5v-3.6Z"
        fill="currentColor"
        opacity=".96"
      />
      <path
        d="M10.5 13.1c0 4.1 2.4 7.1 5.5 7.1s5.5-3 5.5-7.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8.1 27c.9-3.8 3.9-6.2 7.9-6.2s7 2.4 7.9 6.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M13.6 14.1h.1M18.3 14.1h.1"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M14.2 17.1c1.1.7 2.5.7 3.6 0"
        stroke="currentColor"
        strokeWidth="1.6"
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
