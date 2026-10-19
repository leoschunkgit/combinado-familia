import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

      return json(retorno);
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
