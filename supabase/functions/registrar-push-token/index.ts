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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Serviço de notificações não configurado" }, 503);
    }
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Sessão inválida" }, 401);
    }

    const body = await req.json().catch(() => null) as {
      token?: unknown;
      plataforma?: unknown;
      ativo?: unknown;
    } | null;

    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const plataforma = body?.plataforma === "ios" ? "ios" : body?.plataforma === "android" ? "android" : null;
    const ativo = body?.ativo !== false;

    if (!token || token.length > 4096 || !plataforma) {
      return json({ error: "Dados do dispositivo inválidos" }, 400);
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
      console.error("Erro ao localizar responsável para push:", paiError);
      return json({ error: "Responsável não encontrado" }, 404);
    }

    if (!ativo) {
      const { error } = await admin
        .from("t_push_dispositivo")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("token", token)
        .eq("id_usuario_pai", pai.id);

      if (error) {
        console.error("Erro ao desativar token push:", error);
        return json({ error: "Não foi possível desativar o dispositivo" }, 500);
      }

      return json({ ok: true, ativo: false });
    }

    const { error: upsertError } = await admin
      .from("t_push_dispositivo")
      .upsert(
        {
          id_usuario_pai: pai.id,
          token,
          plataforma,
          ativo: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );

    if (upsertError) {
      console.error("Erro ao registrar token push:", upsertError);
      return json({ error: "Não foi possível registrar o dispositivo" }, 500);
    }

    return json({ ok: true, ativo: true });
  } catch (error) {
    console.error("Erro inesperado em registrar-push-token:", error);
    return json({ error: "Erro interno ao registrar notificações" }, 500);
  }
});
