import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, msgErro, type FilhoTarefa } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { usaDesconto, valorDebitado, reais } from "@/lib/mesada";

type BonusTipo="NENHUMA"|"TEXTO"|"VALOR";
type FezDraft={tarefa:FilhoTarefa;bonusTipo:BonusTipo;descricao:string;valor:string};

function hojeBR(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function diaBR(v:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(v));}

export function CheckinDiario(){
  const qc=useQueryClient();
  const {data:filhos=[]}=useFilhos();
  const {data:vigencias=[]}=useVigencias();
  const {data:atribuicoes=[],isLoading:la}=useFilhoTarefas();
  const {data:ocorrencias=[],isLoading:lo}=useOcorrencias();
  const [dispensado,setDispensado]=useState(false);
  const [busy,setBusy]=useState(false);
  const [fez,setFez]=useState<FezDraft|null>(null);
  const hoje=hojeBR();

  const pendencias=useMemo(()=>{
    const ativas=new Set(vigencias.filter(vigenciaEmAndamento).map(v=>v.id));
    const feitosHoje=new Set(ocorrencias.filter(o=>diaBR(o.created_at)===hoje).map(o=>o.id_filho_tarefa));
    return atribuicoes.filter(a=>ativas.has(a.id_vigencia)&&!feitosHoje.has(a.id));
  },[vigencias,atribuicoes,ocorrencias,hoje]);

  const atual=pendencias[0];
  const aberto=!la&&!lo&&!dispensado&&!!atual&&!fez;

  function totalNaoFez(r:FilhoTarefa){return atribuicoes.filter(a=>a.id_filho===r.id_filho&&a.id_vigencia===r.id_vigencia).reduce((s,a)=>s+a.qtd_nao_fez,0);}

  async function naoFez(r:FilhoTarefa){
    const v=r.t_vigencia;if(!v||!vigenciaEmAndamento(v))return;
    const filho=filhos.find(x=>x.id===r.id_filho);
    const comDesconto=filho?usaDesconto(filho,v):false;
    const total=totalNaoFez(r);
    if(!comDesconto&&total>=v.qtd_ocorrencia){toast.error("O limite de Não fez desta vigência já foi atingido");return;}
    const novo=total+1,penalizado=!comDesconto&&novo>=v.qtd_ocorrencia;
    setBusy(true);
    try{
      const {error}=await supabase.from("t_ocorrencia").insert({tipo:penalizado?"PENALIDADE":"NAO_FEZ",bonificacao_tipo:null,bonificacao_descricao:null,bonificacao_valor:null,id_filho_tarefa:r.id,created_at:new Date(hoje+"T12:00:00-03:00").toISOString()});
      if(error)throw error;
      const u=await supabase.from("t_filho_tarefa").update({qtd_nao_fez:r.qtd_nao_fez+1,feito:penalizado?"N":null}).eq("id",r.id);
      if(u.error)throw u.error;
      if(penalizado){
        const g=await supabase.from("t_filho_tarefa").update({feito:"N"}).eq("id_filho",r.id_filho).eq("id_vigencia",r.id_vigencia);
        if(g.error)throw g.error;
      }
      await Promise.all([qc.invalidateQueries({queryKey:["ocorrencias"]}),qc.invalidateQueries({queryKey:["filho_tarefas"]})]);
      if(comDesconto&&filho)toast.success(`Não fez registrado · Desconto acumulado: ${reais(valorDebitado(filho,v,novo))}`);
      else if(penalizado)toast.warning(`Limite atingido! Penalidade: ${v.penalidade}`);
      else toast.success(`Não fez registrado (${novo}/${v.qtd_ocorrencia})`);
    }catch(e){toast.error(msgErro(e as {message?:string}));}finally{setBusy(false);}
  }

  async function salvarFez(d:FezDraft){
    const r=d.tarefa,v=r.t_vigencia;if(!v||!vigenciaEmAndamento(v))return;
    if(d.bonusTipo==="TEXTO"&&!d.descricao.trim()){toast.error("Informe a bonificação escrita");return;}
    const valor=d.bonusTipo==="VALOR"?Number(d.valor.replace(",",".")):null;
    if(d.bonusTipo==="VALOR"&&(valor===null||!Number.isFinite(valor)||valor<0)){toast.error("Informe um valor de bonificação válido");return;}
    setBusy(true);
    try{
      const {error}=await supabase.from("t_ocorrencia").insert({tipo:"FEZ",bonificacao_tipo:d.bonusTipo==="NENHUMA"?null:d.bonusTipo,bonificacao_descricao:d.bonusTipo==="TEXTO"?d.descricao.trim():null,bonificacao_valor:d.bonusTipo==="VALOR"?valor:null,id_filho_tarefa:r.id,created_at:new Date(hoje+"T12:00:00-03:00").toISOString()});
      if(error)throw error;
      await qc.invalidateQueries({queryKey:["ocorrencias"]});
      setFez(null);
      toast.success(d.bonusTipo==="NENHUMA"?"Fez registrado":"Fez registrado com bonificação");
    }catch(e){toast.error(msgErro(e as {message?:string}));}finally{setBusy(false);}
  }

  return <>
    <Dialog open={aberto} onOpenChange={o=>!o&&!busy&&setDispensado(true)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Registro de hoje</DialogTitle><DialogDescription>Marque o resultado das tarefas de hoje. Itens já registrados não aparecem novamente.</DialogDescription></DialogHeader>
        {atual&&<div className="space-y-4"><div className="rounded-xl border bg-muted/30 p-4"><p className="text-sm text-muted-foreground">{atual.t_filho?.nome}</p><p className="mt-1 text-lg font-semibold">{atual.t_tarefa?.nome}</p></div><div className="grid grid-cols-2 gap-3"><Button variant="outline" disabled={busy} onClick={()=>setFez({tarefa:atual,bonusTipo:"NENHUMA",descricao:"",valor:""})}><ThumbsUp className="h-5 w-5 text-green-600"/> Fez</Button><Button variant="destructive" disabled={busy} onClick={()=>void naoFez(atual)}><ThumbsDown className="h-5 w-5"/> Não fez</Button></div><p className="text-center text-xs text-muted-foreground">{pendencias.length} {pendencias.length===1?"tarefa pendente":"tarefas pendentes"} hoje</p></div>}
        <DialogFooter><Button variant="ghost" disabled={busy} onClick={()=>setDispensado(true)}>Agora não</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(fez)} onOpenChange={o=>!o&&!busy&&setFez(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Registrar “Fez”</DialogTitle><DialogDescription>{fez?.tarefa.t_tarefa?.nome} · A bonificação é opcional.</DialogDescription></DialogHeader>
        {fez&&<div className="space-y-4"><div className="space-y-2"><Label>Bonificação</Label><div className="grid grid-cols-3 gap-2"><Button type="button" size="sm" variant={fez.bonusTipo==="NENHUMA"?"default":"outline"} onClick={()=>setFez({...fez,bonusTipo:"NENHUMA"})}>Nenhuma</Button><Button type="button" size="sm" variant={fez.bonusTipo==="TEXTO"?"default":"outline"} onClick={()=>setFez({...fez,bonusTipo:"TEXTO"})}>Escrita</Button><Button type="button" size="sm" variant={fez.bonusTipo==="VALOR"?"default":"outline"} onClick={()=>setFez({...fez,bonusTipo:"VALOR"})}>Valor</Button></div></div>{fez.bonusTipo==="TEXTO"&&<div className="space-y-2"><Label>Bonificação escrita</Label><input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fez.descricao} onChange={e=>setFez({...fez,descricao:e.target.value})}/></div>}{fez.bonusTipo==="VALOR"&&<div className="space-y-2"><Label>Valor da bonificação (R$)</Label><input inputMode="decimal" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fez.valor} onChange={e=>setFez({...fez,valor:e.target.value})}/></div>}</div>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setFez(null)}>Cancelar</Button><Button disabled={busy||!fez} onClick={()=>fez&&void salvarFez(fez)}>Salvar Fez</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
