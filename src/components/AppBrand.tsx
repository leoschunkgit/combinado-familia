export function AppBrand({ className = "" }: { className?: string }) {
  return (
    <span className={`flex h-9 items-center md:h-10 ${className}`.trim()}>
      <img
        src="/logo-combinado-familia.svg"
        alt="Combinado Família"
        className="block h-9 w-auto shrink-0 object-contain md:h-10"
        draggable={false}
      />
    </span>
  );
}
