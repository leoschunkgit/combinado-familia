import { ThumbsDown } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { TarefaIcone } from "@/components/TarefaIcone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConsequenciaNaoFezTipo } from "@/lib/ocorrencia-service";

export type NaoFezDraft = {
  filhoNome: string;
  filhoCor?: string | null;
  filhoAvatar?: string | null;
  tarefaNome: string;
  data: string;
  quantidadeNaoFezAtual: number;
  temMesada: boolean;
  consequenciaTipo: ConsequenciaNaoFezTipo;
  descontoValor: string;
  penalidadeDescricao: string;
};

type NaoFezDialogProps = {
  open: boolean;
  value: NaoFezDraft | null;
  busy?: boolean;
  onChange: (value: NaoFezDraft) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function formatarData(data: string) {
  return data.split("-").reverse().join("/");
}

export function NaoFezDialog({
  open,
  value,
  busy = false,
  onChange,
  onCancel,
  onConfirm,
}: NaoFezDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar “Não fez”</DialogTitle>
          <DialogDescription>
            {value ? (
              <span className="grid min-w-0 grid-cols-[0.9fr_1.5fr_auto] divide-x overflow-hidden rounded-lg border">
                <span className="flex min-w-0 items-center gap-1.5 px-2.5 py-2">
                  <FilhoAvatar
                    nome={value.filhoNome}
                    cor={value.filhoCor}
                    avatar={
                      value.filhoAvatar === "menino" || value.filhoAvatar === "menina"
                        ? value.filhoAvatar
                        : null
                    }
                    className="h-4 w-4"
                  />
                  <span className="min-w-0">
                    <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Filho
                    </span>
                    <span className="block truncate text-xs font-medium text-foreground">
                      {value.filhoNome}
                    </span>
                  </span>
                </span>
                <span className="min-w-0 px-2.5 py-2">
                  <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tarefa
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <TarefaIcone nome={value.tarefaNome} className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate text-xs font-medium text-foreground">
                      {value.tarefaNome}
                    </span>
                  </span>
                </span>
                <span className="px-2.5 py-2">
                  <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Data
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap text-xs font-medium text-foreground">
                    {formatarData(value.data)}
                  </span>
                </span>
              </span>
            ) : (
              "Escolha a consequência deste registro."
            )}
          </DialogDescription>
        </DialogHeader>

        {value && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="text-muted-foreground">“Não fez” na vigência</span>
              <strong className="shrink-0 text-foreground">{value.quantidadeNaoFezAtual}</strong>
            </div>

            <div className="space-y-2">
              <Label>O que deseja fazer?</Label>
              <Select
                value={value.consequenciaTipo}
                onValueChange={(tipo) =>
                  onChange({
                    ...value,
                    consequenciaTipo: tipo as ConsequenciaNaoFezTipo,
                    descontoValor:
                      tipo === "DESCONTO" ? value.descontoValor : "",
                    penalidadeDescricao:
                      tipo === "PENALIDADE" ? value.penalidadeDescricao : "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUMA">Nada</SelectItem>
                  {value.temMesada && (
                    <SelectItem value="DESCONTO">Descontar da mesada</SelectItem>
                  )}
                  <SelectItem value="PENALIDADE">Aplicar penalidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {value.consequenciaTipo === "DESCONTO" && (
              <div className="space-y-2">
                <Label htmlFor="nao-fez-desconto">Valor do desconto</Label>
                <CurrencyInput
                  id="nao-fez-desconto"
                  value={value.descontoValor}
                  valueMode="decimal"
                  onValueChange={(descontoValor) =>
                    onChange({ ...value, descontoValor })
                  }
                />
              </div>
            )}

            {value.consequenciaTipo === "PENALIDADE" && (
              <div className="space-y-2">
                <Label htmlFor="nao-fez-penalidade">Penalidade</Label>
                <input
                  id="nao-fez-penalidade"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ex.: Sem videogame por 30 minutos"
                  maxLength={200}
                  value={value.penalidadeDescricao}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      penalidadeDescricao: event.target.value,
                    })
                  }
                />
              </div>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              O “Não fez” entra na contagem desta vigência. A consequência pertence somente a este registro.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button disabled={busy || !value} onClick={onConfirm}>
            <ThumbsDown className="h-4 w-4" />
            Salvar “Não fez”
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
