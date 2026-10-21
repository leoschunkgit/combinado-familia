import { useState } from "react";
import { CheckCircle2, Gift, Loader2, PartyPopper, Sparkles, Star } from "lucide-react";
import { EmptyState } from "@/components/PageHeader";
import { FilhoAppPageHeader } from "@/components/FilhoAppPageHeader";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EstrelasFilho, RecompensaEstrelaFilho } from "@/lib/child-app-session";

const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(valor));

function Estrela({ className = "" }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={`h-4 w-4 fill-amber-400 text-amber-500 ${className}`}
    />
  );
}

export function FilhoEstrelasPage({
  estrelas,
  onConfirmarAproveitada,
}: {
  estrelas: EstrelasFilho;
  onConfirmarAproveitada: (idRecompensa: number) => Promise<void>;
}) {
  const recompensasOrdenadas = [...estrelas.recompensas].sort((a, b) => a.id - b.id);
  const recompensasAproveitadas = estrelas.resgates
    .filter((resgate) => resgate.status === "ENTREGUE" && resgate.entregue_em)
    .sort((a, b) => new Date(b.entregue_em ?? b.created_at).getTime() - new Date(a.entregue_em ?? a.created_at).getTime());
  const [recompensaConfirmacao, setRecompensaConfirmacao] = useState<RecompensaEstrelaFilho | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function confirmarAproveitada() {
    if (!recompensaConfirmacao || confirmando) return;

    setConfirmando(true);
    try {
      await onConfirmarAproveitada(recompensaConfirmacao.id);
      setRecompensaConfirmacao(null);
    } catch {
      // O fluxo pai já apresenta a mensagem de erro; mantém a confirmação aberta.
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div>
      <FilhoAppPageHeader
        title="Estrelas"
        description="Cada estrela mostra uma conquista sua."
        icon={<Star className="h-4.5 w-4.5" />}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35">
              <Estrela className="animate-subtle-shake h-9 w-9" />
            </span>

            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Saldo de estrelas</p>
              <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">
                {estrelas.total_conquistado}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Suas estrelas ficam acumuladas e mostram tudo o que você já conquistou.
              </p>
            </div>
          </div>
        </section>

        <div>
          <h2 className="text-base font-bold">Recompensas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Acompanhe seu progresso em todas as recompensas.
          </p>
        </div>

        <div className="space-y-3">
        {recompensasOrdenadas.map((recompensa) => {
          const conquistada = recompensa.disponivel || recompensa.pendente;
          const nomeExibido = recompensa.pendente && recompensa.conquista_nome
            ? recompensa.conquista_nome
            : recompensa.nome;
          const descricaoExibida = recompensa.pendente
            ? (recompensa.conquista_descricao ?? recompensa.descricao)
            : recompensa.descricao;
          const metaExibida = recompensa.pendente && recompensa.conquista_meta
            ? recompensa.conquista_meta
            : recompensa.estrelas_necessarias;
          const progressoExibido = conquistada
            ? metaExibida
            : Math.min(recompensa.progresso, metaExibida);
          const itemProgresso = Math.min(
            100,
            Math.max(0, (progressoExibido / metaExibida) * 100),
          );

          return (
            <article
              key={recompensa.id}
              className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border bg-amber-50 dark:bg-amber-950/35">
                  <Estrela className="h-8 w-8" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-bold leading-tight">
                        {nomeExibido}
                      </p>
                      {descricaoExibida && (
                        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                          {descricaoExibida}
                        </p>
                      )}
                    </div>

                  </div>

                  <div className="mt-2 min-h-[58px]">
                    {conquistada ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/35">
                        <div className="flex items-start gap-2">
                          <PartyPopper className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-700 dark:text-amber-300" />
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                              Parabéns! Você conseguiu!
                            </p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                              Quando aproveitar, confirme aqui para começar uma nova contagem.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2 h-8 w-full rounded-lg text-xs font-bold"
                          onClick={() => setRecompensaConfirmacao(recompensa)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Já aproveitei!
                        </Button>
                      </div>
                    ) : (
                      <div className="flex min-h-[58px] items-start pt-1">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Faltam {recompensa.faltam} estrela{recompensa.faltam === 1 ? "" : "s"} para conquistar
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 text-[11px] leading-none">
                      <span className="font-medium text-muted-foreground">Progresso</span>
                      <span className="font-semibold tabular-nums">
                        {progressoExibido} de {metaExibida}
                      </span>
                    </div>

                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${itemProgresso}%` }}
                      />
                    </div>
                  </div>

                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-muted-foreground/20 bg-background"
                    aria-label={conquistada ? "Meta conquistada" : "Meta"}
                  >
                    <Estrela className="h-3.5 w-3.5 opacity-60" />
                  </span>
                </div>

              </div>
            </article>
          );
        })}

          {estrelas.recompensas.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card p-5">
              <EmptyState>
                <span className="flex flex-col items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Nenhuma recompensa por enquanto.
                </span>
              </EmptyState>
            </div>
          )}
        </div>

        {recompensasAproveitadas.length > 0 && (
          <CollapsibleSection
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Já aproveitei
              </span>
            }
            description="Recompensas que já viraram bons momentos."
            count={recompensasAproveitadas.length}
            contentClassName="bg-muted/10 p-2.5 sm:p-3"
          >
            <div className="space-y-2.5">
              {recompensasAproveitadas.map((resgate) => (
                <article
                  key={resgate.id}
                  className="group rounded-xl border bg-background p-3 transition-transform duration-200 motion-safe:active:scale-[0.99] sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35">
                      <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-1.5 text-xs leading-relaxed">
                      <p className="min-w-0 break-words text-sm font-bold text-foreground">
                        {resgate.recompensa_nome}
                      </p>
                      <p className="text-muted-foreground">
                        Quantidade de estrelas atingidas para conquista:{" "}
                        <span className="font-semibold text-foreground tabular-nums">
                          {resgate.meta_estrelas_no_resgate}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Conquistou em:{" "}
                        <span className="font-semibold text-foreground">
                          {dataHora(resgate.created_at)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Aproveitou em:{" "}
                        <span className="font-semibold text-foreground">
                          {dataHora(resgate.entregue_em!)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        Contagem recomeçou em:{" "}
                        <span className="font-semibold text-foreground">
                          {dataHora(resgate.entregue_em!)}
                        </span>
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      <Dialog
        open={recompensaConfirmacao !== null}
        onOpenChange={(open) => {
          if (!open && !confirmando) setRecompensaConfirmacao(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Já aproveitou?</DialogTitle>
            <DialogDescription>
              {recompensaConfirmacao
                ? `Confirme que você já recebeu ou aproveitou “${recompensaConfirmacao.conquista_nome ?? recompensaConfirmacao.nome}”. Depois disso, uma nova contagem começa a partir das próximas estrelas.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRecompensaConfirmacao(null)}
              disabled={confirmando}
            >
              Ainda não
            </Button>
            <Button
              type="button"
              onClick={() => void confirmarAproveitada()}
              disabled={confirmando}
            >
              {confirmando
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
              Já aproveitei!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
