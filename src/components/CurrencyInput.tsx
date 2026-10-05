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

function formatarReal(valor: string) {
  const digitos = somenteDigitos(valor);
  if (!digitos) return "";
  const centavos = Number(digitos);
  const inteiro = Math.floor(centavos / 100);
  const decimal = String(centavos % 100).padStart(2, "0");
  return `R$ ${inteiro.toLocaleString("pt-BR")},${decimal}`;
}

type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function CurrencyInput({
  value,
  onValueChange,
  className,
  placeholder = "R$ 0,00",
  ...props
}: CurrencyInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      className={cn("tabular-nums", className)}
      placeholder={placeholder}
      value={formatarReal(value)}
      onChange={(event) => {
        const digitos = somenteDigitos(event.target.value);
        onValueChange(valorCruPorCentavos(digitos));
      }}
    />
  );
}
