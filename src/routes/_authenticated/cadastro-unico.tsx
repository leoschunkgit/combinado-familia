import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarRange, Copy, Link2, ListPlus, ListTodo, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/CurrencyInput";
import { BrDateTimeField } from "@/components/BrDateTimeField";
import { Pick } from "@/components/Pick";
import { PageHeader } from "@/components/PageHeader";
import { useActionLoading } from "@/components/ActionLoading";
import { fmtVigencia, msgErro, paraCampoDataHoraBrasil, paraIsoDataHoraBrasil, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";
import { erroLimiteMesada } from "@/lib/limite-mesada";

export const Route = createFileRoute("/_authenticated/cadastro-unico")({
  head: () => ({ meta: [
    { title: "Cadastro único — Combinado" },
    { name: "description", content: "Cadastre filhos, tarefas, vigência e associações em um único fluxo." },
  ] }),
  component: CadastroUnicoPage,
});

type Modo = "novo" | "duplicar";
type VigenciaDraft = {
  data_inicio: string;
  data_fim: string;
  penalidade: string;
  qtd_ocorrencia: string;
  valor_debito: string;
};

const vigenciaInicial = (): VigenciaDraft => {
  const inicio = new Date();
  const fim = new Date(inicio.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    data_inicio: paraCampoDataHoraBrasil(inicio.toISOString()),
    data_fim: paraCampoDataHoraBrasil(fim.toISOString()),
    penalidade: "",
    qtd_ocorrencia: "3",
    valor_debito: "",
  };
};

function CadastroUnicoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();

  const [modo, setModo] = useState<Modo>("novo");
  const [nomeFilho, setNomeFilho] = useState("");
  const [temMesada, setTemMesada] = useState(false);
  const [valorMesada, setValorMesada] = useState("");
  const [nomeTarefa, setNomeTarefa] = useState("");
  const [filhosSelecionados, setFilhosSelecionados] = useState<number[]>([]);
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState<number[]>([]);
  const [vigenciaDraft, setVigenciaDraft] = useState<VigenciaDraft>(() => vigenciaInicial());
  const [vigenciaCriadaId, setVigenciaCriadaId] = useState<number | null>(null);
  const [modeloId, setModeloId] = useState("");
  const [duplicacao, setDuplicacao] = useState<VigenciaDraft>(() => vigenciaInicial());

  const vigenciasOrdenadas = [...vigencias].sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());
  const modelo = vigencias.find((v) => v.id === Number(modeloId));
  const associacoesModelo = useMemo(() => atribuicoes.filter((a) => a.id_vigencia === Number(modeloId)), [atribuicoes, modeloId]);
  const totalCombinacoes = filhosSelecionados.length * tarefasSelecionadas.length;

  const alternar = (lista: number[], setLista: (v: number[]) => void, id: number) =>
    setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  async function cadastrarFilho() {
    const nome = nomeFilho.trim();
    if (nome.length < 2 || nome.length > 100) { toast.error("Informe o nome do filho"); return; }
    if (temMesada && (!/^\d+(?:[,.]\d{1,2})?$/.test(valorMesada) || Number(valorMesada.replace(",", ".")) <= 0)) {
      toast.error("Informe um valor de mesada válido"); return;
    }
    const { data, error } = await supabase.from("t_filho").insert({
      nome, email: null, celular: null, idade: null,
      tem_mesada: temMesada,
      tem_mesada_opcional: temMesada ? true : null,
      valor_mesada: temMesada ? Number(valorMesada.replace(",", ".")) : null,
    }).select("id").single();
    if (error || !data) { toast.error(msgErro(error)); return; }
    setFilhosSelecionados((atuais) => [...new Set([...atuais, data.id])]);
    setNomeFilho(""); setTemMesada(false); setValorMesada("");
    await qc.invalidateQueries({ queryKey: ["filhos"] });
    toast.success("Filho adicionado ao lote");
  }

  async function cadastrarTarefa() {
    const nome = nomeTarefa.trim();
    if (nome.length < 2 || nome.length > 150) { toast.error("Informe um nome de tarefa entre 2 e 150 caracteres"); return; }
    const { data, error } = await supabase.from("t_tarefa").insert({ nome }).select("id").single();
    if (error || !data) { toast.error(msgErro(error)); return; }
    setTarefasSelecionadas((atuais) => [...new Set([...atuais, data.id])]);
    setNomeTarefa("");
    await qc.invalidateQueries({ queryKey: ["tarefas"] });
    toast.success("Tarefa adicionada ao lote");
  }

  function validarVigencia(draft: VigenciaDraft) {
    if (!draft.data_inicio || !draft.data_fim) return "Informe início e fim da vigência";
    const inicio = new Date(draft.data_inicio).getTime();
    const fim = new Date(draft.data_fim).getTime();
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return "A data/hora fim deve ser posterior ao início";
    if (draft.penalidade.trim().length < 2) return "Informe a penalidade";
    const qtd = Number(draft.qtd_ocorrencia);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 31) return "A quantidade de “Não fez” deve estar entre 1 e 31";
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(draft.valor_debito) || Number(draft.valor_debito.replace(",", ".")) <= 0) return "Informe o desconto por “Não fez”";
    return null;
  }

  async function criarVigencia() {
    const erro = validarVigencia(vigenciaDraft);
    if (erro) { toast.error(erro); return; }
    const payload = {
      data_inicio: paraIsoDataHoraBrasil(vigenciaDraft.data_inicio),
      data_fim: paraIsoDataHoraBrasil(vigenciaDraft.data_fim),
      penalidade: vigenciaDraft.penalidade.trim(),
      qtd_ocorrencia: Number(vigenciaDraft.qtd_ocorrencia),
      tipo_penalidade: "texto",
      valor_debito: Number(vigenciaDraft.valor_debito.replace(",", ".")),
    };
    const { data, error } = await supabase.from("t_vigencia").insert(payload).select("id").single();
    if (error || !data) { toast.error(msgErro(error)); return; }
    setVigenciaCriadaId(data.id);
    await qc.invalidateQueries({ queryKey: ["vigencias"] });
    toast.success("Vigência criada para este lote");
  }

  async function criarAssociacoes() {
    if (!vigenciaCriadaId) { toast.error("Crie a vigência antes das associações"); return; }
    if (!filhosSelecionados.length || !tarefasSelecionadas.length) { toast.error("Selecione ao menos um filho e uma tarefa"); return; }

    const vigencia = vigencias.find((v) => v.id === vigenciaCriadaId);
    if (!vigencia) { toast.error("Aguarde a atualização da vigência e tente novamente"); return; }

    for (const id of filhosSelecionados) {
      const filho = filhos.find((f) => f.id === id);
      if (filho) {
        const erro = erroLimiteMesada(filho, vigencia);
        if (erro) { toast.error(`${filho.nome}: ${erro}`); return; }
      }
    }

    const existentes = new Set(atribuicoes.map((a) => `${a.id_vigencia}|${a.id_filho}|${a.id_tarefa}`));
    const novos = filhosSelecionados.flatMap((id_filho) =>
      tarefasSelecionadas.map((id_tarefa) => ({ id_vigencia: vigenciaCriadaId, id_filho, id_tarefa }))
    ).filter((x) => !existentes.has(`${x.id_vigencia}|${x.id_filho}|${x.id_tarefa}`));

    if (!novos.length) { toast.info("Todas essas associações já existem"); return; }
    const { error } = await supabase.from("t_filho_tarefa").insert(novos);
    if (error) { toast.error(msgErro(error)); return; }
    await qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
    toast.success(`${novos.length} associação(ões) criada(s)`);
  }

  function escolherModelo(value: string) {
    setModeloId(value);
    const v = vigencias.find((item) => item.id === Number(value));
    if (!v) return;
    const inicio = new Date(v.data_inicio).getTime();
    const fim = new Date(v.data_fim).getTime();
    const duracao = Math.max(60_000, fim - inicio);
    const novoInicio = new Date(fim + 60_000);
    const novoFim = new Date(novoInicio.getTime() + duracao);
    setDuplicacao({
      data_inicio: paraCampoDataHoraBrasil(novoInicio.toISOString()),
      data_fim: paraCampoDataHoraBrasil(novoFim.toISOString()),
      penalidade: v.penalidade ?? "",
      qtd_ocorrencia: String(v.qtd_ocorrencia),
      valor_debito: v.valor_debito === null ? "" : v.valor_debito.toFixed(2).replace(".", ","),
    });
  }

  async function duplicarVigencia() {
    if (!modelo) { toast.error("Selecione a vigência que será usada como modelo"); return; }
    const erro = validarVigencia(duplicacao);
    if (erro) { toast.error(erro); return; }

    const novoInicio = new Date(duplicacao.data_inicio).getTime();
    const fimModelo = new Date(modelo.data_fim).getTime();
    if (novoInicio <= fimModelo) {
      toast.error("A nova vigência deve começar depois do término da vigência modelo");
      return;
    }

    const { data: nova, error: erroVigencia } = await supabase.from("t_vigencia").insert({
      data_inicio: paraIsoDataHoraBrasil(duplicacao.data_inicio),
      data_fim: paraIsoDataHoraBrasil(duplicacao.data_fim),
      penalidade: duplicacao.penalidade.trim(),
      qtd_ocorrencia: Number(duplicacao.qtd_ocorrencia),
      tipo_penalidade: "texto",
      valor_debito: Number(duplicacao.valor_debito.replace(",", ".")),
    }).select("id").single();

    if (erroVigencia || !nova) { toast.error(msgErro(erroVigencia)); return; }

    if (associacoesModelo.length > 0) {
      const novasAtribuicoes = associacoesModelo.map((a) => ({
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
    ]);
    toast.success(`Nova vigência criada com ${associacoesModelo.length} associação(ões) copiadas e zeradas`);
    navigate({ to: "/vigencias" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Cadastro único" description="Cadastre vários filhos e tarefas em lote, crie associações e reutilize vigências anteriores." icon={<ListPlus className="h-6 w-6" />} />
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/inicio" })}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" variant={modo === "novo" ? "default" : "outline"} onClick={() => setModo("novo")}><Plus className="h-4 w-4" /> Montar novo lote</Button>
        <Button type="button" variant={modo === "duplicar" ? "default" : "outline"} onClick={() => setModo("duplicar")}><Copy className="h-4 w-4" /> Duplicar vigência existente</Button>
      </div>

      {modo === "novo" ? (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> 1. Filhos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <div className="space-y-2"><Label>Nome</Label><Input value={nomeFilho} onChange={(e) => setNomeFilho(e.target.value)} placeholder="Nome do filho" /></div>
                <label className="flex h-10 items-center gap-2"><Checkbox checked={temMesada} onCheckedChange={(v) => setTemMesada(v === true)} /> Tem mesada</label>
                {temMesada && <div className="space-y-2"><Label>Mesada</Label><CurrencyInput value={valorMesada} onValueChange={setValorMesada} /></div>}
              </div>
              <Button onClick={() => void runAction(cadastrarFilho)}><Plus className="h-4 w-4" /> Adicionar filho</Button>
              {filhos.length > 0 && <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{filhos.map((f) => <label key={f.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Checkbox checked={filhosSelecionados.includes(f.id)} onCheckedChange={() => alternar(filhosSelecionados, setFilhosSelecionados, f.id)} />{f.nome}</label>)}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ListTodo className="h-5 w-5" /> 2. Tarefas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2"><Input value={nomeTarefa} onChange={(e) => setNomeTarefa(e.target.value)} placeholder="Nome da tarefa" /><Button onClick={() => void runAction(cadastrarTarefa)}><Plus className="h-4 w-4" /> Adicionar</Button></div>
              {tarefas.length > 0 && <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{tarefas.map((t) => <label key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Checkbox checked={tarefasSelecionadas.includes(t.id)} onCheckedChange={() => alternar(tarefasSelecionadas, setTarefasSelecionadas, t.id)} />{t.nome}</label>)}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" /> 3. Vigência</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Início</Label><BrDateTimeField id="lote-inicio" value={vigenciaDraft.data_inicio} onChange={(data_inicio) => setVigenciaDraft({ ...vigenciaDraft, data_inicio })} /></div>
                <div className="space-y-2"><Label>Fim</Label><BrDateTimeField id="lote-fim" value={vigenciaDraft.data_fim} min={vigenciaDraft.data_inicio} onChange={(data_fim) => setVigenciaDraft({ ...vigenciaDraft, data_fim })} /></div>
              </div>
              <div className="space-y-2"><Label>Penalidade</Label><Input value={vigenciaDraft.penalidade} onChange={(e) => setVigenciaDraft({ ...vigenciaDraft, penalidade: e.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Quantidade de “Não fez”</Label><Input type="number" min="1" max="31" value={vigenciaDraft.qtd_ocorrencia} onChange={(e) => setVigenciaDraft({ ...vigenciaDraft, qtd_ocorrencia: e.target.value })} /></div>
                <div className="space-y-2"><Label>Desconto por “Não fez”</Label><CurrencyInput value={vigenciaDraft.valor_debito} onValueChange={(valor_debito) => setVigenciaDraft({ ...vigenciaDraft, valor_debito })} /></div>
              </div>
              <Button onClick={() => void runAction(criarVigencia)} disabled={vigenciaCriadaId !== null}>{vigenciaCriadaId ? "Vigência criada" : "Criar vigência"}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> 4. Associações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">Selecionados: <strong>{filhosSelecionados.length}</strong> filho(s) × <strong>{tarefasSelecionadas.length}</strong> tarefa(s) = <strong>{totalCombinacoes}</strong> associação(ões).</div>
              <Button onClick={() => void runAction(criarAssociacoes)} disabled={!vigenciaCriadaId || totalCombinacoes === 0}>Criar associações em lote</Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Copy className="h-5 w-5" /> Duplicar vigência existente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Pick label="Vigência modelo" value={modeloId} onChange={escolherModelo} options={vigenciasOrdenadas.map((v) => ({ value: String(v.id), label: fmtVigencia(v), status: new Date(v.data_fim).getTime() < Date.now() ? "finalizada" as const : new Date(v.data_inicio).getTime() > Date.now() ? "futura" as const : "andamento" as const }))} />
            {modelo && (
              <>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">{fmtVigencia(modelo)}</p>
                  <p className="mt-1 text-muted-foreground">{new Set(associacoesModelo.map((a) => a.id_filho)).size} filho(s), {new Set(associacoesModelo.map((a) => a.id_tarefa)).size} tarefa(s), {associacoesModelo.length} associação(ões).</p>
                  <p className="mt-1 text-xs text-muted-foreground">Fez, Não fez, bonificações, penalidades atingidas e contadores não serão copiados.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Novo início</Label><BrDateTimeField id="duplicar-lote-inicio" value={duplicacao.data_inicio} min={paraCampoDataHoraBrasil(new Date(new Date(modelo.data_fim).getTime() + 60_000).toISOString())} onChange={(data_inicio) => setDuplicacao({ ...duplicacao, data_inicio })} /></div>
                  <div className="space-y-2"><Label>Novo fim</Label><BrDateTimeField id="duplicar-lote-fim" value={duplicacao.data_fim} min={duplicacao.data_inicio || paraCampoDataHoraBrasil(new Date(new Date(modelo.data_fim).getTime() + 60_000).toISOString())} onChange={(data_fim) => setDuplicacao({ ...duplicacao, data_fim })} /></div>
                </div>
                <div className="space-y-2"><Label>Penalidade</Label><Input value={duplicacao.penalidade} onChange={(e) => setDuplicacao({ ...duplicacao, penalidade: e.target.value })} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Quantidade de “Não fez”</Label><Input type="number" min="1" max="31" value={duplicacao.qtd_ocorrencia} onChange={(e) => setDuplicacao({ ...duplicacao, qtd_ocorrencia: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Desconto por “Não fez”</Label><CurrencyInput value={duplicacao.valor_debito} onValueChange={(valor_debito) => setDuplicacao({ ...duplicacao, valor_debito })} /></div>
                </div>
                <Button onClick={() => void runAction(duplicarVigencia)}><Copy className="h-4 w-4" /> Criar nova vigência com associações</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end"><Link to="/inicio" className="text-sm text-muted-foreground underline">Sair do cadastro em lote</Link></div>
    </div>
  );
}
