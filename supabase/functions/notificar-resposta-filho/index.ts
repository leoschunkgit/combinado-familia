import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  enviarFirebaseMensagem,
  obterFirebaseAccessToken,
  type FirebaseServiceAccount,
} from "../_shared/firebase-messaging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type TipoInteracao = "SOLICITACAO" | "REVISAO";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function mensagemResposta(tipo: TipoInteracao, status: string, tarefa: string) {
  if (tipo === "SOLICITACAO") {
    if (status === "RESOLVIDA_FEZ") {
      return `Seu aviso foi respondido: “${tarefa}” foi marcada como Fez.`;
    }
    if (status === "RESOLVIDA_NAO_PRECISOU") {
      return `Seu aviso foi respondido: “${tarefa}” foi marcada como Não precisou.`;
    }
    return `Seu aviso foi respondido: “${tarefa}” foi marcada como Não fez.`;
  }

  if (status === "ALTERADO_PARA_FEZ") {
    return `Seu pedido de revisão de “${tarefa}” foi aceito: agora está como Fez.`;
  }
  if (status === "ALTERADO_PARA_NAO_PRECISOU") {
    return `Seu pedido de revisão de “${tarefa}” foi aceito: agora está como Não precisou.`;
  }

  return `Seu pedido de revisão de “${tarefa}” foi respondido: o Não fez foi mantido.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey || !serviceAccountJson) {
      return json({ error: "Serviço de notificações não configurado" }, 503);
    }
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Sessão inválida" }, 401);
    }

    const body = await req.json().catch(() => null) as {
      tipo_interacao?: unknown;
      id_interacao?: unknown;
    } | null;

    const tipoInteracao: TipoInteracao | null =
      body?.tipo_interacao === "SOLICITACAO"
        ? "SOLICITACAO"
        : body?.tipo_interacao === "REVISAO"
          ? "REVISAO"
          : null;
    const idInteracao = typeof body?.id_interacao === "number"
      ? body.id_interacao
      : Number(body?.id_interacao);

    if (!tipoInteracao || !Number.isInteger(idInteracao) || idInteracao <= 0) {
      return json({ error: "Interação inválida" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) return json({ error: "Sessão inválida" }, 401);

    const { data: pai, error: paiError } = await admin
      .from("t_usuario_pai")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (paiError || !pai) {
      console.error("Erro ao localizar responsável:", paiError);
      return json({ error: "Responsável não encontrado" }, 404);
    }

    const { data: envioExistente, error: envioExistenteError } = await admin
      .from("t_push_resposta_filho")
      .select("id,notificacoes_enviadas")
      .eq("tipo_interacao", tipoInteracao)
      .eq("id_interacao", idInteracao)
      .maybeSingle();

    if (envioExistenteError) {
      console.error("Erro ao consultar envio da resposta ao filho:", envioExistenteError);
      return json({ error: "Não foi possível validar a notificação" }, 500);
    }
    if (envioExistente) {
      return json({
        ok: true,
        ja_enviada: true,
        notificacoes_enviadas: envioExistente.notificacoes_enviadas,
      });
    }

    const tabela = tipoInteracao === "SOLICITACAO"
      ? "t_solicitacao_tarefa_filho"
      : "t_revisao_tarefa_filho";

    const { data: interacao, error: interacaoError } = await admin
      .from(tabela)
      .select("id,id_filho_tarefa,data_referencia,status")
      .eq("id", idInteracao)
      .maybeSingle();

    if (interacaoError || !interacao) {
      console.error("Erro ao localizar interação do filho:", interacaoError);
      return json({ error: "Interação não encontrada" }, 404);
    }

    const statusValido =
      tipoInteracao === "SOLICITACAO"
        ? interacao.status === "RESOLVIDA_FEZ" ||
          interacao.status === "RESOLVIDA_NAO_FEZ" ||
          interacao.status === "RESOLVIDA_NAO_PRECISOU"
        : interacao.status === "MANTEVE_NAO_FEZ" ||
          interacao.status === "ALTERADO_PARA_FEZ" ||
          interacao.status === "ALTERADO_PARA_NAO_PRECISOU";

    if (!statusValido) {
      return json({ error: "A interação ainda não possui uma resposta notificável" }, 409);
    }

    const { data: atribuicao, error: atribuicaoError } = await admin
      .from("t_filho_tarefa")
      .select("id_usuario_pai,id_filho,id_tarefa")
      .eq("id", interacao.id_filho_tarefa)
      .maybeSingle();

    if (atribuicaoError || !atribuicao) {
      console.error("Erro ao localizar atribuição da interação:", atribuicaoError);
      return json({ error: "Atribuição não encontrada" }, 404);
    }
    if (Number(atribuicao.id_usuario_pai) !== Number(pai.id)) {
      return json({ error: "Interação não pertence ao responsável" }, 403);
    }

    const { data: tarefa } = await admin
      .from("t_tarefa")
      .select("nome")
      .eq("id", atribuicao.id_tarefa)
      .eq("id_usuario_pai", pai.id)
      .maybeSingle();

    const nomeTarefa =
      typeof tarefa?.nome === "string" && tarefa.nome.trim()
        ? tarefa.nome.trim()
        : "sua tarefa";

    const { data: dispositivos, error: dispositivosError } = await admin
      .from("t_push_dispositivo_filho")
      .select("id,token,id_acesso_app_filho")
      .eq("id_usuario_pai", pai.id)
      .eq("id_filho", atribuicao.id_filho)
      .eq("ativo", true);

    if (dispositivosError) {
      console.error("Erro ao localizar dispositivos do filho:", dispositivosError);
      return json({ error: "Não foi possível localizar os dispositivos do filho" }, 500);
    }
    if (!dispositivos?.length) {
      return json({ ok: true, ja_enviada: false, notificacoes_enviadas: 0 });
    }

    const idsAcessos = [...new Set(dispositivos.map((item) => item.id_acesso_app_filho))];
    const { data: acessos, error: acessosError } = await admin
      .from("t_filho_acesso_app")
      .select("id")
      .in("id", idsAcessos)
      .eq("ativo", true);

    if (acessosError) {
      console.error("Erro ao validar acessos ativos do filho:", acessosError);
      return json({ error: "Não foi possível validar o acesso do filho" }, 500);
    }

    const acessosAtivos = new Set((acessos ?? []).map((item) => item.id));
    const dispositivosAtivos = dispositivos.filter((item) =>
      acessosAtivos.has(item.id_acesso_app_filho)
    );

    if (!dispositivosAtivos.length) {
      return json({ ok: true, ja_enviada: false, notificacoes_enviadas: 0 });
    }

    const serviceAccount = JSON.parse(serviceAccountJson) as FirebaseServiceAccount;
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      return json({ error: "Credenciais do Firebase inválidas" }, 503);
    }

    const accessToken = await obterFirebaseAccessToken(serviceAccount);
    const texto = mensagemResposta(tipoInteracao, interacao.status, nomeTarefa);
    let enviados = 0;

    for (const dispositivo of dispositivosAtivos) {
      const resultado = await enviarFirebaseMensagem({
        serviceAccount,
        accessToken,
        token: dispositivo.token,
        title: "Combinado Família",
        body: texto,
        data: {
          target: "resposta_interacao_filho",
          tipo_interacao: tipoInteracao,
          id_interacao: String(idInteracao),
          id_filho_tarefa: String(interacao.id_filho_tarefa),
          data_referencia: String(interacao.data_referencia),
        },
      });

      if (resultado.ok) {
        enviados += 1;
        continue;
      }

      console.error(
        "Erro FCM ao notificar resposta ao filho:",
        resultado.status,
        resultado.errorBody,
      );

      if (resultado.tokenInvalido) {
        await admin
          .from("t_push_dispositivo_filho")
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq("id", dispositivo.id);
      }
    }

    if (enviados > 0) {
      const { error: registrarError } = await admin
        .from("t_push_resposta_filho")
        .insert({
          id_usuario_pai: pai.id,
          id_filho: atribuicao.id_filho,
          tipo_interacao: tipoInteracao,
          id_interacao: idInteracao,
          status_resposta: interacao.status,
          notificacoes_enviadas: enviados,
        });

      if (registrarError && registrarError.code !== "23505") {
        console.error("Push enviado, mas o controle idempotente falhou:", registrarError);
      }
    }

    return json({
      ok: true,
      ja_enviada: false,
      notificacoes_enviadas: enviados,
    });
  } catch (error) {
    console.error("Erro inesperado em notificar-resposta-filho:", error);
    return json({ error: "Erro interno ao notificar o filho" }, 500);
  }
});
