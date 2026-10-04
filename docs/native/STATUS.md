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
