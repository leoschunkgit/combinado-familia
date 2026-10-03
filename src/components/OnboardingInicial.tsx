import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  useVigencias,
} from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";

const PASSOS = ["Filho", "Tarefa", "Vigência", "Associação"] as const;

export function OnboardingInicial({ forcarAberto = false, onFecharForcado }: { forcarAberto?: boolean; onFecharForcado?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: filhos = [], isLoading: carregandoFilhos } = useFilhos();
  const { data: tarefas = [], isLoading: carregandoTarefas } = useTarefas();
  const { data: vigencias = [], isLoading: carregandoVigencias } = useVigencias();
  const { data: atribuicoes = [], isLoading: carregandoAtribuicoes } = useFilhoTarefas();

  const [salvando, setSalvando] = useState(false);

  const [nomeFilho, setNomeFilho] = useState("");
  const [temMesada, setTemMesada] = useState(false);
  const [valorMesada, setValorMesada] = useState("");

  const [nomeTarefa, setNomeTarefa] = useState("");

  const agora = new Date();
  const fimPadrao = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [inicioVigencia, setInicioVigencia] = useState(() => paraCampoDataHoraBrasil(agora.toISOString()));
  const [fimVigencia, setFimVigencia] = useState(() => paraCampoDataHoraBrasil(fimPadrao.toISOString()));
  const [penalidade, setPenalidade] = useState("");
  const [quantidade, setQuantidade] = useState("3");
  const [desconto, setDesconto] = useState("");

  const [filhoSelecionado, setFilhoSelecionado] = useState("");
  const [tarefaSelecionada, setTarefaSelecionada] = useState("");
  const [vigenciaSelecionada, setVigenciaSelecionada] = useState("");

  const carregando = carregandoFilhos || carregandoTarefas || carregandoVigencias || carregandoAtribuicoes;
  const vigenciasAtivas = vigencias.filter(vigenciaEmAndamento);

  const etapa =
    filhos.length === 0 ? 0 :
    tarefas.length === 0 ? 1 :
    vigencias.length === 0 ? 2 :
    atribuicoes.length === 0 ? 3 :
    -1;

  const configuracaoConcluida = etapa === -1;
  const aberto = !carregando && (etapa >= 0 || forcarAberto);
  const filhoAtual = filhoSelecionado || (filhos[0] ? String(filhos[0].id) : "");
  const tarefaAtual = tarefaSelecionada || (tarefas[0] ? String(tarefas[0].id) : "");
  const vigenciaAtual = vigenciaSelecionada || (vigenciasAtivas[0] ? String(vigenciasAtivas[0].id) : "");

  async function cadastrarFilho() {
    const nome = nomeFilho.trim();
    if (nome.length < 2 || nome.length > 100) {
      toast.error("Informe o nome do filho");
      return;
    }

    if (temMesada && (!/^\d+(?:[,.]\d{1,2})?$/.test(valorMesada) || Number(valorMesada.replace(",", ".")) <= 0)) {
      toast.error("Informe um valor de mesada válido");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from("t_filho").insert({
      nome,
      email: null,
      celular: null,
      idade: null,
      tem_mesada: temMesada,
      tem_mesada_opcional: temMesada ? true : null,
      valor_mesada: temMesada ? Number(valorMesada.replace(",", ".")) : null,
    });
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    toast.success("Filho cadastrado. Vamos para a próxima etapa.");
    await qc.invalidateQueries({ queryKey: ["filhos"] });
  }

  async function cadastrarTarefa() {
    const nome = nomeTarefa.trim();
    if (nome.length < 2 || nome.length > 150) {
      toast.error("Informe um nome de tarefa entre 2 e 150 caracteres");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from("t_tarefa").insert({ nome });
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    toast.success("Tarefa cadastrada. Vamos para a próxima etapa.");
    await qc.invalidateQueries({ queryKey: ["tarefas"] });
  }

  async function cadastrarVigencia() {
    if (!inicioVigencia || !fimVigencia) {
      toast.error("Informe o início e o fim da vigência");
      return;
    }

    const inicio = new Date(inicioVigencia).getTime();
    const fim = new Date(fimVigencia).getTime();
    if (Number.isNaN(inicio) || Number.isNaN(fim) || fim < inicio) {
      toast.error("A data final deve ser igual ou posterior à data inicial");
      return;
    }

    if (inicio > Date.now()) {
      toast.error("Para concluir o aprendizado agora, a vigência precisa começar agora ou antes");
      return;
    }

    const textoPenalidade = penalidade.trim();
    if (textoPenalidade.length < 2) {
      toast.error("Informe a penalidade");
      return;
    }

    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 31) {
      toast.error("A quantidade de “Não fez” deve estar entre 1 e 31");
      return;
    }

    if (!/^\d+(?:[,.]\d{1,2})?$/.test(desconto) || Number(desconto.replace(",", ".")) <= 0) {
      toast.error("Informe um valor de desconto válido");
      return;
    }

    const valorDebito = Number(desconto.replace(",", "."));
    setSalvando(true);
    const { error } = await supabase.from("t_vigencia").insert({
      data_inicio: paraIsoDataHoraBrasil(inicioVigencia),
      data_fim: paraIsoDataHoraBrasil(fimVigencia),
      penalidade: textoPenalidade,
      qtd_ocorrencia: qtd,
      tipo_penalidade: "texto",
      valor_debito: valorDebito,
    });
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    toast.success("Vigência cadastrada. Falta só fazer a associação.");
    await qc.invalidateQueries({ queryKey: ["vigencias"] });
  }

  async function cadastrarAssociacao() {
    if (!filhoAtual || !tarefaAtual || !vigenciaAtual) {
      toast.error("Selecione o filho, a tarefa e a vigência");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from("t_filho_tarefa").insert({
      id_filho: Number(filhoAtual),
      id_tarefa: Number(tarefaAtual),
      id_vigencia: Number(vigenciaAtual),
    });
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    await qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
    toast.success("Configuração inicial concluída!");
    navigate({ to: "/ocorrencias" });
  }

  return (
    <Dialog open={aberto}>
      <DialogContent
        className="max-h-[92vh] max-w-lg overflow-y-auto rounded-xl [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Primeiros passos · aprendizado do sistema
          </div>
          <DialogTitle>Aprenda o Combinado Família configurando seu primeiro combinado</DialogTitle>
          <DialogDescription>
            Este passo a passo ensina, na prática, como o sistema funciona. Você fará os cadastros essenciais na ordem correta e, ao terminar, seguirá direto para Ocorrências.
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

        {forcarAberto && configuracaoConcluida && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Sua configuração inicial já está concluída. Filho, tarefa, vigência e associação já estão prontos.</span>
            </div>
            <p className="text-sm text-muted-foreground">Você já pode registrar e acompanhar os combinados normalmente em Ocorrências.</p>
            <Button
              className="w-full"
              onClick={() => {
                onFecharForcado?.();
                navigate({ to: "/ocorrencias" });
              }}
            >
              Ir para Ocorrências
            </Button>
          </div>
        )}

        {!configuracaoConcluida && etapa === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">1. Cadastre seu primeiro filho</h3>
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
                <Input id="onboarding-valor-mesada" inputMode="decimal" value={valorMesada} onChange={(e) => setValorMesada(e.target.value)} placeholder="100,00" />
              </div>
            )}
            <Button className="w-full" disabled={salvando} onClick={() => void cadastrarFilho()}>
              {salvando ? "Salvando..." : "Cadastrar filho e continuar"}
            </Button>
          </div>
        )}

        {!configuracaoConcluida && etapa === 1 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Filho cadastrado. Agora você vai aprender a criar uma tarefa.</span>
            </div>
            <div>
              <h3 className="font-semibold">2. Cadastre uma tarefa</h3>
              <p className="mt-1 text-sm text-muted-foreground">A tarefa representa o que será combinado com o filho.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-tarefa">Nome da tarefa *</Label>
              <Input id="onboarding-tarefa" autoFocus value={nomeTarefa} onChange={(e) => setNomeTarefa(e.target.value)} placeholder="Ex.: Arrumar a cama" />
            </div>
            <Button className="w-full" disabled={salvando} onClick={() => void cadastrarTarefa()}>
              {salvando ? "Salvando..." : "Cadastrar tarefa e continuar"}
            </Button>
          </div>
        )}

        {!configuracaoConcluida && etapa === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Filho e tarefa prontos. Agora defina o período e as regras do combinado.</span>
            </div>
            <div>
              <h3 className="font-semibold">3. Crie uma vigência</h3>
              <p className="mt-1 text-sm text-muted-foreground">Para seguir direto até Ocorrências, crie uma vigência que já esteja em andamento.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Data início *</Label><BrDateTimeField id="onboarding-inicio-vigencia" value={inicioVigencia} onChange={setInicioVigencia} /></div>
              <div className="space-y-2"><Label>Data fim *</Label><BrDateTimeField id="onboarding-fim-vigencia" value={fimVigencia} onChange={setFimVigencia} /></div>
            </div>
            <div className="rounded-lg border border-amber-400 bg-amber-50/60 p-3 dark:border-amber-700/60 dark:bg-amber-950/10">
              <div className="space-y-2">
                <Label htmlFor="onboarding-penalidade">Penalidade *</Label>
                <Input id="onboarding-penalidade" value={penalidade} onChange={(e) => setPenalidade(e.target.value)} placeholder="Ex.: Sem videogame no fim de semana" />
              </div>
              <div className="mt-3 space-y-2">
                <Label htmlFor="onboarding-quantidade">Quantidade de “Não fez” para ser penalizado *</Label>
                <Input id="onboarding-quantidade" type="number" min="1" max="31" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
                <p className="text-xs text-muted-foreground">Usado para filhos sem mesada.</p>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-400 bg-emerald-50/60 p-3 dark:border-emerald-700/60 dark:bg-emerald-950/10">
              <div className="space-y-2">
                <Label htmlFor="onboarding-desconto">Desconto por cada “Não fez” na mesada (R$) *</Label>
                <Input id="onboarding-desconto" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="20,00" />
                <p className="text-xs text-muted-foreground">Usado para filhos com mesada.</p>
              </div>
            </div>
            <Button className="w-full" disabled={salvando} onClick={() => void cadastrarVigencia()}>
              {salvando ? "Salvando..." : "Cadastrar vigência e continuar"}
            </Button>
          </div>
        )}

        {!configuracaoConcluida && etapa === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Você já aprendeu a criar filho, tarefa e vigência. Agora vamos ligar tudo.</span>
            </div>
            <div>
              <h3 className="font-semibold">4. Faça a primeira associação</h3>
              <p className="mt-1 text-sm text-muted-foreground">Associe um filho a uma tarefa dentro da vigência. Depois disso, o sistema estará pronto para registrar ocorrências.</p>
            </div>
            <Pick label="Filho" required value={filhoAtual} onChange={setFilhoSelecionado} options={filhos.map((f) => ({ value: String(f.id), label: f.nome }))} />
            <Pick label="Tarefa" required value={tarefaAtual} onChange={setTarefaSelecionada} options={tarefas.map((t) => ({ value: String(t.id), label: t.nome }))} />
            <Pick label="Vigência" required value={vigenciaAtual} onChange={setVigenciaSelecionada} options={vigenciasAtivas.map((v) => ({ value: String(v.id), label: fmtVigencia(v), status: "andamento" as const }))} />
            <Button className="w-full" disabled={salvando} onClick={() => void cadastrarAssociacao()}>
              {salvando ? "Salvando..." : "Concluir aprendizado e ir para Ocorrências"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
