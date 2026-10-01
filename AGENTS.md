<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

- Data access uses the browser client with RLS scoped by `current_pai_id()`; every table carries `id_usuario_pai` (including t_tarefa) so each parent only sees their own data.
- T_USUARIO_PAI is linked to the auth user via `auth_user_id`; the row is created on first sign-in in `_authenticated/route.tsx` (no triggers on auth schema allowed). Passwords live only in auth, never in the table.
- "Não fez" count is stored in `t_filho_tarefa.qtd_nao_fez`; `feito` = 'S' (cumprida), 'N' (penalidade atingida), null (em andamento).
- Editing an assignment updates its existing `t_filho_tarefa` row so linked occurrence history is preserved.
- Database triggers protect assignment edits/deletes after any “Não fez” for that child and validity, and protect validity deletion/period/limit against dependent records; UI checks are only early feedback, so concurrent writes cannot bypass these rules.
- Date selection uses shared pt-BR calendar fields with ISO values internally, and blocked actions use a focusable tooltip wrapper; this keeps display language and restriction explanations consistent across screens.
