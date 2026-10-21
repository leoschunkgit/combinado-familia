type AppBrandProps = {
  className?: string;
  inverse?: boolean;
};

export function AppBrand({ className = "", inverse = false }: AppBrandProps) {
  const imageClass = [
    "block h-10 w-auto max-w-none shrink-0 object-contain md:h-11",
    inverse ? "brightness-0 invert" : "dark:brightness-0 dark:invert",
  ].join(" ");

  return (
    <span className={`flex h-10 items-center md:h-11 ${className}`.trim()}>
      <img
        src="/logo-combinado-familia.svg"
        alt="Combinado Família"
        className={imageClass}
        draggable={false}
      />
    </span>
  );
}
