import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { msgErro } from "@/lib/app-error";
import { obterIdentificacaoApp } from "@/lib/app-telemetry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FeedbackTipo = "SUGESTAO" | "PROBLEMA" | "DUVIDA" | "ELOGIO";

export function FeedbackDialog({
  open,
  onOpenChange,
  paginaOrigem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paginaOrigem: string;
}) {
  const [tipo, setTipo] = useState<FeedbackTipo>("SUGESTAO");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  function limpar() {
    setTipo("SUGESTAO");
    setAssunto("");
    setMensagem("");
  }

  async function enviar() {
    const assuntoLimpo = assunto.trim();
    const mensagemLimpa = mensagem.trim();

    if (assuntoLimpo.length < 3) {
      toast.error("Informe um assunto para o feedback.");
      return;
    }

    if (mensagemLimpa.length < 3) {
      toast.error("Escreva sua mensagem antes de enviar.");
      return;
    }

    setEnviando(true);

    try {
      const identificacao = await obterIdentificacaoApp();
      const { error } = await supabase.rpc("enviar_feedback", {
        p_tipo: tipo,
        p_assunto: assuntoLimpo,
        p_mensagem: mensagemLimpa,
        p_plataforma: identificacao.plataforma,
        p_version_name: identificacao.versionName,
        p_version_code: identificacao.versionCode,
        p_pagina_origem: paginaOrigem || null,
      });

      if (error) throw error;

      limpar();
      onOpenChange(false);
      toast.success("Feedback recebido. Obrigado por contribuir com o Combinado Família.");
    } catch (error) {
      toast.error(msgErro(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(novoOpen) => {
        if (!enviando) onOpenChange(novoOpen);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-primary" />
            Feedback
          </DialogTitle>
          <DialogDescription>
            Compartilhe sua opinião para ajudar a melhorar o Combinado Família.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(value) => setTipo(value as FeedbackTipo)}>
              <SelectTrigger id="feedback-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUGESTAO">Sugestão</SelectItem>
                <SelectItem value="PROBLEMA">Problema</SelectItem>
                <SelectItem value="DUVIDA">Dúvida</SelectItem>
                <SelectItem value="ELOGIO">Elogio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-assunto">Assunto</Label>
            <Input
              id="feedback-assunto"
              maxLength={120}
              value={assunto}
              onChange={(event) => setAssunto(event.target.value)}
              placeholder="Resuma seu feedback"
              disabled={enviando}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="feedback-mensagem">Mensagem</Label>
              <span className="text-[11px] text-muted-foreground">{mensagem.length}/2000</span>
            </div>
            <Textarea
              id="feedback-mensagem"
              className="min-h-32"
              maxLength={2000}
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              placeholder="Conte o que você achou ou o que poderia melhorar."
              disabled={enviando}
            />
          </div>

          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            Não envie senhas ou informações sensíveis. O feedback é registrado junto ao seu usuário, plataforma, versão do aplicativo e tela de origem.
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => void enviar()} disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar feedback"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
