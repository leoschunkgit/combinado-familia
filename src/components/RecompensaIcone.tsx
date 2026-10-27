import {
  Crown,
  Film,
  Gamepad2,
  Gift,
  MapPin,
  Moon,
  Music,
  Pizza,
  ShoppingBag,
  Star,
  Sun,
  Tv,
  Utensils,
} from "lucide-react";
import {
  obterIconeRecompensaPorNome,
  type IconeSugestaoRecompensa,
} from "@/lib/recompensa-sugestoes";

export function RecompensaIcone({
  nome,
  icone,
  className = "",
}: {
  nome?: string | null;
  icone?: IconeSugestaoRecompensa | null;
  className?: string;
}) {
  const iconeResolvido = icone ?? (nome ? obterIconeRecompensaPorNome(nome) : null);
  const classes = `shrink-0 ${className}`;

  switch (iconeResolvido) {
    case "UTENSILS":
      return <Utensils aria-hidden="true" className={classes} />;
    case "PIZZA":
      return <Pizza aria-hidden="true" className={classes} />;
    case "FILM":
      return <Film aria-hidden="true" className={classes} />;
    case "GAMEPAD":
      return <Gamepad2 aria-hidden="true" className={classes} />;
    case "MOON":
      return <Moon aria-hidden="true" className={classes} />;
    case "SUN":
      return <Sun aria-hidden="true" className={classes} />;
    case "MAP_PIN":
      return <MapPin aria-hidden="true" className={classes} />;
    case "GIFT":
      return <Gift aria-hidden="true" className={classes} />;
    case "SHOPPING_BAG":
      return <ShoppingBag aria-hidden="true" className={classes} />;
    case "MUSIC":
      return <Music aria-hidden="true" className={classes} />;
    case "TV":
      return <Tv aria-hidden="true" className={classes} />;
    case "CROWN":
      return <Crown aria-hidden="true" className={classes} />;
    case "STAR":
      return <Star aria-hidden="true" className={classes} />;
    default:
      return <Gift aria-hidden="true" className={classes} />;
  }
}
