import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ClonarVigenciaDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clonar vigência</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground">
            Serão copiadas todas as informações da última vigência, incluindo os filhos vinculados às tarefas, para a nova vigência.
            Você poderá editar essa nova vigência depois pelo menu <strong>Vigências</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Os registros de Fez/Não fez, bonificações, penalidades atingidas e contadores não serão copiados.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirm}>
              <Copy className="h-4 w-4" /> Confirmar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
