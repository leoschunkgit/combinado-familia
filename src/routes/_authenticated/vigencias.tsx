import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarRange, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { BrDateField } from "@/components/BrDateField";
import { BlockedAction } from "@/components/BlockedAction";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, type Vigencia } from "@/lib/db";
import { descricaoPenalidade } from "@/lib/mesada";
import { erroLimiteMesada } from "@/lib/limite-mesada";
import { useActionLoading } from "@/components/ActionLoading";

export const Route = createFileRoute("/_authenticated/vigencias")({
  head: () => ({ meta: [
    { title: "Vigências — Combinado" },
    { name: "description", content: "Defina os períodos e limites dos combinados da família." },
    { property: "og:title", content: "Vigências — Combinado" },
    { property: "og:description", content: "Defina os períodos e limites dos combinados da família." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VigenciasPage,
});

const schema = z
  .object({
    data_inicio: z.string().min(1, "Informe a data de início"),
    data_fim: z.string().min(1, "Informe a data de fim"),
    penalidade: z.string().trim().max(200),
    valor_debito: z.string(),
    qtd_ocorrencia: z.coerce.number().int().min(1, "Mínimo de 1 ocorrência").max(31, "Máximo de 31"),
  })
  .refine((v) => v.data_fim >= v.data_inicio, "A data fim deve ser igual ou posterior à data início")
  .refine((v) => v.penalidade.length >= 2, { message: "Informe a penalidade escrita", path: ["penalidade"] })
  .refine((v) => (/^\d+(?:[,.]\d{1,2})?$/.test(v.valor_debito) && Number(v.valor_debito.replace(",", ".")) > 0 && Number(v.valor_debito.replace(",", ".")) <= 9999999999.99), { message: "Informe um valor de desconto maior que zero, com até duas casas decimais", path: ["valor_debito"] });

type VigenciaForm = { data_inicio: string; data_fim: string; penalidade: string; valor_debito: string; qtd_ocorrencia: string };
const vazio: VigenciaForm = { data_inicio: "", data_fim: "", penalidade: "", valor_debito: "", qtd_ocorrencia: "3" };
const dadosPenalidade = (v: Pick<VigenciaForm, "penalidade" | "valor_debito">) => ({
  tipo_penalidade: "texto",
  penalidade: v.penalidade,
  valor_debito: Number(v.valor_debito.replace(",", ".")),
});

function EscolhaPenalidade({ value, onChange, prefix }: { value: VigenciaForm; onChange: (v: VigenciaForm) => void; prefix: string }) {
  return <div className="space-y-3">
    <div className="space-y-2"><Label htmlFor={`${prefix}-penalidade`}>Penalidade escrita <span className="text-destructive" aria-hidden="true">*</span></Label><Input id={`${prefix}-penalidade`} placeholder="Ex.: Sem videogame no fim de semana" value={value.penalidade} onChange={(e) => onChange({ ...value, penalidade: e.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor={`${prefix}-valor`}>Desconto por “Não fez” (R$) <span className="text-destructive" aria-hidden="true">*</span></Label><Input id={`${prefix}-valor`} inputMode="decimal" placeholder="20,00" value={value.valor_debito} onChange={(e) => onChange({ ...value, valor_debito: e.target.value })} /><p className="text-xs text-muted-foreground">Com mesada cadastrada, aplica-se o desconto por registro até o limite. Sem mesada, aplica-se a penalidade escrita ao atingir o limite.</p></div>
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

  const paraCampo = (valor: string) => {
    const d = new Date(valor);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const dia = (valor: string) => paraCampo(valor);
  const inicioDoDia = (data: string) => new Date(`${data}T00:00:00`).toISOString();
  const fimDoDia = (data: string) => new Date(`${data}T23:59:59.999`).toISOString();

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const { error } = await supabase.from("t_vigencia").insert({
      ...p.data,
      ...dadosPenalidade(p.data),
      data_inicio: inicioDoDia(p.data.data_inicio),
      data_fim: fimDoDia(p.data.data_fim),
    });
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência cadastrada");
    setForm(vazio);
    qc.invalidateQueries({ queryKey: ["vigencias"] });
  }

  async function excluir(id: number) {
    const { count, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id", { count: "exact", head: true }).eq("id_vigencia", id);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    if (count) { toast.error("Esta vigência tem atribuições e não pode ser excluída"); return; }
    const { error } = await supabase.from("t_vigencia").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries();
  }

  function abrirEdicao(v: Vigencia) {
    setEditando(v);
    setEdicao({ data_inicio: paraCampo(v.data_inicio), data_fim: paraCampo(v.data_fim), penalidade: v.penalidade, valor_debito: v.valor_debito === null ? "" : v.valor_debito.toFixed(2).replace(".", ","), qtd_ocorrencia: String(v.qtd_ocorrencia) });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const p = schema.safeParse(edicao);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const novoPeriodo = { valor_debito: Number(p.data.valor_debito.replace(",", ".")), qtd_ocorrencia: p.data.qtd_ocorrencia };
    for (const idFilho of new Set(atribuicoes.filter((a) => a.id_vigencia === editando.id).map((a) => a.id_filho))) {
      const filho = filhos.find((f) => f.id === idFilho);
      if (filho) {
        const erro = erroLimiteMesada(filho, novoPeriodo);
        if (erro) { toast.error(erro); return; }
      }
    }
    const { data: vinculadas, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id, id_filho, qtd_nao_fez").eq("id_vigencia", editando.id);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    const totais = new Map<number, number>();
    for (const item of vinculadas ?? []) totais.set(item.id_filho, (totais.get(item.id_filho) ?? 0) + item.qtd_nao_fez);
    const maiorTotal = Math.max(0, ...totais.values());
    if (p.data.qtd_ocorrencia < maiorTotal) {
      toast.error(`O limite não pode ser menor que os ${maiorTotal} registros de “Não fez” já acumulados por um filho nesta vigência`);
      return;
    }
    if (vinculadas?.length) {
      const { data: registros, error: registrosErro } = await supabase.from("t_ocorrencia").select("created_at").in("id_filho_tarefa", vinculadas.map((item) => item.id));
      if (registrosErro) { toast.error(msgErro(registrosErro)); return; }
      const inicio = p.data.data_inicio.slice(0, 10);
      const fim = p.data.data_fim.slice(0, 10);
      if (registros?.some((o) => dia(o.created_at) < inicio || dia(o.created_at) > fim)) {
        toast.error("Há datas de ‘Não fez’ fora do novo período. Corrija-as na aba Ocorrências antes de salvar a vigência.");
        return;
      }
    }
    const { error } = await supabase.from("t_vigencia").update({
      ...p.data,
      ...dadosPenalidade(p.data),
      data_inicio: inicioDoDia(p.data.data_inicio),
      data_fim: fimDoDia(p.data.data_fim),
    }).eq("id", editando.id);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência atualizada");
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["vigencias"] });
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
    qc.invalidateQueries({ queryKey: ["ocorrencias"] });
  }

  const agora = Date.now();
  const vinculadasNaEdicao = atribuicoes.filter((a) => a.id_vigencia === editando?.id);
  const idsNaEdicao = new Set(vinculadasNaEdicao.map((a) => a.id));
  const totaisNaEdicao = new Map<number, number>();
  for (const a of vinculadasNaEdicao) totaisNaEdicao.set(a.id_filho, (totaisNaEdicao.get(a.id_filho) ?? 0) + a.qtd_nao_fez);
  const minimoNaEdicao = Math.max(1, ...totaisNaEdicao.values());
  const foraDoPeriodo = editando ? ocorrencias.filter((o) => idsNaEdicao.has(o.id_filho_tarefa) &&
    (dia(o.created_at) < edicao.data_inicio.slice(0, 10) || dia(o.created_at) > edicao.data_fim.slice(0, 10))) : [];

  return (
    <>
      <PageHeader title="Vigências" description="Defina o período, a penalidade e quantas falhas são toleradas." icon={<CalendarRange className="h-6 w-6" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Cadastrar vigência</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { void runAction(() => salvar(e)); }} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="inicio">Data início <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateField id="inicio" value={form.data_inicio} onChange={(data_inicio) => setForm({ ...form, data_inicio })} /></div>
              <div className="space-y-2"><Label htmlFor="fim">Data fim <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateField id="fim" value={form.data_fim} onChange={(data_fim) => setForm({ ...form, data_fim })} /></div>
              <EscolhaPenalidade value={form} onChange={setForm} prefix="novo" />
              <div className="space-y-2"><Label>Quantidade de ocorrências <span className="text-destructive" aria-hidden="true">*</span></Label><Input type="number" value={form.qtd_ocorrencia} onChange={(e) => setForm({ ...form, qtd_ocorrencia: e.target.value })} />
                <p className="text-xs text-muted-foreground">Número de "não fez" que aplica a penalidade.</p></div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {vigencias.length === 0 && <EmptyState>Nenhuma vigência cadastrada ainda.</EmptyState>}
          {vigencias.map((v) => {
            const ativa = new Date(v.data_inicio).getTime() <= agora && new Date(v.data_fim).getTime() >= agora;
            return (
              <div key={v.id} className="flex items-start gap-4 rounded-2xl border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{fmtVigencia(v)}</p>
                    {ativa && <Badge className="bg-success text-success-foreground">Em andamento</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{descricaoPenalidade(v)}</p>
                  <p className="text-sm text-muted-foreground">Limite: {v.qtd_ocorrencia} ocorrência(s)</p>
                </div>
                 <Button variant="ghost" size="icon" onClick={() => abrirEdicao(v)} aria-label={`Editar vigência ${fmtVigencia(v)}`}><Pencil className="h-4 w-4" /></Button>
                 <BlockedAction reason={atribuicoes.some((a) => a.id_vigencia === v.id) ? "Esta vigência tem atribuições e não pode ser excluída." : undefined}>
                   <Button variant="ghost" size="icon" disabled={atribuicoes.some((a) => a.id_vigencia === v.id)} onClick={() => setConfirmarExclusao(v.id)} aria-label={`Excluir vigência ${fmtVigencia(v)}`}><Trash2 className="h-4 w-4" /></Button>
                 </BlockedAction>
              </div>
            );
          })}
        </div>
      </div>
      <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p>Tem certeza que deseja excluir a vigência <strong>{confirmarExclusao !== null ? (() => { const v = vigencias.find((item) => item.id === confirmarExclusao); return v ? fmtVigencia(v) : ""; })() : ""}</strong>?</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar vigência</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { void runAction(() => salvarEdicao(e)); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="editar-inicio">Data início <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateField id="editar-inicio" value={edicao.data_inicio} onChange={(data_inicio) => setEdicao({ ...edicao, data_inicio })} /></div>
            <div className="space-y-2"><Label htmlFor="editar-fim">Data fim <span className="text-destructive" aria-hidden="true">*</span></Label><BrDateField id="editar-fim" value={edicao.data_fim} onChange={(data_fim) => setEdicao({ ...edicao, data_fim })} /></div>
             <EscolhaPenalidade value={edicao} onChange={setEdicao} prefix="editar" />
             <div className="space-y-2"><Label htmlFor="editar-limite">Quantidade de ocorrências <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="editar-limite" type="number" value={edicao.qtd_ocorrencia} onChange={(e) => setEdicao({ ...edicao, qtd_ocorrencia: e.target.value })} />
               {minimoNaEdicao > 1 && <p className="text-xs text-muted-foreground">Mínimo: {minimoNaEdicao}, já registrado por um filho nesta vigência.</p>}</div>
             {foraDoPeriodo.length > 0 && <p className="text-sm text-destructive">{foraDoPeriodo.length} data(s) de “Não fez” fora do novo período. <Link to="/ocorrencias" className="underline">Corrigir em Ocorrências</Link> antes de salvar.</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button type="submit">Salvar alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
