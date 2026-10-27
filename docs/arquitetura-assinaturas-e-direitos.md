# Arquitetura de Assinaturas e Direitos

## Objetivo

Criar uma camada de monetização totalmente separada das regras atuais do Combinado Família.

Nesta fase, **nenhuma tela, fluxo, RPC de negócio ou regra existente consulta esta estrutura**.
O aplicativo continua se comportando exatamente como antes.

A integração com o produto só começa depois que esta camada estiver fechada e testada.

---

## Princípio central

O aplicativo **não deve decidir acesso olhando assinatura, pagamento ou provedor**.

Evitar:

```ts
if (assinante) { ... }
if (plano === "PREMIUM") { ... }
if (status === "ATIVA") { ... }
if (googlePlay) { ... }
```

O domínio de cobrança resolve tudo antes.

A aplicação deverá trabalhar apenas com direitos já calculados, por exemplo:

```ts
entitlements.tem("MESADA")
entitlements.limite("FILHOS")
entitlements.tem("PDF_HISTORICO")
```

Os nomes acima são exemplos da futura API de aplicação. Os recursos reais serão definidos depois.

---

## Fronteira de segurança

O domínio interno fica no schema PostgreSQL:

```
billing
```

Esse schema:

- não fica exposto diretamente ao cliente;
- não concede acesso a `anon` nem `authenticated`;
- possui RLS ativado como defesa adicional;
- não compartilha tabelas com feature flags administrativos;
- não altera `t_usuario_pai`;
- não adiciona `assinante = true/false` ao usuário;
- mantém histórico de cobrança independente do ciclo de vida da conta.

O único vínculo estrutural atual é `id_usuario_pai`, com `ON DELETE SET NULL` nas estruturas históricas.

---

## Entidades

### `billing.plano`

Representa o pacote de direitos.

Exemplos iniciais:

- `FREE`
- `PREMIUM`

Plano não representa preço, mensalidade ou Google Play.

---

### `billing.recurso`

Catálogo central de capacidades que poderão ser controladas.

Tipos suportados:

- `BOOLEANO`
- `LIMITE_INTEIRO`
- `NUMERO`
- `TEXTO`
- `JSON`

Exemplos futuros:

- `FILHOS.LIMITE`
- `HISTORICO.PDF`
- `MESADA.HABILITADA`
- `NOTIFICACOES.AVANCADAS`

Os recursos definitivos ainda não foram cadastrados.

---

### `billing.plano_recurso`

Define o valor de cada recurso dentro de um plano.

Exemplo conceitual:

| Plano | Recurso | Valor |
| --- | --- | --- |
| FREE | FILHOS.LIMITE | 1 |
| PREMIUM | FILHOS.LIMITE | 10 |
| FREE | MESADA.HABILITADA | false |
| PREMIUM | MESADA.HABILITADA | true |

O banco valida o tipo do valor conforme o tipo cadastrado no recurso.

---

### `billing.oferta`

Representa a forma comercial de comprar um plano.

Isso separa **o que o usuário recebe** de **como ele paga**.

Uma mesma assinatura Premium poderá ter ofertas como:

- Google Play mensal;
- Google Play anual;
- Web mensal;
- Web anual;
- promoção;
- vitalício;
- oferta personalizada.

Campos de integração permitem mapear produto, base plan e offer externos.

Preço salvo nessa tabela é informação de catálogo. O provedor de pagamento continua sendo a fonte autoritativa da cobrança.

---

### `billing.assinatura`

Representa o estado comercial de uma conta.

Estados previstos:

- `EM_TESTE`
- `ATIVA`
- `GRACE_PERIOD`
- `PAGAMENTO_PENDENTE`
- `PAUSADA`
- `CANCELADA`
- `EXPIRADA`
- `REVOGADA`

Também guarda:

- início;
- período vigente;
- fim do teste;
- cancelamento;
- encerramento;
- renovação automática;
- origem.

Nenhum desses estados será interpretado diretamente pela UI.

---

### `billing.assinatura_provedor`

Liga uma assinatura interna ao provedor externo.

Permite armazenar, sem contaminar a entidade principal:

- Google Play;
- futuro provedor web;
- identificador externo da assinatura;
- identificador do cliente;
- produto;
- purchase token;
- último payload sincronizado;
- oferta relacionada.

---

### `billing.assinatura_evento`

Histórico imutável dos eventos recebidos/processados.

Serve para:

- webhook;
- renovação;
- cancelamento;
- falha de pagamento;
- restauração;
- mudança de plano;
- auditoria;
- idempotência por `evento_externo_id`.

---

### `billing.direito_override`

Exceção deliberada sobre um direito de uma conta.

Pode atender futuramente:

- cortesia;
- promoção;
- beta;
- compensação;
- acesso manual por período;
- liberação administrativa.

O override tem precedência sobre o valor vindo do plano.

Assim não é necessário criar planos artificiais para cada exceção.

---

## Resolução central

### `billing.plano_efetivo(...)`

Resolve qual plano vale para a conta naquele momento.

Atualmente:

1. procura assinatura válida;
2. considera `EM_TESTE`, `ATIVA` e `GRACE_PERIOD`;
3. respeita período e encerramento;
4. escolhe maior prioridade;
5. se não existir assinatura válida, usa o plano padrão `FREE`.

---

### `billing.direitos_efetivos(...)`

Resolve o conjunto final de direitos:

1. encontra o plano efetivo;
2. carrega direitos do plano;
3. aplica overrides válidos;
4. retorna um único mapa de direitos.

A futura aplicação consumirá esse resultado por uma interface controlada.
Ela não acessará as tabelas `billing` diretamente.

---

## Precedência

A precedência inicial é:

```
override individual
        ↓
direito do plano efetivo
        ↓
ausência de direito
```

O plano efetivo é resolvido por prioridade e vigência.

---

## Integração futura com provedores

Fluxo pretendido:

```
Google Play / provedor web
        ↓
validação server-side
        ↓
evento idempotente
        ↓
assinatura interna
        ↓
plano efetivo
        ↓
direitos efetivos
        ↓
API controlada de entitlements
        ↓
aplicação
```

A compra informada pelo cliente nunca será suficiente para liberar Premium.
O servidor precisa validar com o provedor.

---

## Estratégia para evitar IFs espalhados

Quando chegar a fase de integração, deverá existir um único módulo de aplicação, por exemplo:

```
src/lib/entitlements/
```

Responsabilidades esperadas:

- carregar snapshot de direitos;
- tipar chaves conhecidas;
- oferecer helpers consistentes;
- tratar cache/refresh;
- produzir razão de bloqueio;
- nunca conhecer detalhes do Google Play.

Componentes e páginas não consultarão assinatura diretamente.

---

## Fases

### Fase 1 — Fundação isolada

Status: iniciada.

- schema privado `billing`;
- planos;
- recursos;
- direitos por plano;
- ofertas;
- assinaturas;
- vínculo com provedores;
- eventos;
- overrides;
- resolvedor central;
- validação de tipos;
- segurança;
- índices.

**Sem impacto no app.**

### Fase 2 — Catálogo de direitos

Definir exatamente:

- o que permanece gratuito;
- o que será Premium;
- limites;
- comportamento ao ultrapassar limite após downgrade;
- direitos que nunca devem ser bloqueados.

Ainda sem bloquear o app.

### Fase 3 — API de entitlements

Criar interface server-side controlada e contrato TypeScript.

O app poderá ler direitos, mas continuará com todos os recursos liberados enquanto validamos.

### Fase 4 — Administração e testes

Ferramentas internas para:

- visualizar plano;
- simular assinatura;
- conceder override;
- expirar acesso;
- auditar resolução.

### Fase 5 — Google Play Billing

Integrar:

- produtos;
- compra;
- restauração;
- validação server-side;
- renovação;
- cancelamento;
- grace period;
- falha de pagamento.

### Fase 6 — Aplicação gradual das travas

Aplicar recurso por recurso.

Nunca alterar vários módulos de negócio de uma vez.

---

## Regras arquiteturais

1. `t_usuario_pai` não recebe coluna `assinante`.
2. Feature flags e assinatura continuam domínios separados.
3. UI nunca é a única camada de bloqueio.
4. Compra nunca é validada somente pelo cliente.
5. Status do provedor não vaza para componentes.
6. Histórico de eventos é preservado.
7. Direitos são definidos por dados, não por condicionais espalhadas.
8. Downgrade não deve apagar dados do usuário.
9. Regra de bloqueio e regra de visualização são conceitos diferentes.
10. Toda integração futura começa em DEV e só vai para PRD depois de validada.
