export type ErroAplicacao = {
  message?: string | null;
  code?: string | null;
  status?: number | null;
  cause?: unknown;
};

const MENSAGENS_SQL: Record<string, string> = {
  "23505": "Este registro já existe",
  "23503": "Este registro está em uso e não pode ser removido",
  "23502": "Preencha todos os campos obrigatórios",
  "23514": "Valor inválido para um dos campos",
  "22P02": "Valor em formato inválido",
  "22001": "Um dos campos ultrapassou o tamanho máximo",
  "22003": "Valor fora do intervalo permitido",
  "PGRST116": "Registro não encontrado",
};

const ERROS_TECNICOS: [RegExp, string][] = [
  [/invalid login credentials/i, "Email ou senha incorretos"],
  [/email not confirmed/i, "Confirme seu email antes de entrar"],
  [/user already registered|already been registered/i, "Este email já está cadastrado"],
  [/password should be at least/i, "A senha deve ter pelo menos 6 caracteres"],
  [/weak password|password.*(breach|known|compromised)/i, "Senha muito fraca. Escolha outra"],
  [/unable to validate email|invalid email|email.*invalid/i, "Email inválido"],
  [/row-level security|permission denied|not authorized|unauthorized/i, "Você não tem permissão para esta ação"],
  [/failed to fetch|network|fetch failed|load failed|econnrefused|timeout/i, "Sem conexão. Verifique sua internet"],
  [/jwt|token|session/i, "Sua sessão expirou. Entre novamente"],
  [/rate limit|too many requests|over_email_send_rate/i, "Muitas tentativas. Aguarde um instante"],
  [/signup.*(disabled|not allowed)|signups/i, "Cadastro temporariamente indisponível"],
];

function extrairErro(error: unknown): ErroAplicacao {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? { message: error } : {};
  }

  const item = error as Record<string, unknown>;
  const cause = item["cause"];
  const causa = cause && typeof cause === "object"
    ? extrairErro(cause)
    : {};

  return {
    message:
      typeof item["message"] === "string"
        ? item["message"]
        : causa.message,
    code:
      typeof item["code"] === "string"
        ? item["code"]
        : causa.code,
    status:
      typeof item["status"] === "number"
        ? item["status"]
        : causa.status,
    cause,
  };
}

function mensagemPermissao(mensagem: string) {
  if (
    mensagem &&
    !/permission denied|row-level security|not authorized|unauthorized/i.test(mensagem)
  ) {
    return mensagem;
  }

  return "Você não tem permissão para esta ação";
}

export function msgErro(error: unknown): string {
  const { message, code } = extrairErro(error);
  const mensagem = message?.trim() ?? "";
  const codigo = code?.trim() ?? "";

  // Regra de negócio deliberadamente lançada pelo PostgreSQL/RPC.
  // A mensagem definida no banco é a fonte de verdade.
  if (codigo === "P0001" && mensagem) {
    return mensagem;
  }

  // Regras de autorização podem usar 42501 com mensagem de negócio própria.
  // Mensagens técnicas de RLS/GRANT continuam escondidas.
  if (codigo === "42501") {
    return mensagemPermissao(mensagem);
  }

  const mensagemSql = MENSAGENS_SQL[codigo];
  if (mensagemSql) {
    return mensagemSql;
  }

  for (const [padrao, texto] of ERROS_TECNICOS) {
    if (padrao.test(mensagem)) return texto;
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}
