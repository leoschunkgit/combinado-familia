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
- T_USUARIO_PAI is linked to the auth user via `auth_user_id`; signup creates its row through `handle_new_auth_user()` and the authenticated layout provides a fallback for missing legacy rows. Passwords live only in auth, never in the table.
- Account name edits update the parent row and auth metadata; email is read-only and CPF is not part of the current schema, so account writes must never include CPF.
- "Não fez" count is stored in `t_filho_tarefa.qtd_nao_fez`; `feito` = 'S' (cumprida), 'N' (penalidade atingida), null (em andamento).
- Editing an assignment updates its existing `t_filho_tarefa` row so linked occurrence history is preserved.
- DB triggers protect assignment edits/deletes after “Não fez” and validity deletion/period/limit; UI checks give early feedback, DB prevents bypasses.
- Date selection uses shared pt-BR date/time fields with ISO values internally. Validity rules always use the full timestamp: end must be strictly after start; editing dates is blocked only when an existing Fez/Não fez would fall outside the new interval. Fez/Não fez can only be created, changed, or deleted while the validity is in progress. Pending-day alerts are derived only from in-progress validities.
- Penalty indicators derive from the current validity limit and occurrence insertion order across all tasks per child; stored occurrence types remain historical data so editing a limit never rewrites records.
- Child age/allowance are nullable; nullable `tem_mesada_opcional` is the source of truth, while legacy `tem_mesada` remains for compatibility. Selecting allowance requires a value in UI and DB; unselecting clears it.
- Validities require both penalties: allowance children get debits; others get written penalty at the limit. Legacy rows may lack one. Assignment and linked child/validity edits require debit × limit ≤ allowance, enforced in UI and DB; standalone creation is free. Debits never mutate allowance.
- Persist guide completion in auth metadata, not local storage, so first-access guidance follows the parent's account across devices.
- Shared React contexts used by route components live outside route modules so TanStack route code splitting cannot duplicate their instances.
