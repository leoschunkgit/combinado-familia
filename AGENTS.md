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
- Date selection uses shared pt-BR calendar fields with ISO values internally; validity periods are entered as dates and stored from the start through the end of their local calendar days, while blocked actions use a focusable tooltip wrapper for restriction explanations.
- Penalty indicators derive from the current validity limit and occurrence insertion order across all tasks per child; stored occurrence types remain historical data so editing a limit never rewrites records.
- Child age and allowance amount are nullable; allowance amount is cleared when allowance is unchecked and currency is entered in Brazilian decimal format, so absent values remain distinct from zero.
- New validities require both written and allowance-debit penalties; a child with a registered allowance amount receives the debit per occurrence, otherwise the written penalty at the limit. Legacy validities may lack one penalty; allowance debits aggregate across all assigned tasks until the validity limit, are capped at the child's current allowance, and are displayed as calculated balances without mutating allowance.
