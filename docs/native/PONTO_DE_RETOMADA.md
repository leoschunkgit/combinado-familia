# Ponto de retomada — Combinado Família Android

Atualizado em 04/10/2026.

Este arquivo é a referência oficial de continuidade do trabalho nativo Android.
Antes de qualquer nova etapa, consultar também:
- `docs/native/VALIDACAO.md`
- `docs/native/STATUS.md`
- `docs/native/LOVABLE_DEPLOY_EXCLUSAO.md` enquanto a exclusão de conta estiver pendente

## Estado atual

### Base nativa já preparada
- Build SPA separado para app.
- Capacitor Android configurado.
- App ID: `app.combinadofamilia`.
- Nome: `Combinado Família`.
- Assets nativos preparados.
- Safe area, teclado, navegação, botão Voltar e lifecycle preparados.
- Compartilhamento, clipboard, browser e filesystem preparados.
- PDF preparado para uso nativo.
- Deep links preparados para:
  - `/acompanhar/:token`
  - `/redefinir-senha`

### CI Android já validado
- npm install
- build:app
- .output/public/index.html
- geração da plataforma Android
- assets
- sync Capacitor Android
- AndroidManifest
- permissões mínimas
- identidade Android
- APK debug
- AAB debug
- AAB release sem assinatura de produção
- pipeline de assinatura com chave temporária de CI
- release Android
- preparação do deploy do Supabase

### Publicação / Google Play já preparada
- documentação de publicação
- descrição curta e completa
- categoria sugerida
- checklist de screenshots
- guia de Data Safety
- rascunho de Política de Privacidade
- rota pública de Política de Privacidade:
  - https://www.combinadofamilia.app/politica-de-privacidade
- rota pública de exclusão:
  - https://www.combinadofamilia.app/exclusao-de-conta

## Exclusão de conta — estado exato

### Já implementado
- botão `Excluir minha conta` em Minha conta
- confirmação digitando `EXCLUIR`
- Edge Function `excluir-conta`
- exclusão em ordem segura de:
  - ocorrências
  - links públicos dos filhos
  - atribuições
  - vigências
  - tarefas
  - filhos
  - responsável
  - usuário do Auth
- Edge Function `excluir-conta` preparada no repositório
- toda a implementação passou na bateria de CI Android

### Exclusão validada

- Edge Function `excluir-conta` publicada no Lovable Cloud. ✅
- Prévia/build do Lovable corrigida e sem erros. ✅
- Autoteste de ponta a ponta executado com sucesso. ✅
- Resultado: `AUTOTESTE_APROVADO`.
- Confirmado:
  - usuário do Auth removido;
  - `t_usuario_pai` zerado;
  - `t_filho` zerado;
  - `t_tarefa` zerado;
  - `t_vigencia` zerado;
  - `t_filho_tarefa` zerado;
  - `t_ocorrencia` zerado;
  - `t_filho_acesso_publico` zerado;
  - link público invalidado.

### Limpeza ainda obrigatória

- A função temporária `testar-exclusao-conta` continua publicada.
- A remoção imediata foi bloqueada porque a versão mais recente do app TanStack ainda não está publicada.
- Assim que a versão mais recente do app TanStack for publicada:
  1. remover/despublicar `testar-exclusao-conta`;
  2. manter publicada apenas `excluir-conta`;
  3. atualizar checklist/status marcando a limpeza como concluída.

## Pendências Android que dependem do computador pessoal

- instalar/usar Node, Git e Android Studio
- clonar o repositório
- testar APK em aparelho real/emulador
- criar keystore de produção
- guardar keystore e senhas fora do GitHub
- fazer backup seguro do keystore
- obter SHA-256 real da chave
- finalizar `assetlinks.json`
- gerar AAB final assinado
- testar App Links reais
- testar teclado, PDF, plugins nativos, botão Voltar, ícone e splash em aparelho real

## Pendências Google Play

- finalizar Política de Privacidade
- definir canal oficial de suporte/contato
- finalizar fluxo de exclusão com teste real
- preencher Data Safety no Play Console
- produzir e enviar screenshots finais
- revisar e enviar textos finais
- subir AAB assinado
- concluir teste interno
- publicar na Google Play

## Pendências iOS futuras

- Mac + Xcode
- Apple Developer
- Bundle ID / Team ID
- certificados e assinatura
- Associated Domains
- Universal Links
- apple-app-site-association
- Privacy Manifest
- TestFlight
- App Store

## Regras para não perder nada

1. Antes de qualquer nova etapa Android, ler este arquivo, `VALIDACAO.md` e `STATUS.md`.
2. Não marcar etapa como concluída sem validação real.
3. Não finalizar `assetlinks.json` sem SHA-256 de produção.
4. Não considerar AAB final enquanto não estiver assinado com o keystore real.
5. Não considerar exclusão de conta concluída sem deploy real + teste com conta descartável.
6. Sempre atualizar checklist/status após cada etapa validada.
7. Preservar comportamento atual do app web e não reintroduzir CPF.


## Validação mais recente

- A prévia do Lovable foi corrigida e compilou sem erros.
- A última bateria após os ajustes no Lovable também passou integralmente no GitHub/Android:
  - build principal;
  - Capacitor Android;
  - Manifest;
  - identidade;
  - APK;
  - AAB;
  - release;
  - assinatura.
