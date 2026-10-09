import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarRange, CheckCircle2, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClonarVigenciaDialog } from "@/components/ClonarVigenciaDialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { BrDateTimeField } from "@/components/BrDateTimeField";
import { BlockedAction } from "@/components/BlockedAction";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";
import { fmtVigencia, msgErro, paraCampoDataHoraBrasil, paraIsoDataHoraBrasil, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, type Vigencia } from "@/lib/db";
import { reais } from "@/lib/mesada";
import { validarAlteracaoLimiteNaoFez } from "@/lib/penalidade";
import { useActionLoading } from "@/components/ActionLoading";
import { clonarUltimaVigencia, obterUltimaVigencia } from "@/lib/clonar-vigencia";
import { excluirVigenciaComRegra } from "@/lib/excluir-vigencia";

export const Route = createFileRoute("/_authenticated/vigencias")({
  head: () => ({ meta: [
    { title: "Vigências — Combinado" },
    { name: "description", content: "Defina o período, o limite de Não fez e o desconto da mesada." },
    { property: "og:title", content: "Vigências — Combinado" },
    { property: "og:description", content: "Defina os períodos e limites dos combinados da família." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VigenciasPage,
});

const schema = z.object({
  data_inicio: z.string().min(1, "Informe a data de início"),
  data_fim: z.string().min(1, "Informe a data de fim"),
  valor_debito: z.string(),
  qtd_ocorrencia: z.coerce.number().int().min(1, "Mínimo de 1 ocorrência").max(31, "Máximo de 31"),
})
.refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.data_inicio) && !Number.isNaN(new Date(v.data_inicio).getTime()), { message: "Informe uma data e hora de início válidas", path: ["data_inicio"] })
.refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.data_fim) && !Number.isNaN(new Date(v.data_fim).getTime()), { message: "Informe uma data e hora de fim válidas", path: ["data_fim"] })
.refine((v) => new Date(v.data_fim).getTime() > new Date(v.data_inicio).getTime(), "A data/hora fim deve ser posterior à data/hora início")
.refine((v) => (/^\d+(?:[,.]\d{1,2})?$/.test(v.valor_debito) && Number(v.valor_debito.replace(",", ".")) > 0 && Number(v.valor_debito.replace(",", ".")) <= 9999999999.99), { message: "Informe um valor de desconto maior que zero, com até duas casas decimais", path: ["valor_debito"] });

type VigenciaForm = { data_inicio: string; data_fim: string; valor_debito: string; qtd_ocorrencia: string };
type PeriodoNovoModo = "DATAS" | "DIAS";
const vazio: VigenciaForm = { data_inicio: "", data_fim: "", valor_debito: "", qtd_ocorrencia: "0" };

function sugerirPeriodoVigencia(vigencias: Array<{ data_fim: string }>, base: VigenciaForm = vazio): VigenciaForm {
  if (vigencias.length === 0) {
    const inicio = new Date();
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + 1);
    return {
      ...base,
      data_inicio: paraCampoDataHoraBrasil(inicio.toISOString()),
      data_fim: paraCampoDataHoraBrasil(fim.toISOString()),
    };
  }

  const maiorFim = vigencias.reduce((maior, vigencia) => {
    const fim = new Date(vigencia.data_fim).getTime();
    return fim > maior ? fim : maior;
  }, Number.NEGATIVE_INFINITY);

  const inicio = new Date(maiorFim);
  inicio.setDate(inicio.getDate() + 1);

  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);

  return {
    ...base,
    data_inicio: paraCampoDataHoraBrasil(inicio.toISOString()),
    data_fim: paraCampoDataHoraBrasil(fim.toISOString()),
  };
}
const diaBrasil = (valor: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof valor === "string" ? new Date(valor) : valor);
const dataHoraBrasil = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const diaCampo = (valor: string) => valor.slice(0, 10);

function calcularPeriodoPorDias(quantidade: string, inicioIso: string | null) {
  const dias = Number(quantidade);
  if (!inicioIso || !Number.isSafeInteger(dias) || dias < 1) return null;
  const inicio = new Date(inicioIso);
  const fim = new Date(inicio.getTime() + dias * 86_400_000);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return null;
  return {
    data_inicio: paraCampoDataHoraBrasil(inicio.toISOString()),
    data_fim: paraCampoDataHoraBrasil(fim.toISOString()),
    resumo: `${dataHoraBrasil.format(inicio)} até ${dataHoraBrasil.format(fim)}`,
  };
}
const dadosRegra = (v: Pick<VigenciaForm, "valor_debito">) => ({ tipo_penalidade: "texto", valor_debito: Number(v.valor_debito.replace(",", ".")) });

function diasDaVigencia(inicioCampo: string, fimCampo: string) {
  const dataUtc = (valor: string) => {
    const partes = valor.slice(0, 10).split("-").map(Number);
    if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
    return Date.UTC(partes[0], partes[1] - 1, partes[2]);
  };
  const inicio = dataUtc(inicioCampo);
  const fim = dataUtc(fimCampo);
  if (inicio === null || fim === null || fim < inicio) return null;
  return Math.floor((fim - inicio) / 86400000) + 1;
}

function RegrasVigencia({ value, onChange, prefix }: { value: VigenciaForm; onChange: (v: VigenciaForm) => void; prefix: string }) {
  const dias = diasDaVigencia(value.data_inicio, value.data_fim);
  return <div className="space-y-3">
    <div className="w-full rounded-lg border border-amber-400 bg-amber-50/60 md:border-amber-300/70 md:bg-amber-50/30 p-3 space-y-2 dark:border-amber-700/60 dark:bg-amber-950/10">
      <p className="text-sm font-semibold">1 — Para filhos sem mesada</p>
      {dias !== null && <p className="text-sm text-muted-foreground">Sua vigência tem {dias} {dias === 1 ? "dia" : "dias"}.</p>}
      <Label htmlFor={`${prefix}-quantidade`} className="block leading-5">Escolha o limite máximo de “Não fez” que seu filho pode ter nesta vigência <span className="text-destructive" aria-hidden="true">*</span></Label>
      <Input id={`${prefix}-quantidade`} type="number" min="1" max="31" value={value.qtd_ocorrencia} onChange={(e) => onChange({ ...value, qtd_ocorrencia: e.target.value })} />
      <p className="text-xs text-muted-foreground">Esse limite considera o total de “Não fez” do filho na vigência, independentemente da quantidade de tarefas atribuídas a ele.</p>
    </div>
    <div className="w-full rounded-lg border border-emerald-400 bg-emerald-50/60 md:border-emerald-300/70 md:bg-emerald-50/30 p-3 space-y-2 dark:border-emerald-700/60 dark:bg-emerald-950/10">
      <p className="text-sm font-semibold">2 — Para filhos marcados com mesada</p>
      <Label htmlFor={`${prefix}-valor`}>Desconto por cada “Não fez” na mesada (R$) <span className="text-destructive" aria-hidden="true">*</span></Label>
      <CurrencyInput id={`${prefix}-valor`} value={value.valor_debito} onValueChange={(valor_debito) => onChange({ ...value, valor_debito })} />
    </div>
  </div>;
}

function VigenciasPage() {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const [form, setForm] = useState<VigenciaForm>(vazio);
  const [modoPeriodoNovo, setModoPeriodoNovo] = useState<PeriodoNovoModo>("DATAS");
  const [quantidadeDias, setQuantidadeDias] = useState("");
  const [inicioPeriodoDias, setInicioPeriodoDias] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Vigencia | null>(null);
  const [edicao, setEdicao] = useState(form);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [confirmarFinalizacao, setConfirmarFinalizacao] = useState<number | null>(null);
  const [confirmarCloneAberto, setConfirmarCloneAberto] = useState(false);
  const paraCampo = paraCampoDataHoraBrasil;
  const paraIso = paraIsoDataHoraBrasil;

  const periodoDiasCalculado = calcularPeriodoPorDias(quantidadeDias, inicioPeriodoDias);

  useEffect(() => {
    if (modoPeriodoNovo === "DATAS" && !form.data_inicio && !form.data_fim) {
      setForm((atual) => sugerirPeriodoVigencia(vigencias, atual));
    }
  }, [vigencias, form.data_inicio, form.data_fim, modoPeriodoNovo]);

  function selecionarModoPeriodoNovo(modo: PeriodoNovoModo) {
    if (modo === modoPeriodoNovo) return;
    setModoPeriodoNovo(modo);
    if (modo === "DIAS") {
      setQuantidadeDias("");
      setInicioPeriodoDias(new Date().toISOString());
      setForm((atual) => ({ ...atual, data_inicio: "", data_fim: "" }));
      return;
    }
    setQuantidadeDias("");
    setInicioPeriodoDias(null);
    setForm((atual) => sugerirPeriodoVigencia(vigencias, { ...atual, data_inicio: "", data_fim: "" }));
  }

  function conflitaComVigenciaExistente(inicioCampo: string, fimCampo: string, ignorarId?: number) {
    const inicio = new Date(inicioCampo).getTime();
    const fim = new Date(fimCampo).getTime();
    return vigencias.some((v) => {
      if (ignorarId !== undefined && v.id === ignorarId) return false;
      const existenteInicio = new Date(v.data_inicio).getTime();
      const existenteFim = new Date(v.data_fim).getTime();
      return inicio <= existenteFim && fim >= existenteInicio;
    });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dadosPeriodo = modoPeriodoNovo === "DIAS" ? periodoDiasCalculado : { data_inicio: form.data_inicio, data_fim: form.data_fim };
    if (!dadosPeriodo) {
      toast.error("Informe uma quantidade inteira de dias maior que zero");
      return;
    }
    const formParaSalvar = { ...form, data_inicio: dadosPeriodo.data_inicio, data_fim: dadosPeriodo.data_fim };
    const p = schema.safeParse(formParaSalvar);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    if (conflitaComVigenciaExistente(p.data.data_inicio, p.data.data_fim)) {
      toast.error("Já existe uma vigência nesse período. As vigências não podem ficar ativas ao mesmo tempo.");
      return;
    }
    const { error } = await supabase.from("t_vigencia").insert({ ...p.data, ...dadosRegra(p.data), penalidade: null, data_inicio: paraIso(p.data.data_inicio), data_fim: paraIso(p.data.data_fim) });
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência cadastrada");
    setForm(vazio);
    setModoPeriodoNovo("DATAS");
    setQuantidadeDias("");
    setInicioPeriodoDias(null);
    setNovoAberto(false);
    qc.invalidateQueries({ queryKey: ["vigencias"] });
  }

  async function finalizar(id: number) {
    const vigencia = vigencias.find((v) => v.id === id); if (!vigencia) return;
    const agora = Date.now();
    if (new Date(vigencia.data_inicio).getTime() > agora || new Date(vigencia.data_fim).getTime() < agora) { toast.error("Somente vigências em andamento podem ser finalizadas"); return; }
    const { error } = await supabase.from("t_vigencia").update({ data_fim: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência finalizada"); qc.invalidateQueries({ queryKey: ["vigencias"] });
  }

  async function excluir(id: number) {
    try {
      await excluirVigenciaComRegra(id);
      toast.success("Vigência excluída");
      qc.invalidateQueries();
    } catch (error) {
      toast.error(msgErro(error instanceof Error ? { message: error.message } : null));
    }
  }

  async function confirmarClone() {
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
      toast.error(msgErro(error instanceof Error ? { message: error.message } : null));
    }
  }

  function abrirEdicao(v: Vigencia) {
    if (new Date(v.data_fim).getTime() < Date.now()) { toast.error("Vigências finalizadas não podem ser editadas"); return; }
    setEditando(v);
    setEdicao({ data_inicio: paraCampo(v.data_inicio), data_fim: paraCampo(v.data_fim), valor_debito: v.valor_debito === null ? "" : v.valor_debito.toFixed(2).replace(".", ","), qtd_ocorrencia: String(v.qtd_ocorrencia) });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault(); if (!editando) return;
    const p = schema.safeParse(edicao);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const novoInicio = new Date(p.data.data_inicio).getTime(); const novoFim = new Date(p.data.data_fim).getTime();
    if (novoFim <= novoInicio) { toast.error("A data/hora fim deve ser posterior à data/hora início"); return; }
    if (conflitaComVigenciaExistente(p.data.data_inicio, p.data.data_fim, editando.id)) { toast.error("Já existe uma vigência nesse período. As vigências não podem ficar ativas ao mesmo tempo."); return; }
    const { data: vinculadas, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id, id_filho, qtd_nao_fez").eq("id_vigencia", editando.id);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    const idsVinculadas = (vinculadas ?? []).map((item) => item.id);
    if (idsVinculadas.length) {
      const { data: registros, error: registrosErro } = await supabase.from("t_ocorrencia").select("id, created_at, tipo, id_filho_tarefa").in("id_filho_tarefa", idsVinculadas);
      if (registrosErro) { toast.error(msgErro(registrosErro)); return; }

      const validacaoLimite = validarAlteracaoLimiteNaoFez({
        vigencia: editando,
        novoLimite: p.data.qtd_ocorrencia,
        filhos,
        ocorrencias,
      });
      if (!validacaoLimite.ok) {
        toast.error(validacaoLimite.mensagem);
        return;
      }

      const novoInicioDia = diaCampo(p.data.data_inicio); const novoFimDia = diaCampo(p.data.data_fim);
      const fora = (registros ?? []).filter((o) => { const d = diaBrasil(o.created_at); return d < novoInicioDia || d > novoFimDia; });
      if (fora.length) { toast.error(`Não é possível alterar o período: existem ${fora.length} registro(s) de Fez/Não fez fora das novas datas. Ajuste ou remova esses registros em Fez / Não fez antes de salvar.`); return; }
    }
    const { error } = await supabase.from("t_vigencia").update({ ...p.data, ...dadosRegra(p.data), data_inicio: paraIso(p.data.data_inicio), data_fim: paraIso(p.data.data_fim) }).eq("id", editando.id);
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

  return <>
    <PageHeader
      title="Vigências"
      description="Defina o período, o limite de “Não fez” e o desconto da mesada."
      icon={<CalendarRange className="h-6 w-6" />}
      action={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {ultimaVigencia && (
            <Button size="sm" variant="outline" className="px-2 sm:px-3" onClick={() => setConfirmarCloneAberto(true)}>
              <Copy className="h-4 w-4" />
              <span className="sm:hidden">Clonar</span>
              <span className="hidden sm:inline">Clonar vigência</span>
            </Button>
          )}
          <Button size="sm" className="px-2 sm:px-3" onClick={() => setNovoAberto(true)}>
            <Plus className="h-4 w-4" />
            <span>Adicionar</span>
          </Button>
        </div>
      }
    />
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium">Legenda:</span>
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-300" />Em andamento</span>
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-300" />Finalizada</span>
      <span className="flex shrink-0 items-center gap-2 whitespace-nowrap"><span className="h-2.5 w-2.5 rounded-full bg-gray-300" />Irá começar</span>
    </div>
    <div className="space-y-3">
        {vigencias.length === 0 && <EmptyState>Nenhuma vigência cadastrada ainda.</EmptyState>}
        {vigenciasOrdenadas.map((v) => {
          const situacao = situacaoVigencia(v, agora);
          const finalizada = situacao === "finalizada";
          const emAndamento = situacao === "andamento";
          const temAtribuicoes = atribuicoes.some((a) => a.id_vigencia === v.id);
          return <div key={v.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1"><VigenciaStatus vigencia={v} /><p className="font-semibold">{fmtVigencia(v)}</p></div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {emAndamento && <Button variant="ghost" size="icon" onClick={() => setConfirmarFinalizacao(v.id)} title="Finalizar vigência"><CheckCircle2 className="h-4 w-4" /></Button>}
                <BlockedAction reason={finalizada ? "Vigências finalizadas não podem ser editadas." : undefined}><Button variant="ghost" size="icon" disabled={finalizada} onClick={() => abrirEdicao(v)}><Pencil className="h-4 w-4" /></Button></BlockedAction>
                <Button variant="ghost" size="icon" onClick={() => setConfirmarExclusao(v.id)} aria-label="Excluir vigência"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="w-full rounded-lg border border-amber-400 bg-amber-50/60 md:border-amber-300/70 md:bg-amber-50/30 px-3 py-1.5 text-xs dark:border-amber-700/60 dark:bg-amber-950/10">
                <span className="font-semibold text-foreground">Para filhos sem mesada:</span>{" "}<span className="text-muted-foreground">limite máximo de {v.qtd_ocorrencia} “Não fez”</span>
                {v.penalidade && <><span className="text-muted-foreground"> · </span><span className="font-semibold text-foreground">Penalidade aplicada:</span>{" "}<span className="text-muted-foreground">{v.penalidade}</span></>}
              </div>
              <div className="w-full rounded-lg border border-emerald-400 bg-emerald-50/60 md:border-emerald-300/70 md:bg-emerald-50/30 px-3 py-1.5 text-xs dark:border-emerald-700/60 dark:bg-emerald-950/10">
                <span className="font-semibold text-foreground">Para filhos com mesada:</span>{" "}<span className="text-muted-foreground">{v.valor_debito !== null ? `${reais(v.valor_debito)} de desconto por cada “Não fez”` : "Não cadastrado"}</span>
              </div>
            </div>
          </div>;
        })}
    </div>

    <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
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

          <RegrasVigencia value={form} onChange={setForm} prefix="novo" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNovoAberto(false)}>Cancelar</Button>
            <Button type="submit">Cadastrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ClonarVigenciaDialog
      open={confirmarCloneAberto}
      onOpenChange={setConfirmarCloneAberto}
      onConfirm={() => void runAction(confirmarClone)}
    />
    <Dialog open={confirmarFinalizacao !== null} onOpenChange={(open) => !open && setConfirmarFinalizacao(null)}><DialogContent><DialogHeader><DialogTitle>Finalizar vigência</DialogTitle></DialogHeader><p>Tem certeza que deseja finalizar esta vigência?</p><p className="text-sm text-muted-foreground">A data e hora de fim serão alteradas para agora.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarFinalizacao(null)}>Cancelar</Button><Button onClick={() => { if (confirmarFinalizacao !== null) void runAction(() => finalizar(confirmarFinalizacao)); setConfirmarFinalizacao(null); }}>Finalizar vigência</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}><DialogContent><DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader><p>Tem certeza que deseja excluir esta vigência?</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}><DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:max-w-lg sm:p-5"><DialogHeader className="space-y-0.5"><DialogTitle>Editar vigência</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { void runAction(() => salvarEdicao(e)); }} className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="editar-inicio" className="text-sm">Data início <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="editar-inicio" value={edicao.data_inicio} onChange={(data_inicio) => setEdicao({ ...edicao, data_inicio })} /></div>
        <div className="space-y-1.5"><Label htmlFor="editar-fim" className="text-sm">Data fim <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="editar-fim" value={edicao.data_fim} onChange={(data_fim) => setEdicao({ ...edicao, data_fim })} /></div>
        <div className="[&_.space-y-3]:space-y-2 [&_.space-y-2]:space-y-1.5 [&_.p-3]:p-2.5 [&_input]:h-9 [&_label]:text-sm [&_p.text-xs]:text-[11px]"><RegrasVigencia value={edicao} onChange={setEdicao} prefix="editar" /></div>
        {foraDoPeriodo.length > 0 && <p className="text-sm text-destructive">{foraDoPeriodo.length} registro(s) de Fez/Não fez fora do novo período. <Link to="/ocorrencias" className="underline">Corrigir em Fez / Não fez</Link> antes de salvar.</p>}
        <DialogFooter className="pt-1"><Button type="button" variant="outline" size="sm" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" size="sm">Salvar alterações</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}