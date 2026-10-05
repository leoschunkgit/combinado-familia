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
      return json({ error: "Serviço de exclusão não configurado" }, 503);
    }

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Sessão inválida" }, 401);
    }

    let body: { confirmacao?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Confirmação inválida" }, 400);
    }

    if (body.confirmacao !== true) {
      return json({ error: "Confirmação explícita obrigatória" }, 400);
    }

    const token = authorization.slice("Bearer ".length);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return json({ error: "Sessão inválida" }, 401);

    const { data: pai, error: paiError } = await admin
      .from("t_usuario_pai")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (paiError) {
      console.error("Erro ao localizar responsável:", paiError);
      return json({ error: "Não foi possível localizar a conta" }, 500);
    }

    if (pai) {
      // As relações da família usam ON DELETE CASCADE:
      // pai -> filhos/tarefas/vigências/atribuições
      // atribuições -> ocorrências
      // filhos -> acessos públicos.
      // Assim, uma única exclusão no banco remove a família inteira de forma atômica.
      const { data: paiExcluido, error: deletePaiError } = await admin
        .from("t_usuario_pai")
        .delete()
        .eq("id", pai.id)
        .eq("auth_user_id", user.id)
        .select("id")
        .maybeSingle();

      if (deletePaiError || !paiExcluido) {
        console.error("Erro ao excluir dados da família:", deletePaiError);
        return json({ error: "Não foi possível excluir todos os dados da conta" }, 500);
      }
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      console.error("Erro ao excluir usuário do Auth:", deleteAuthError);
      return json({ error: "Os dados foram removidos, mas não foi possível concluir a exclusão da conta de acesso" }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Erro inesperado em excluir-conta:", error);
    return json({ error: "Erro interno ao excluir a conta" }, 500);
  }
});
