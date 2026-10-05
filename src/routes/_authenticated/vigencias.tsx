import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarRange, CheckCircle2, Copy, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { BrDateTimeField } from "@/components/BrDateTimeField";
import { BlockedAction } from "@/components/BlockedAction";
import { VigenciaStatus } from "@/components/VigenciaStatus";
import { fmtVigencia, msgErro, paraCampoDataHoraBrasil, paraIsoDataHoraBrasil, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, type Vigencia } from "@/lib/db";
import { reais, usaDesconto } from "@/lib/mesada";
import { useActionLoading } from "@/components/ActionLoading";

export const Route = createFileRoute("/_authenticated/vigencias")({
  head: () => ({ meta: [
    { title: "Vigências — Combinado" },
    { name: "description", content: "Defina o período, a penalidade e o desconto da mesada." },
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
  penalidade: z.string().trim().max(200),
  valor_debito: z.string(),
  qtd_ocorrencia: z.coerce.number().int().min(1, "Mínimo de 1 ocorrência").max(31, "Máximo de 31"),
})
.refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.data_inicio) && !Number.isNaN(new Date(v.data_inicio).getTime()), { message: "Informe uma data e hora de início válidas", path: ["data_inicio"] })
.refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.data_fim) && !Number.isNaN(new Date(v.data_fim).getTime()), { message: "Informe uma data e hora de fim válidas", path: ["data_fim"] })
.refine((v) => new Date(v.data_fim).getTime() > new Date(v.data_inicio).getTime(), "A data/hora fim deve ser posterior à data/hora início")
.refine((v) => v.penalidade.length >= 2, { message: "Informe a penalidade", path: ["penalidade"] })
.refine((v) => (/^\d+(?:[,.]\d{1,2})?$/.test(v.valor_debito) && Number(v.valor_debito.replace(",", ".")) > 0 && Number(v.valor_debito.replace(",", ".")) <= 9999999999.99), { message: "Informe um valor de desconto maior que zero, com até duas casas decimais", path: ["valor_debito"] });

type VigenciaForm = { data_inicio: string; data_fim: string; penalidade: string; valor_debito: string; qtd_ocorrencia: string };
const vazio: VigenciaForm = { data_inicio: "", data_fim: "", penalidade: "", valor_debito: "", qtd_ocorrencia: "3" };
const diaBrasil = (valor: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof valor === "string" ? new Date(valor) : valor);
const diaCampo = (valor: string) => valor.slice(0, 10);
const dadosPenalidade = (v: Pick<VigenciaForm, "penalidade" | "valor_debito">) => ({ tipo_penalidade: "texto", penalidade: v.penalidade, valor_debito: Number(v.valor_debito.replace(",", ".")) });

function EscolhaPenalidade({ value, onChange, prefix, mostrarPenalidade = true }: { value: VigenciaForm; onChange: (v: VigenciaForm) => void; prefix: string; mostrarPenalidade?: boolean }) {
  return <div className="space-y-3">
    {mostrarPenalidade && <div className="rounded-lg border border-amber-400 bg-amber-50/60 md:border-amber-300/70 md:bg-amber-50/30 p-3 space-y-2 dark:border-amber-700/60 dark:bg-amber-950/10">
      <p className="text-sm font-semibold">Penalidade</p>
      <Label htmlFor={`${prefix}-penalidade`}>Descrição <span className="text-destructive" aria-hidden="true">*</span></Label>
      <Input id={`${prefix}-penalidade`} placeholder="Ex.: Sem videogame no fim de semana" value={value.penalidade} onChange={(e) => onChange({ ...value, penalidade: e.target.value })} />
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-quantidade`} className="block leading-5">Número de “Não fez” para ser penalizado <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input id={`${prefix}-quantidade`} type="number" min="1" max="31" value={value.qtd_ocorrencia} onChange={(e) => onChange({ ...value, qtd_ocorrencia: e.target.value })} />
        <p className="animate-pulse text-xs font-semibold text-amber-600 dark:text-amber-400">Usado apenas para filhos sem mesada.</p>
      </div>
    </div>}
    <div className="rounded-lg border border-emerald-400 bg-emerald-50/60 md:border-emerald-300/70 md:bg-emerald-50/30 p-3 space-y-2 dark:border-emerald-700/60 dark:bg-emerald-950/10">
      <p className="text-sm font-semibold">Desconto por cada “Não fez” na mesada</p>
      <Label htmlFor={`${prefix}-valor`}>Valor do desconto (R$) <span className="text-destructive" aria-hidden="true">*</span></Label>
      <CurrencyInput id={`${prefix}-valor`} value={value.valor_debito} onValueChange={(valor_debito) => onChange({ ...value, valor_debito })} />
      <p className="animate-pulse text-xs font-semibold text-emerald-600 dark:text-emerald-400">Usado apenas para filhos com mesada. Cada “Não fez” gera esse desconto.</p>
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
  const [editando, setEditando] = useState<Vigencia | null>(null);
  const [edicao, setEdicao] = useState(form);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [confirmarFinalizacao, setConfirmarFinalizacao] = useState<number | null>(null);
  const [duplicando, setDuplicando] = useState<Vigencia | null>(null);
  const [duplicacao, setDuplicacao] = useState<VigenciaForm>(vazio);
  const paraCampo = paraCampoDataHoraBrasil;
  const paraIso = paraIsoDataHoraBrasil;

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
    const p = schema.safeParse(form);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    if (conflitaComVigenciaExistente(p.data.data_inicio, p.data.data_fim)) {
      toast.error("Já existe uma vigência nesse período. As vigências não podem ficar ativas ao mesmo tempo.");
      return;
    }
    const { error } = await supabase.from("t_vigencia").insert({ ...p.data, ...dadosPenalidade(p.data), data_inicio: paraIso(p.data.data_inicio), data_fim: paraIso(p.data.data_fim) });
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência cadastrada"); setForm(vazio); qc.invalidateQueries({ queryKey: ["vigencias"] });
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
    const vigencia = vigencias.find((v) => v.id === id);
    if (!vigencia) return;

    const agora = Date.now();
    const inicio = new Date(vigencia.data_inicio).getTime();
    const fim = new Date(vigencia.data_fim).getTime();
    const finalizada = fim < agora;
    const futura = inicio > agora;

    if (finalizada) {
      toast.error("Vigências finalizadas não podem ser excluídas");
      return;
    }

    const { count, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id", { count: "exact", head: true }).eq("id_vigencia", id);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }

    if (count && !futura) {
      toast.error("Esta vigência está em andamento e tem atribuições, por isso não pode ser excluída");
      return;
    }

    if (count && futura) {
      const { error: erroAtribuicoes } = await supabase.from("t_filho_tarefa").delete().eq("id_vigencia", id);
      if (erroAtribuicoes) { toast.error(msgErro(erroAtribuicoes)); return; }
    }

    const { error } = await supabase.from("t_vigencia").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries();
  }

  function abrirDuplicacao(v: Vigencia) {
    const inicioOriginal = new Date(v.data_inicio).getTime();
    const fimOriginal = new Date(v.data_fim).getTime();
    const duracao = Math.max(60_000, fimOriginal - inicioOriginal);
    const novoInicioDate = new Date(fimOriginal + 60_000);
    const novoFimDate = new Date(novoInicioDate.getTime() + duracao);
    setDuplicando(v);
    setDuplicacao({
      data_inicio: paraCampo(novoInicioDate.toISOString()),
      data_fim: paraCampo(novoFimDate.toISOString()),
      penalidade: v.penalidade ?? "",
      valor_debito: v.valor_debito === null ? "" : v.valor_debito.toFixed(2).replace(".", ","),
      qtd_ocorrencia: String(v.qtd_ocorrencia),
    });
  }

  async function duplicarVigencia(e: FormEvent) {
    e.preventDefault();
    if (!duplicando) return;

    const p = schema.safeParse(duplicacao);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }

    const novoInicio = new Date(p.data.data_inicio).getTime();
    const fimOriginal = new Date(duplicando.data_fim).getTime();
    if (novoInicio <= fimOriginal) {
      toast.error("A nova vigência deve começar depois do término da vigência original");
      return;
    }
    if (conflitaComVigenciaExistente(p.data.data_inicio, p.data.data_fim)) {
      toast.error("Já existe uma vigência nesse período. As vigências não podem ficar ativas ao mesmo tempo.");
      return;
    }

    const origem = atribuicoes.filter((a) => a.id_vigencia === duplicando.id);

    const { data: nova, error: erroVigencia } = await supabase
      .from("t_vigencia")
      .insert({
        ...p.data,
        ...dadosPenalidade(p.data),
        data_inicio: paraIso(p.data.data_inicio),
        data_fim: paraIso(p.data.data_fim),
      })
      .select("id")
      .single();

    if (erroVigencia || !nova) {
      toast.error(msgErro(erroVigencia));
      return;
    }

    if (origem.length > 0) {
      const novasAtribuicoes = origem.map((a) => ({
        id_vigencia: nova.id,
        id_filho: a.id_filho,
        id_tarefa: a.id_tarefa,
        qtd_nao_fez: 0,
        feito: null,
      }));

      const { error: erroAtribuicoes } = await supabase.from("t_filho_tarefa").insert(novasAtribuicoes);
      if (erroAtribuicoes) {
        await supabase.from("t_vigencia").delete().eq("id", nova.id);
        toast.error(msgErro(erroAtribuicoes));
        return;
      }
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["vigencias"] }),
      qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
      qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
    ]);
    toast.success(`Vigência duplicada com ${origem.length} associação(ões), todas zeradas`);
    setDuplicando(null);
  }

  function abrirEdicao(v: Vigencia) {
    if (new Date(v.data_fim).getTime() < Date.now()) { toast.error("Vigências finalizadas não podem ser editadas"); return; }
    setEditando(v);
    setEdicao({ data_inicio: paraCampo(v.data_inicio), data_fim: paraCampo(v.data_fim), penalidade: v.penalidade, valor_debito: v.valor_debito === null ? "" : v.valor_debito.toFixed(2).replace(".", ","), qtd_ocorrencia: String(v.qtd_ocorrencia) });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault(); if (!editando) return;
    const p = schema.safeParse(edicao);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const novoInicio = new Date(p.data.data_inicio).getTime(); const novoFim = new Date(p.data.data_fim).getTime();
    if (novoFim <= novoInicio) { toast.error("A data/hora fim deve ser posterior à data/hora início"); return; }
    const { data: vinculadas, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id, id_filho, qtd_nao_fez").eq("id_vigencia", editando.id);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    const idsVinculadas = (vinculadas ?? []).map((item) => item.id);
    if (idsVinculadas.length) {
      const { data: registros, error: registrosErro } = await supabase.from("t_ocorrencia").select("id, created_at").in("id_filho_tarefa", idsVinculadas);
      if (registrosErro) { toast.error(msgErro(registrosErro)); return; }
      const novoInicioDia = diaCampo(p.data.data_inicio); const novoFimDia = diaCampo(p.data.data_fim);
      const fora = (registros ?? []).filter((o) => { const d = diaBrasil(o.created_at); return d < novoInicioDia || d > novoFimDia; });
      if (fora.length) { toast.error(`Não é possível alterar o período: existem ${fora.length} registro(s) de Fez/Não fez fora das novas datas. Ajuste ou remova esses registros em Fez / Não fez antes de salvar.`); return; }
    }
    const { error } = await supabase.from("t_vigencia").update({ ...p.data, ...dadosPenalidade(p.data), data_inicio: paraIso(p.data.data_inicio), data_fim: paraIso(p.data.data_fim) }).eq("id", editando.id);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência atualizada"); setEditando(null);
    qc.invalidateQueries({ queryKey: ["vigencias"] }); qc.invalidateQueries({ queryKey: ["filho_tarefas"] }); qc.invalidateQueries({ queryKey: ["ocorrencias"] });
  }

  const agora = Date.now();
  const vigenciasOrdenadas = [...vigencias].sort((a, b) => {
    const inicioA = new Date(a.data_inicio).getTime();
    const inicioB = new Date(b.data_inicio).getTime();
    const fimA = new Date(a.data_fim).getTime();
    const fimB = new Date(b.data_fim).getTime();
    const statusA = inicioA <= agora && fimA >= agora ? 0 : inicioA > agora ? 1 : 2;
    const statusB = inicioB <= agora && fimB >= agora ? 0 : inicioB > agora ? 1 : 2;
    if (statusA !== statusB) return statusA - statusB;
    return statusA === 2 ? inicioB - inicioA : inicioA - inicioB;
  });
  const vinculadasNaEdicao = atribuicoes.filter((a) => a.id_vigencia === editando?.id);
  const idsNaEdicao = new Set(vinculadasNaEdicao.map((a) => a.id));
  const foraDoPeriodo = editando ? ocorrencias.filter((o) => idsNaEdicao.has(o.id_filho_tarefa) && (diaBrasil(o.created_at) < diaCampo(edicao.data_inicio) || diaBrasil(o.created_at) > diaCampo(edicao.data_fim))) : [];

  return <>
    <PageHeader title="Vigências" description="Defina o período, a penalidade e o desconto da mesada." icon={<CalendarRange className="h-6 w-6" />} />
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium">Legenda:</span>
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-300" />Em andamento</span>
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-300" />Finalizada</span>
      <span className="flex shrink-0 items-center gap-2 whitespace-nowrap"><span className="h-2.5 w-2.5 rounded-full bg-gray-300" />Irá começar</span>
    </div>
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card><CardHeader><CardTitle>Cadastrar vigência</CardTitle></CardHeader><CardContent>
        <form onSubmit={(e) => { void runAction(() => salvar(e)); }} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="inicio">Data início <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="inicio" value={form.data_inicio} onChange={(data_inicio) => setForm({ ...form, data_inicio })} /></div>
          <div className="space-y-2"><Label htmlFor="fim">Data fim <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="fim" value={form.data_fim} onChange={(data_fim) => setForm({ ...form, data_fim })} /></div>
          <EscolhaPenalidade value={form} onChange={setForm} prefix="novo" /><Button type="submit" className="w-full">Cadastrar</Button>
        </form>
      </CardContent></Card>
      <div className="space-y-3">
        {vigencias.length === 0 && <EmptyState>Nenhuma vigência cadastrada ainda.</EmptyState>}
        {vigenciasOrdenadas.map((v) => {
          const finalizada = new Date(v.data_fim).getTime() < agora;
          const emAndamento = new Date(v.data_inicio).getTime() <= agora && !finalizada;
          const temAtribuicoes = atribuicoes.some((a) => a.id_vigencia === v.id);
          return <div key={v.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1"><VigenciaStatus vigencia={v} /><p className="font-semibold">{fmtVigencia(v)}</p></div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => abrirDuplicacao(v)} title="Duplicar vigência" aria-label="Duplicar vigência"><Copy className="h-4 w-4" /></Button>
                {emAndamento && <Button variant="ghost" size="icon" onClick={() => setConfirmarFinalizacao(v.id)} title="Finalizar vigência"><CheckCircle2 className="h-4 w-4" /></Button>}
                <BlockedAction reason={finalizada ? "Vigências finalizadas não podem ser editadas." : undefined}><Button variant="ghost" size="icon" disabled={finalizada} onClick={() => abrirEdicao(v)}><Pencil className="h-4 w-4" /></Button></BlockedAction>
                <BlockedAction reason={finalizada ? "Vigências finalizadas não podem ser excluídas." : emAndamento && temAtribuicoes ? "Esta vigência está em andamento e tem atribuições, por isso não pode ser excluída." : undefined}><Button variant="ghost" size="icon" disabled={finalizada || (emAndamento && temAtribuicoes)} onClick={() => setConfirmarExclusao(v.id)}><Trash2 className="h-4 w-4" /></Button></BlockedAction>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="w-full rounded-lg border border-amber-400 bg-amber-50/60 md:border-amber-300/70 md:bg-amber-50/30 px-3 py-1.5 text-xs dark:border-amber-700/60 dark:bg-amber-950/10">
                <span className="font-semibold text-foreground">Penalidade:</span>{" "}<span className="text-muted-foreground">{v.penalidade || "Não cadastrada"}</span>{" "}
                <span className="text-muted-foreground">·</span>{" "}<span className="font-semibold text-foreground">Quantidade de “Não fez”:</span>{" "}<span className="text-muted-foreground">{v.qtd_ocorrencia}</span>
              </div>
              <div className="w-full rounded-lg border border-emerald-400 bg-emerald-50/60 md:border-emerald-300/70 md:bg-emerald-50/30 px-3 py-1.5 text-xs dark:border-emerald-700/60 dark:bg-emerald-950/10">
                <span className="font-semibold text-foreground">Desconto da mesada:</span>{" "}<span className="text-muted-foreground">{v.valor_debito !== null ? `${reais(v.valor_debito)} por cada “Não fez”` : "Não cadastrado"}</span>
              </div>
            </div>
          </div>;
        })}
      </div>
    </div>

    <Dialog open={Boolean(duplicando)} onOpenChange={(open) => !open && setDuplicando(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar vigência</DialogTitle>
        </DialogHeader>
        {duplicando && (
          <form onSubmit={(e) => { void runAction(() => duplicarVigencia(e)); }} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">Vigência original</p>
              <p className="mt-1 text-muted-foreground">{fmtVigencia(duplicando)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Serão copiadas {new Set(atribuicoes.filter((a) => a.id_vigencia === duplicando.id).map((a) => a.id_filho)).size} pessoa(s), {new Set(atribuicoes.filter((a) => a.id_vigencia === duplicando.id).map((a) => a.id_tarefa)).size} tarefa(s) e {atribuicoes.filter((a) => a.id_vigencia === duplicando.id).length} associação(ões).
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Fez, Não fez, bonificações, penalidades atingidas e contadores não serão copiados.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duplicar-inicio">Novo início <span className="text-destructive" aria-hidden="true">*</span></Label>
              <BrDateTimeField
                id="duplicar-inicio"
                value={duplicacao.data_inicio}
                min={paraCampo(new Date(new Date(duplicando.data_fim).getTime() + 60_000).toISOString())}
                onChange={(data_inicio) => setDuplicacao({ ...duplicacao, data_inicio })}
              />
              <p className="text-xs text-muted-foreground">A nova vigência só pode começar depois do fim da vigência original.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duplicar-fim">Novo fim <span className="text-destructive" aria-hidden="true">*</span></Label>
              <BrDateTimeField
                id="duplicar-fim"
                value={duplicacao.data_fim}
                min={duplicacao.data_inicio || paraCampo(new Date(new Date(duplicando.data_fim).getTime() + 60_000).toISOString())}
                onChange={(data_fim) => setDuplicacao({ ...duplicacao, data_fim })}
              />
            </div>
            <EscolhaPenalidade value={duplicacao} onChange={setDuplicacao} prefix="duplicar" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDuplicando(null)}>Cancelar</Button>
              <Button type="submit"><Copy className="h-4 w-4" /> Criar nova vigência</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={confirmarFinalizacao !== null} onOpenChange={(open) => !open && setConfirmarFinalizacao(null)}><DialogContent><DialogHeader><DialogTitle>Finalizar vigência</DialogTitle></DialogHeader><p>Tem certeza que deseja finalizar esta vigência?</p><p className="text-sm text-muted-foreground">A data e hora de fim serão alteradas para agora.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarFinalizacao(null)}>Cancelar</Button><Button onClick={() => { if (confirmarFinalizacao !== null) void runAction(() => finalizar(confirmarFinalizacao)); setConfirmarFinalizacao(null); }}>Finalizar vigência</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}><DialogContent><DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader><p>Tem certeza que deseja excluir esta vigência?</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}><DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:max-w-lg sm:p-5"><DialogHeader className="space-y-0.5"><DialogTitle>Editar vigência</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { void runAction(() => salvarEdicao(e)); }} className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="editar-inicio" className="text-sm">Data início <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="editar-inicio" value={edicao.data_inicio} onChange={(data_inicio) => setEdicao({ ...edicao, data_inicio })} /></div>
        <div className="space-y-1.5"><Label htmlFor="editar-fim" className="text-sm">Data fim <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateTimeField id="editar-fim" value={edicao.data_fim} onChange={(data_fim) => setEdicao({ ...edicao, data_fim })} /></div>
        <div className="[&_.space-y-3]:space-y-2 [&_.space-y-2]:space-y-1.5 [&_.p-3]:p-2.5 [&_input]:h-9 [&_label]:text-sm [&_p.text-xs]:text-[11px]"><EscolhaPenalidade value={edicao} onChange={setEdicao} prefix="editar" /></div>
        {foraDoPeriodo.length > 0 && <p className="text-sm text-destructive">{foraDoPeriodo.length} registro(s) de Fez/Não fez fora do novo período. <Link to="/ocorrencias" className="underline">Corrigir em Fez / Não fez</Link> antes de salvar.</p>}
        <DialogFooter className="pt-1"><Button type="button" variant="outline" size="sm" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" size="sm">Salvar alterações</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}