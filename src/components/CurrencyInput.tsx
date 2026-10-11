import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function valorCruPorCentavos(digitos: string) {
  if (!digitos) return "";
  const centavos = Number(digitos);
  const inteiro = Math.floor(centavos / 100);
  const decimal = String(centavos % 100).padStart(2, "0");
  return `${inteiro},${decimal}`;
}

function formatarRealPorCentavos(valor: string) {
  const digitos = somenteDigitos(valor);
  if (!digitos) return "";
  const centavos = Number(digitos);
  const inteiro = Math.floor(centavos / 100);
  const decimal = String(centavos % 100).padStart(2, "0");
  return `R$ ${inteiro.toLocaleString("pt-BR")},${decimal}`;
}

function formatarRealDecimal(valor: string) {
  if (!valor.trim()) return "";
  const numero = Number(valor.replace(",", "."));
  if (!Number.isFinite(numero)) return "";
  const centavos = Math.round(numero * 100);
  const inteiro = Math.floor(centavos / 100);
  const decimal = String(Math.abs(centavos % 100)).padStart(2, "0");
  return `R$ ${inteiro.toLocaleString("pt-BR")},${decimal}`;
}

type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
  valueMode?: "centavos" | "decimal";
};

export function CurrencyInput({
  value,
  onValueChange,
  className,
  placeholder = "R$ 0,00",
  valueMode = "centavos",
  ...props
}: CurrencyInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      className={cn("tabular-nums", className)}
      placeholder={placeholder}
      value={
        valueMode === "decimal"
          ? formatarRealDecimal(value)
          : formatarRealPorCentavos(value)
      }
      onChange={(event) => {
        const digitos = somenteDigitos(event.target.value);
        onValueChange(valorCruPorCentavos(digitos));
      }}
    />
  );
}
