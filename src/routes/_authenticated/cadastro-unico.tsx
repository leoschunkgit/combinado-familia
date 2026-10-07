import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarRange, CheckCircle2, Link2, ListPlus, ListTodo, Plus, Users } from "lucide-react";
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
import { PageHeader } from "@/components/PageHeader";
import { useActionLoading } from "@/components/ActionLoading";
import { msgErro, paraCampoDataHoraBrasil, paraIsoDataHoraBrasil, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/cadastro-unico")({
  head: () => ({ meta: [
    { title: "Cadastro Fluxo — Combinado" },
    { name: "description", content: "Cadastre filhos, tarefas, vigência e atribuições em um único fluxo." },
  ] }),
  component: CadastroUnicoPage,
});

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

function sugerirPeriodoVigencia(vigencias: Array<{ data_fim: string }>, atual: VigenciaDraft): VigenciaDraft {
  if (vigencias.length === 0) return atual;

  const maiorFim = vigencias.reduce((maior, vigencia) => {
    const fim = new Date(vigencia.data_fim).getTime();
    return fim > maior ? fim : maior;
  }, Number.NEGATIVE_INFINITY);

  if (!Number.isFinite(maiorFim)) return atual;

  const inicio = new Date(maiorFim);
  inicio.setDate(inicio.getDate() + 1);

  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);

  return {
    ...atual,
    data_inicio: paraCampoDataHoraBrasil(inicio.toISOString()),
    data_fim: paraCampoDataHoraBrasil(fim.toISOString()),
  };
}

function CadastroUnicoPage() {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();

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
  const [etapaNovo, setEtapaNovo] = useState<1 | 2 | 3 | 4>(1);
  const [tarefasPorFilho, setTarefasPorFilho] = useState<Record<number, number[]>>({});

  const totalCombinacoes = filhosSelecionados.reduce((total, idFilho) => total + (tarefasPorFilho[idFilho]?.length ?? 0), 0);

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

    setVigenciaDraft((atual) => sugerirPeriodoVigencia(vigencias, atual));
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
    setTarefasPorFilho(Object.fromEntries(filhosSelecionados.map((idFilho) => [idFilho, [...tarefasSelecionadas]])));
    await qc.invalidateQueries({ queryKey: ["vigencias"] });
    setEtapaNovo(4);
    toast.success("Vigência criada para este lote");
  }

  async function criarAssociacoes() {
    if (!vigenciaCriadaId) { toast.error("Crie a vigência antes das atribuições"); return; }
    if (!filhosSelecionados.length || !tarefasSelecionadas.length) { toast.error("Selecione ao menos um filho e uma tarefa"); return; }

    const vigencia = vigencias.find((v) => v.id === vigenciaCriadaId);
    if (!vigencia) { toast.error("Aguarde a atualização da vigência e tente novamente"); return; }

    const existentes = new Set(atribuicoes.map((a) => `${a.id_vigencia}|${a.id_filho}|${a.id_tarefa}`));
    const novos = filhosSelecionados.flatMap((id_filho) =>
      (tarefasPorFilho[id_filho] ?? []).map((id_tarefa) => ({ id_vigencia: vigenciaCriadaId, id_filho, id_tarefa }))
    ).filter((x) => !existentes.has(`${x.id_vigencia}|${x.id_filho}|${x.id_tarefa}`));

    if (!novos.length) { toast.error("Selecione ao menos uma atribuição entre filho e tarefa"); return; }
    const { error } = await supabase.from("t_filho_tarefa").insert(novos);
    if (error) { toast.error(msgErro(error)); return; }
    await qc.invalidateQueries({ queryKey: ["filho_tarefas"] });

    setNomeFilho("");
    setTemMesada(false);
    setValorMesada("");
    setFilhosSelecionados([]);
    setFilhosNovosPendentes([]);
    setNomeTarefa("");
    setTarefasSelecionadas([]);
    setTarefasNovasPendentes([]);
    setVigenciaDraft(vigenciaInicial());
    setVigenciaCriadaId(null);
    setTarefasPorFilho({});
    setEtapaNovo(1);

    toast.success("Cadastro Fluxo finalizado com sucesso");
  }


  return (
    <div className="space-y-4">
      <PageHeader title="Cadastro Fluxo" description="Cadastre todo fluxo na mesma tela" icon={<ListPlus className="h-6 w-6" />} />

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
                    <Button className="h-9 shrink-0 px-3 text-xs" size="sm" onClick={adicionarFilhoAoFluxo}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                  </div>
                </div>

                {(filhos.length > 0 || filhosNovosPendentes.length > 0) && (
                  <div>
                    <p className="text-sm font-semibold">Marque abaixo quem participa do fluxo</p>
                    {filhos.length > 0 && (
                      <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-2.5 pl-3 text-xs">
                        <Checkbox
                          checked={filhos.every((f) => filhosSelecionados.includes(f.id))}
                          onCheckedChange={() => {
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
                      <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-2.5 pl-3 text-xs">
                        <Checkbox
                          checked={tarefas.every((t) => tarefasSelecionadas.includes(t.id))}
                          onCheckedChange={() => {
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
                <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_1fr]">
                  <div className="space-y-1.5"><Label>Penalidade</Label><Input value={vigenciaDraft.penalidade} onChange={(e) => setVigenciaDraft({ ...vigenciaDraft, penalidade: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Quantidade de “Não fez”</Label><Input type="number" min="1" max="31" value={vigenciaDraft.qtd_ocorrencia} onChange={(e) => setVigenciaDraft({ ...vigenciaDraft, qtd_ocorrencia: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Desconto por “Não fez”</Label><CurrencyInput value={vigenciaDraft.valor_debito} onValueChange={(valor_debito) => setVigenciaDraft({ ...vigenciaDraft, valor_debito })} /></div>
                </div>
                <div className="flex items-center justify-between border-t pt-2.5"><Button variant="ghost" size="sm" onClick={() => setEtapaNovo(2)}>Anterior</Button><Button onClick={() => void runAction(criarVigencia)}>Criar vigência e continuar</Button></div>
              </CardContent>
            </Card>
          )}

          {etapaNovo === 4 && (
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="border-b bg-primary/5 px-4 py-2.5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span><span className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Atribuições</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 p-3.5">
                <p className="text-sm text-muted-foreground">Escolha quais tarefas pertencem a cada filho.</p>

                <div className="space-y-2">
                  {filhos.filter((f) => filhosSelecionados.includes(f.id)).map((filho) => {
                    const selecionadas = tarefasPorFilho[filho.id] ?? [];
                    const todasSelecionadas = tarefasSelecionadas.length > 0 && tarefasSelecionadas.every((id) => selecionadas.includes(id));

                    return (
                      <div key={filho.id} className="overflow-hidden rounded-lg border bg-background">
                        <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{filho.nome}</p>
                          </div>
                          <label className="flex shrink-0 cursor-pointer items-center gap-2.5 text-xs">
                            <Checkbox
                              checked={todasSelecionadas}
                              onCheckedChange={() =>
                                setTarefasPorFilho((atual) => ({
                                  ...atual,
                                  [filho.id]: todasSelecionadas ? [] : [...tarefasSelecionadas],
                                }))
                              }
                            />
                            <span>{todasSelecionadas ? "Desmarcar todas" : "Selecionar todas"}</span>
                          </label>
                        </div>

                        <div className="divide-y">
                          {tarefas.filter((t) => tarefasSelecionadas.includes(t.id)).map((tarefa) => {
                            const marcada = selecionadas.includes(tarefa.id);
                            return (
                              <label key={tarefa.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/30">
                                <Checkbox
                                  checked={marcada}
                                  onCheckedChange={() =>
                                    setTarefasPorFilho((atual) => {
                                      const atuais = atual[filho.id] ?? [];
                                      return {
                                        ...atual,
                                        [filho.id]: marcada ? atuais.filter((id) => id !== tarefa.id) : [...atuais, tarefa.id],
                                      };
                                    })
                                  }
                                />
                                <span className="min-w-0 flex-1 truncate">{tarefa.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t pt-2.5">
                  <p className="text-xs text-muted-foreground">{totalCombinacoes} atribuição(ões) selecionada(s)</p>
                  <Button onClick={() => void runAction(criarAssociacoes)} disabled={!vigenciaCriadaId || totalCombinacoes === 0}><Link2 className="h-4 w-4" /> Finalizar Cadastro Fluxo</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>


    </div>
  );
}
