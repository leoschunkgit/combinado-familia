export function AppBrand({ className = "" }: { className?: string }) {
  return (
    <span className={`flex h-11 items-center md:h-12 ${className}`.trim()}>
      <img
        src="/logo-combinado-familia.svg"
        alt="Combinado Família"
        className="block h-11 w-auto shrink-0 object-contain md:h-12"
        draggable={false}
      />
    </span>
  );
}
