# Permissões e privacidade

## Princípio

O app deve pedir somente o mínimo necessário.

### Não usamos atualmente

- Localização
- Câmera
- Microfone
- Contatos
- Biblioteca de fotos
- Bluetooth
- Notificações push

Essas permissões não devem ser adicionadas ao AndroidManifest/Info.plist sem uma
funcionalidade explícita que realmente precise delas.

## Plugins nativos atuais

- @capacitor/app
- @capacitor/browser
- @capacitor/clipboard
- @capacitor/filesystem
- @capacitor/keyboard
- @capacitor/share
- @capacitor/status-bar

## Android

Após gerar a plataforma, revisar o `android/app/src/main/AndroidManifest.xml` e
manter apenas as permissões necessárias. Para o funcionamento online da aplicação,
a permissão de internet é esperada.

Não adicionar permissões de armazenamento apenas para o PDF atual: o relatório é
gravado no cache privado do aplicativo antes de ser compartilhado.

## iOS

Revisar o `Info.plist` e não criar Usage Descriptions para APIs que o app não usa.

O plugin `@capacitor/filesystem` pode exigir declaração no Privacy Manifest da
Apple. Essa configuração deve ser concluída quando a pasta `ios/` existir.

## Deep links

O código só aceita links dos hosts:

- combinadofamilia.app
- www.combinadofamilia.app

Os caminhos que planejamos associar ao app são:

- /acompanhar/*
- /redefinir-senha*

Não ampliar para ações destrutivas via URL.
