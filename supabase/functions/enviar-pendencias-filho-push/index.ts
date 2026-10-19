import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ANDROID_NOTIFICATION_STYLE } from "../_shared/firebase-messaging.ts";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type PendenciaAgrupada = {
  idUsuarioPai: number;
  idFilho: number;
  quantidade: number;
};

type DispositivoFilho = {
  id: number;
  id_usuario_pai: number;
  id_filho: number;
  id_acesso_app_filho: number;
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
  const inicio = new Date(data + "T00:00:00-03:00");
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
  const unsigned = header + "." + payload;

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
  const assertion = unsigned + "." + base64Url(signature);

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

async function enviarFcm(
  serviceAccount: ServiceAccount,
  accessToken: string,
  dispositivo: DispositivoFilho,
) {
  const response = await fetch(
    "https://fcm.googleapis.com/v1/projects/" +
      encodeURIComponent(serviceAccount.project_id) +
      "/messages:send",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: dispositivo.token,
          notification: {
            title: "Combinado Família",
            body: "Não esqueça de fazer suas tarefas do dia.",
          },
          data: {
            target: "filho",
            route: "/",
          },
          android: {
            priority: "high",
            notification: ANDROID_NOTIFICATION_STYLE,
          },
        },
      }),
    },
  );

  if (response.ok) return { ok: true, tokenInvalido: false };

  const errorBody = await response.text();
  console.error("Erro FCM do filho:", response.status, errorBody);
  const tokenInvalido =
    response.status === 404 ||
    errorBody.includes("UNREGISTERED") ||
    errorBody.includes("registration-token-not-registered");

  return { ok: false, tokenInvalido };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as { janela?: unknown };
    const janela =
      body?.janela === "09:00" ||
      body?.janela === "12:00" ||
      body?.janela === "19:00"
        ? body.janela
        : null;

    if (!janela) return json({ error: "Janela de envio inválida" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("PUSH_CRON_SECRET");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!supabaseUrl || !serviceRoleKey || !cronSecret || !serviceAccountJson) {
      return json({ error: "Serviço de push do filho não configurado" }, 503);
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
    if (!vigencias?.length) {
      return json({ ok: true, data: dataReferencia, janela, enviados: 0 });
    }

    const idsVigencias = vigencias.map((v) => v.id);
    const { data: atribuicoes, error: atribuicoesError } = await admin
      .from("t_filho_tarefa")
      .select("id,id_usuario_pai,id_filho")
      .in("id_vigencia", idsVigencias);

    if (atribuicoesError) throw atribuicoesError;
    if (!atribuicoes?.length) {
      return json({ ok: true, data: dataReferencia, janela, enviados: 0 });
    }

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
      const chave = String(atribuicao.id_usuario_pai) + ":" + String(atribuicao.id_filho);
      const atual = agrupadas.get(chave);
      if (atual) {
        atual.quantidade += 1;
      } else {
        agrupadas.set(chave, {
          idUsuarioPai: atribuicao.id_usuario_pai,
          idFilho: atribuicao.id_filho,
          quantidade: 1,
        });
      }
    }

    const pendencias = [...agrupadas.values()];
    if (!pendencias.length) {
      return json({ ok: true, data: dataReferencia, janela, enviados: 0 });
    }

    const idsFilhos = [...new Set(pendencias.map((p) => p.idFilho))];
    const { data: dispositivos, error: dispositivosError } = await admin
      .from("t_push_dispositivo_filho")
      .select("id,id_usuario_pai,id_filho,id_acesso_app_filho,token")
      .in("id_filho", idsFilhos)
      .eq("ativo", true);

    if (dispositivosError) throw dispositivosError;
    if (!dispositivos?.length) {
      return json({ ok: true, data: dataReferencia, janela, enviados: 0 });
    }

    const idsAcessos = [...new Set(dispositivos.map((d) => d.id_acesso_app_filho))];
    const { data: acessosAtivos, error: acessosError } = await admin
      .from("t_filho_acesso_app")
      .select("id")
      .in("id", idsAcessos)
      .eq("ativo", true);

    if (acessosError) throw acessosError;

    const acessosAtivosIds = new Set((acessosAtivos ?? []).map((a) => a.id));
    const dispositivosAtivos = (dispositivos as DispositivoFilho[]).filter((d) =>
      acessosAtivosIds.has(d.id_acesso_app_filho)
    );

    if (!dispositivosAtivos.length) {
      return json({ ok: true, data: dataReferencia, janela, enviados: 0 });
    }

    const idsDispositivos = dispositivosAtivos.map((d) => d.id);
    const { data: enviosExistentes, error: enviosError } = await admin
      .from("t_push_envio_filho")
      .select("id_push_dispositivo_filho")
      .in("id_push_dispositivo_filho", idsDispositivos)
      .eq("data_referencia", dataReferencia)
      .eq("janela_envio", janela);

    if (enviosError) throw enviosError;

    const jaEnviados = new Set(
      (enviosExistentes ?? []).map((e) => e.id_push_dispositivo_filho),
    );
    const pendenciasPorFilho = new Map(
      pendencias.map((p) => [String(p.idUsuarioPai) + ":" + String(p.idFilho), p]),
    );

    const accessToken = await obterAccessToken(serviceAccount);
    let enviados = 0;
    let falhas = 0;

    for (const dispositivo of dispositivosAtivos) {
      if (jaEnviados.has(dispositivo.id)) continue;

      const chave = String(dispositivo.id_usuario_pai) + ":" + String(dispositivo.id_filho);
      const pendencia = pendenciasPorFilho.get(chave);
      if (!pendencia) continue;

      const resultado = await enviarFcm(serviceAccount, accessToken, dispositivo);
      if (!resultado.ok) {
        falhas += 1;
        if (resultado.tokenInvalido) {
          await admin
            .from("t_push_dispositivo_filho")
            .update({ ativo: false, updated_at: new Date().toISOString() })
            .eq("id", dispositivo.id);
        }
        continue;
      }

      const { error: insertError } = await admin.from("t_push_envio_filho").insert({
        id_push_dispositivo_filho: dispositivo.id,
        id_usuario_pai: dispositivo.id_usuario_pai,
        id_filho: dispositivo.id_filho,
        data_referencia: dataReferencia,
        janela_envio: janela,
        qtd_pendencias: pendencia.quantidade,
      });

      if (insertError && insertError.code !== "23505") {
        console.error("Push do filho enviado, mas o controle do envio falhou:", insertError);
      }

      enviados += 1;
      jaEnviados.add(dispositivo.id);
    }

    return json({
      ok: true,
      data: dataReferencia,
      janela,
      filhosComPendencia: pendencias.length,
      enviados,
      falhas,
    });
  } catch (error) {
    console.error("Erro inesperado em enviar-pendencias-filho-push:", error);
    return json({ error: "Erro interno ao enviar notificações do filho" }, 500);
  }
});
