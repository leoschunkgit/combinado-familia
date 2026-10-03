import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, MoreVertical, Pencil, Share2, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { maskCelular, msgErro, useFilhos, useFilhoTarefas, useVigencias, type Filho } from "@/lib/db";
import { erroLimiteMesada } from "@/lib/limite-mesada";
import { useActionLoading } from "@/components/ActionLoading";

export const Route = createFileRoute("/_authenticated/filhos")({
  head: () => ({ meta: [
    { title: "Filhos — Combinado" },
    { name: "description", content: "Cadastre e consulte os filhos vinculados à sua família." },
    { property: "og:title", content: "Filhos — Combinado" },
    { property: "og:description", content: "Cadastre e consulte os filhos vinculados à sua família." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FilhosPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.union([z.literal(""), z.string().trim().email("Email inválido").max(255)]),
  celular: z.string().refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Celular inválido"),
  idade: z.string().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 150), "Informe uma idade inteira entre 0 e 150"),
  tem_mesada: z.boolean(),
  valor_mesada: z.string(),
}).refine((v) => !v.tem_mesada || v.valor_mesada.trim() !== "", {
  message: "Informe o valor da mesada ao marcar ‘Tem mesada’", path: ["valor_mesada"],
}).refine((v) => !v.tem_mesada || (/^\d+(?:[,.]\d{1,2})?$/.test(v.valor_mesada) && Number(v.valor_mesada.replace(",", ".")) <= 9999999999.99), {
  message: "Informe um valor válido com até duas casas decimais", path: ["valor_mesada"],
});

type FilhoForm = z.input<typeof schema>;
type AcessoPublico = { token: string; ativo: boolean };
const vazio: FilhoForm = { nome: "", email: "", celular: "", idade: "", tem_mesada: false, valor_mesada: "" };
const dinheiro = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dadosExtras = (v: FilhoForm) => ({
  idade: v.idade === "" ? null : Number(v.idade),
  tem_mesada: v.tem_mesada,
  tem_mesada_opcional: v.tem_mesada ? true : null,
  valor_mesada: v.tem_mesada && v.valor_mesada !== "" ? Number(v.valor_mesada.replace(",", ".")) : null,
});

function CamposExtras({ value, onChange, prefix }: { value: FilhoForm; onChange: (v: FilhoForm) => void; prefix: string }) {
  return <>
    <div className="space-y-2"><Label htmlFor={`${prefix}-idade`}>Idade (opcional)</Label><Input id={`${prefix}-idade`} type="number" min="0" max="150" step="1" value={value.idade} onChange={(e) => onChange({ ...value, idade: e.target.value })} /></div>
    <div className="flex items-center gap-2"><Checkbox id={`${prefix}-mesada`} checked={value.tem_mesada} onCheckedChange={(checked) => onChange({ ...value, tem_mesada: checked === true, valor_mesada: checked === true ? value.valor_mesada : "" })} /><Label htmlFor={`${prefix}-mesada`}>Tem mesada <span className="text-muted-foreground font-normal">(opcional)</span></Label></div>
    {value.tem_mesada && <div className="space-y-2"><Label htmlFor={`${prefix}-valor`}>Valor da mesada (R$) <span className="text-destructive" aria-hidden="true">*</span></Label><Input id={`${prefix}-valor`} inputMode="decimal" placeholder="0,00" value={value.valor_mesada} onChange={(e) => onChange({ ...value, valor_mesada: e.target.value })} /><p className="text-xs text-muted-foreground">Ao cadastrar uma mesada, a penalidade será um desconto na mesada por “Não fez”, até o limite da vigência. Sem mesada cadastrada, vale a penalidade escrita.</p></div>}
  </>;
}

function FilhosPage() {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: filhos = [] } = useFilhos();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: vigencias = [] } = useVigencias();
  const [form, setForm] = useState<FilhoForm>(vazio);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Filho | null>(null);
  const [edicao, setEdicao] = useState<FilhoForm>(vazio);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [acessos, setAcessos] = useState<Record<number, AcessoPublico | null>>({});
  const [carregandoAcesso, setCarregandoAcesso] = useState<Record<number, boolean>>({});
  const [maisOpcoes, setMaisOpcoes] = useState<number | null>(null);
  const [confirmarNovoLink, setConfirmarNovoLink] = useState<Filho | null>(null);
  const [confirmarDesativar, setConfirmarDesativar] = useState<Filho | null>(null);

  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

  function normalizarAcesso(data: unknown): AcessoPublico | null {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    return typeof r["token"] === "string" ? { token: r["token"], ativo: r["ativo"] === true } : null;
  }

  async function carregarAcesso(idFilho: number) {
    setCarregandoAcesso((v) => ({ ...v, [idFilho]: true }));
    const { data, error } = await rpc("obter_acesso_publico_filho", { p_id_filho: idFilho });
    setCarregandoAcesso((v) => ({ ...v, [idFilho]: false }));
    if (error) return;
    setAcessos((v) => ({ ...v, [idFilho]: normalizarAcesso(data) }));
  }

  useEffect(() => {
    filhos.forEach((f) => { if (!(f.id in acessos) && !carregandoAcesso[f.id]) void carregarAcesso(f.id); });
  }, [filhos]);

  async function gerarLink(filho: Filho, regenerar = false) {
    const { data, error } = await rpc(regenerar ? "regenerar_acesso_publico_filho" : "gerar_acesso_publico_filho", { p_id_filho: filho.id });
    if (error) { toast.error(msgErro(error)); return; }
    const acesso = normalizarAcesso(data);
    if (!acesso) { toast.error("Não foi possível gerar o link de acompanhamento."); return; }
    setAcessos((v) => ({ ...v, [filho.id]: acesso }));
    setMaisOpcoes(null);
    toast.success(regenerar ? "Novo link gerado. O link anterior deixou de funcionar." : "Painel de acompanhamento ativado");
  }

  async function desativarLink(filho: Filho) {
    const { error } = await rpc("desativar_acesso_publico_filho", { p_id_filho: filho.id });
    if (error) { toast.error(msgErro(error)); return; }
    setAcessos((v) => ({ ...v, [filho.id]: v[filho.id] ? { ...v[filho.id]!, ativo: false } : null }));
    setMaisOpcoes(null);
    toast.success("Acesso ao painel desativado");
  }

  function urlAcesso(token: string) {
    return `${window.location.origin}/acompanhar/${token}`;
  }

  async function copiarLink(token: string) {
    try { await navigator.clipboard.writeText(urlAcesso(token)); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar o link"); }
  }

  async function compartilharLink(filho: Filho, token: string) {
    const url = urlAcesso(token);
    if (navigator.share) {
      try { await navigator.share({ title: `Acompanhamento de ${filho.nome}`, text: `Acompanhe seus combinados no Combinado Família.`, url }); } catch { /* compartilhamento cancelado */ }
      return;
    }
    await copiarLink(token);
    toast.info("O compartilhamento direto não está disponível neste navegador. O link foi copiado.");
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    const { error } = await supabase.from("t_filho").insert({ nome: p.data.nome, email: p.data.email || null, celular: p.data.celular.replace(/\D/g, "") || null, ...dadosExtras(p.data) });
    setSaving(false);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Filho cadastrado"); setForm(vazio); qc.invalidateQueries({ queryKey: ["filhos"] });
  }

  async function excluir(id: number) {
    const { error } = await supabase.from("t_filho").delete().eq("id", id);
    if (error) { toast.error(/Filho com Não fez nesta vigência/i.test(error.message) ? "Este filho tem registros de ‘Não fez’ e não pode ser excluído. A edição dos dados continua permitida." : msgErro(error)); return; }
    qc.invalidateQueries();
  }

  function abrirEdicao(filho: Filho) {
    setEditando(filho);
    setEdicao({ nome: filho.nome, email: filho.email ?? "", celular: filho.celular ? maskCelular(filho.celular) : "", idade: filho.idade === null ? "" : String(filho.idade), tem_mesada: filho.tem_mesada_opcional === true && filho.valor_mesada !== null, valor_mesada: filho.valor_mesada === null ? "" : filho.valor_mesada.toFixed(2).replace(".", ",") });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault(); if (!editando) return;
    const p = schema.safeParse(edicao); if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const novoFilho = { nome: p.data.nome, ...dadosExtras(p.data) };
    for (const idVigencia of new Set(atribuicoes.filter((a) => a.id_filho === editando.id).map((a) => a.id_vigencia))) {
      const vigencia = vigencias.find((v) => v.id === idVigencia); if (vigencia) { const erro = erroLimiteMesada(novoFilho, vigencia); if (erro) { toast.error(erro); return; } }
    }
    setSaving(true);
    const { error } = await supabase.from("t_filho").update({ nome: p.data.nome, email: p.data.email || null, celular: p.data.celular.replace(/\D/g, "") || null, ...dadosExtras(p.data) }).eq("id", editando.id);
    setSaving(false); if (error) { toast.error(msgErro(error)); return; }
    toast.success("Filho atualizado"); setEditando(null); qc.invalidateQueries({ queryKey: ["filhos"] }); qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  return <>
    <PageHeader title="Filhos" description="Cadastre os filhos vinculados à sua conta." icon={<Users className="h-6 w-6" />} />
    <div className="grid min-w-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-w-0 max-w-full"><CardHeader><CardTitle>Cadastrar filho</CardTitle></CardHeader><CardContent><form onSubmit={(e) => { void runAction(() => salvar(e)); }} className="space-y-4">
        <div className="space-y-2"><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="space-y-2"><Label>Email <span className="text-muted-foreground font-normal">(opcional)</span></Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2"><Label>Celular <span className="text-muted-foreground font-normal">(opcional)</span></Label><Input type="tel" placeholder="(00) 00000-0000" value={form.celular} onChange={(e) => setForm({ ...form, celular: maskCelular(e.target.value) })} /></div>
        <CamposExtras value={form} onChange={setForm} prefix="novo-filho" /><Button type="submit" className="w-full" disabled={saving}>Cadastrar</Button>
      </form></CardContent></Card>
      <div className="min-w-0 max-w-full space-y-3">{filhos.length === 0 && <EmptyState>Nenhum filho cadastrado ainda.</EmptyState>}{filhos.map((f) => {
        const acesso = acessos[f.id]; const ativo = acesso?.ativo === true;
        return <div key={f.id} className="min-w-0 max-w-full rounded-2xl border bg-card p-4">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg font-bold text-secondary-foreground">{f.nome[0]?.toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{f.nome}</p><p className="truncate text-sm text-muted-foreground">{[f.email, f.celular && maskCelular(f.celular)].filter(Boolean).join(" · ") || "Sem contato"}</p><p className="truncate text-sm text-muted-foreground">{[f.idade !== null && `${f.idade} anos`, f.tem_mesada_opcional === true && f.valor_mesada !== null ? `Mesada: ${dinheiro(f.valor_mesada)}` : null].filter(Boolean).join(" · ")}</p></div>
            <Button className="shrink-0" variant="ghost" size="icon" onClick={() => abrirEdicao(f)} aria-label={`Editar ${f.nome}`}><Pencil className="h-4 w-4" /></Button><Button className="shrink-0" variant="ghost" size="icon" onClick={() => setConfirmarExclusao(f.id)} aria-label={`Excluir ${f.nome}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="mt-4 min-w-0 max-w-full rounded-xl border bg-muted/25 p-3"><div className="flex min-w-0 items-start gap-2"><Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Painel de acompanhamento</p>
            {carregandoAcesso[f.id] ? <p className="mt-1 text-xs text-muted-foreground">Carregando acesso...</p> : !acesso ? <><p className="mt-1 text-xs text-muted-foreground">Permita que {f.nome} acompanhe tarefas e resultados sem fazer login.</p><Button size="sm" className="mt-3" onClick={() => void runAction(() => gerarLink(f))}>Gerar link</Button></> : <>
              <div className="mt-1 flex items-center gap-1.5 text-xs"><span className={`h-2 w-2 shrink-0 rounded-full ${ativo ? "bg-green-500" : "bg-muted-foreground/50"}`} /><span className={ativo ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>{ativo ? "Acesso ativo" : "Acesso desativado"}</span></div>
              {ativo && <><p className="mt-2 max-w-full break-all text-xs text-muted-foreground">{urlAcesso(acesso.token)}</p><div className="mt-3 flex min-w-0 flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copiarLink(acesso.token)}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link</Button><Button size="sm" variant="outline" onClick={() => void compartilharLink(f, acesso.token)}><Share2 className="mr-1.5 h-3.5 w-3.5" />Compartilhar</Button><Button size="sm" variant="ghost" onClick={() => window.open(urlAcesso(acesso.token), "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir</Button></div></>}
               <div className="relative mt-2 min-w-0 max-w-full"><Button size="sm" variant="ghost" className="max-w-full px-2 text-muted-foreground" onClick={() => setMaisOpcoes(maisOpcoes === f.id ? null : f.id)}><MoreVertical className="mr-1 h-3.5 w-3.5" />Mais opções</Button>{maisOpcoes === f.id && <div className="mt-1 flex min-w-0 max-w-full flex-wrap gap-2 rounded-lg border bg-background p-2">{ativo ? <><Button size="sm" variant="ghost" onClick={() => setConfirmarDesativar(f)}>Desativar acesso</Button><Button size="sm" variant="ghost" onClick={() => setConfirmarNovoLink(f)}>Gerar novo link</Button></> : <div className="min-w-0 max-w-full"><Button size="sm" variant="ghost" onClick={() => void runAction(() => gerarLink(f))}>Gerar novo link</Button><p className="max-w-full break-words px-2 pb-1 text-xs text-muted-foreground">Será criado um novo endereço de acesso.</p></div>}</div>}</div>
            </>}</div></div></div>
        </div>;
      })}</div>
    </div>
    <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}><DialogContent><DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader><p>Tem certeza que deseja excluir <strong>{filhos.find((f) => f.id === confirmarExclusao)?.nome}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(confirmarDesativar)} onOpenChange={(open) => !open && setConfirmarDesativar(null)}><DialogContent><DialogHeader><DialogTitle>Desativar painel</DialogTitle></DialogHeader><p>O link de <strong>{confirmarDesativar?.nome}</strong> deixará de permitir acesso ao painel. Os dados não serão apagados.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarDesativar(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { const f = confirmarDesativar; setConfirmarDesativar(null); if (f) void runAction(() => desativarLink(f)); }}>Desativar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(confirmarNovoLink)} onOpenChange={(open) => !open && setConfirmarNovoLink(null)}><DialogContent><DialogHeader><DialogTitle>Gerar novo link</DialogTitle></DialogHeader><p>O link atual de <strong>{confirmarNovoLink?.nome}</strong> deixará de funcionar imediatamente. Deseja continuar?</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarNovoLink(null)}>Cancelar</Button><Button onClick={() => { const f = confirmarNovoLink; setConfirmarNovoLink(null); if (f) void runAction(() => gerarLink(f, true)); }}>Gerar novo link</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}><DialogContent><DialogHeader><DialogTitle>Editar filho</DialogTitle></DialogHeader><form onSubmit={(e) => { void runAction(() => salvarEdicao(e)); }} className="space-y-4"><div className="space-y-2"><Label htmlFor="editar-filho-nome">Nome *</Label><Input id="editar-filho-nome" value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="editar-filho-email">Email <span className="text-muted-foreground font-normal">(opcional)</span></Label><Input id="editar-filho-email" type="email" value={edicao.email} onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="editar-filho-celular">Celular <span className="text-muted-foreground font-normal">(opcional)</span></Label><Input id="editar-filho-celular" type="tel" value={edicao.celular} onChange={(e) => setEdicao({ ...edicao, celular: maskCelular(e.target.value) })} /></div><CamposExtras value={edicao} onChange={setEdicao} prefix="editar-filho" /><DialogFooter><Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" disabled={saving}>Salvar alterações</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}
