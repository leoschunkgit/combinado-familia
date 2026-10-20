# Autenticação e sessão do responsável

## Regra central

A sessão do responsável deve permanecer ativa no aparelho até que o próprio usuário execute uma ação que encerre ou invalide aquela sessão.

O fechamento do app, tempo sem uso, suspensão em segundo plano ou uma falha transitória de rede não são logout.

## Matriz de comportamento

| Cenário | Comportamento |
| --- | --- |
| Login com email e senha | Cria/persiste a sessão no aparelho |
| Fechar e abrir o app | Mantém a sessão |
| Ficar horas ou dias sem usar | Mantém a sessão enquanto o Supabase considerar a sessão válida |
| Biometria desligada + sessão válida | Entra direto |
| Biometria ligada + sessão válida | Solicita biometria para desbloquear o acesso |
| Biometria ligada + sem sessão | Biometria não cria sessão; exige login com senha |
| Ativar biometria | Não cria nem troca sessão; apenas ativa a barreira local |
| Desativar biometria | Não encerra a sessão |
| Sair | Encerra somente a sessão do aparelho/navegador atual |
| Sair em outro aparelho | Não encerra esta sessão |
| Falha temporária de rede | Não deve ser tratada como logout |
| Sessão revogada/inválida pelo Supabase | Volta ao login |
| Redefinição de senha | Encerra explicitamente apenas a sessão de recuperação deste aparelho; não usa logout global |
| Exclusão da conta | A conta Auth é removida; todas as sessões deixam de ser válidas |

## Implementação

- Cliente Supabase:
  - `persistSession: true`
  - `autoRefreshToken: true`
- Logout normal: sempre `scope: "local"`.
- A biometria é uma proteção local do aparelho. Ela não armazena senha e não substitui a sessão Supabase.
- A validação de rota diferencia sessão realmente inválida de falha transitória de rede.
- A sessão do filho continua separada da sessão do responsável.

## Banco / Supabase Auth

As sessões do responsável pertencem ao schema gerenciado `auth` do Supabase. Não criar tabela funcional paralela para controlar login do responsável.

A aplicação deve depender do ciclo oficial de access token + refresh token do Supabase e das políticas RLS já existentes para os dados da família.
