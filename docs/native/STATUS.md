# Estado da preparação do app nativo

## Objetivo

Manter uma única base de código para:
- Web
- Android
- iPhone/iPad

Stack:
- TanStack React Start
- Supabase / Lovable Cloud
- Capacitor 8

## Identidade do app

- Nome: Combinado Família
- App ID / Bundle ID base: app.combinadofamilia
- Domínio oficial: https://www.combinadofamilia.app

## Já preparado no código

### Build
- Build separado para app via `vite.config.app.ts`
- Script `npm run build:app`
- `webDir`: `.output/public`
- Build SPA validado com sucesso no GitHub Actions
- `.output/public/index.html` confirmado no CI

### Plataformas
- Capacitor Core
- Android
- iOS
- Scripts separados de add/sync/open/run

### Deep links
- Domínio público centralizado
- Links do painel do filho usam o domínio oficial
- Listener para App Links/Universal Links
- Proteção de cold start para não sobrescrever deep links
- Rotas planejadas:
  - /acompanhar/:token
  - /redefinir-senha

### Autenticação
- Links de confirmação/recuperação usam o domínio oficial
- Redefinição de senha preservada
- Sessão reaproveitada no app

### Recursos nativos preparados
- Compartilhamento
- Clipboard
- Browser
- Filesystem
- Keyboard
- Status Bar
- App lifecycle

### PDF
- Web: download normal
- App: arquivo temporário + compartilhamento nativo

### Mobile
- Safe areas
- Viewport fit
- Dialogs responsivos
- Menu mobile com scroll
- Inputs com alvo de toque melhor
- Campos focados protegidos do teclado
- Data/hora com limites min/max no picker nativo
- Ocorrências e Relatório ajustados para telas estreitas

### Android
- Identidade Android validada no GitHub Actions (appId, nome e versão base)
- Botão/gesto Voltar preparado
- Atualização dos dados ao voltar do segundo plano
- Plataforma Android gerada com sucesso no GitHub Actions
- Assets nativos gerados no CI
- Capacitor Android sincronizado com sucesso
- APK de debug compilado com sucesso via Gradle no GitHub Actions
- AAB de debug compilado com sucesso via Gradle no GitHub Actions
- AAB de release sem assinatura de produção gerado com sucesso no GitHub Actions
- Pipeline de assinatura de release validado com chave temporária efêmera no GitHub Actions

### Assets
- Manifesto web
- Pipeline do @capacitor/assets
- Documentação para ícone/splash

### Segurança
- Política de permissões mínimas
- AndroidManifest e permissões mínimas validados com sucesso no GitHub Actions
- Sem câmera/localização/microfone/contatos/fotos por padrão
- Templates de App Links e Universal Links
- Checklist de publicação
- Checklist de validação

## Ainda depende de um computador pessoal

### Windows / Android
- Instalar Node/NPM
- Instalar Git
- Clonar o repositório
- Instalar Android Studio / SDK
- Testar APK em aparelho/emulador
- Criar keystore
- Descobrir SHA-256
- Finalizar assetlinks.json
- Assinar AAB
- Publicar/Teste interno Google Play

## Ainda depende de Mac / Apple

- Gerar ios/
- Xcode
- Conta Apple Developer
- Team ID
- Certificados e assinatura
- Associated Domains
- Finalizar apple-app-site-association
- Privacy Manifest
- TestFlight
- App Store

## Pontos que ainda precisam ser validados em execução

Mesmo com o código preparado, ainda precisam ser testados em build real:
- plugins nativos
- comportamento de teclado
- deep links
- PDF
- botão Voltar do Android
- App Links / Universal Links
- ícone e splash

Não considerar a versão nativa pronta para publicação antes desses testes.


## Google Play — preparação já feita

- Pacote de preparação da Google Play documentado
- Rascunho de política de privacidade preparado
- Guia de Data Safety preparado
- Descrição curta/completa e categoria sugeridas
- Checklist de screenshots preparado
- Permanecem pendentes as ações que exigem Play Console, URL pública final, materiais finais e assinatura de produção


- Política de Privacidade pública criada em /politica-de-privacidade e validada no build
- Revisão final da política ainda depende de definir contato oficial e fluxo de exclusão de conta/dados


- Página pública de exclusão de conta criada em /exclusao-de-conta
- Nova rota validada em build, APK, AAB, release, assinatura, Manifest, identidade e sync Android
- Exclusão automática ainda não implementada
- Canal oficial para solicitação de exclusão ainda precisa ser definido


- Fluxo de exclusão de conta passou em toda a bateria de CI: build, Capacitor, Manifest, identidade, APK, AAB, release e assinatura
- Ainda pendente: publicar a Edge Function excluir-conta e testar a exclusão real com uma conta descartável


- Preparado workflow manual de deploy da Edge Function excluir-conta, sem credenciais no repositório
- Próximo bloqueio externo: configurar o secret GitHub SUPABASE_ACCESS_TOKEN e executar o deploy


## Regra de retomada

Antes de iniciar qualquer nova etapa do app Android, consultar obrigatoriamente:

- `docs/native/PONTO_DE_RETOMADA.md`
- `docs/native/VALIDACAO.md`

O arquivo `PONTO_DE_RETOMADA.md` registra pendências que não podem ser esquecidas, mesmo que a conversa anterior não esteja disponível. Nenhuma etapa deve ser considerada concluída se houver pendência obrigatória registrada ali.
