import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarRange, CheckCircle2, Copy, Link2, ListPlus, ListTodo, Plus, Users } from "lucide-react";
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
    { title: "Cadastro Fluxo — Combinado" },
    { name: "description", content: "Cadastre filhos, tarefas, vigência e associações em um único fluxo." },
  ] }),
  component: CadastroUnicoPage,
});

type Modo = "novo" | "duplicar";
type FilhoNovoFluxo = {
  tempId: number;
  nome: string;
  tem_mesada: boolean;
  valor_mesada: number | null;
};

type TarefaNovaFluxo = {
  tempId: number;
  nome: string;
};
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
  const [filhosNovosPendentes, setFilhosNovosPendentes] = useState<FilhoNovoFluxo[]>([]);
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState<number[]>([]);
  const [tarefasNovasPendentes, setTarefasNovasPendentes] = useState<TarefaNovaFluxo[]>([]);
  const [vigenciaDraft, setVigenciaDraft] = useState<VigenciaDraft>(() => vigenciaInicial());
  const [vigenciaCriadaId, setVigenciaCriadaId] = useState<number | null>(null);
  const [modeloId, setModeloId] = useState("");
  const [duplicacao, setDuplicacao] = useState<VigenciaDraft>(() => vigenciaInicial());
  const [etapaNovo, setEtapaNovo] = useState<1 | 2 | 3 | 4>(1);

  const vigenciasOrdenadas = [...vigencias].sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());
  const modelo = vigencias.find((v) => v.id === Number(modeloId));
  const associacoesModelo = useMemo(() => atribuicoes.filter((a) => a.id_vigencia === Number(modeloId)), [atribuicoes, modeloId]);
  const totalCombinacoes = filhosSelecionados.length * tarefasSelecionadas.length;

  const alternar = (lista: number[], setLista: (v: number[]) => void, id: number) =>
    setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);


  function adicionarFilhoAoFluxo() {
    const nome = nomeFilho.trim();
    if (nome.length < 2 || nome.length > 100) { toast.error("Informe o nome do filho"); return; }
    if (temMesada && (!/^\d+(?:[,.]\d{1,2})?$/.test(valorMesada) || Number(valorMesada.replace(",", ".")) <= 0)) {
      toast.error("Informe um valor de mesada válido"); return;
    }

    const valor = temMesada ? Number(valorMesada.replace(",", ".")) : null;
    setFilhosNovosPendentes((atuais) => [
      ...atuais,
      {
        tempId: Date.now() + atuais.length,
        nome,
        tem_mesada: temMesada,
        valor_mesada: valor,
      },
    ]);
    setNomeFilho("");
    setTemMesada(false);
    setValorMesada("");
  }

  async function concluirEtapaFilhos() {
    if (filhosSelecionados.length === 0 && filhosNovosPendentes.length === 0) {
      toast.error("Selecione ou adicione pelo menos um filho");
      return;
    }

    let idsNovos: number[] = [];

    if (filhosNovosPendentes.length > 0) {
      const payload = filhosNovosPendentes.map((filho) => ({
        nome: filho.nome,
        email: null,
        celular: null,
        idade: null,
        tem_mesada: filho.tem_mesada,
        tem_mesada_opcional: filho.tem_mesada ? true : null,
        valor_mesada: filho.valor_mesada,
      }));

      const { data, error } = await supabase.from("t_filho").insert(payload).select("id");
      if (error || !data) { toast.error(msgErro(error)); return; }

      idsNovos = data.map((item) => item.id);
      setFilhosSelecionados((atuais) => [...new Set([...atuais, ...idsNovos])]);
      setFilhosNovosPendentes([]);
      await qc.invalidateQueries({ queryKey: ["filhos"] });
    }

    setEtapaNovo(2);
  }

  function adicionarTarefaAoFluxo() {
    const nome = nomeTarefa.trim();
    if (nome.length < 2 || nome.length > 150) { toast.error("Informe um nome de tarefa entre 2 e 150 caracteres"); return; }

    setTarefasNovasPendentes((atuais) => [
      ...atuais,
      { tempId: Date.now() + atuais.length, nome },
    ]);
    setNomeTarefa("");
  }

  async function concluirEtapaTarefas() {
    if (tarefasSelecionadas.length === 0 && tarefasNovasPendentes.length === 0) {
      toast.error("Selecione ou adicione pelo menos uma tarefa");
      return;
    }

    let idsNovos: number[] = [];

    if (tarefasNovasPendentes.length > 0) {
      const { data, error } = await supabase
        .from("t_tarefa")
        .insert(tarefasNovasPendentes.map((tarefa) => ({ nome: tarefa.nome })))
        .select("id");

      if (error || !data) { toast.error(msgErro(error)); return; }

      idsNovos = data.map((item) => item.id);
      setTarefasSelecionadas((atuais) => [...new Set([...atuais, ...idsNovos])]);
      setTarefasNovasPendentes([]);
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
    }

    setEtapaNovo(3);
  }

  function validarVigencia(draft: VigenciaDraft) {
    if (!draft.data_inicio) return "Informe a data de início";
    if (!draft.data_fim) return "Informe a data de fim";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.data_inicio) || Number.isNaN(new Date(draft.data_inicio).getTime())) return "Informe uma data e hora de início válidas";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.data_fim) || Number.isNaN(new Date(draft.data_fim).getTime())) return "Informe uma data e hora de fim válidas";
    if (new Date(draft.data_fim).getTime() <= new Date(draft.data_inicio).getTime()) return "A data/hora fim deve ser posterior à data/hora início";
    if (draft.penalidade.trim().length < 2) return "Informe a penalidade";
    if (draft.penalidade.trim().length > 200) return "A penalidade deve ter no máximo 200 caracteres";
    const qtd = Number(draft.qtd_ocorrencia);
    if (!Number.isInteger(qtd) || qtd < 1) return "Mínimo de 1 ocorrência";
    if (qtd > 31) return "Máximo de 31";
    const valor = Number(draft.valor_debito.replace(",", "."));
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(draft.valor_debito) || valor <= 0 || valor > 9999999999.99) return "Informe um valor de desconto maior que zero, com até duas casas decimais";
    return null;
  }

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

  async function criarVigencia() {
    const erro = validarVigencia(vigenciaDraft);
    if (erro) { toast.error(erro); return; }
    if (conflitaComVigenciaExistente(vigenciaDraft.data_inicio, vigenciaDraft.data_fim)) {
      toast.error("Já existe uma vigência nesse período. As vigências não podem ficar ativas ao mesmo tempo.");
      return;
    }
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
    setEtapaNovo(4);
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
    if (conflitaComVigenciaExistente(duplicacao.data_inicio, duplicacao.data_fim)) {
      toast.error("Já existe uma vigência nesse período. As vigências não podem ficar ativas ao mesmo tempo.");
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
    <div className="space-y-4">
      <PageHeader title="Cadastro Fluxo" description="Cadastre vários filhos e tarefas em lote, crie associações e reutilize vigências anteriores." icon={<ListPlus className="h-6 w-6" />} />

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setModo("novo")} className={`rounded-lg border p-3 text-left transition ${modo === "novo" ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "bg-card hover:bg-muted/40"}`}>
          <span className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${modo === "novo" ? "bg-primary text-primary-foreground" : "bg-muted"}`}><Plus className="h-5 w-5" /></span><span><span className="block font-semibold">Montar novo cadastro</span><span className="block text-xs text-muted-foreground">Filhos, tarefas, vigência e associações em lote</span></span></span>
        </button>
        <button type="button" onClick={() => setModo("duplicar")} className={`rounded-lg border p-3 text-left transition ${modo === "duplicar" ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "bg-card hover:bg-muted/40"}`}>
          <span className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${modo === "duplicar" ? "bg-primary text-primary-foreground" : "bg-muted"}`}><Copy className="h-5 w-5" /></span><span><span className="block font-semibold">Duplicar vigência</span><span className="block text-xs text-muted-foreground">Reaproveite regras e associações existentes</span></span></span>
        </button>
      </div>

      {modo === "novo" ? (
        <div className="space-y-2">
          {etapaNovo > 1 && (
            <Card className="overflow-hidden">
              <CardContent className="flex items-center gap-2.5 px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">1. Filhos</p>
                  <p className="truncate text-xs text-muted-foreground">{filhosSelecionados.length} filho(s) selecionado(s) para este fluxo</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEtapaNovo(1)}>Editar</Button>
              </CardContent>
            </Card>
          )}

          {etapaNovo === 1 && (
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="border-b bg-primary/5 px-4 py-2.5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Filhos</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 p-3.5">
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-sm font-semibold">Cadastrar novo filho</p>
                                    <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="w-full space-y-1.5 sm:w-52"><Label>Nome</Label><Input value={nomeFilho} onChange={(e) => setNomeFilho(e.target.value)} placeholder="Nome do filho" /></div>
                    <label className="flex h-10 shrink-0 items-center gap-2"><Checkbox checked={temMesada} onCheckedChange={(v) => setTemMesada(v === true)} /> Tem mesada</label>
                    {temMesada && <div className="w-full space-y-1.5 sm:w-32"><Label>Mesada</Label><CurrencyInput value={valorMesada} onValueChange={setValorMesada} /></div>}
                    <Button className="h-10 shrink-0" size="sm" onClick={adicionarFilhoAoFluxo}><Plus className="h-4 w-4" /> Adicionar</Button>
                  </div>
                </div>

                {(filhos.length > 0 || filhosNovosPendentes.length > 0) && (
                  <div>
                    <p className="text-sm font-semibold">Marque abaixo quem participa do fluxo</p>
                    {filhos.length > 0 && (
                      <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5 pl-3 text-xs">
                        <input
                          type="checkbox"
                          checked={filhos.every((f) => filhosSelecionados.includes(f.id))}
                          onChange={() => {
                            const todosSelecionados = filhos.every((f) => filhosSelecionados.includes(f.id));
                            setFilhosSelecionados(
                              todosSelecionados
                                ? filhosSelecionados.filter((id) => !filhos.some((f) => f.id === id))
                                : [...new Set([...filhosSelecionados, ...filhos.map((f) => f.id)])]
                            );
                          }}
                        />
                        <span>{filhos.every((f) => filhosSelecionados.includes(f.id)) ? "Desmarcar todos" : "Selecionar todos"}</span>
                      </label>
                    )}
                    <div className="mt-2 divide-y rounded-lg border bg-background">
                      {filhos.map((f) => {
                        const selecionado = filhosSelecionados.includes(f.id);
                        return (
                          <label key={f.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/30">
                            <Checkbox checked={selecionado} onCheckedChange={() => alternar(filhosSelecionados, setFilhosSelecionados, f.id)} />
                            <span className="min-w-0 flex-1 truncate font-medium">{f.nome}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {f.tem_mesada && f.valor_mesada != null ? `Mesada: R$ ${Number(f.valor_mesada).toFixed(2).replace(".", ",")}` : "Sem mesada"}
                            </span>
                          </label>
                        );
                      })}
                      {filhosNovosPendentes.map((f) => (
                        <div key={f.tempId} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                          <Checkbox checked disabled />
                          <span className="min-w-0 flex-1 truncate font-medium">{f.nome}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {f.tem_mesada && f.valor_mesada != null ? `Mesada: R$ ${f.valor_mesada.toFixed(2).replace(".", ",")}` : "Sem mesada"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end border-t pt-2.5">
                  <Button onClick={() => void runAction(concluirEtapaFilhos)} disabled={filhosSelecionados.length === 0 && filhosNovosPendentes.length === 0}>Continuar para tarefas</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {etapaNovo > 2 && (
            <Card className="overflow-hidden">
              <CardContent className="flex items-center gap-2.5 px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">2. Tarefas</p><p className="truncate text-xs text-muted-foreground">{tarefasSelecionadas.length} tarefa(s) selecionada(s)</p></div>
                <Button variant="ghost" size="sm" onClick={() => setEtapaNovo(2)}>Editar</Button>
              </CardContent>
            </Card>
          )}

          {etapaNovo === 2 && (
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="border-b bg-primary/5 px-4 py-2.5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span><span className="flex items-center gap-2"><ListTodo className="h-4 w-4" /> Tarefas</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 p-3.5">
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-sm font-semibold">Cadastrar nova tarefa</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="w-full space-y-1.5 sm:w-72">
                      <Label>Nome da tarefa</Label>
                      <Input value={nomeTarefa} onChange={(e) => setNomeTarefa(e.target.value)} placeholder="Nome da tarefa" />
                    </div>
                    <Button className="h-10 shrink-0" size="sm" onClick={adicionarTarefaAoFluxo}><Plus className="h-4 w-4" /> Adicionar</Button>
                  </div>
                </div>

                {(tarefas.length > 0 || tarefasNovasPendentes.length > 0) && (
                  <div>
                    <p className="text-sm font-semibold">Marque abaixo quais tarefas participam do fluxo</p>
                    {tarefas.length > 0 && (
                      <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5 pl-3 text-xs">
                        <input
                          type="checkbox"
                          checked={tarefas.every((t) => tarefasSelecionadas.includes(t.id))}
                          onChange={() => {
                            const todasSelecionadas = tarefas.every((t) => tarefasSelecionadas.includes(t.id));
                            setTarefasSelecionadas(
                              todasSelecionadas
                                ? tarefasSelecionadas.filter((id) => !tarefas.some((t) => t.id === id))
                                : [...new Set([...tarefasSelecionadas, ...tarefas.map((t) => t.id)])]
                            );
                          }}
                        />
                        <span>{tarefas.every((t) => tarefasSelecionadas.includes(t.id)) ? "Desmarcar todos" : "Selecionar todos"}</span>
                      </label>
                    )}
                    <div className="mt-2 divide-y rounded-lg border bg-background">
                      {tarefas.map((t) => {
                        const selecionada = tarefasSelecionadas.includes(t.id);
                        return (
                          <label key={t.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/30">
                            <Checkbox checked={selecionada} onCheckedChange={() => alternar(tarefasSelecionadas, setTarefasSelecionadas, t.id)} />
                            <span className="min-w-0 flex-1 truncate font-medium">{t.nome}</span>
                          </label>
                        );
                      })}
                      {tarefasNovasPendentes.map((t) => (
                        <div key={t.tempId} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                          <Checkbox checked disabled />
                          <span className="min-w-0 flex-1 truncate font-medium">{t.nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-2.5"><Button variant="ghost" size="sm" onClick={() => setEtapaNovo(1)}>Anterior</Button><Button onClick={() => void runAction(concluirEtapaTarefas)} disabled={tarefasSelecionadas.length === 0 && tarefasNovasPendentes.length === 0}>Continuar para vigência</Button></div>
              </CardContent>
            </Card>
          )}

          {etapaNovo > 3 && (
            <Card className="overflow-hidden">
              <CardContent className="flex items-center gap-2.5 px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">3. Vigência</p><p className="truncate text-xs text-muted-foreground">Vigência criada para este fluxo</p></div>
              </CardContent>
            </Card>
          )}

          {etapaNovo === 3 && (
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="border-b bg-primary/5 px-4 py-2.5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span><span className="flex items-center gap-2"><CalendarRange className="h-4 w-4" /> Vigência</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 p-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Início</Label><BrDateTimeField id="lote-inicio" value={vigenciaDraft.data_inicio} onChange={(data_inicio) => setVigenciaDraft({ ...vigenciaDraft, data_inicio })} /></div>
                  <div className="space-y-1.5"><Label>Fim</Label><BrDateTimeField id="lote-fim" value={vigenciaDraft.data_fim} min={vigenciaDraft.data_inicio} onChange={(data_fim) => setVigenciaDraft({ ...vigenciaDraft, data_fim })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Penalidade</Label><Input value={vigenciaDraft.penalidade} onChange={(e) => setVigenciaDraft({ ...vigenciaDraft, penalidade: e.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Quantidade de “Não fez”</Label><Input type="number" min="1" max="31" value={vigenciaDraft.qtd_ocorrencia} onChange={(e) => setVigenciaDraft({ ...vigenciaDraft, qtd_ocorrencia: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Desconto por “Não fez”</Label><CurrencyInput value={vigenciaDraft.valor_debito} onValueChange={(valor_debito) => setVigenciaDraft({ ...vigenciaDraft, valor_debito })} /></div>
                </div>
                <div className="flex items-center justify-between border-t pt-2.5"><Button variant="ghost" size="sm" onClick={() => setEtapaNovo(2)}>Anterior</Button><Button onClick={() => void runAction(criarVigencia)}>Criar vigência e continuar</Button></div>
              </CardContent>
            </Card>
          )}

          {etapaNovo === 4 && (
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="border-b bg-primary/5 px-4 py-2.5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span><span className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Associações</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 p-3.5">
                <div className="grid gap-1.5 sm:grid-cols-3">
                  <div className="rounded-lg border bg-card px-2 py-1.5 text-center"><p className="text-xl font-bold">{filhosSelecionados.length}</p><p className="text-[11px] text-muted-foreground">filho(s)</p></div>
                  <div className="rounded-lg border bg-card px-2 py-1.5 text-center"><p className="text-xl font-bold">{tarefasSelecionadas.length}</p><p className="text-[11px] text-muted-foreground">tarefa(s)</p></div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5 text-center"><p className="text-xl font-bold text-primary">{totalCombinacoes}</p><p className="text-[11px] text-muted-foreground">associação(ões)</p></div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
                  <div className="space-y-1.5">{filhos.filter((f) => filhosSelecionados.includes(f.id)).map((f) => <div key={f.id} className="rounded-md bg-background px-3 py-2 text-sm"><span className="font-semibold">{f.nome}</span><span className="text-muted-foreground"> receberá {tarefasSelecionadas.length} tarefa(s)</span></div>)}</div>
                </div>
                <div className="flex justify-end border-t pt-2.5"><Button onClick={() => void runAction(criarAssociacoes)} disabled={!vigenciaCriadaId || totalCombinacoes === 0}><Link2 className="h-4 w-4" /> Criar {totalCombinacoes} associação(ões)</Button></div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b bg-primary/5"><CardTitle className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Copy className="h-5 w-5" /></span><span>Duplicar vigência existente</span></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Pick label="Vigência modelo" value={modeloId} onChange={escolherModelo} options={vigenciasOrdenadas.map((v) => ({ value: String(v.id), label: fmtVigencia(v), status: new Date(v.data_fim).getTime() < Date.now() ? "finalizada" as const : new Date(v.data_inicio).getTime() > Date.now() ? "futura" as const : "andamento" as const }))} />
            {modelo && (
              <>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vigência modelo</p>
                  <p className="mt-1 font-semibold">{fmtVigencia(modelo)}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-background p-2 text-center"><p className="text-xl font-bold">{new Set(associacoesModelo.map((a) => a.id_filho)).size}</p><p className="text-[10px] text-muted-foreground">filhos</p></div>
                    <div className="rounded-lg bg-background p-2 text-center"><p className="text-xl font-bold">{new Set(associacoesModelo.map((a) => a.id_tarefa)).size}</p><p className="text-[10px] text-muted-foreground">tarefas</p></div>
                    <div className="rounded-lg bg-background p-2 text-center"><p className="text-xl font-bold text-primary">{associacoesModelo.length}</p><p className="text-[10px] text-muted-foreground">associações</p></div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Somente a estrutura será copiada. Fez, Não fez, bonificações, penalidades atingidas e contadores começam zerados.</p>
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
    </div>
  );
}
