import { CheckCircle2, Gift, RefreshCcw, Sparkles, Star, Trophy } from "lucide-react";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { InfoTile } from "@/components/InfoTile";
import type { CicloRecompensaResumo } from "@/lib/estrelas-model";

const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(valor));

export function RecompensasAproveitadasSection({
  resgates,
}: {
  resgates: CicloRecompensaResumo[];
}) {
  const aproveitadas = resgates
    .filter((resgate) => resgate.status === "ENTREGUE" && resgate.aproveitou_em)
    .sort((a, b) =>
      new Date(b.aproveitou_em ?? b.conquistou_em).getTime()
      - new Date(a.aproveitou_em ?? a.conquistou_em).getTime()
    );

  if (aproveitadas.length === 0) return null;

  return (
    <CollapsibleSection
      className="border-0 bg-clean-surface"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Já aproveitei
        </span>
      }
      description="Recompensas que já viraram bons momentos."
      count={aproveitadas.length}
      contentClassName="bg-clean-surface p-2.5 sm:p-3"
    >
      <div className="space-y-2.5">
        {aproveitadas.map((resgate) => (
          <article key={resgate.id} className="rounded-xl bg-clean-surface p-2.5 sm:p-3">
            <div className="space-y-1.5">
              <div className="flex min-w-0 items-center gap-2 px-2.5 py-1.5">
                <Gift className="h-4 w-4 shrink-0 text-primary" />
                <p className="min-w-0 break-words text-sm font-bold leading-tight sm:text-base">
                  {resgate.nome_exibicao}
                </p>
              </div>
              <InfoTile
                compact
                inline
                label="Quantidade de estrelas atingidas para conquista"
                icon={<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                value={resgate.quantidade_estrelas_conquista}
                className="border-0 bg-clean-surface"
                valueClassName="font-semibold tabular-nums"
              />
              <InfoTile
                compact
                inline
                label="Conquistou em"
                icon={<Trophy className="h-3.5 w-3.5" />}
                value={dataHora(resgate.conquistou_em)}
                className="border-0 bg-clean-surface"
                valueClassName="font-semibold tabular-nums"
              />
              <InfoTile
                compact
                inline
                label="Aproveitou em"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                value={dataHora(resgate.aproveitou_em!)}
                className="border-0 bg-clean-surface"
                valueClassName="font-semibold tabular-nums"
              />
              <InfoTile
                compact
                inline
                label="Contagem recomeçou em"
                icon={<RefreshCcw className="h-3.5 w-3.5" />}
                value={dataHora(resgate.contagem_recomecou_em!)}
                className="border-0 bg-clean-surface"
                valueClassName="font-semibold tabular-nums"
              />
            </div>
          </article>
        ))}
      </div>
    </CollapsibleSection>
  );
}
