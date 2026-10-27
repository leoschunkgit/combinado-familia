import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Smartphone, Trash2, Users, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { AtribuicaoDialog } from "@/components/AtribuicaoDialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { msgErro, useFilhos, useFilhoTarefas, useTarefas, useVigencias, type Filho } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { useActionLoading } from "@/components/ActionLoading";
import { Hint } from "@/components/Hint";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { InfoTile } from "@/components/InfoTile";
import { RecompensasRapidas, criarRecompensasRapidasVazias, prepararRecompensasRapidas } from "@/components/RecompensasRapidas";

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

const corValida = (valor: string) => {
  const cor = valor.trim();
  if (cor === "") return true;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(cor)) return true;
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(cor);
  return Boolean(rgb && rgb.slice(1).every((parte) => Number(parte) >= 0 && Number(parte) <= 255));
};

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(100),
  idade: z.string().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 150), "Informe uma idade inteira entre 0 e 150"),
  cor: z.string().trim().max(50).refine(corValida, "Use uma cor hexadecimal ou RGB válida"),
  avatar: z.union([z.literal(""), z.literal("menino"), z.literal("menina")]),
  valor_mesada: z.string(),
}).refine((v) => v.valor_mesada.trim() === "" || (/^\d+(?:[,.]\d{1,2})?$/.test(v.valor_mesada) && Number(v.valor_mesada.replace(",", ".")) > 0 && Number(v.valor_mesada.replace(",", ".")) <= 9999999999.99), {
  message: "Informe um valor de mesada válido, maior que zero e com até duas casas decimais", path: ["valor_mesada"],
});

type FilhoForm = z.input<typeof schema>;
const vazio: FilhoForm = { nome: "", idade: "", cor: "", avatar: "", valor_mesada: "" };
const dinheiro = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dadosExtras = (v: FilhoForm) => ({
  idade: v.idade === "" ? null : Number(v.idade),
  cor: v.cor.trim() || null,
  avatar: v.avatar || null,
  tem_mesada: v.valor_mesada.trim() !== "",
  valor_mesada: v.valor_mesada.trim() !== "" ? Number(v.valor_mesada.replace(",", ".")) : null,
});

function CamposExtras({ value, onChange, prefix }: { value: FilhoForm; onChange: (v: FilhoForm) => void; prefix: string }) {
  const corPicker = /^#[0-9a-f]{6}$/i.test(value.cor.trim()) ? value.cor.trim() : "#0C5C3C";
  return <>
    <div className="space-y-2"><Label htmlFor={`${prefix}-idade`}>Idade (opcional)</Label><Input id={`${prefix}-idade`} type="number" min="0" max="150" step="1" value={value.idade} onChange={(e) => onChange({ ...value, idade: e.target.value })} /></div>

    <div className="space-y-2"><Label htmlFor={`${prefix}-valor`}>Mesada <span className="text-muted-foreground font-normal">(opcional)</span></Label><CurrencyInput id={`${prefix}-valor`} value={value.valor_mesada} onValueChange={(valor_mesada) => onChange({ ...value, valor_mesada })} placeholder="R$ 100,00" /><p className="text-xs text-muted-foreground">Se informado, o valor será usado como base para os descontos de “Não fez”.</p></div>

    <div className="space-y-2 pt-1">
      <Label>Avatar <span className="text-muted-foreground font-normal">(opcional)</span></Label>
      <div className="flex flex-wrap gap-1.5">
        {([
          { valor: "" as const, label: "Iniciais" },
          { valor: "menino" as const, label: "Menino" },
          { valor: "menina" as const, label: "Menina" },
        ]).map((opcao) => (
          <button
            key={opcao.label}
            type="button"
            aria-pressed={value.avatar === opcao.valor}
            onClick={() => onChange({ ...value, avatar: opcao.valor })}
            className={`flex h-9 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors ${
              value.avatar === opcao.valor ? "border-primary bg-primary/5 text-primary" : "bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            <FilhoAvatar nome={value.nome || "Filho"} cor={value.cor || null} avatar={opcao.valor || null} className="h-6 w-6" />
            <span>{opcao.label}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor={`${prefix}-cor-texto`}>Cor <span className="text-muted-foreground font-normal">(opcional)</span></Label>
      <div className="flex items-center gap-2">
        <input
          id={`${prefix}-cor`}
          type="color"
          value={corPicker}
          onChange={(e) => onChange({ ...value, cor: e.target.value })}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-background p-1"
          aria-label="Escolher cor do filho"
        />
        <Input
          id={`${prefix}-cor-texto`}
          value={value.cor}
          onChange={(e) => onChange({ ...value, cor: e.target.value })}
          placeholder="#0C5C3C ou rgb(12, 92, 60)"
          maxLength={50}
          className="h-9"
        />
      </div>
    </div>
  </>;
}

function FilhosPage() {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: vigencias = [] } = useVigencias();
  const vigenciaAtual = vigencias.find(vigenciaEmAndamento);
  const [form, setForm] = useState<FilhoForm>(vazio);
  const [novoAberto, setNovoAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Filho | null>(null);
  const [edicao, setEdicao] = useState<FilhoForm>(vazio);
  const [recompensasNovo, setRecompensasNovo] = useState(criarRecompensasRapidasVazias);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [confirmarExclusaoTodos, setConfirmarExclusaoTodos] = useState(false);
  const [filhoPosCadastro, setFilhoPosCadastro] = useState<{ id: number; nome: string; cor: string | null; avatar: string | null } | null>(null);
  const [perguntarAtribuicao, setPerguntarAtribuicao] = useState(false);
  const [atribuirAberto, setAtribuirAberto] = useState(false);
  const [filhosAbertos, setFilhosAbertos] = useState<Record<number, boolean>>({});
  async function salvar(e: FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }

    const recompensasPreparadas = prepararRecompensasRapidas(recompensasNovo);
    if (!recompensasPreparadas.ok) {
      toast.error(recompensasPreparadas.mensagem);
      return;
    }

    const extras = dadosExtras(p.data);

    setSaving(true);
    const { data, error } = await supabase.rpc("cadastrar_filho_com_recompensas", {
      p_nome: p.data.nome,
      p_idade: extras.idade,
      p_cor: extras.cor,
      p_avatar: extras.avatar,
      p_valor_mesada: extras.valor_mesada,
      p_recompensas: recompensasPreparadas.recompensas,
    });
    setSaving(false);

    const criado = data as unknown as {
      id?: number;
      nome?: string;
      cor?: string | null;
      avatar?: string | null;
      qtd_recompensas?: number;
    } | null;

    if (error || !criado?.id) { toast.error(msgErro(error)); return; }

    toast.success(
      criado.qtd_recompensas
        ? `Filho cadastrado com ${criado.qtd_recompensas} recompensa${criado.qtd_recompensas === 1 ? "" : "s"}`
        : "Filho cadastrado",
    );
    setForm(vazio);
    setRecompensasNovo(criarRecompensasRapidasVazias());
    setNovoAberto(false);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["filhos"] }),
      qc.invalidateQueries({ queryKey: ["resumo_estrelas_filho"] }),
    ]);

    if (tarefas.length > 0 && vigenciaAtual) {
      setFilhoPosCadastro({
        id: criado.id,
        nome: criado.nome ?? p.data.nome,
        cor: criado.cor ?? extras.cor,
        avatar: criado.avatar ?? extras.avatar,
      });
      setPerguntarAtribuicao(true);
    }
  }

  async function excluir(id: number) {
    const { error } = await supabase.rpc("excluir_filho_com_regra", { p_id_filho: id });
    if (error) { toast.error(msgErro(error)); return; }
    await qc.invalidateQueries();
  }

  async function excluirTodos() {
    if (filhos.length === 0) return;

    const { error } = await supabase.rpc("excluir_todos_filhos_com_regra");

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    setConfirmarExclusaoTodos(false);
    await qc.invalidateQueries();
    toast.success("Todos os filhos foram excluídos");
  }

  function abrirEdicao(filho: Filho) {
    setEditando(filho);
    setEdicao({ nome: filho.nome, idade: filho.idade === null ? "" : String(filho.idade), cor: filho.cor ?? "", avatar: filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : "", valor_mesada: filho.tem_mesada === true && filho.valor_mesada !== null ? filho.valor_mesada.toFixed(2).replace(".", ",") : "" });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault(); if (!editando) return;
    const p = schema.safeParse(edicao); if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    const { error } = await supabase.from("t_filho").update({ nome: p.data.nome, ...dadosExtras(p.data) }).eq("id", editando.id);
    setSaving(false); if (error) { toast.error(msgErro(error)); return; }
    toast.success("Filho atualizado"); setEditando(null); qc.invalidateQueries({ queryKey: ["filhos"] }); qc.invalidateQueries({ queryKey: ["filho_tarefas"] }); qc.invalidateQueries({ queryKey: ["filho_vigencia_mesadas"] });
  }

  const podeExcluirTodos = filhos.length > 0;

  return <>
    <PageHeader
      title="Filhos"
      description="Cadastre seus filhos"
      icon={<Users className="h-6 w-6" />}
      action={
        <div className="flex items-center gap-2">
          {podeExcluirTodos && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs sm:px-2.5"
              onClick={() => setConfirmarExclusaoTodos(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir todos
            </Button>
          )}
          <Button size="sm" className="h-8 px-2 text-xs sm:px-2.5" onClick={() => setNovoAberto(true)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
        </div>
      }
    />
    <div className="min-w-0 max-w-full space-y-3">{filhos.length === 0 && <EmptyState>Nenhum filho cadastrado ainda.</EmptyState>}{filhos.map((f) => {
        const aberto = filhosAbertos[f.id] === true;
        return <CollapsibleSection
          key={f.id}
          title={
            <span className="flex min-w-0 items-center gap-2.5">
              <FilhoAvatar nome={f.nome} cor={f.cor} avatar={f.avatar === "menino" || f.avatar === "menina" ? f.avatar : null} className="h-9 w-9 shrink-0" />
              <span className="min-w-0 truncate text-base font-semibold">{f.nome}</span>
            </span>
          }
          open={aberto}
          onOpenChange={(open) => setFilhosAbertos((atuais) => ({ ...atuais, [f.id]: open }))}
          action={
            <>
              <Hint content="Editar filho">
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => abrirEdicao(f)} aria-label={`Editar ${f.nome}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </Hint>
              <Hint content="Excluir filho">
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => setConfirmarExclusao(f.id)} aria-label={`Excluir ${f.nome}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Hint>
            </>
          }
          contentClassName="p-4"
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoTile
              label="Idade"
              value={f.idade !== null ? `${f.idade} anos` : "Não informada"}
            />
            <InfoTile
              label="Mesada"
              icon={<WalletCards className="h-3.5 w-3.5" />}
              className="col-span-2 sm:col-span-1"
              value={f.tem_mesada === true && f.valor_mesada !== null ? dinheiro(f.valor_mesada) : "Não"}
            />
          </div>

          <div className="mt-3 border-t pt-3">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="w-full justify-center sm:w-auto"
            >
              <Link to="/acesso-filhos" search={{ filho: f.id }}>
                <Smartphone className="h-3.5 w-3.5" />
                Gerenciar acesso
              </Link>
            </Button>
          </div>
        </CollapsibleSection>;
      })}</div>
    <Dialog open={novoAberto} onOpenChange={(open) => { setNovoAberto(open); if (!open) { setForm(vazio); setRecompensasNovo(criarRecompensasRapidasVazias()); } }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Adicionar filho</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { void runAction(() => salvar(e)); }} className="space-y-4">
          <div className="space-y-2"><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <CamposExtras value={form} onChange={setForm} prefix="novo-filho" />
          <div className="border-t pt-3">
            <RecompensasRapidas value={recompensasNovo} onChange={setRecompensasNovo} prefix="novo-filho" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setNovoAberto(false); setForm(vazio); setRecompensasNovo(criarRecompensasRapidasVazias()); }}>Cancelar</Button>
            <Button type="submit" disabled={saving}>Cadastrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={perguntarAtribuicao} onOpenChange={setPerguntarAtribuicao}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Filho cadastrado com sucesso</DialogTitle></DialogHeader>
        {filhoPosCadastro && (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FilhoAvatar nome={filhoPosCadastro.nome} cor={filhoPosCadastro.cor} avatar={filhoPosCadastro.avatar === "menino" || filhoPosCadastro.avatar === "menina" ? filhoPosCadastro.avatar : null} className="h-5 w-5" />
            <span>{filhoPosCadastro.nome}</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">Deseja atribuir tarefas para este filho na vigência atual?</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setPerguntarAtribuicao(false); setFilhoPosCadastro(null); }}>Agora não</Button>
          <Button type="button" onClick={() => { setPerguntarAtribuicao(false); setAtribuirAberto(true); }}>Sim, atribuir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AtribuicaoDialog
      open={atribuirAberto}
      onOpenChange={(open) => { setAtribuirAberto(open); if (!open) setFilhoPosCadastro(null); }}
      mode="POS_CADASTRO_FILHO"
      vigenciaInicialId={vigenciaAtual?.id ?? null}
      filhoInicial={filhoPosCadastro}
    />

    <Dialog open={confirmarExclusaoTodos} onOpenChange={setConfirmarExclusaoTodos}>
      <DialogContent>
        <DialogHeader><DialogTitle>Excluir todos os filhos?</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <p>Tem certeza que deseja excluir todos os filhos cadastrados?</p>
          <p className="text-sm text-muted-foreground">
            As atribuições, resultados, consequências, estrelas, recompensas, solicitações, acessos e histórico dos filhos também serão excluídos. As tarefas e vigências permanecem. A exclusão não poderá ser desfeita.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmarExclusaoTodos(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void runAction(excluirTodos)}>
            <Trash2 className="h-4 w-4" /> Excluir todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}><DialogContent><DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader><div className="space-y-2">{(() => { const filho = filhos.find((f) => f.id === confirmarExclusao); return filho ? <div className="flex items-center gap-2 text-sm font-semibold"><FilhoAvatar nome={filho.nome} cor={filho.cor} avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null} className="h-5 w-5" /><span>{filho.nome}</span></div> : null; })()}<p>Tem certeza que deseja excluir este filho?</p><p className="text-sm text-muted-foreground">As atribuições, resultados, consequências, estrelas, recompensas, solicitações, acessos e histórico deste filho também serão excluídos. As tarefas e vigências permanecem.</p></div><DialogFooter><Button variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}><DialogContent><DialogHeader><DialogTitle>Editar filho</DialogTitle></DialogHeader><form onSubmit={(e) => { void runAction(() => salvarEdicao(e)); }} className="space-y-4"><div className="space-y-2"><Label htmlFor="editar-filho-nome">Nome *</Label><Input id="editar-filho-nome" value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} /></div><CamposExtras value={edicao} onChange={setEdicao} prefix="editar-filho" /><DialogFooter><Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" disabled={saving}>Salvar alterações</Button></DialogFooter></form></DialogContent></Dialog>

  </>;
}
