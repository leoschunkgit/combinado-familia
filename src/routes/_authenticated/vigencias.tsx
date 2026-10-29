import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarRange, CircleStop, Copy, EllipsisVertical, FileDown, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClonarVigenciaDialog } from "@/components/ClonarVigenciaDialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { BrDateTimeField } from "@/components/BrDateTimeField";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";
import { fmtVigencia, msgErro, paraCampoDataHoraBrasil, paraIsoDataHoraBrasil, useFilhos, useFilhoTarefas, useFilhoVigenciaMesadas, useOcorrencias, useTarefas, useVigencias, type Vigencia } from "@/lib/db";
import { useActionLoading } from "@/components/ActionLoading";
import { clonarUltimaVigencia, obterUltimaVigencia } from "@/lib/clonar-vigencia";
import { excluirVigenciaComRegra } from "@/lib/excluir-vigencia";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { calcularPeriodoPorDias, diasDaVigencia, sugerirInicioVigencia, type PeriodoVigenciaModo } from "@/lib/vigencia-periodo";
import { extrairPdfVigencia, podeExtrairPdfVigencia } from "@/lib/vigencia-relatorio-pdf";
import { MENSAGEM_VIGENCIA_AUTOMATICA_GERENCIAMENTO, useVigenciaAutomatica } from "@/lib/vigencia-automatica";

export const Route = createFileRoute("/_authenticated/vigencias")({
  head: () => ({ meta: [
    { title: "Vigências — Combinado" },
    { name: "description", content: "Defina os períodos dos combinados da família." },
    { property: "og:title", content: "Vigências — Combinado" },
    { property: "og:description", content: "Defina os períodos dos combinados da família." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VigenciasPage,
});

const schema = z.object({
  data_inicio: z.string().min(1, "Informe a data de início"),
  data_fim: z.string().min(1, "Informe a data de fim"),
})
.refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.data_inicio) && !Number.isNaN(new Date(v.data_inicio).getTime()), { message: "Informe uma data e hora de início válidas", path: ["data_inicio"] })
.refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.data_fim) && !Number.isNaN(new Date(v.data_fim).getTime()), { message: "Informe uma data e hora de fim válidas", path: ["data_fim"] })
.refine((v) => new Date(v.data_fim).getTime() > new Date(v.data_inicio).getTime(), "A data/hora fim deve ser posterior à data/hora início");

type VigenciaForm = { data_inicio: string; data_fim: string };
const vazio: VigenciaForm = { data_inicio: "", data_fim: "" };

const diaBrasil = (valor: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof valor === "string" ? new Date(valor) : valor);
const diaCampo = (valor: string) => valor.slice(0, 10);

const formatarDataVigencia = (valor: string) =>
  new Date(valor).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

const formatarHoraVigencia = (valor: string) =>
  new Date(valor).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  });

function formatarDuracaoVigencia(vigencia: Pick<Vigencia, "data_inicio" | "data_fim">) {
  const totalSegundos = Math.max(
    0,
    Math.floor((new Date(vigencia.data_fim).getTime() - new Date(vigencia.data_inicio).getTime()) / 1_000),
  );

  const dias = Math.floor(totalSegundos / 86_400);
  const horas = Math.floor((totalSegundos % 86_400) / 3_600);
  const minutos = Math.floor((totalSegundos % 3_600) / 60);
  const segundos = totalSegundos % 60;

  const partes = [
    dias > 0 ? `${dias}d` : null,
    horas > 0 ? `${horas}h` : null,
    minutos > 0 ? `${minutos}m` : null,
    segundos > 0 || (dias === 0 && horas === 0 && minutos === 0) ? `${segundos}s` : null,
  ].filter(Boolean);

  return partes.join(" ");
}

function VigenciasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: mesadasVigencia = [] } = useFilhoVigenciaMesadas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const { ativa: vigenciaAutomaticaAtiva, carregando: carregandoVigenciaAutomatica } = useVigenciaAutomatica();
  const [form, setForm] = useState<VigenciaForm>(vazio);
  const [modoPeriodoNovo, setModoPeriodoNovo] = useState<PeriodoVigenciaModo>("DATAS");
  const [quantidadeDias, setQuantidadeDias] = useState("");
  const [inicioPeriodoDias, setInicioPeriodoDias] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Vigencia | null>(null);
  const [edicao, setEdicao] = useState(form);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [confirmarFinalizacao, setConfirmarFinalizacao] = useState<number | null>(null);
  const [confirmarCloneAberto, setConfirmarCloneAberto] = useState(false);
  const [vigenciaParaAtribuir, setVigenciaParaAtribuir] = useState<number | null>(null);
  const [vigenciaInfoId, setVigenciaInfoId] = useState<number | null>(null);
  const paraCampo = paraCampoDataHoraBrasil;
  const paraIso = paraIsoDataHoraBrasil;

  const periodoDiasCalculado = calcularPeriodoPorDias(quantidadeDias, inicioPeriodoDias);
  const gerenciamentoManualDisponivel = !carregandoVigenciaAutomatica && !vigenciaAutomaticaAtiva;

  useEffect(() => {
    if (!vigenciaAutomaticaAtiva) return;

    setNovoAberto(false);
    setEditando(null);
    setConfirmarExclusao(null);
    setConfirmarFinalizacao(null);
    setConfirmarCloneAberto(false);
    setVigenciaParaAtribuir(null);
  }, [vigenciaAutomaticaAtiva]);

  useEffect(() => {
    if (!vigenciaAutomaticaAtiva) return;

    const atualizarSilenciosamente = () => {
      void qc.invalidateQueries({ queryKey: ["vigencias"] });
      void qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
    };

    atualizarSilenciosamente();
    const timer = window.setInterval(atualizarSilenciosamente, 5_000);

    return () => window.clearInterval(timer);
  }, [qc, vigenciaAutomaticaAtiva]);

  function bloquearGerenciamentoManual() {
    if (carregandoVigenciaAutomatica) {
      toast.info("Aguarde a configuração de vigência ser carregada.");
      return true;
    }
    if (!vigenciaAutomaticaAtiva) return false;
    toast.info(MENSAGEM_VIGENCIA_AUTOMATICA_GERENCIAMENTO);
    return true;
  }

  function abrirNovaVigencia() {
    if (bloquearGerenciamentoManual()) return;
    setForm({ ...vazio, data_inicio: sugerirInicioVigencia(vigencias), data_fim: "" });
    setModoPeriodoNovo("DATAS");
    setQuantidadeDias("");
    setInicioPeriodoDias(null);
    setNovoAberto(true);
  }

  function selecionarModoPeriodoNovo(modo: PeriodoVigenciaModo) {
    if (modo === modoPeriodoNovo) return;
    setModoPeriodoNovo(modo);
    if (modo === "DIAS") {
      setQuantidadeDias("");
      setInicioPeriodoDias(sugerirInicioVigencia(vigencias));
      setForm((atual) => ({ ...atual, data_inicio: "", data_fim: "" }));
      return;
    }
    setQuantidadeDias("");
    setInicioPeriodoDias(null);
    setForm((atual) => ({ ...atual, data_inicio: sugerirInicioVigencia(vigencias), data_fim: "" }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (bloquearGerenciamentoManual()) return;
    const dadosPeriodo = modoPeriodoNovo === "DIAS" ? periodoDiasCalculado : { data_inicio: form.data_inicio, data_fim: form.data_fim };
    if (!dadosPeriodo) {
      toast.error("Informe uma quantidade inteira de dias maior que zero");
      return;
    }
    const formParaSalvar = { ...form, data_inicio: dadosPeriodo.data_inicio, data_fim: dadosPeriodo.data_fim };
    const p = schema.safeParse(formParaSalvar);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const { data: criada, error } = await supabase
      .from("t_vigencia")
      .insert({ data_inicio: paraIso(p.data.data_inicio), data_fim: paraIso(p.data.data_fim) })
      .select("id")
      .single();
    if (error || !criada) { toast.error(msgErro(error)); return; }
    toast.success("Vigência cadastrada");
    setForm(vazio);
    setModoPeriodoNovo("DATAS");
    setQuantidadeDias("");
    setInicioPeriodoDias(null);
    setNovoAberto(false);
    await qc.invalidateQueries({ queryKey: ["vigencias"] });

    if (filhos.length > 0 && tarefas.length > 0) {
      setVigenciaParaAtribuir(criada.id);
    }
  }

  async function finalizar(id: number) {
    if (bloquearGerenciamentoManual()) return;
    const vigencia = vigencias.find((v) => v.id === id); if (!vigencia) return;
    const agora = Date.now();
    if (new Date(vigencia.data_inicio).getTime() > agora || new Date(vigencia.data_fim).getTime() < agora) { toast.error("Somente vigências em andamento podem ser finalizadas"); return; }
    const { error } = await supabase.from("t_vigencia").update({ data_fim: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência finalizada"); qc.invalidateQueries({ queryKey: ["vigencias"] });
  }

  async function excluir(id: number) {
    if (bloquearGerenciamentoManual()) return;
    try {
      await excluirVigenciaComRegra(id);
      toast.success("Vigência excluída");
      qc.invalidateQueries();
    } catch (error) {
      toast.error(msgErro(error));
    }
  }

  async function confirmarClone() {
    if (bloquearGerenciamentoManual()) return;
    try {
      const { qtdAtribuicoes } = await clonarUltimaVigencia(vigencias);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
      ]);
      setConfirmarCloneAberto(false);
      toast.success(`Vigência clonada com ${qtdAtribuicoes} atribuição(ões), todas zeradas`);
    } catch (error) {
      toast.error(msgErro(error));
    }
  }

  async function extrairPdf(vigencia: Vigencia) {
    try {
      await extrairPdfVigencia({
        vigencia,
        filhos,
        atribuicoes,
        ocorrencias,
        mesadasVigencia,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar ou compartilhar o PDF.",
      );
    }
  }

  function abrirEdicao(v: Vigencia) {
    if (bloquearGerenciamentoManual()) return;
    if (new Date(v.data_fim).getTime() < Date.now()) { toast.error("Vigências finalizadas não podem ser editadas"); return; }
    setEditando(v);
    setEdicao({ data_inicio: paraCampo(v.data_inicio), data_fim: paraCampo(v.data_fim) });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (bloquearGerenciamentoManual()) return;
    if (!editando) return;
    const p = schema.safeParse(edicao);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const { error } = await supabase.from("t_vigencia").update({ data_inicio: paraIso(p.data.data_inicio), data_fim: paraIso(p.data.data_fim) }).eq("id", editando.id);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência atualizada"); setEditando(null);
    qc.invalidateQueries({ queryKey: ["vigencias"] }); qc.invalidateQueries({ queryKey: ["filho_tarefas"] }); qc.invalidateQueries({ queryKey: ["ocorrencias"] });
  }

  const agora = Date.now();
  const vigenciasOrdenadas = [...vigencias].sort(compararVigencias);
  const ultimaVigencia = obterUltimaVigencia(vigencias);
  const vinculadasNaEdicao = atribuicoes.filter((a) => a.id_vigencia === editando?.id);
  const idsNaEdicao = new Set(vinculadasNaEdicao.map((a) => a.id));
  const foraDoPeriodo = editando ? ocorrencias.filter((o) => idsNaEdicao.has(o.id_filho_tarefa) && (diaBrasil(o.created_at) < diaCampo(edicao.data_inicio) || diaBrasil(o.created_at) > diaCampo(edicao.data_fim))) : [];
  const vigenciaInfo = vigencias.find((vigencia) => vigencia.id === vigenciaInfoId) ?? null;
  const filhosVinculadosInfo = vigenciaInfoId === null
    ? []
    : filhos
        .filter((filho) =>
          atribuicoes.some(
            (atribuicao) =>
              atribuicao.id_vigencia === vigenciaInfoId &&
              atribuicao.id_filho === filho.id,
          ),
        )
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return <>
    <PageHeader
      title="Vigências"
      description={vigenciaAutomaticaAtiva ? "Períodos gerenciados automaticamente" : "Defina os períodos"}
      icon={<CalendarRange className="h-6 w-6" />}
      action={
        gerenciamentoManualDisponivel ? (
          <div className="flex items-center gap-1.5">
            {ultimaVigencia && (
              <Button size="sm" variant="outline" className="h-8 px-2 text-xs sm:px-2.5" onClick={() => setConfirmarCloneAberto(true)}>
                <Copy className="h-3.5 w-3.5" />
                <span className="sm:hidden">Clonar</span>
                <span className="hidden sm:inline">Clonar vigência</span>
              </Button>
            )}
            <Button size="sm" className="h-8 px-2 text-xs sm:px-2.5" onClick={abrirNovaVigencia}>
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar</span>
            </Button>
          </div>
        ) : undefined
      }
    />

    {vigenciaAutomaticaAtiva && (
      <div className="mb-3 flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="leading-relaxed">
          <strong className="text-foreground">Vigência automática ativa.</strong>{" "}
          {MENSAGEM_VIGENCIA_AUTOMATICA_GERENCIAMENTO}
        </p>
      </div>
    )}
    <div className="mb-3 flex flex-nowrap items-center gap-x-2 rounded-lg border bg-muted/30 px-2 py-2 text-[10px] text-muted-foreground sm:gap-x-4 sm:px-3 sm:text-xs">
      <span className="shrink-0 font-medium whitespace-nowrap">Legenda:</span>
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap sm:gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-300" />Em andamento</span>
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap sm:gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-300" />Finalizada</span>
      {gerenciamentoManualDisponivel && (
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap sm:gap-2"><span className="h-2.5 w-2.5 rounded-full bg-gray-300" />Irá começar</span>
      )}
    </div>
    <div className="mb-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      {vigenciaAutomaticaAtiva
        ? "Este período faz parte do ciclo automático. As atribuições continuam sendo definidas por filho e tarefa."
        : "A vigência define somente o período do combinado. As consequências de “Não fez” são escolhidas em cada registro."}
    </div>
    <div className="space-y-3">
        {vigencias.length === 0 && (
          <EmptyState>
            {vigenciaAutomaticaAtiva
              ? "Nenhuma vigência automática criada ainda. Ela será criada ao salvar a primeira atribuição."
              : "Nenhuma vigência cadastrada ainda."}
          </EmptyState>
        )}
        {vigenciasOrdenadas.map((v) => {
          const situacao = situacaoVigencia(v, agora);
          const finalizada = situacao === "finalizada";
          const emAndamento = situacao === "andamento";
          return <section key={v.id} className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-start">
              <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground sm:text-sm">
                  <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
                  <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
                    <span>{formatarDataVigencia(v.data_inicio)}</span>
                    <span className="font-medium tabular-nums text-muted-foreground">{formatarHoraVigencia(v.data_inicio)}</span>
                    <span className="font-medium text-muted-foreground">à</span>
                    <span>{formatarDataVigencia(v.data_fim)}</span>
                    <span className="font-medium tabular-nums text-muted-foreground">{formatarHoraVigencia(v.data_fim)}</span>
                  </span>
                  <span className="inline-flex h-5 shrink-0 items-center rounded-full border bg-muted/40 px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {formatarDuracaoVigencia(v)}
                  </span>
                </div>
                <div className="mt-1">
                  <VigenciaStatus vigencia={v} />
                </div>
              </div>
              <div className="flex shrink-0 items-center py-4 pr-4 sm:pr-5">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    aria-label="Abrir ações da vigência"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setVigenciaInfoId(v.id)}>
                    <Info className="h-4 w-4" />
                    Ver filhos vinculados
                  </DropdownMenuItem>

                  {gerenciamentoManualDisponivel && emAndamento && (
                    <DropdownMenuItem onSelect={() => setConfirmarFinalizacao(v.id)}>
                      <CircleStop className="h-4 w-4" />
                      Finalizar vigência
                    </DropdownMenuItem>
                  )}

                  {gerenciamentoManualDisponivel && (
                    <DropdownMenuItem
                      disabled={finalizada}
                      onSelect={() => {
                        if (!finalizada) abrirEdicao(v);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar vigência
                    </DropdownMenuItem>
                  )}

                  {situacao !== "futura" && (
                    <DropdownMenuItem
                      disabled={!podeExtrairPdfVigencia(v, atribuicoes)}
                      onSelect={() => {
                        if (podeExtrairPdfVigencia(v, atribuicoes)) {
                          void runAction(() => extrairPdf(v));
                        }
                      }}
                    >
                      <FileDown className="h-4 w-4" />
                      Extrair PDF
                    </DropdownMenuItem>
                  )}

                  {gerenciamentoManualDisponivel && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setConfirmarExclusao(v.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir vigência
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>
          </section>;
        })}
    </div>

    <Dialog open={vigenciaInfoId !== null} onOpenChange={(open) => !open && setVigenciaInfoId(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filhos vinculados à vigência</DialogTitle>
          {vigenciaInfo && (
            <p className="text-sm text-muted-foreground">{fmtVigencia(vigenciaInfo)}</p>
          )}
        </DialogHeader>

        {filhosVinculadosInfo.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {filhosVinculadosInfo.length} {filhosVinculadosInfo.length === 1 ? "filho vinculado" : "filhos vinculados"}
            </p>
            <div className="divide-y rounded-lg border bg-background">
              {filhosVinculadosInfo.map((filho) => (
                <div key={filho.id} className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
                  <FilhoAvatar nome={filho.nome} cor={filho.cor} avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null} className="h-5 w-5" />
                  <span className="min-w-0 truncate">{filho.nome}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Nenhum filho vinculado a esta vigência.
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={gerenciamentoManualDisponivel && novoAberto} onOpenChange={setNovoAberto}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Adicionar vigência</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { void runAction(() => salvar(e)); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Como deseja definir o período?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={modoPeriodoNovo === "DATAS" ? "default" : "outline"} aria-pressed={modoPeriodoNovo === "DATAS"} onClick={() => selecionarModoPeriodoNovo("DATAS")}>
                Escolher datas
              </Button>
              <Button type="button" variant={modoPeriodoNovo === "DIAS" ? "default" : "outline"} aria-pressed={modoPeriodoNovo === "DIAS"} onClick={() => selecionarModoPeriodoNovo("DIAS")}>
                Quantidade de dias
              </Button>
            </div>
          </div>

          {modoPeriodoNovo === "DATAS" ? (
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="inicio">Início <span className="text-destructive" aria-hidden="true">*</span></Label>
                <BrDateTimeField id="inicio" value={form.data_inicio} onChange={(data_inicio) => setForm((atual) => ({ ...atual, data_inicio }))} />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="fim">Fim <span className="text-destructive" aria-hidden="true">*</span></Label>
                <BrDateTimeField id="fim" value={form.data_fim} min={form.data_inicio} onChange={(data_fim) => setForm((atual) => ({ ...atual, data_fim }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="quantidade-dias">Quantos dias a partir de agora? <span className="text-destructive" aria-hidden="true">*</span></Label>
              <Input id="quantidade-dias" type="number" min="1" step="1" inputMode="numeric" value={quantidadeDias} onChange={(e) => setQuantidadeDias(e.target.value)} placeholder="Ex.: 5" />
              <p className="text-xs text-muted-foreground">Ex.: 5 dias = agora até o mesmo horário daqui a 5 dias.</p>
              {periodoDiasCalculado && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Período calculado: </span>
                  <span className="font-medium">{periodoDiasCalculado.resumo}</span>
                </div>
              )}
            </div>
          )}

          {modoPeriodoNovo === "DATAS" && diasDaVigencia(form.data_inicio, form.data_fim) !== null && (
            <p className="text-sm text-muted-foreground">
              Sua vigência tem {diasDaVigencia(form.data_inicio, form.data_fim)} {diasDaVigencia(form.data_inicio, form.data_fim) === 1 ? "dia" : "dias"}.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNovoAberto(false)}>Cancelar</Button>
            <Button type="submit">Cadastrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ClonarVigenciaDialog
      open={gerenciamentoManualDisponivel && confirmarCloneAberto}
      onOpenChange={setConfirmarCloneAberto}
      onConfirm={() => void runAction(confirmarClone)}
    />

    <Dialog open={gerenciamentoManualDisponivel && vigenciaParaAtribuir !== null} onOpenChange={(open) => !open && setVigenciaParaAtribuir(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Fazer atribuições agora?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          A vigência foi cadastrada e você já possui filhos e tarefas cadastrados. Deseja fazer as atribuições desta vigência agora?
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setVigenciaParaAtribuir(null)}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (vigenciaParaAtribuir === null) return;
              const id = vigenciaParaAtribuir;
              setVigenciaParaAtribuir(null);
              navigate({ to: "/atribuicoes", search: { adicionar: "1", vigencia: String(id) } });
            }}
          >
            Fazer atribuição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={gerenciamentoManualDisponivel && confirmarFinalizacao !== null} onOpenChange={(open) => !open && setConfirmarFinalizacao(null)}><DialogContent><DialogHeader><DialogTitle>Finalizar vigência</DialogTitle></DialogHeader><p>Tem certeza que deseja finalizar esta vigência?</p><p className="text-sm text-muted-foreground">A data e hora de fim serão alteradas para agora.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarFinalizacao(null)}>Cancelar</Button><Button onClick={() => { if (confirmarFinalizacao !== null) void runAction(() => finalizar(confirmarFinalizacao)); setConfirmarFinalizacao(null); }}>Finalizar vigência</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={gerenciamentoManualDisponivel && confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}><DialogContent><DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader><p>Tem certeza que deseja excluir esta vigência?</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={gerenciamentoManualDisponivel && Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}><DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:max-w-lg sm:p-5"><DialogHeader className="space-y-0.5"><DialogTitle>Editar vigência</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { void runAction(() => salvarEdicao(e)); }} className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="editar-inicio" className="text-sm">Data início <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="editar-inicio" value={edicao.data_inicio} onChange={(data_inicio) => setEdicao({ ...edicao, data_inicio })} /></div>
        <div className="space-y-1.5"><Label htmlFor="editar-fim" className="text-sm">Fim <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="editar-fim" value={edicao.data_fim} min={edicao.data_inicio} onChange={(data_fim) => setEdicao({ ...edicao, data_fim })} /></div>
        {diasDaVigencia(edicao.data_inicio, edicao.data_fim) !== null && (
          <p className="text-xs text-muted-foreground">
            Sua vigência tem {diasDaVigencia(edicao.data_inicio, edicao.data_fim)} {diasDaVigencia(edicao.data_inicio, edicao.data_fim) === 1 ? "dia" : "dias"}.
          </p>
        )}
        {foraDoPeriodo.length > 0 && <p className="text-sm text-destructive">{foraDoPeriodo.length} resultado(s) fora do novo período. <Link to="/ocorrencias" className="underline">Corrigir em Fez / Não fez</Link> antes de salvar.</p>}
        <DialogFooter className="pt-1"><Button type="button" variant="outline" size="sm" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" size="sm">Salvar alterações</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}