import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

const TOKEN_KEY = "combinado-familia.child-app-session";
const TOKEN_CREDENTIAL_SERVER = "combinado-familia.child-app-session";
const TOKEN_WEB_KEY = "combinado_familia_child_app_session";
const CLIENTE_ID_KEY = "combinado_familia_child_client_id";

let tokenFilhoEmMemoria: string | null = null;

const tokenFilhoValido = (token: unknown): token is string =>
  typeof token === "string" && /^[0-9a-f]{64}$/.test(token);

const aguardar = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export type OcorrenciaFilho = {
  tipo: "FEZ" | "NAO_FEZ";
  data: string;
  bonificacao_tipo: "TEXTO" | "VALOR" | null;
  bonificacao_descricao: string | null;
  bonificacao_valor: number | null;
};

export type TarefaFilho = {
  id: number;
  nome: string;
  ocorrencias: OcorrenciaFilho[];
};

export type SolicitacaoTarefaFilhoApp = {
  id: number;
  id_filho_tarefa: number;
  data_referencia: string;
  observacao: string | null;
  status: "PENDENTE" | "RESOLVIDA_FEZ" | "RESOLVIDA_NAO_FEZ";
  created_at: string;
  resolvido_em: string | null;
};

export type RevisaoTarefaFilhoApp = {
  id: number;
  id_filho_tarefa: number;
  data_referencia: string;
  observacao: string | null;
  status: "PENDENTE" | "MANTEVE_NAO_FEZ" | "ALTERADO_PARA_FEZ" | "MARCACAO_DESFEITA";
  created_at: string;
  resolvido_em: string | null;
};

export type VigenciaFilho = {
  id: number;
  data_inicio: string;
  data_fim: string;
  penalidade: string | null;
  qtd_ocorrencia: number;
  valor_debito: number | null;
  tarefas: TarefaFilho[];
};

export type RecompensaEstrelaFilho = {
  id: number;
  nome: string;
  descricao: string | null;
  estrelas_necessarias: number;
  disponivel: boolean;
};

export type ResgateEstrelaFilho = {
  id: number;
  recompensa_nome: string;
  estrelas_utilizadas: number;
  status: "PENDENTE" | "ENTREGUE" | "CANCELADO";
  created_at: string;
  entregue_em: string | null;
  cancelado_em: string | null;
};

export type EstrelasFilho = {
  hoje: number;
  vigencia_atual: number;
  saldo: number;
  total_conquistado: number;
  recompensas: RecompensaEstrelaFilho[];
  resgates: ResgateEstrelaFilho[];
};

export type PainelFilho = {
  filho: {
    nome: string;
    cor: string | null;
    avatar: string | null;
    tem_mesada: boolean;
    valor_mesada: number | null;
  };
  responsavel: { nome: string };
  vigencias: VigenciaFilho[];
  estrelas?: EstrelasFilho;
  solicitacoes_hoje?: SolicitacaoTarefaFilhoApp[];
  revisoes_hoje?: RevisaoTarefaFilhoApp[];
  comunicacao?: {
    mensagem_global_ativa: boolean;
    mensagem_global: string | null;
  };
  atualizado_em: string;
};

type RespostaPareamento = {
  ok: true;
  token: string;
  dispositivo_id: string;
  painel: PainelFilho;
};

type RespostaSolicitacao = {
  ok: true;
  ja_existia: boolean;
  solicitacao: SolicitacaoTarefaFilhoApp;
  notificacoes_enviadas?: number;
};

type RespostaRevisao = {
  ok: true;
  ja_existia: boolean;
  revisao: RevisaoTarefaFilhoApp;
  notificacoes_enviadas?: number;
};

type RespostaErro = {
  ok?: false;
  codigo?: string;
  tentar_em_segundos?: number;
  error?: string;
};

function gerarIdLocal() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function obterClienteId() {
  if (typeof window === "undefined") return gerarIdLocal();

  try {
    const atual = window.localStorage.getItem(CLIENTE_ID_KEY);
    if (atual && atual.length >= 16) return atual;

    const novo = gerarIdLocal();
    window.localStorage.setItem(CLIENTE_ID_KEY, novo);
    return novo;
  } catch {
    return gerarIdLocal();
  }
}

function nomeDispositivo() {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === "android" ? "Android" : "iPhone / iPad";
  }
  return "Navegador";
}

async function chamarAcessoFilho(body: Record<string, unknown>) {
  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("O acesso do filho não está configurado neste ambiente.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/acesso-filho-app`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({})) as RespostaPareamento | RespostaSolicitacao | RespostaRevisao | RespostaErro;

  if (!response.ok) {
    const codigo = "codigo" in data ? data.codigo : undefined;

    if (codigo === "BLOQUEADO") {
      throw new Error("Muitas tentativas inválidas. Aguarde 30 minutos e tente novamente.");
    }
    if (codigo === "CHAVE_INVALIDA") {
      throw new Error("Chave inválida ou expirada. Peça uma nova chave ao seu responsável.");
    }
    if (codigo === "SESSAO_INVALIDA") {
      throw new Error("Este acesso não está mais ativo.");
    }
    if (codigo === "TAREFA_INVALIDA") {
      throw new Error("Esta tarefa não pertence a este acesso.");
    }
    if (codigo === "VIGENCIA_INATIVA") {
      throw new Error("Só é possível avisar durante a vigência em andamento.");
    }
    if (codigo === "JA_MARCADA") {
      throw new Error("O responsável já marcou esta tarefa hoje.");
    }
    if (codigo === "REVISAO_INDISPONIVEL") {
      throw new Error("Esta marcação não está disponível para revisão.");
    }
    if (codigo === "REVISAO_JA_SOLICITADA") {
      throw new Error("A revisão desta tarefa já foi solicitada.");
    }
    if (codigo === "OBSERVACAO_INVALIDA") {
      throw new Error("A observação deve ter no máximo 120 caracteres.");
    }

    throw new Error(("error" in data && data.error) || "Não foi possível acessar o painel do filho.");
  }

  return data;
}

async function lerSessaoFilhoNativaUmaVez(): Promise<string | null> {
  try {
    const { value } = await NativeBiometric.getData({ key: TOKEN_KEY });
    if (tokenFilhoValido(value)) return value;
  } catch {
    // Tenta o cofre alternativo abaixo. Falha de leitura não significa logout.
  }

  try {
    const credenciais = await NativeBiometric.getCredentials({
      server: TOKEN_CREDENTIAL_SERVER,
    });
    if (tokenFilhoValido(credenciais.password)) return credenciais.password;
  } catch {
    // O token pode ainda estar temporariamente indisponível no Keystore.
  }

  return null;
}

async function persistirSessaoFilhoNativa(token: string) {
  const resultados = await Promise.allSettled([
    NativeBiometric.setData({ key: TOKEN_KEY, value: token }),
    NativeBiometric.setCredentials({
      server: TOKEN_CREDENTIAL_SERVER,
      username: "filho",
      password: token,
    }),
  ]);

  if (resultados.every((resultado) => resultado.status === "rejected")) {
    throw new Error("Não foi possível salvar o acesso do filho neste aparelho.");
  }
}

export async function lerSessaoFilhoLocal(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (tokenFilhoValido(tokenFilhoEmMemoria)) return tokenFilhoEmMemoria;

  if (Capacitor.isNativePlatform()) {
    // Depois de reiniciar o aparelho, o Keystore pode levar um instante para
    // responder. Não trate uma leitura transitória como se o filho tivesse saído.
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const token = await lerSessaoFilhoNativaUmaVez();
      if (token) {
        tokenFilhoEmMemoria = token;

        // Migra silenciosamente sessões antigas para os dois cofres seguros.
        void persistirSessaoFilhoNativa(token).catch(() => {
          // A sessão já foi recuperada; uma falha de redundância não encerra o acesso.
        });

        return token;
      }

      if (tentativa < 2) await aguardar(200 * (tentativa + 1));
    }

    return null;
  }

  try {
    const token = window.localStorage.getItem(TOKEN_WEB_KEY);
    if (!tokenFilhoValido(token)) return null;
    tokenFilhoEmMemoria = token;
    return token;
  } catch {
    return null;
  }
}

export async function salvarSessaoFilhoLocal(token: string) {
  if (!tokenFilhoValido(token)) {
    throw new Error("Sessão do filho inválida.");
  }

  if (Capacitor.isNativePlatform()) {
    await persistirSessaoFilhoNativa(token);
    tokenFilhoEmMemoria = token;
    return;
  }

  window.localStorage.setItem(TOKEN_WEB_KEY, token);
  tokenFilhoEmMemoria = token;
}

export async function limparSessaoFilhoLocal() {
  tokenFilhoEmMemoria = null;
  if (typeof window === "undefined") return;

  if (Capacitor.isNativePlatform()) {
    await Promise.allSettled([
      NativeBiometric.deleteData({ key: TOKEN_KEY }),
      NativeBiometric.deleteCredentials({ server: TOKEN_CREDENTIAL_SERVER }),
    ]);
    return;
  }

  try {
    window.localStorage.removeItem(TOKEN_WEB_KEY);
  } catch {
    // Sem armazenamento local disponível.
  }
}

export async function parearFilhoApp(chave: string): Promise<RespostaPareamento> {
  const data = await chamarAcessoFilho({
    acao: "parear",
    chave,
    dispositivo_nome: nomeDispositivo(),
    cliente_id: obterClienteId(),
  });

  if (!("ok" in data) || data.ok !== true || !("token" in data) || !("painel" in data)) {
    throw new Error("Não foi possível concluir o acesso do filho.");
  }

  return data as RespostaPareamento;
}

export async function obterPainelFilhoApp(token: string): Promise<PainelFilho | null> {
  try {
    const data = await chamarAcessoFilho({ acao: "painel", token });
    if (!("ok" in data) || data.ok !== true || !("painel" in data)) return null;
    return data.painel as PainelFilho;
  } catch (error) {
    if (error instanceof Error && error.message === "Este acesso não está mais ativo.") {
      return null;
    }
    throw error;
  }
}

export async function avisarTarefaConcluida(
  idFilhoTarefa: number,
  observacao?: string,
): Promise<RespostaSolicitacao> {
  const token = await lerSessaoFilhoLocal();
  if (!token) throw new Error("Este acesso não está mais ativo.");

  const data = await chamarAcessoFilho({
    acao: "avisar_tarefa_concluida",
    token,
    id_filho_tarefa: idFilhoTarefa,
    observacao: observacao?.trim() || null,
  });

  if (!("ok" in data) || data.ok !== true || !("solicitacao" in data)) {
    throw new Error("Não foi possível enviar o aviso ao responsável.");
  }

  return data as RespostaSolicitacao;
}

export async function pedirRevisaoTarefa(
  idFilhoTarefa: number,
  observacao?: string,
): Promise<RespostaRevisao> {
  const token = await lerSessaoFilhoLocal();
  if (!token) throw new Error("Este acesso não está mais ativo.");

  const data = await chamarAcessoFilho({
    acao: "pedir_revisao_nao_fez",
    token,
    id_filho_tarefa: idFilhoTarefa,
    observacao: observacao?.trim() || null,
  });

  if (!("ok" in data) || data.ok !== true || !("revisao" in data)) {
    throw new Error("Não foi possível pedir a revisão ao responsável.");
  }

  return data as RespostaRevisao;
}

export async function revogarTokenFilho(token: string) {
  await chamarAcessoFilho({ acao: "sair", token });
}

export async function encerrarSessaoFilho() {
  const token = await lerSessaoFilhoLocal();
  if (token) {
    await revogarTokenFilho(token);
  }
  await limparSessaoFilhoLocal();
}
