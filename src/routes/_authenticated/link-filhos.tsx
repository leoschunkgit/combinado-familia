import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, MoreVertical, Share2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { msgErro, useFilhos, type Filho } from "@/lib/db";
import { useActionLoading } from "@/components/ActionLoading";
import { getChildTrackingUrl } from "@/lib/app-runtime";
import { copyText, openExternalUrl, shareLink } from "@/lib/platform-actions";

export const Route = createFileRoute("/_authenticated/link-filhos")({
  head: () => ({ meta: [
    { title: "Gerar Link / Filho — Combinado" },
    { name: "description", content: "Gerencie os links de acompanhamento dos filhos." },
  ] }),
  component: LinkFilhosPage,
});

type AcessoPublico = { token: string; ativo: boolean };

function LinkFilhosPage() {
  const { runAction } = useActionLoading();
  const { data: filhos = [] } = useFilhos();
  const [acessos, setAcessos] = useState<Record<number, AcessoPublico | null>>({});
  const [carregando, setCarregando] = useState<Record<number, boolean>>({});
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
    setCarregando((v) => ({ ...v, [idFilho]: true }));
    const { data, error } = await rpc("obter_acesso_publico_filho", { p_id_filho: idFilho });
    setCarregando((v) => ({ ...v, [idFilho]: false }));
    if (error) return;
    setAcessos((v) => ({ ...v, [idFilho]: normalizarAcesso(data) }));
  }

  useEffect(() => {
    filhos.forEach((f) => { if (!(f.id in acessos) && !carregando[f.id]) void carregarAcesso(f.id); });
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

  const urlAcesso = (token: string) => getChildTrackingUrl(token);

  async function copiarLink(token: string) {
    try { await copyText(urlAcesso(token)); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar o link"); }
  }

  async function compartilharLink(filho: Filho, token: string) {
    const url = urlAcesso(token);
    try {
      const compartilhado = await shareLink({ title: `Acompanhamento de ${filho.nome}`, text: "Acompanhe seus combinados no Combinado Família.", url });
      if (compartilhado) return;
    } catch { return; }
    await copiarLink(token);
    toast.info("O compartilhamento direto não está disponível. O link foi copiado.");
  }

  return <>
    <PageHeader title="Gerar Link / Filho" description="Gerencie os links de acompanhamento de cada filho." icon={<Link2 className="h-6 w-6" />} />
    <div className="space-y-3">
      {filhos.length === 0 && <EmptyState>Nenhum filho cadastrado ainda.</EmptyState>}
      {filhos.map((f) => {
        const acesso = acessos[f.id];
        const ativo = acesso?.ativo === true;
        return <section key={f.id} className="min-w-0 rounded-2xl border bg-card p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{f.nome}</h2><p className="text-xs text-muted-foreground">Painel de acompanhamento</p></div>
          </div>

          <div className="mt-4 min-w-0 rounded-xl border bg-muted/25 p-3">
            {carregando[f.id] ? <p className="text-sm text-muted-foreground">Carregando acesso...</p> : !acesso ? <>
              <p className="text-sm text-muted-foreground">Crie um link para {f.nome} acompanhar tarefas e resultados sem fazer login.</p>
              <Button size="sm" className="mt-3" onClick={() => void runAction(() => gerarLink(f))}><Link2 className="mr-1.5 h-3.5 w-3.5" />Gerar link</Button>
            </> : <>
              <div className="flex items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${ativo ? "bg-green-500" : "bg-muted-foreground/50"}`} /><span className={ativo ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>{ativo ? "Acesso ativo" : "Acesso desativado"}</span></div>
              {ativo && <>
                <p className="mt-2 max-w-full break-all text-xs text-muted-foreground">{urlAcesso(acesso.token)}</p>
                <div className="mt-3 flex max-w-full flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copiarLink(acesso.token)}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link</Button>
                  <Button size="sm" variant="outline" onClick={() => void compartilharLink(f, acesso.token)}><Share2 className="mr-1.5 h-3.5 w-3.5" />Compartilhar</Button>
                  <Button size="sm" variant="ghost" onClick={() => void openExternalUrl(urlAcesso(acesso.token))}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir</Button>
                </div>
              </>}
              <div className="relative mt-2 max-w-full">
                <Button size="sm" variant="ghost" className="max-w-full px-2 text-muted-foreground" onClick={() => setMaisOpcoes(maisOpcoes === f.id ? null : f.id)}><MoreVertical className="mr-1 h-3.5 w-3.5" />Mais opções</Button>
                {maisOpcoes === f.id && <div className="mt-1 flex max-w-full flex-wrap gap-2 rounded-lg border bg-background p-2">{ativo ? <><Button size="sm" variant="ghost" onClick={() => setConfirmarDesativar(f)}>Desativar acesso</Button><Button size="sm" variant="ghost" onClick={() => setConfirmarNovoLink(f)}>Gerar novo link</Button></> : <div className="min-w-0 max-w-full"><Button size="sm" variant="ghost" onClick={() => void runAction(() => gerarLink(f))}>Gerar novo link</Button><p className="px-2 pb-1 text-xs text-muted-foreground">Será criado um novo endereço de acesso.</p></div>}</div>}
              </div>
            </>}
          </div>
        </section>;
      })}
    </div>

    <Dialog open={Boolean(confirmarDesativar)} onOpenChange={(open) => !open && setConfirmarDesativar(null)}><DialogContent><DialogHeader><DialogTitle>Desativar painel</DialogTitle></DialogHeader><p>O link de <strong>{confirmarDesativar?.nome}</strong> deixará de permitir acesso ao painel. Os dados não serão apagados.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarDesativar(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { const f = confirmarDesativar; setConfirmarDesativar(null); if (f) void runAction(() => desativarLink(f)); }}>Desativar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(confirmarNovoLink)} onOpenChange={(open) => !open && setConfirmarNovoLink(null)}><DialogContent><DialogHeader><DialogTitle>Gerar novo link</DialogTitle></DialogHeader><p>O link atual de <strong>{confirmarNovoLink?.nome}</strong> deixará de funcionar imediatamente. Deseja continuar?</p><DialogFooter><Button variant="outline" onClick={() => setConfirmarNovoLink(null)}>Cancelar</Button><Button onClick={() => { const f = confirmarNovoLink; setConfirmarNovoLink(null); if (f) void runAction(() => gerarLink(f, true)); }}>Gerar novo link</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
