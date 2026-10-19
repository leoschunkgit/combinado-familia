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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request) {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  const real = req.headers.get("x-real-ip")?.trim();
  return real || "ip-indisponivel";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Serviço de acesso do filho não configurado" }, 503);
    }

    const body = await req.json().catch(() => null) as {
      acao?: unknown;
      chave?: unknown;
      dispositivo_nome?: unknown;
      cliente_id?: unknown;
      token?: unknown;
      push_token?: unknown;
      plataforma?: unknown;
      id_filho_tarefa?: unknown;
      observacao?: unknown;
    } | null;

    const acao = typeof body?.acao === "string" ? body.acao : "";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (acao === "parear") {
      const chave = typeof body?.chave === "string" ? body.chave.trim() : "";
      const dispositivoNome = typeof body?.dispositivo_nome === "string"
        ? body.dispositivo_nome.trim().slice(0, 120)
        : "";
      const clienteId = typeof body?.cliente_id === "string" ? body.cliente_id.trim() : "";

      if (!/^\d{6}$/.test(chave) || clienteId.length < 16 || clienteId.length > 200) {
        return json({ ok: false, codigo: "REQUISICAO_INVALIDA" }, 400);
      }

      const ipHash = await sha256Hex(getClientIp(req));
      const clienteHash = await sha256Hex(clienteId);

      const { data, error } = await admin.rpc("parear_acesso_app_filho_interno", {
        p_chave: chave,
        p_dispositivo_nome: dispositivoNome || null,
        p_ip_hash: ipHash,
        p_cliente_hash: clienteHash,
      });

      if (error) {
        console.error("Erro ao parear acesso do filho:", error);
        return json({ error: "Não foi possível validar a chave" }, 500);
      }

      const retorno = data as Record<string, unknown> | null;
      if (!retorno?.ok) {
        const codigo = typeof retorno?.codigo === "string" ? retorno.codigo : "CHAVE_INVALIDA";
        const status = codigo === "BLOQUEADO" ? 429 : 401;
        return json(retorno ?? { ok: false, codigo }, status);
      }

      const tokenRetorno = typeof retorno.token === "string" ? retorno.token : "";
      if (/^[0-9a-f]{64}$/.test(tokenRetorno)) {
        const { data: painelApp, error: painelAppError } = await admin.rpc(
          "obter_painel_app_filho_interno",
          { p_token: tokenRetorno },
        );
        if (!painelAppError && painelApp) retorno.painel = painelApp;
      }

      return json(retorno);
    }

    if (acao === "avisar_tarefa_concluida") {
      const token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
      const idFilhoTarefa = typeof body?.id_filho_tarefa === "number"
        ? body.id_filho_tarefa
        : Number(body?.id_filho_tarefa);
      const observacao = typeof body?.observacao === "string"
        ? body.observacao.trim()
        : null;

      if (
        !/^[0-9a-f]{64}$/.test(token) ||
        !Number.isInteger(idFilhoTarefa) ||
        idFilhoTarefa <= 0 ||
        (observacao !== null && observacao.length > 120)
      ) {
        return json({ ok: false, codigo: "REQUISICAO_INVALIDA" }, 400);
      }

      const { data, error } = await admin.rpc("criar_solicitacao_tarefa_filho_interno", {
        p_token: token,
        p_id_filho_tarefa: idFilhoTarefa,
        p_observacao: observacao || null,
      });

      if (error) {
        console.error("Erro ao criar aviso de tarefa do filho:", error);
        return json({ error: "Não foi possível enviar o aviso ao responsável" }, 500);
      }

      const retorno = data as Record<string, unknown> | null;
      if (!retorno?.ok) {
        const codigo = typeof retorno?.codigo === "string" ? retorno.codigo : "REQUISICAO_INVALIDA";
        const status =
          codigo === "SESSAO_INVALIDA" ? 401 :
          codigo === "TAREFA_INVALIDA" ? 403 :
          codigo === "JA_MARCADA" || codigo === "VIGENCIA_INATIVA" ? 409 :
          400;
        return json(retorno ?? { ok: false, codigo }, status);
      }

      const solicitacao =
        retorno.solicitacao && typeof retorno.solicitacao === "object"
          ? retorno.solicitacao as Record<string, unknown>
          : null;

      if (retorno.criada !== true) {
        return json({
          ok: true,
          ja_existia: true,
          solicitacao,
          notificacoes_enviadas: 0,
        });
      }

      let notificacoesEnviadas = 0;

      try {
        const idUsuarioPai = Number(retorno.id_usuario_pai);
        const idFilho = Number(retorno.id_filho);
        const nomeFilho = typeof retorno.nome_filho === "string" ? retorno.nome_filho : "Seu filho";
        const nomeTarefa = typeof retorno.nome_tarefa === "string" ? retorno.nome_tarefa : "uma tarefa";
        const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

        if (Number.isInteger(idUsuarioPai) && serviceAccountJson) {
          const serviceAccount = JSON.parse(serviceAccountJson) as FirebaseServiceAccount;

          if (serviceAccount.project_id && serviceAccount.client_email && serviceAccount.private_key) {
            const { data: dispositivos, error: dispositivosError } = await admin
              .from("t_push_dispositivo")
              .select("id,token")
              .eq("id_usuario_pai", idUsuarioPai)
              .eq("ativo", true);

            if (dispositivosError) {
              console.error("Erro ao localizar dispositivos do responsável:", dispositivosError);
            } else if (dispositivos?.length) {
              const accessToken = await obterFirebaseAccessToken(serviceAccount);
              const observacaoSalva =
                typeof solicitacao?.observacao === "string" ? solicitacao.observacao : "";
              const textoBase = nomeFilho + " avisou que terminou: " + nomeTarefa + ".";
              const textoPush = observacaoSalva ? textoBase + " " + observacaoSalva : textoBase;

              for (const dispositivo of dispositivos) {
                const resultado = await enviarFirebaseMensagem({
                  serviceAccount,
                  accessToken,
                  token: dispositivo.token,
                  title: "Combinado Família",
                  body: textoPush,
                  data: {
                    target: "solicitacao_tarefa_filho",
                    route: "/ocorrencias",
                    id_filho: String(idFilho),
                    id_filho_tarefa: String(idFilhoTarefa),
                    id_solicitacao: String(solicitacao?.id ?? ""),
                    data_referencia: String(solicitacao?.data_referencia ?? ""),
                  },
                });

                if (resultado.ok) {
                  notificacoesEnviadas += 1;
                  continue;
                }

                console.error(
                  "Erro FCM no aviso da tarefa do filho:",
                  resultado.status,
                  resultado.errorBody,
                );

                if (resultado.tokenInvalido) {
                  await admin
                    .from("t_push_dispositivo")
                    .update({ ativo: false, updated_at: new Date().toISOString() })
                    .eq("id", dispositivo.id);
                }
              }
            }
          }
        }
      } catch (pushError) {
        // O aviso no banco e a fonte de verdade. Falha do push nao desfaz a solicitacao.
        console.error("Aviso salvo, mas o push ao responsável falhou:", pushError);
      }

      return json({
        ok: true,
        ja_existia: false,
        solicitacao,
        notificacoes_enviadas: notificacoesEnviadas,
      });
    }

    if (acao === "registrar_push") {
      const token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
      const pushToken = typeof body?.push_token === "string" ? body.push_token.trim() : "";
      const plataforma = body?.plataforma === "android"
        ? "android"
        : body?.plataforma === "ios"
          ? "ios"
          : null;

      if (!/^[0-9a-f]{64}$/.test(token) || !pushToken || pushToken.length > 4096 || !plataforma) {
        return json({ ok: false, codigo: "REQUISICAO_INVALIDA" }, 400);
      }

      const tokenHash = await sha256Hex(token);
      const { data: acesso, error: acessoError } = await admin
        .from("t_filho_acesso_app")
        .select("id,id_usuario_pai,id_filho")
        .eq("token_hash", tokenHash)
        .eq("ativo", true)
        .maybeSingle();

      if (acessoError) {
        console.error("Erro ao localizar acesso do filho para push:", acessoError);
        return json({ error: "Não foi possível registrar notificações" }, 500);
      }
      if (!acesso) {
        return json({ ok: false, codigo: "SESSAO_INVALIDA" }, 401);
      }

      const agora = new Date().toISOString();

      const { error: desativarError } = await admin
        .from("t_push_dispositivo_filho")
        .update({ ativo: false, updated_at: agora })
        .eq("id_acesso_app_filho", acesso.id)
        .eq("ativo", true)
        .neq("token", pushToken);

      if (desativarError) {
        console.error("Erro ao desativar token anterior do filho:", desativarError);
        return json({ error: "Não foi possível atualizar notificações" }, 500);
      }

      const { error: upsertError } = await admin
        .from("t_push_dispositivo_filho")
        .upsert(
          {
            id_usuario_pai: acesso.id_usuario_pai,
            id_filho: acesso.id_filho,
            id_acesso_app_filho: acesso.id,
            token: pushToken,
            plataforma,
            ativo: true,
            updated_at: agora,
          },
          { onConflict: "token" },
        );

      if (upsertError) {
        console.error("Erro ao registrar push do filho:", upsertError);
        return json({ error: "Não foi possível registrar notificações" }, 500);
      }

      return json({ ok: true, ativo: true });
    }

    if (acao === "painel") {
      const token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
      if (!/^[0-9a-f]{64}$/.test(token)) return json({ ok: false, codigo: "SESSAO_INVALIDA" }, 401);

      const { data, error } = await admin.rpc("obter_painel_app_filho_interno", { p_token: token });
      if (error) {
        console.error("Erro ao obter painel do filho:", error);
        return json({ error: "Não foi possível carregar o acompanhamento" }, 500);
      }
      if (!data) return json({ ok: false, codigo: "SESSAO_INVALIDA" }, 401);

      return json({ ok: true, painel: data });
    }

    if (acao === "sair") {
      const token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
      if (!/^[0-9a-f]{64}$/.test(token)) return json({ ok: true });

      const { error } = await admin.rpc("sair_acesso_app_filho_interno", { p_token: token });
      if (error) {
        console.error("Erro ao encerrar acesso do filho:", error);
        return json({ error: "Não foi possível encerrar o acesso" }, 500);
      }

      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Erro inesperado em acesso-filho-app:", error);
    return json({ error: "Erro interno no acesso do filho" }, 500);
  }
});
