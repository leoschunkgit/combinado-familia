import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type PenalidadeDialogProps = {
  open: boolean;
  value: string;
  busy?: boolean;
  inputId: string;
  contexto?: ReactNode;
  limite?: number | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PenalidadeDialog({
  open,
  value,
  busy = false,
  inputId,
  contexto,
  limite,
  onChange,
  onCancel,
  onConfirm,
}: PenalidadeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(novoEstado) => !novoEstado && !busy && onCancel()}>
      <DialogContent className="top-[calc(env(safe-area-inset-top)+1rem)] translate-y-0 sm:top-1/2 sm:-translate-y-1/2 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar penalidade</DialogTitle>
          <DialogDescription className="space-y-2">
            {contexto && <span className="flex min-w-0 max-w-full items-start whitespace-normal break-words">{contexto}</span>}
            <span className="block">
              Atingiu o número máximo de “Não fez” cadastrado nesta vigência{limite != null ? ` (${limite})` : ""}.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={inputId}>Penalidade à aplicar *</Label>
          <input
            id={inputId}
            autoFocus
            maxLength={200}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Ex.: Sem celular por 30 minutos"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Obrigatória para registrar o “Não fez” que atingiu o limite.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={busy || value.trim().length < 2}
            onClick={onConfirm}
          >
            <AlertTriangle className="h-4 w-4" /> Salvar penalidade e “Não fez”
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
