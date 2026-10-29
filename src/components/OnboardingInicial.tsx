import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { BrDateTimeField } from "@/components/BrDateTimeField";
import { Pick } from "@/components/Pick";
import {
  fmtVigencia,
  msgErro,
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
import { encontrarTarefaEquivalente } from "@/lib/tarefa-sugestoes";
import { RecompensasRapidas, criarRecompensasRapidasVazias, prepararRecompensasRapidas } from "@/components/RecompensasRapidas";
import { useVigenciaAutomatica } from "@/lib/vigencia-automatica";

const PASSOS_MANUAL = ["Filho", "Tarefa", "Vigência", "Atribuição"] as const;
const PASSOS_AUTOMATICO = ["Filho", "Tarefa", "Atribuição"] as const;

export function OnboardingInicial() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: filhos = [], isLoading: carregandoFilhos } = useFilhos();
  const { data: tarefas = [], isLoading: carregandoTarefas } = useTarefas();
  const { data: vigencias = [], isLoading: carregandoVigencias } = useVigencias();
  const { data: atribuicoes = [], isLoading: carregandoAtribuicoes } = useFilhoTarefas();
  const { data: usuarioPai, isLoading: carregandoUsuarioPai } = useUsuarioPai();
  const {
    ativa: vigenciaAutomaticaAtiva,
    carregando: carregandoVigenciaAutomatica,
  } = useVigenciaAutomatica();

  const [salvando, setSalvando] = useState(false);
  const [confirmarPularAberto, setConfirmarPularAberto] = useState(false);
  const [onboardingEncerradoLocalmente, setOnboardingEncerradoLocalmente] = useState(false);

  const [nomeFilho, setNomeFilho] = useState("");
  const [idadeFilho, setIdadeFilho] = useState("");
  const [valorMesada, setValorMesada] = useState("");
  const [corFilho, setCorFilho] = useState("");
  const [avatarFilho, setAvatarFilho] = useState<FilhoAvatarOpcao>("");
  const [recompensasFilho, setRecompensasFilho] = useState(criarRecompensasRapidasVazias);

  const [nomeTarefa, setNomeTarefa] = useState("");

  const [inicioVigencia, setInicioVigencia] = useState(() => sugerirInicioVigencia([]));
  const [fimVigencia, setFimVigencia] = useState("");

  const [filhoSelecionado, setFilhoSelecionado] = useState("");
  const [tarefaSelecionada, setTarefaSelecionada] = useState("");
  const [vigenciaSelecionada, setVigenciaSelecionada] = useState("");

  const carregando =
    carregandoFilhos
    || carregandoTarefas
    || carregandoVigencias
    || carregandoAtribuicoes
    || carregandoUsuarioPai
    || carregandoVigenciaAutomatica;
  const vigenciasAtivas = vigencias.filter(vigenciaEmAndamento);
  const passos = vigenciaAutomaticaAtiva ? PASSOS_AUTOMATICO : PASSOS_MANUAL;
  const etapaAtribuicao = vigenciaAutomaticaAtiva ? 2 : 3;

  const etapaBase = vigenciaAutomaticaAtiva
    ? filhos.length === 0
      ? 0
      : tarefas.length === 0
        ? 1
        : 2
    : filhos.length === 0
      ? 0
      : tarefas.length === 0
        ? 1
        : vigencias.length === 0
          ? 2
          : 3;
  const etapa = etapaBase;

  const aberto = !onboardingEncerradoLocalmente && !carregando && usuarioPai?.onboarding_concluido !== true && etapa >= 0;
  const filhoAtual = filhoSelecionado || (filhos[0] ? String(filhos[0].id) : "");
  const tarefaAtual = tarefaSelecionada || (tarefas[0] ? String(tarefas[0].id) : "");
  const vigenciaAtual = vigenciaSelecionada || (vigenciasAtivas[0] ? String(vigenciasAtivas[0].id) : "");
  const atribuicaoAtualExiste = Boolean(
    !vigenciaAutomaticaAtiva
    && filhoAtual
    && tarefaAtual
    && vigenciaAtual
    && atribuicoes.some((atribuicao) =>
      atribuicao.id_filho === Number(filhoAtual)
      && atribuicao.id_tarefa === Number(tarefaAtual)
      && atribuicao.id_vigencia === Number(vigenciaAtual)
    ),
  );


  async function cadastrarFilho() {
    const nome = nomeFilho.trim();
    if (nome.length < 2 || nome.length > 100) {
      toast.error("Informe o nome do filho");
      return;
    }

    if (idadeFilho.trim() !== "" && (!/^\d+$/.test(idadeFilho) || Number(idadeFilho) > 150)) {
      toast.error("Informe uma idade inteira entre 0 e 150");
      return;
    }

    if (valorMesada.trim() !== "" && (!/^\d+(?:[,.]\d{1,2})?$/.test(valorMesada) || Number(valorMesada.replace(",", ".")) <= 0 || Number(valorMesada.replace(",", ".")) > 9999999999.99)) {
      toast.error("Informe um valor de mesada válido");
      return;
    }
    if (!corFilhoValida(corFilho)) {
      toast.error("Use uma cor hexadecimal ou RGB válida");
      return;
    }

    const recompensasPreparadas = prepararRecompensasRapidas(recompensasFilho);

    if (!recompensasPreparadas.ok) {
      toast.error(recompensasPreparadas.mensagem);
      return;
    }

    const idadeNumero = idadeFilho.trim() !== "" ? Number(idadeFilho) : null;
    const valorMesadaNumero = valorMesada.trim() !== "" ? Number(valorMesada.replace(",", ".")) : null;

    setSalvando(true);

    const resultado = await supabase.rpc("cadastrar_filho_com_recompensas", {
      p_nome: nome,
      p_idade: idadeNumero,
      p_cor: corFilho.trim() || null,
      p_avatar: avatarFilho || null,
      p_valor_mesada: valorMesadaNumero,
      p_recompensas: recompensasPreparadas.recompensas,
    });

    const criado = resultado.data as unknown as { id?: number; qtd_recompensas?: number } | null;
    const error = resultado.error;
    setSalvando(false);

    if (error || !criado?.id) {
      toast.error(msgErro(error));
      return;
    }

    setRecompensasFilho(criarRecompensasRapidasVazias());
    setFilhoSelecionado(String(criado.id));
    toast.success(criado.qtd_recompensas ? "Filho e recompensas cadastrados" : "Filho cadastrado");
    await qc.invalidateQueries({ queryKey: ["filhos"] });
  }

  async function cadastrarTarefa() {
    const nome = nomeTarefa.trim();
    if (nome.length < 2 || nome.length > 150) {
      toast.error("Informe um nome de tarefa entre 2 e 150 caracteres");
      return;
    }

    if (encontrarTarefaEquivalente(tarefas, nome)) {
      toast.error(`A tarefa "${nome}" já está cadastrada`);
      return;
    }

    setSalvando(true);
    const { data: criada, error } = await supabase.from("t_tarefa").insert({ nome }).select("id").single();
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    if (criada?.id) setTarefaSelecionada(String(criada.id));
    toast.success("Tarefa cadastrada");
    await qc.invalidateQueries({ queryKey: ["tarefas"] });
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
    const { data: vigenciaSalva, error } = await supabase.from("t_vigencia").insert(payload).select("id").single();
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    if (vigenciaSalva?.id) setVigenciaSelecionada(String(vigenciaSalva.id));
    toast.success("Vigência cadastrada");
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
    if (
      !filhoAtual
      || !tarefaAtual
      || (!vigenciaAutomaticaAtiva && !vigenciaAtual)
    ) {
      toast.error(
        vigenciaAutomaticaAtiva
          ? "Selecione o filho e a tarefa"
          : "Selecione o filho, a tarefa e a vigência",
      );
      return;
    }

    setSalvando(true);

    try {
      if (!atribuicaoAtualExiste) {
        const resultado = await cadastrarAtribuicoes({
          candidatos: [{
            id_filho: Number(filhoAtual),
            id_tarefa: Number(tarefaAtual),
            ...(vigenciaAutomaticaAtiva
              ? {}
              : { id_vigencia: Number(vigenciaAtual) }),
          }],
          existentes: atribuicoes,
          vigencias,
          politica: "SOMENTE_ATUAL",
        });

        if (!resultado.ok) {
          toast.error("erroBanco" in resultado ? msgErro(resultado.erroBanco) : resultado.mensagem);
          return;
        }

        await qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
        if (resultado.modo === "AUTOMATICA") {
          await qc.invalidateQueries({ queryKey: ["vigencias"] });
        }
      }

      if (!usuarioPai?.id) {
        toast.error("Não foi possível identificar sua conta para concluir o aprendizado.");
        return;
      }

      const { error: erroOnboarding } = await supabase
        .from("t_usuario_pai")
        .update({ onboarding_concluido: true })
        .eq("id", usuarioPai.id);

      if (erroOnboarding) {
        toast.error(msgErro(erroOnboarding));
        return;
      }

      setOnboardingEncerradoLocalmente(true);
      await qc.invalidateQueries({ queryKey: ["usuario_pai"] });
      toast.success("Configuração inicial concluída!");
      navigate({ to: "/ocorrencias" });
    } catch (erro) {
      toast.error(msgErro(erro));
    } finally {
      setSalvando(false);
    }
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
          <div className="mb-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Primeiros passos
          </div>
          <DialogTitle>Configure seu primeiro combinado</DialogTitle>
          <DialogDescription>
            {vigenciaAutomaticaAtiva
              ? "Três passos rápidos para começar."
              : "Quatro passos rápidos para começar."}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`grid gap-1.5 ${vigenciaAutomaticaAtiva ? "grid-cols-3" : "grid-cols-4"}`}
          aria-label="Progresso da configuração inicial"
        >
          {passos.map((passo, index) => (
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
              <h3 className="font-semibold">1. Filho</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-filho">Nome *</Label>
              <Input id="onboarding-filho" autoFocus value={nomeFilho} onChange={(e) => setNomeFilho(e.target.value)} placeholder="Nome do filho" />
            </div>
            <div className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-3">
              <div className="space-y-2">
                <Label htmlFor="onboarding-idade">Idade <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="onboarding-idade"
                  type="number"
                  min="0"
                  max="150"
                  step="1"
                  value={idadeFilho}
                  onChange={(e) => setIdadeFilho(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-valor-mesada">Mesada <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <CurrencyInput id="onboarding-valor-mesada" value={valorMesada} onValueChange={setValorMesada} placeholder="R$ 100,00" />
              </div>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">Se informado, o valor da mesada será usado como base para os descontos de “Não fez”.</p>
            <div className="border-t pt-3">
              <RecompensasRapidas value={recompensasFilho} onChange={setRecompensasFilho} prefix="onboarding-filho" />
            </div>
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
              {salvando ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </div>
        )}

        {etapa === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">2. Tarefa</h3>
            <div className="space-y-2">
              <Label htmlFor="onboarding-tarefa">Nome da tarefa *</Label>
              <Input id="onboarding-tarefa" autoFocus value={nomeTarefa} onChange={(e) => setNomeTarefa(e.target.value)} placeholder="Ex.: Arrumar a cama" />
            </div>
            <Button className="w-full" disabled={salvando} onClick={() => void runAction(cadastrarTarefa)}>
              {salvando ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </div>
        )}

        {!vigenciaAutomaticaAtiva && etapa === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold">3. Vigência</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Início *</Label><BrDateTimeField id="onboarding-inicio-vigencia" value={inicioVigencia} onChange={setInicioVigencia} /></div>
              <div className="space-y-2"><Label>Fim *</Label><BrDateTimeField id="onboarding-fim-vigencia" value={fimVigencia} min={inicioVigencia} onChange={setFimVigencia} /></div>
            </div>
            {diasDaVigencia(inicioVigencia, fimVigencia) !== null && (
              <p className="text-xs font-medium text-muted-foreground">
                {diasDaVigencia(inicioVigencia, fimVigencia)} {diasDaVigencia(inicioVigencia, fimVigencia) === 1 ? "dia" : "dias"}
              </p>
            )}
            <Button className="w-full" disabled={salvando} onClick={() => void runAction(cadastrarVigencia)}>
              {salvando ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </div>
        )}

        {etapa === etapaAtribuicao && (
          <div className="space-y-4">
            <h3 className="font-semibold">
              {vigenciaAutomaticaAtiva ? "3. Atribuição" : "4. Atribuição"}
            </h3>
            <Pick label="Filho" childIcons required value={filhoAtual} onChange={setFilhoSelecionado} options={filhos.map((f) => ({ value: String(f.id), label: f.nome, cor: f.cor, avatar: f.avatar === "menino" || f.avatar === "menina" ? f.avatar : null }))} />
            <Pick label="Tarefa" taskIcons required value={tarefaAtual} onChange={setTarefaSelecionada} options={tarefas.map((t) => ({ value: String(t.id), label: t.nome }))} />
            {!vigenciaAutomaticaAtiva && (
              <Pick label="Vigência" required value={vigenciaAtual} onChange={setVigenciaSelecionada} options={vigenciasAtivas.map((v) => ({ value: String(v.id), label: fmtVigencia(v), status: "andamento" as const }))} />
            )}
            <Button className="w-full" disabled={salvando} onClick={() => void runAction(cadastrarAssociacao)}>
              {salvando ? "Salvando..." : "Concluir configuração"}
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
          <DialogTitle>Pular configuração inicial?</DialogTitle>
          <DialogDescription>Você poderá cadastrar tudo depois pelas telas do sistema.</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">O que já foi cadastrado será mantido.</p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={salvando}
            onClick={() => void runAction(pularOnboarding)}
          >
            {salvando ? "Salvando..." : "Pular configuração"}
          </Button>
          <Button
            type="button"
            disabled={salvando}
            onClick={() => setConfirmarPularAberto(false)}
          >
            Continuar configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
