import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Copy, ExternalLink, Link2, PowerOff, RefreshCw, Share2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { uiTypography } from "@/lib/ui-typography";
import { msgErro, useFilhos, type Filho } from "@/lib/db";
import { useActionLoading } from "@/components/ActionLoading";
import { getChildTrackingUrl } from "@/lib/app-runtime";
import { copyText, openExternalUrl, shareLink } from "@/lib/platform-actions";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { CollapsibleSection } from "@/components/CollapsibleSection";

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
  const [filhosAbertos, setFilhosAbertos] = useState<Record<number, boolean>>({});
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
        const aberto = filhosAbertos[f.id] === true;
        return <CollapsibleSection
          key={f.id}
          title={
            <span className="flex min-w-0 items-center gap-2.5">
              <FilhoAvatar nome={f.nome} cor={f.cor} avatar={f.avatar === "menino" || f.avatar === "menina" ? f.avatar : null} className="h-7 w-7" />
              <span className={`min-w-0 truncate ${uiTypography.secondaryTitle}`}>{f.nome}</span>
            </span>
          }
          description="Painel de acompanhamento"
          open={aberto}
          onOpenChange={(open) => setFilhosAbertos((atuais) => ({ ...atuais, [f.id]: open }))}
          contentClassName="p-4"
        >
          <div className="min-w-0 rounded-xl border bg-muted/25 p-3">
            {carregando[f.id] ? <p className="text-sm text-muted-foreground">Carregando acesso...</p> : !acesso ? <>
              <p className="text-sm text-muted-foreground">Crie um link para {f.nome} acompanhar tarefas e resultados sem fazer login.</p>
              <Button size="sm" className="mt-3" onClick={() => void runAction(() => gerarLink(f))}><Link2 className="mr-1.5 h-3.5 w-3.5" />Gerar link</Button>
            </> : <>
              <div className="flex items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${ativo ? "bg-green-500" : "bg-muted-foreground/50"}`} /><span className={ativo ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>{ativo ? "Acesso ativo" : "Acesso desativado"}</span></div>
              {ativo && <>
                <p className="mt-2 max-w-full break-all text-xs leading-relaxed text-muted-foreground">{urlAcesso(acesso.token)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button size="sm" variant="outline" className="w-full justify-center sm:w-auto" onClick={() => void copiarLink(acesso.token)}><Copy className="h-3.5 w-3.5" />Copiar</Button>
                  <Button size="sm" variant="outline" className="w-full justify-center sm:w-auto" onClick={() => void compartilharLink(f, acesso.token)}><Share2 className="h-3.5 w-3.5" />Compartilhar</Button>
                  <Button size="sm" variant="outline" className="w-full justify-center sm:w-auto" onClick={() => void openExternalUrl(urlAcesso(acesso.token))}><ExternalLink className="h-3.5 w-3.5" />Abrir</Button>
                  <Button size="sm" variant="ghost" className="w-full justify-center text-muted-foreground sm:w-auto" onClick={() => setMaisOpcoes(maisOpcoes === f.id ? null : f.id)}>{maisOpcoes === f.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}Mais opções</Button>
                </div>
              </>}
              {!ativo && (
                <div className="mt-3">
                  <Button size="sm" variant="ghost" className="px-2 text-muted-foreground" onClick={() => setMaisOpcoes(maisOpcoes === f.id ? null : f.id)}>{maisOpcoes === f.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}Mais opções</Button>
                </div>
              )}
              {maisOpcoes === f.id && (
                <div className="mt-2 rounded-lg border bg-background p-2.5">
                  {ativo ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={() => setConfirmarDesativar(f)}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                        Desativar acesso
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setConfirmarNovoLink(f)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Gerar novo link
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => void runAction(() => gerarLink(f))}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Gerar novo link
                      </Button>
                      <p className="px-1 text-xs leading-relaxed text-muted-foreground">Será criado um novo endereço de acesso.</p>
                    </div>
                  )}
                </div>
              )}
            </>}
          </div>
        </CollapsibleSection>;
      })}
    </div>

    <Dialog open={Boolean(confirmarDesativar)} onOpenChange={(open) => !open && setConfirmarDesativar(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Desativar painel</DialogTitle></DialogHeader>
        {confirmarDesativar && <div className="flex items-center gap-2 text-sm font-semibold"><FilhoAvatar nome={confirmarDesativar.nome} cor={confirmarDesativar.cor} avatar={confirmarDesativar.avatar === "menino" || confirmarDesativar.avatar === "menina" ? confirmarDesativar.avatar : null} className="h-5 w-5" /><span>{confirmarDesativar.nome}</span></div>}
        <p>O link deixará de permitir acesso ao painel. Os dados não serão apagados.</p>
        <DialogFooter><Button variant="outline" onClick={() => setConfirmarDesativar(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { const f = confirmarDesativar; setConfirmarDesativar(null); if (f) void runAction(() => desativarLink(f)); }}>Desativar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(confirmarNovoLink)} onOpenChange={(open) => !open && setConfirmarNovoLink(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar novo link</DialogTitle></DialogHeader>
        {confirmarNovoLink && <div className="flex items-center gap-2 text-sm font-semibold"><FilhoAvatar nome={confirmarNovoLink.nome} cor={confirmarNovoLink.cor} avatar={confirmarNovoLink.avatar === "menino" || confirmarNovoLink.avatar === "menina" ? confirmarNovoLink.avatar : null} className="h-5 w-5" /><span>{confirmarNovoLink.nome}</span></div>}
        <p>O link atual deixará de funcionar imediatamente. Deseja continuar?</p>
        <DialogFooter><Button variant="outline" onClick={() => setConfirmarNovoLink(null)}>Cancelar</Button><Button onClick={() => { const f = confirmarNovoLink; setConfirmarNovoLink(null); if (f) void runAction(() => gerarLink(f, true)); }}>Gerar novo link</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
