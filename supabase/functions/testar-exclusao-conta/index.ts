import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function fail(step: string, details?: unknown) {
  return json({ ok: false, step, details }, 500);
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Ambiente do backend incompleto para o autoteste" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const suffix = crypto.randomUUID().replaceAll("-", "");
  const email = `teste-exclusao-${suffix}@example.invalid`;
  const password = `T3ste!${suffix.slice(0, 20)}`;

  let authUserId: string | null = null;
  let paiId: number | null = null;
  let publicToken: string | null = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: "Teste Exclusão Automática" },
    });
    if (createError || !created.user) return fail("criar_usuario_auth", createError?.message);
    authUserId = created.user.id;

    const { data: pai, error: paiError } = await admin
      .from("t_usuario_pai")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (paiError) return fail("localizar_responsavel", paiError.message);

    if (pai) {
      paiId = pai.id;
    } else {
      const { data: insertedPai, error: insertPaiError } = await admin
        .from("t_usuario_pai")
        .insert({ auth_user_id: authUserId, nome: "Teste Exclusão Automática", email })
        .select("id")
        .single();
      if (insertPaiError || !insertedPai) return fail("criar_responsavel", insertPaiError?.message);
      paiId = insertedPai.id;
    }

    const { data: filho, error: filhoError } = await admin
      .from("t_filho")
      .insert({ id_usuario_pai: paiId, nome: "Filho Teste", tem_mesada: false })
      .select("id")
      .single();
    if (filhoError || !filho) return fail("criar_filho", filhoError?.message);

    const { data: tarefa, error: tarefaError } = await admin
      .from("t_tarefa")
      .insert({ id_usuario_pai: paiId, nome: "Tarefa Teste Exclusão" })
      .select("id")
      .single();
    if (tarefaError || !tarefa) return fail("criar_tarefa", tarefaError?.message);

    const agora = new Date();
    const inicio = new Date(agora.getTime() - 60 * 60 * 1000).toISOString();
    const fim = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const { data: vigencia, error: vigenciaError } = await admin
      .from("t_vigencia")
      .insert({
        id_usuario_pai: paiId,
        data_inicio: inicio,
        data_fim: fim,
        penalidade: "Penalidade teste",
        qtd_ocorrencia: 1,
        tipo_penalidade: "texto",
        valor_debito: null,
      })
      .select("id")
      .single();
    if (vigenciaError || !vigencia) return fail("criar_vigencia", vigenciaError?.message);

    const { data: atribuicao, error: atribuicaoError } = await admin
      .from("t_filho_tarefa")
      .insert({
        id_usuario_pai: paiId,
        id_filho: filho.id,
        id_tarefa: tarefa.id,
        id_vigencia: vigencia.id,
        qtd_nao_fez: 0,
      })
      .select("id")
      .single();
    if (atribuicaoError || !atribuicao) return fail("criar_atribuicao", atribuicaoError?.message);

    const { error: ocorrenciaError } = await admin
      .from("t_ocorrencia")
      .insert({
        id_usuario_pai: paiId,
        id_filho_tarefa: atribuicao.id,
        tipo: "NAO_FEZ",
      });
    if (ocorrenciaError) return fail("criar_ocorrencia", ocorrenciaError.message);

    publicToken = crypto.randomUUID();
    const { error: linkError } = await admin
      .from("t_filho_acesso_publico")
      .insert({
        id_usuario_pai: paiId,
        id_filho: filho.id,
        token: publicToken,
        ativo: true,
      });
    if (linkError) return fail("criar_link_publico", linkError.message);

    const { data: login, error: loginError } = await anon.auth.signInWithPassword({ email, password });
    if (loginError || !login.session?.access_token) return fail("login_usuario_teste", loginError?.message);

    const response = await fetch(`${supabaseUrl}/functions/v1/excluir-conta`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${login.session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmacao: true }),
    });

    const exclusionBody = await response.json().catch(() => ({}));
    if (!response.ok || exclusionBody?.ok !== true) {
      return fail("executar_exclusao", { status: response.status, body: exclusionBody });
    }

    const checks: Record<string, boolean> = {};

    const { data: authAfter } = await admin.auth.admin.getUserById(authUserId);
    checks.auth_removido = !authAfter.user;

    const tables = [
      "t_usuario_pai",
      "t_filho",
      "t_tarefa",
      "t_vigencia",
      "t_filho_tarefa",
      "t_ocorrencia",
      "t_filho_acesso_publico",
    ] as const;

    for (const table of tables) {
      const { count, error } = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("id_usuario_pai", paiId);
      if (error) return fail(`verificar_${table}`, error.message);
      checks[`${table}_zerado`] = (count ?? 0) === 0;
    }

    if (publicToken) {
      const { data: painel } = await admin.rpc("obter_painel_publico_filho", { p_token: publicToken });
      checks.link_publico_invalido = painel == null;
    }

    const allOk = Object.values(checks).every(Boolean);

    return json({
      ok: allOk,
      result: allOk ? "AUTOTESTE_APROVADO" : "AUTOTESTE_FALHOU",
      checks,
    }, allOk ? 200 : 500);
  } catch (error) {
    return fail("erro_inesperado", error instanceof Error ? error.message : String(error));
  } finally {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }
  }
});
