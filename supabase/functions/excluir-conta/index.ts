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
      const idPai = pai.id;

      const deletes = [
        ["t_ocorrencia", admin.from("t_ocorrencia").delete().eq("id_usuario_pai", idPai)],
        ["t_filho_acesso_publico", admin.from("t_filho_acesso_publico").delete().eq("id_usuario_pai", idPai)],
        ["t_filho_tarefa", admin.from("t_filho_tarefa").delete().eq("id_usuario_pai", idPai)],
        ["t_vigencia", admin.from("t_vigencia").delete().eq("id_usuario_pai", idPai)],
        ["t_tarefa", admin.from("t_tarefa").delete().eq("id_usuario_pai", idPai)],
        ["t_filho", admin.from("t_filho").delete().eq("id_usuario_pai", idPai)],
        ["t_usuario_pai", admin.from("t_usuario_pai").delete().eq("id", idPai)],
      ] as const;

      for (const [table, promise] of deletes) {
        const { error } = await promise;
        if (error) {
          console.error(`Erro ao excluir ${table}:`, error);
          return json({ error: "Não foi possível excluir todos os dados da conta" }, 500);
        }
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
