import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { BrDateTimeField } from "@/components/BrDateTimeField";
import { Pick } from "@/components/Pick";
import {
  fmtVigencia,
  msgErro,
  paraCampoDataHoraBrasil,
  paraIsoDataHoraBrasil,
  useFilhos,
  useFilhoTarefas,
  useTarefas,
  useUsuarioPai,
  useVigencias,
} from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { cadastrarAtribuicoes } from "@/lib/atribuicoes";
import { useActionLoading } from "@/components/ActionLoading";
import { diasDaVigencia, sugerirInicioVigencia } from "@/lib/vigencia-periodo";
import { ModalCloseIcon, modalCloseInlineButtonClass } from "@/components/ui/modal-close";
import { FilhoPersonalizacao, corFilhoValida, type FilhoAvatarOpcao } from "@/components/FilhoPersonalizacao";

const PASSOS = ["Filho", "Tarefa", "Vigência", "Atribuição"] as const;

export function OnboardingInicial() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: filhos = [], isLoading: carregandoFilhos } = useFilhos();
  const { data: tarefas = [], isLoading: carregandoTarefas } = useTarefas();
  const { data: vigencias = [], isLoading: carregandoVigencias } = useVigencias();
  const { data: atribuicoes = [], isLoading: carregandoAtribuicoes } = useFilhoTarefas();
  const { data: usuarioPai, isLoading: carregandoUsuarioPai } = useUsuarioPai();

  const [salvando, setSalvando] = useState(false);
  const [confirmarPularAberto, setConfirmarPularAberto] = useState(false);
  const [onboardingEncerradoLocalmente, setOnboardingEncerradoLocalmente] = useState(false);

  const [nomeFilho, setNomeFilho] = useState("");
  const [temMesada, setTemMesada] = useState(false);
  const [valorMesada, setValorMesada] = useState("");
  const [corFilho, setCorFilho] = useState("");
  const [avatarFilho, setAvatarFilho] = useState<FilhoAvatarOpcao>("");

  const [nomeTarefa, setNomeTarefa] = useState("");

  const [inicioVigencia, setInicioVigencia] = useState(() => sugerirInicioVigencia([]));
  const [fimVigencia, setFimVigencia] = useState("");

  const [filhoSelecionado, setFilhoSelecionado] = useState("");
  const [tarefaSelecionada, setTarefaSelecionada] = useState("");
  const [vigenciaSelecionada, setVigenciaSelecionada] = useState("");
  const [filhoEmCorrecaoId, setFilhoEmCorrecaoId] = useState<number | null>(null);
  const [tarefaEmCorrecaoId, setTarefaEmCorrecaoId] = useState<number | null>(null);
  const [vigenciaEmCorrecaoId, setVigenciaEmCorrecaoId] = useState<number | null>(null);

  const carregando = carregandoFilhos || carregandoTarefas || carregandoVigencias || carregandoAtribuicoes || carregandoUsuarioPai;
  const vigenciasAtivas = vigencias.filter(vigenciaEmAndamento);

  const etapaBase =
    filhos.length === 0 ? 0 :
    tarefas.length === 0 ? 1 :
    vigencias.length === 0 ? 2 :
    atribuicoes.length === 0 ? 3 :
    -1;
  const etapa = filhoEmCorrecaoId !== null ? 0 : tarefaEmCorrecaoId !== null ? 1 : vigenciaEmCorrecaoId !== null ? 2 : etapaBase;

  const aberto = !onboardingEncerradoLocalmente && !carregando && usuarioPai?.onboarding_concluido !== true && etapa >= 0;
  const filhoAtual = filhoSelecionado || (filhos[0] ? String(filhos[0].id) : "");
  const tarefaAtual = tarefaSelecionada || (tarefas[0] ? String(tarefas[0].id) : "");
  const vigenciaAtual = vigenciaSelecionada || (vigenciasAtivas[0] ? String(vigenciasAtivas[0].id) : "");


  async function cadastrarFilho() {
    const nome = nomeFilho.trim();
    if (nome.length < 2 || nome.length > 100) {
      toast.error("Informe o nome do filho");
      return;
    }

    if (temMesada && (!/^\d+(?:[,.]\d{1,2})?$/.test(valorMesada) || Number(valorMesada.replace(",", ".")) <= 0 || Number(valorMesada.replace(",", ".")) > 9999999999.99)) {
      toast.error("Informe um valor de mesada válido");
      return;
    }
    if (!corFilhoValida(corFilho)) {
      toast.error("Use uma cor hexadecimal ou RGB válida");
      return;
    }

    setSalvando(true);
    const payload = {
      nome,
      email: null,
      celular: null,
      idade: null,
      tem_mesada: temMesada,
      valor_mesada: temMesada ? Number(valorMesada.replace(",", ".")) : null,
      cor: corFilho.trim() || null,
      avatar: avatarFilho || null,
    };
    const resultado = filhoEmCorrecaoId === null
      ? await supabase.from("t_filho").insert(payload).select("id").single()
      : await supabase.from("t_filho").update(payload).eq("id", filhoEmCorrecaoId).select("id").single();
    const { data: criado, error } = resultado;
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    const corrigiu = filhoEmCorrecaoId !== null;
    if (criado?.id) setFilhoSelecionado(String(criado.id));
    setFilhoEmCorrecaoId(null);
    toast.success(corrigiu ? "Filho atualizado. Vamos continuar." : "Filho cadastrado. Vamos para a próxima etapa.");
    await qc.invalidateQueries({ queryKey: ["filhos"] });
  }

  async function cadastrarTarefa() {
    const nome = nomeTarefa.trim();
    if (nome.length < 2 || nome.length > 150) {
      toast.error("Informe um nome de tarefa entre 2 e 150 caracteres");
      return;
    }

    setSalvando(true);
    const resultado = tarefaEmCorrecaoId === null
      ? await supabase.from("t_tarefa").insert({ nome }).select("id").single()
      : await supabase.from("t_tarefa").update({ nome }).eq("id", tarefaEmCorrecaoId).select("id").single();
    const { data: criada, error } = resultado;
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    const corrigiu = tarefaEmCorrecaoId !== null;
    if (criada?.id) setTarefaSelecionada(String(criada.id));
    setTarefaEmCorrecaoId(null);
    toast.success(corrigiu ? "Tarefa atualizada. Vamos continuar." : "Tarefa cadastrada. Vamos para a próxima etapa.");
    await qc.invalidateQueries({ queryKey: ["tarefas"] });
  }

  function voltarParaCorrigirFilho() {
    const filho = filhos.find((f) => String(f.id) === filhoAtual);
    if (!filho) {
      toast.error("Selecione um filho para corrigir.");
      return;
    }
    setFilhoEmCorrecaoId(filho.id);
    setNomeFilho(filho.nome);
    const comMesada = filho.tem_mesada === true && filho.valor_mesada !== null;
    setTemMesada(comMesada);
    setValorMesada(comMesada && filho.valor_mesada !== null ? filho.valor_mesada.toFixed(2).replace(".", ",") : "");
    setCorFilho(filho.cor ?? "");
    setAvatarFilho(filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : "");
  }

  function voltarParaCorrigirTarefa() {
    const tarefa = tarefas.find((t) => String(t.id) === tarefaAtual);
    if (!tarefa) {
      toast.error("Selecione uma tarefa para corrigir.");
      return;
    }
    setTarefaEmCorrecaoId(tarefa.id);
    setNomeTarefa(tarefa.nome);
  }

  function voltarParaCorrigirVigencia() {
    const vigencia = vigencias.find((v) => String(v.id) === vigenciaAtual);
    if (!vigencia) {
      toast.error("Selecione uma vigência para corrigir.");
      return;
    }

    setVigenciaEmCorrecaoId(vigencia.id);
    setInicioVigencia(paraCampoDataHoraBrasil(vigencia.data_inicio));
    setFimVigencia(paraCampoDataHoraBrasil(vigencia.data_fim));
  }

  async function cadastrarVigencia() {
    if (!inicioVigencia || !fimVigencia) {
      toast.error("Informe o início e o fim da vigência");
      return;
    }

    const inicio = new Date(inicioVigencia).getTime();
    const fim = new Date(fimVigencia).getTime();
    if (Number.isNaN(inicio) || Number.isNaN(fim) || fim <= inicio) {
      toast.error("A data/hora fim deve ser posterior à data/hora início");
      return;
    }

    if (inicio > Date.now()) {
      toast.error("Para concluir o aprendizado agora, a vigência precisa começar agora ou antes");
      return;
    }

    setSalvando(true);
    const payload = {
      data_inicio: paraIsoDataHoraBrasil(inicioVigencia),
      data_fim: paraIsoDataHoraBrasil(fimVigencia),
    };
    const resultado = vigenciaEmCorrecaoId === null
      ? await supabase.from("t_vigencia").insert(payload).select("id").single()
      : await supabase.from("t_vigencia").update(payload).eq("id", vigenciaEmCorrecaoId).select("id").single();
    const { data: vigenciaSalva, error } = resultado;
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    const corrigiu = vigenciaEmCorrecaoId !== null;
    if (vigenciaSalva?.id) setVigenciaSelecionada(String(vigenciaSalva.id));
    setVigenciaEmCorrecaoId(null);
    toast.success(corrigiu ? "Vigência corrigida. Agora conclua a atribuição." : "Vigência cadastrada. Falta só fazer a atribuição.");
    await qc.invalidateQueries({ queryKey: ["vigencias"] });
  }

  async function pularOnboarding() {
    if (!usuarioPai?.id) {
      toast.error("Não foi possível identificar sua conta para encerrar o aprendizado.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase
      .from("t_usuario_pai")
      .update({ onboarding_concluido: true })
      .eq("id", usuarioPai.id);
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    setConfirmarPularAberto(false);
    setOnboardingEncerradoLocalmente(true);
    await qc.invalidateQueries({ queryKey: ["usuario_pai"] });
  }

  async function cadastrarAssociacao() {
    if (!filhoAtual || !tarefaAtual || !vigenciaAtual) {
      toast.error("Selecione o filho, a tarefa e a vigência");
      return;
    }

    setSalvando(true);
    const resultado = await cadastrarAtribuicoes({
      candidatos: [{
        id_filho: Number(filhoAtual),
        id_tarefa: Number(tarefaAtual),
        id_vigencia: Number(vigenciaAtual),
      }],
      existentes: atribuicoes,
      vigencias,
      politica: "SOMENTE_ATUAL",
    });
    setSalvando(false);

    if (!resultado.ok) {
      toast.error("erroBanco" in resultado ? msgErro(resultado.erroBanco) : resultado.mensagem);
      return;
    }

    setOnboardingEncerradoLocalmente(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
      qc.invalidateQueries({ queryKey: ["usuario_pai"] }),
    ]);
    toast.success("Configuração inicial concluída!");
    navigate({ to: "/ocorrencias" });
  }

  return (
    <>
    <Dialog open={aberto}>
      <DialogContent
        className="max-h-[92vh] max-w-lg overflow-y-auto rounded-xl [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="absolute right-4 top-4 z-10">
          <button
            type="button"
            className={modalCloseInlineButtonClass}
            onClick={() => setConfirmarPularAberto(true)}
            disabled={salvando}
            aria-label="Fechar aprendizado inicial"
          >
            <ModalCloseIcon />
          </button>
        </div>
        <DialogHeader>
          <div className="mb-2 inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Primeiros passos · aprendizado do sistema
          </div>
          <DialogTitle>Aprenda o Combinado Família configurando seu primeiro combinado</DialogTitle>
          <DialogDescription>
            Este passo a passo ensina, na prática, como o sistema funciona. Você fará os cadastros essenciais na ordem correta e, ao terminar, seguirá direto para Fez / Não fez.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-1.5" aria-label="Progresso da configuração inicial">
          {PASSOS.map((passo, index) => (
            <div key={passo} className="min-w-0">
              <div className={`h-1.5 rounded-full ${index <= etapa ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-1 truncate text-[10px] sm:text-xs ${index === etapa ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {index + 1}. {passo}
              </p>
            </div>
          ))}
        </div>


        {etapa === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{filhoEmCorrecaoId !== null ? "1. Corrija o filho" : "1. Cadastre seu primeiro filho"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">O filho é a base para depois associar tarefas e acompanhar os combinados.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-filho">Nome *</Label>
              <Input id="onboarding-filho" autoFocus value={nomeFilho} onChange={(e) => setNomeFilho(e.target.value)} placeholder="Nome do filho" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="onboarding-mesada" checked={temMesada} onCheckedChange={(checked) => setTemMesada(checked === true)} />
              <Label htmlFor="onboarding-mesada">Tem mesada</Label>
            </div>
            {temMesada && (
              <div className="space-y-2">
                <Label htmlFor="onboarding-valor-mesada">Valor da mesada (R$) *</Label>
                <CurrencyInput id="onboarding-valor-mesada" value={valorMesada} onValueChange={setValorMesada} placeholder="R$ 100,00" />
              </div>
            )}
            <div className="border-t pt-3">
              <FilhoPersonalizacao
                nome={nomeFilho}
                cor={corFilho}
                avatar={avatarFilho}
                onCorChange={setCorFilho}
                onAvatarChange={setAvatarFilho}
                prefix="onboarding-filho"
              />
            </div>
            <Button className="w-full" disabled={salvando} onClick={() => void runAction(cadastrarFilho)}>
              {salvando ? "Salvando..." : filhoEmCorrecaoId !== null ? "Salvar correção e continuar" : "Cadastrar filho e continuar"}
            </Button>
          </div>
        )}

        {etapa === 1 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Filho cadastrado. Agora você vai aprender a criar uma tarefa.</span>
            </div>
            <div>
              <h3 className="font-semibold">{tarefaEmCorrecaoId !== null ? "2. Corrija a tarefa" : "2. Cadastre uma tarefa"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">A tarefa representa o que será combinado com o filho.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-tarefa">Nome da tarefa *</Label>
              <Input id="onboarding-tarefa" autoFocus value={nomeTarefa} onChange={(e) => setNomeTarefa(e.target.value)} placeholder="Ex.: Arrumar a cama" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" disabled={salvando} onClick={voltarParaCorrigirFilho}>
                <ArrowLeft className="h-4 w-4" /> Corrigir filho
              </Button>
              <Button className="w-full" disabled={salvando} onClick={() => void runAction(cadastrarTarefa)}>
                {salvando ? "Salvando..." : tarefaEmCorrecaoId !== null ? "Salvar correção e continuar" : "Cadastrar tarefa e continuar"}
              </Button>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Filho e tarefa prontos. Agora defina o período do combinado.</span>
            </div>
            <div>
              <h3 className="font-semibold">{vigenciaEmCorrecaoId !== null ? "3. Corrija a vigência" : "3. Crie uma vigência"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Para seguir direto até Fez / Não fez, crie uma vigência que já esteja em andamento.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Início *</Label><BrDateTimeField id="onboarding-inicio-vigencia" value={inicioVigencia} onChange={setInicioVigencia} /></div>
              <div className="space-y-2"><Label>Fim *</Label><BrDateTimeField id="onboarding-fim-vigencia" value={fimVigencia} min={inicioVigencia} onChange={setFimVigencia} /></div>
            </div>
            <div className="w-full rounded-lg border bg-muted/30 p-3">
              <div className="space-y-1.5">
                {diasDaVigencia(inicioVigencia, fimVigencia) !== null && (
                  <p className="text-sm font-semibold">
                    Sua vigência tem {diasDaVigencia(inicioVigencia, fimVigencia)} {diasDaVigencia(inicioVigencia, fimVigencia) === 1 ? "dia" : "dias"}.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  A vigência define somente o período. Ao registrar um “Não fez”, você escolhe a consequência daquele registro: nada, desconto da mesada (quando houver) ou penalidade.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" disabled={salvando} onClick={voltarParaCorrigirTarefa}>
                <ArrowLeft className="h-4 w-4" /> Corrigir tarefa
              </Button>
              <Button className="w-full" disabled={salvando} onClick={() => void runAction(cadastrarVigencia)}>
                {salvando ? "Salvando..." : vigenciaEmCorrecaoId !== null ? "Salvar correção e voltar para atribuição" : "Cadastrar vigência e continuar"}
              </Button>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Você já aprendeu a criar filho, tarefa e vigência. Agora vamos ligar tudo.</span>
            </div>
            <div>
              <h3 className="font-semibold">4. Faça a primeira atribuição</h3>
              <p className="mt-1 text-sm text-muted-foreground">Associe um filho a uma tarefa dentro da vigência. Depois disso, o sistema estará pronto para registrar Fez / Não fez.</p>
            </div>
            <Pick label="Filho" childIcons required value={filhoAtual} onChange={setFilhoSelecionado} options={filhos.map((f) => ({ value: String(f.id), label: f.nome, cor: f.cor, avatar: f.avatar === "menino" || f.avatar === "menina" ? f.avatar : null }))} />
            <Pick label="Tarefa" taskIcons required value={tarefaAtual} onChange={setTarefaSelecionada} options={tarefas.map((t) => ({ value: String(t.id), label: t.nome }))} />
            <Pick label="Vigência" required value={vigenciaAtual} onChange={setVigenciaSelecionada} options={vigenciasAtivas.map((v) => ({ value: String(v.id), label: fmtVigencia(v), status: "andamento" as const }))} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" disabled={salvando} onClick={voltarParaCorrigirFilho}>
                <ArrowLeft className="h-4 w-4" /> Filho
              </Button>
              <Button type="button" variant="outline" disabled={salvando} onClick={voltarParaCorrigirTarefa}>
                <ArrowLeft className="h-4 w-4" /> Tarefa
              </Button>
              <Button type="button" variant="outline" disabled={salvando} onClick={voltarParaCorrigirVigencia}>
                <ArrowLeft className="h-4 w-4" /> Vigência
              </Button>
            </div>
            <Button className="w-full" disabled={salvando} onClick={() => void runAction(cadastrarAssociacao)}>
              {salvando ? "Salvando..." : "Concluir aprendizado e ir para Fez / Não fez"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog
      open={confirmarPularAberto}
      onOpenChange={(open) => {
        if (!salvando) setConfirmarPularAberto(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pular aprendizado inicial?</DialogTitle>
          <DialogDescription>
            Essa etapa é importante para você aprender a usar o Combinado Família. Tem certeza de que não deseja fazer o aprendizado agora?
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          O que você já cadastrou será mantido. Ao pular, o aprendizado será marcado como concluído e não aparecerá novamente automaticamente.
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={salvando}
            onClick={() => void runAction(pularOnboarding)}
          >
            {salvando ? "Salvando..." : "Pular aprendizado"}
          </Button>
          <Button
            type="button"
            disabled={salvando}
            onClick={() => setConfirmarPularAberto(false)}
          >
            Continuar aprendizado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
