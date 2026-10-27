import { Minus, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RecompensaRapidaItem = {
  chave: number;
  nome: string;
  estrelas: string;
};

export type RecompensaRapidaPayload = {
  nome: string;
  estrelas_necessarias: number;
};

export function criarRecompensasRapidasVazias(): RecompensaRapidaItem[] {
  return [{ chave: 1, nome: "", estrelas: "" }];
}

export function prepararRecompensasRapidas(
  itens: RecompensaRapidaItem[],
):
  | { ok: true; recompensas: RecompensaRapidaPayload[] }
  | { ok: false; mensagem: string } {
  const recompensas: RecompensaRapidaPayload[] = [];

  for (const item of itens) {
    const nome = item.nome.trim();
    const estrelasTexto = item.estrelas.trim();

    if (nome === "" && estrelasTexto === "") continue;

    if (nome.length < 2 || nome.length > 100) {
      return { ok: false, mensagem: "Informe uma recompensa entre 2 e 100 caracteres" };
    }

    if (!/^\d+$/.test(estrelasTexto)) {
      return { ok: false, mensagem: `Informe as estrelas necessárias para “${nome}”` };
    }

    const estrelas = Number(estrelasTexto);
    if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 100000) {
      return { ok: false, mensagem: "Informe uma quantidade válida de estrelas" };
    }

    recompensas.push({ nome, estrelas_necessarias: estrelas });
  }

  return { ok: true, recompensas };
}

export function RecompensasRapidas({
  value,
  onChange,
  prefix,
}: {
  value: RecompensaRapidaItem[];
  onChange: (value: RecompensaRapidaItem[]) => void;
  prefix: string;
}) {
  function atualizar(chave: number, campo: "nome" | "estrelas", novoValor: string) {
    onChange(value.map((item) => item.chave === chave ? { ...item, [campo]: novoValor } : item));
  }

  function adicionar() {
    const proximaChave = Math.max(0, ...value.map((item) => item.chave)) + 1;
    onChange([...value, { chave: proximaChave, nome: "", estrelas: "" }]);
  }

  function remover(chave: number) {
    const restantes = value.filter((item) => item.chave !== chave);
    onChange(restantes.length > 0 ? restantes : criarRecompensasRapidasVazias());
  }

  return (
    <div className="space-y-2">
      <Label>Recompensas <span className="font-normal text-muted-foreground">(opcional)</span></Label>

      <div className="space-y-2">
        {value.map((item, index) => {
          const ultima = index === value.length - 1;

          return (
            <div key={item.chave} className="flex min-w-0 items-center gap-2">
              <Input
                id={`${prefix}-recompensa-${item.chave}`}
                value={item.nome}
                onChange={(evento) => atualizar(item.chave, "nome", evento.target.value)}
                maxLength={100}
                placeholder="Ex.: Ir ao cinema"
                className="min-w-0 flex-1"
                aria-label="Recompensa"
              />

              <div className="relative w-20 shrink-0">
                <Input
                  id={`${prefix}-recompensa-estrelas-${item.chave}`}
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  inputMode="numeric"
                  value={item.estrelas}
                  onChange={(evento) => atualizar(item.chave, "estrelas", evento.target.value)}
                  className="pr-7 text-center"
                  aria-label="Estrelas necessárias"
                />
                <Star
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 fill-amber-400 text-amber-500"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={ultima ? adicionar : () => remover(item.chave)}
                aria-label={ultima ? "Adicionar recompensa" : "Remover recompensa"}
                title={ultima ? "Adicionar recompensa" : "Remover recompensa"}
              >
                {ultima ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
