import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { maskCelular, msgErro, useFilhos } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/filhos")({
  head: () => ({ meta: [{ title: "Filhos — Combinado" }] }),
  component: FilhosPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.union([z.literal(""), z.string().trim().email("Email inválido").max(255)]),
  celular: z.string().refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Celular inválido"),
});

function FilhosPage() {
  const qc = useQueryClient();
  const { data: filhos = [] } = useFilhos();
  const [form, setForm] = useState({ nome: "", email: "", celular: "" });
  const [saving, setSaving] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    const { error } = await supabase.from("t_filho").insert({
      nome: p.data.nome,
      email: p.data.email || null,
      celular: p.data.celular.replace(/\D/g, "") || null,
    });
    setSaving(false);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Filho cadastrado");
    setForm({ nome: "", email: "", celular: "" });
    qc.invalidateQueries({ queryKey: ["filhos"] });
  }

  async function excluir(id: number) {
    const { error } = await supabase.from("t_filho").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader title="Filhos" description="Cadastre os filhos vinculados à sua conta." icon={<Users className="h-6 w-6" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Cadastrar filho</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Celular</Label><Input type="tel" placeholder="(00) 00000-0000" value={form.celular} onChange={(e) => setForm({ ...form, celular: maskCelular(e.target.value) })} /></div>
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
              </div>
              <Button variant="ghost" size="icon" onClick={() => excluir(f.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
