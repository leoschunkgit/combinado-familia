# Google Play — Data Safety

Atualizado em 04/10/2026.

Este documento é o guia operacional para preencher a seção **Segurança dos dados / Data Safety** do Google Play Console para o Combinado Família.

## Resumo recomendado

### O app coleta dados?
**Sim.**

O app envia e armazena dados no backend para oferecer autenticação e as funcionalidades familiares. Para o Google Play, dados transmitidos para fora do dispositivo contam como dados coletados.

### O app compartilha dados com terceiros?
**Não**, considerando a arquitetura atual e desde que o Lovable Cloud e os serviços de infraestrutura utilizados continuem atuando apenas como provedores que processam os dados em nome do Combinado Família.

O painel público do filho é disponibilizado somente quando o responsável gera/compartilha o link. Esse compartilhamento é iniciado pelo próprio usuário.

Não foram encontrados SDKs de anúncios, analytics, crash reporting ou marketing no código atual.

### Os dados são criptografados em trânsito?
**Sim.**

A comunicação do app com o backend e com o domínio público utiliza HTTPS.

### O usuário pode solicitar/executar exclusão dos dados?
**Sim.**

A exclusão pode ser iniciada diretamente em **Minha conta → Excluir minha conta**. O fluxo foi validado de ponta a ponta e remove o usuário do Auth, os dados vinculados e invalida os links públicos existentes.

URL pública:
- https://www.combinadofamilia.app/exclusao-de-conta

Política de Privacidade:
- https://www.combinadofamilia.app/politica-de-privacidade

Contato oficial:
- leoschunk@gmail.com

## Tipos de dados a declarar

### Informações pessoais

#### Nome
**Coletado:** Sim  
**Compartilhado:** Não  
**Finalidade:** Funcionalidade do app / Gerenciamento da conta

Inclui:
- nome do responsável;
- nome dos filhos cadastrados.

#### Endereço de e-mail
**Coletado:** Sim  
**Compartilhado:** Não  
**Finalidade:** Gerenciamento da conta / Funcionalidade do app

Inclui:
- e-mail do responsável;
- e-mail do filho, quando informado opcionalmente.

#### IDs de usuários
**Coletado:** Sim  
**Compartilhado:** Não  
**Finalidade:** Gerenciamento da conta / Funcionalidade do app

Inclui identificadores internos necessários para relacionar a conta e seus registros.

#### Número de telefone
**Coletado:** Sim, opcional  
**Compartilhado:** Não  
**Finalidade:** Funcionalidade do app

O celular do filho é um campo opcional.

#### Outras informações pessoais
**Coletado:** Sim, opcional  
**Compartilhado:** Não  
**Finalidade:** Funcionalidade do app

Inclui a idade do filho, quando cadastrada.

### Informações financeiras

#### Outras informações financeiras
**Coletado:** Sim, opcional  
**Compartilhado:** Não  
**Finalidade:** Funcionalidade do app

O app pode armazenar o valor da mesada informado pelo responsável para calcular descontos e regras familiares.

O app **não coleta dados de cartão, conta bancária, PIX, histórico de compras ou score de crédito**.

### Atividade no app

#### Outro conteúdo gerado pelo usuário
**Coletado:** Sim  
**Compartilhado:** Não  
**Finalidade:** Funcionalidade do app

Inclui conteúdo cadastrado pelo responsável, como:
- tarefas;
- vigências;
- penalidades;
- bonificações;
- registros relacionados ao acompanhamento familiar.

#### Outras ações
**Coletado:** Sim  
**Compartilhado:** Não  
**Finalidade:** Funcionalidade do app

Inclui ações registradas intencionalmente no produto, como:
- “Fez”;
- “Não fez”;
- ocorrências e alterações relacionadas às tarefas.

## Dados que não devem ser marcados como coletados pela implementação atual

Com base no código e nas permissões Android já validadas:

- localização aproximada;
- localização exata;
- câmera/fotos;
- vídeos;
- áudio/microfone;
- contatos do dispositivo;
- agenda;
- SMS/MMS;
- histórico de navegação;
- arquivos/documentos do dispositivo;
- dados de pagamento;
- histórico de compras;
- score de crédito;
- saúde;
- fitness;
- apps instalados;
- ID de publicidade;
- dados para publicidade/marketing.

Também não foram encontrados SDKs específicos de analytics, anúncios, Crashlytics, Sentry, PostHog, Mixpanel ou equivalentes no código atual.

## Obrigatório x opcional

### Obrigatórios
- nome do responsável;
- e-mail do responsável;
- ID da conta/usuário.

### Opcionais ou fornecidos conforme uso das funções
- nome e dados cadastrais de filhos;
- e-mail do filho;
- celular do filho;
- idade do filho;
- mesada;
- tarefas;
- vigências;
- ocorrências;
- Fez/Não fez;
- bonificações;
- penalidades.

A classificação final “obrigatório/opcional” deve acompanhar exatamente as opções exibidas pelo Play Console na versão vigente do formulário.

## Finalidades

Para os dados acima, priorizar:
- **Funcionalidade do app**
- **Gerenciamento da conta**

Não marcar, salvo mudança futura do produto:
- Publicidade ou marketing
- Personalização para anúncios
- Analytics

## Consistência futura

A declaração do Data Safety precisa continuar consistente com:
- a Política de Privacidade;
- o código efetivamente publicado;
- os SDKs incluídos na versão enviada à loja.

Se futuramente forem adicionados analytics, anúncios, crash reporting, pagamentos, notificações com novo provedor ou qualquer outro SDK que trate novos dados, este documento e a declaração do Google Play devem ser revisados antes da publicação da nova versão.
