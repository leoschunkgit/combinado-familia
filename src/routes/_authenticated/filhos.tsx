import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { maskCelular, msgErro, useFilhos, type Filho } from "@/lib/db";

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
    <div className="flex items-center gap-2"><Checkbox id={`${prefix}-mesada`} checked={value.tem_mesada} onCheckedChange={(checked) => onChange({ ...value, tem_mesada: checked === true, valor_mesada: checked === true ? value.valor_mesada : "" })} /><Label htmlFor={`${prefix}-mesada`}>Tem mesada</Label></div>
    {value.tem_mesada && <div className="space-y-2"><Label htmlFor={`${prefix}-valor`}>Valor da mesada (R$) <span className="text-destructive" aria-hidden="true">*</span></Label><Input id={`${prefix}-valor`} inputMode="decimal" placeholder="0,00" value={value.valor_mesada} onChange={(e) => onChange({ ...value, valor_mesada: e.target.value })} /><p className="text-xs text-muted-foreground">Ao cadastrar uma mesada, a penalidade será um desconto na mesada por “Não fez”, até o limite da vigência. Sem mesada cadastrada, vale a penalidade escrita.</p></div>}
  </>;
}

function FilhosPage() {
  const qc = useQueryClient();
  const { data: filhos = [] } = useFilhos();
  const [form, setForm] = useState<FilhoForm>(vazio);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Filho | null>(null);
  const [edicao, setEdicao] = useState<FilhoForm>(vazio);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    const { error } = await supabase.from("t_filho").insert({
      nome: p.data.nome,
      email: p.data.email || null,
      celular: p.data.celular.replace(/\D/g, "") || null,
      ...dadosExtras(p.data),
    });
    setSaving(false);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Filho cadastrado");
    setForm(vazio);
    qc.invalidateQueries({ queryKey: ["filhos"] });
  }

  async function excluir(id: number) {
    const { error } = await supabase.from("t_filho").delete().eq("id", id);
    if (error) {
      toast.error(/Filho com Não fez nesta vigência/i.test(error.message)
        ? "Este filho tem registros de ‘Não fez’ e não pode ser excluído. A edição dos dados continua permitida."
        : msgErro(error));
      return;
    }
    qc.invalidateQueries();
  }

  function abrirEdicao(filho: Filho) {
    setEditando(filho);
    setEdicao({ nome: filho.nome, email: filho.email ?? "", celular: filho.celular ? maskCelular(filho.celular) : "", idade: filho.idade === null ? "" : String(filho.idade), tem_mesada: filho.tem_mesada_opcional === true && filho.valor_mesada !== null, valor_mesada: filho.valor_mesada === null ? "" : filho.valor_mesada.toFixed(2).replace(".", ",") });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const p = schema.safeParse(edicao);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    const { error } = await supabase.from("t_filho").update({
      nome: p.data.nome,
      email: p.data.email || null,
      celular: p.data.celular.replace(/\D/g, "") || null,
      ...dadosExtras(p.data),
    }).eq("id", editando.id);
    setSaving(false);
    if (error) {
      toast.error(/Mesada vinculada a vigência com desconto/i.test(error.message) ? msgErro(error) : /Filho com Não fez nesta vigência/i.test(error.message)
        ? "Não foi possível atualizar os dados deste filho. Tente novamente."
        : msgErro(error));
      return;
    }
    toast.success("Filho atualizado");
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["filhos"] });
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  return (
    <>
      <PageHeader title="Filhos" description="Cadastre os filhos vinculados à sua conta." icon={<Users className="h-6 w-6" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Cadastrar filho</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2"><Label>Nome <span className="text-destructive" aria-hidden="true">*</span></Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Celular</Label><Input type="tel" placeholder="(00) 00000-0000" value={form.celular} onChange={(e) => setForm({ ...form, celular: maskCelular(e.target.value) })} /></div>
              <CamposExtras value={form} onChange={setForm} prefix="novo-filho" />
              <Button type="submit" className="w-full" disabled={saving}>Cadastrar</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {filhos.length === 0 && <EmptyState>Nenhum filho cadastrado ainda.</EmptyState>}
          {filhos.map((f) => (
            <div key={f.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary font-display text-lg font-bold text-secondary-foreground">
                {f.nome[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{f.nome}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[f.email, f.celular && maskCelular(f.celular)].filter(Boolean).join(" · ") || "Sem contato"}
                </p>
                <p className="text-sm text-muted-foreground">{[f.idade !== null && `${f.idade} anos`, f.tem_mesada_opcional === true && f.valor_mesada !== null ? `Mesada: ${dinheiro(f.valor_mesada)}` : null].filter(Boolean).join(" · ")}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => abrirEdicao(f)} aria-label={`Editar ${f.nome}`}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => excluir(f.id)} aria-label={`Excluir ${f.nome}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar filho</DialogTitle></DialogHeader>
          <form onSubmit={salvarEdicao} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="editar-filho-nome">Nome <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="editar-filho-nome" value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="editar-filho-email">Email</Label><Input id="editar-filho-email" type="email" value={edicao.email} onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="editar-filho-celular">Celular</Label><Input id="editar-filho-celular" type="tel" value={edicao.celular} onChange={(e) => setEdicao({ ...edicao, celular: maskCelular(e.target.value) })} /></div>
            <CamposExtras value={edicao} onChange={setEdicao} prefix="editar-filho" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>Salvar alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
