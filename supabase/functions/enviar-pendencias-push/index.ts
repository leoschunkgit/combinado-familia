import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type PendenciaAgrupada = {
  idUsuarioPai: number;
  idFilho: number;
  nomeFilho: string;
  quantidade: number;
};

type Dispositivo = {
  id: number;
  id_usuario_pai: number;
  token: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function dataSaoPaulo(valor = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(valor);
}

function limitesDiaSaoPaulo(data: string) {
  const inicio = new Date(`${data}T00:00:00-03:00`);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 1);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemPkcs8ToBytes(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function obterAccessToken(serviceAccount: ServiceAccount) {
  const agora = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  }));
  const unsigned = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemPkcs8ToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = await response.json();
  if (!response.ok || typeof body.access_token !== "string") {
    console.error("Erro ao obter token OAuth do Firebase:", body);
    throw new Error("Não foi possível autenticar no Firebase");
  }
  return body.access_token as string;
}

function mensagemPendencia(nome: string, quantidade: number) {
  return quantidade === 1
    ? `${nome} ainda tem 1 tarefa sem marcação no dia de hoje.`
    : `${nome} ainda tem ${quantidade} tarefas sem marcação no dia de hoje.`;
}

async function enviarFcm(
  serviceAccount: ServiceAccount,
  accessToken: string,
  dispositivo: Dispositivo,
  pendencia: PendenciaAgrupada,
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: dispositivo.token,
          notification: {
            title: "Combinado Família",
            body: mensagemPendencia(pendencia.nomeFilho, pendencia.quantidade),
          },
          data: {
            route: "/notificacoes",
            id_filho: String(pendencia.idFilho),
          },
          android: { priority: "high" },
        },
      }),
    },
  );

  if (response.ok) return { ok: true, tokenInvalido: false };

  const errorBody = await response.text();
  console.error("Erro FCM:", response.status, errorBody);
  const tokenInvalido =
    response.status === 404 ||
    errorBody.includes("UNREGISTERED") ||
    errorBody.includes("registration-token-not-registered");

  return { ok: false, tokenInvalido };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("PUSH_CRON_SECRET");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!supabaseUrl || !serviceRoleKey || !cronSecret || !serviceAccountJson) {
      return json({ error: "Serviço de push não configurado" }, 503);
    }
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "Não autorizado" }, 401);
    }

    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      return json({ error: "Credenciais do Firebase inválidas" }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const agora = new Date();
    const agoraIso = agora.toISOString();
    const dataReferencia = dataSaoPaulo(agora);
    const { inicio, fim } = limitesDiaSaoPaulo(dataReferencia);

    const { data: vigencias, error: vigenciasError } = await admin
      .from("t_vigencia")
      .select("id,id_usuario_pai")
      .lte("data_inicio", agoraIso)
      .gte("data_fim", agoraIso);

    if (vigenciasError) throw vigenciasError;
    if (!vigencias?.length) return json({ ok: true, data: dataReferencia, enviados: 0 });

    const idsVigencias = vigencias.map((v) => v.id);
    const { data: atribuicoes, error: atribuicoesError } = await admin
      .from("t_filho_tarefa")
      .select("id,id_usuario_pai,id_filho,t_filho!t_filho_tarefa_same_pai_filho_fk(nome)")
      .in("id_vigencia", idsVigencias);

    if (atribuicoesError) throw atribuicoesError;
    if (!atribuicoes?.length) return json({ ok: true, data: dataReferencia, enviados: 0 });

    const idsAtribuicoes = atribuicoes.map((a) => a.id);
    const { data: ocorrencias, error: ocorrenciasError } = await admin
      .from("t_ocorrencia")
      .select("id_filho_tarefa")
      .in("id_filho_tarefa", idsAtribuicoes)
      .gte("created_at", inicio)
      .lt("created_at", fim);

    if (ocorrenciasError) throw ocorrenciasError;

    const marcadas = new Set((ocorrencias ?? []).map((o) => o.id_filho_tarefa));
    const agrupadas = new Map<string, PendenciaAgrupada>();

    for (const atribuicao of atribuicoes) {
      if (marcadas.has(atribuicao.id)) continue;
      const filhoRel = Array.isArray(atribuicao.t_filho) ? atribuicao.t_filho[0] : atribuicao.t_filho;
      const nomeFilho = filhoRel?.nome;
      if (typeof nomeFilho !== "string" || !nomeFilho) continue;

      const chave = `${atribuicao.id_usuario_pai}:${atribuicao.id_filho}`;
      const atual = agrupadas.get(chave);
      if (atual) {
        atual.quantidade += 1;
      } else {
        agrupadas.set(chave, {
          idUsuarioPai: atribuicao.id_usuario_pai,
          idFilho: atribuicao.id_filho,
          nomeFilho,
          quantidade: 1,
        });
      }
    }

    const pendencias = [...agrupadas.values()];
    if (!pendencias.length) return json({ ok: true, data: dataReferencia, enviados: 0 });

    const pais = [...new Set(pendencias.map((p) => p.idUsuarioPai))];
    const { data: dispositivos, error: dispositivosError } = await admin
      .from("t_push_dispositivo")
      .select("id,id_usuario_pai,token")
      .in("id_usuario_pai", pais)
      .eq("ativo", true);

    if (dispositivosError) throw dispositivosError;
    if (!dispositivos?.length) return json({ ok: true, data: dataReferencia, enviados: 0 });

    const idsDispositivos = dispositivos.map((d) => d.id);
    const { data: enviosExistentes, error: enviosError } = await admin
      .from("t_push_envio")
      .select("id_push_dispositivo,id_filho")
      .in("id_push_dispositivo", idsDispositivos)
      .eq("data_referencia", dataReferencia);

    if (enviosError) throw enviosError;

    const jaEnviados = new Set(
      (enviosExistentes ?? []).map((e) => `${e.id_push_dispositivo}:${e.id_filho}`),
    );
    const dispositivosPorPai = new Map<number, Dispositivo[]>();
    for (const dispositivo of dispositivos as Dispositivo[]) {
      const lista = dispositivosPorPai.get(dispositivo.id_usuario_pai) ?? [];
      lista.push(dispositivo);
      dispositivosPorPai.set(dispositivo.id_usuario_pai, lista);
    }

    const accessToken = await obterAccessToken(serviceAccount);
    let enviados = 0;
    let falhas = 0;

    for (const pendencia of pendencias) {
      for (const dispositivo of dispositivosPorPai.get(pendencia.idUsuarioPai) ?? []) {
        const chaveEnvio = `${dispositivo.id}:${pendencia.idFilho}`;
        if (jaEnviados.has(chaveEnvio)) continue;

        const resultado = await enviarFcm(serviceAccount, accessToken, dispositivo, pendencia);
        if (!resultado.ok) {
          falhas += 1;
          if (resultado.tokenInvalido) {
            await admin
              .from("t_push_dispositivo")
              .update({ ativo: false, updated_at: new Date().toISOString() })
              .eq("id", dispositivo.id);
          }
          continue;
        }

        const { error: insertError } = await admin.from("t_push_envio").insert({
          id_push_dispositivo: dispositivo.id,
          id_usuario_pai: pendencia.idUsuarioPai,
          id_filho: pendencia.idFilho,
          data_referencia: dataReferencia,
          qtd_pendencias: pendencia.quantidade,
        });
        if (insertError && insertError.code !== "23505") {
          console.error("Push enviado, mas não foi possível registrar controle de envio:", insertError);
        }

        enviados += 1;
        jaEnviados.add(chaveEnvio);
      }
    }

    return json({
      ok: true,
      data: dataReferencia,
      familiasComPendencia: pais.length,
      filhosComPendencia: pendencias.length,
      enviados,
      falhas,
    });
  } catch (error) {
    console.error("Erro inesperado em enviar-pendencias-push:", error);
    return json({ error: "Erro interno ao enviar notificações" }, 500);
  }
});
