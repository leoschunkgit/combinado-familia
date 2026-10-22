import { BRAND_LOGO_URI } from "@/assets/brand-assets";

type AppBrandProps = {
  className?: string;
  inverse?: boolean;
};

export function AppBrand({ className = "", inverse = false }: AppBrandProps) {
  const imageClass = [
    "block h-11 w-auto max-w-none shrink-0 object-contain md:h-12",
    inverse ? "brightness-0 invert" : "dark:brightness-0 dark:invert",
  ].join(" ");

  return (
    <span className={`flex h-11 items-center md:h-12 ${className}`.trim()}>
      <img
        src={BRAND_LOGO_URI}
        alt="Combinado Família"
        className={imageClass}
        draggable={false}
      />
    </span>
  );
}
