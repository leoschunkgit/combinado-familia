import { Gift, Star, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { EstrelasFilho } from "@/lib/child-app-session";

const dataHora = (valor: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));

function statusResgate(status: "PENDENTE" | "ENTREGUE" | "CANCELADO") {
  if (status === "PENDENTE") return "Pendente";
  if (status === "ENTREGUE") return "Entregue";
  return "Cancelado";
}

export function FilhoEstrelasPage({ estrelas }: { estrelas: EstrelasFilho }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Estrelas e recompensas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada “Fez” vale 1 estrela. As estrelas ficam acumuladas no seu saldo até serem usadas em uma recompensa.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card><CardContent className="pt-5 text-center"><Star className="mx-auto h-5 w-5 text-amber-500" /><p className="mt-1 text-2xl font-bold">{estrelas.hoje}</p><p className="text-xs text-muted-foreground">Hoje</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><Star className="mx-auto h-5 w-5 text-amber-500" /><p className="mt-1 text-2xl font-bold">{estrelas.vigencia_atual}</p><p className="text-xs text-muted-foreground">Nesta vigência</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><Gift className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-1 text-2xl font-bold">{estrelas.saldo}</p><p className="text-xs text-muted-foreground">Saldo disponível</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><Trophy className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-1 text-2xl font-bold">{estrelas.total_conquistado}</p><p className="text-xs text-muted-foreground">Total conquistado</p></CardContent></Card>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-3.5">
          <h2 className="text-base font-semibold">Recompensas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Acompanhe o seu progresso e veja quais recompensas já estão disponíveis.</p>
        </div>
        <div className="divide-y">
          {estrelas.recompensas.map((recompensa) => {
            const faltam = Math.max(0, recompensa.estrelas_necessarias - estrelas.saldo);
            const progresso = Math.min(100, Math.max(0, (estrelas.saldo / recompensa.estrelas_necessarias) * 100));

            return (
              <div key={recompensa.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{recompensa.nome}</p>
                    {recompensa.descricao && <p className="mt-0.5 break-words text-xs text-muted-foreground">{recompensa.descricao}</p>}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
                    <Star className="h-4 w-4 text-amber-500" />
                    {recompensa.estrelas_necessarias}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progresso}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{estrelas.saldo} de {recompensa.estrelas_necessarias} ⭐</span>
                  <span className={recompensa.disponivel ? "font-semibold text-green-700" : "text-muted-foreground"}>
                    {recompensa.disponivel ? "Disponível" : `Faltam ${faltam} ⭐`}
                  </span>
                </div>
              </div>
            );
          })}
          {estrelas.recompensas.length === 0 && (
            <p className="px-4 py-5 text-sm text-muted-foreground">Seu responsável ainda não cadastrou recompensas.</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-3.5">
          <h2 className="text-base font-semibold">Histórico de recompensas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Os resgates ficam registrados para você acompanhar o andamento.</p>
        </div>
        <div className="divide-y">
          {estrelas.resgates.map((resgate) => (
            <div key={resgate.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{resgate.recompensa_nome}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{dataHora(resgate.created_at)}</p>
                <p className="mt-1 text-xs font-medium">{statusResgate(resgate.status)}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
                <Star className="h-4 w-4 text-amber-500" />
                {resgate.estrelas_utilizadas}
              </span>
            </div>
          ))}
          {estrelas.resgates.length === 0 && (
            <p className="px-4 py-5 text-sm text-muted-foreground">Nenhuma recompensa resgatada ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
