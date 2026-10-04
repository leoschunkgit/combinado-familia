# Publicação nativa — checklist de segurança

Este documento reúne o que já está preparado no código e o que só pode ser concluído
depois que os projetos nativos Android/iOS forem gerados.

## Já preparado

- Bundle/App ID base: `app.combinadofamilia`
- Domínio público canônico: `https://www.combinadofamilia.app`
- Deep links validados apenas para:
  - `combinadofamilia.app`
  - `www.combinadofamilia.app`
- Rota pública de acompanhamento: `/acompanhar/:token`
- Autenticação por email usando o domínio público oficial
- Compartilhamento, clipboard, navegador e PDF com adaptação nativa
- Atualização de dados quando o app volta do segundo plano
- Safe areas, teclado, status bar e botão Voltar do Android
- Logs de debug do Capacitor desativados em produção

## Android — pendências após gerar `android/`

1. Gerar a keystore de produção e guardá-la fora do repositório.
2. Obter o SHA-256 do certificado de assinatura.
3. Configurar Android App Links para:
   - `https://www.combinadofamilia.app/acompanhar/*`
   - `https://www.combinadofamilia.app/redefinir-senha*`
4. Criar `public/.well-known/assetlinks.json` usando o template deste diretório.
5. Confirmar que o arquivo é servido por HTTPS sem redirecionamento.
6. Revisar o AndroidManifest gerado e remover permissões não necessárias.
7. Gerar AAB assinado e testar em aparelho real antes de publicar.

## iOS — pendências após gerar `ios/`

1. Definir a conta Apple Developer e descobrir o Team ID.
2. Adicionar Associated Domains no Xcode:
   - `applinks:www.combinadofamilia.app`
3. Criar `public/.well-known/apple-app-site-association` usando o template deste diretório.
4. Confirmar que o arquivo é servido por HTTPS, sem extensão e sem redirecionamento.
5. Preencher o Privacy Manifest exigido pelos plugins usados.
6. Revisar capacidades/permissões no Xcode e manter somente as necessárias.
7. Testar Universal Links em aparelho real/TestFlight.

## Princípio de permissões

O Combinado Família não deve solicitar localização, câmera, microfone, contatos ou
fotos apenas por estar instalado. Qualquer permissão futura deve ser adicionada
somente quando existir uma funcionalidade que realmente precise dela.
