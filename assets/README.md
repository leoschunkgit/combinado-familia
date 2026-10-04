# Assets do aplicativo

Esta pasta será usada pelo `@capacitor/assets` para gerar automaticamente
ícones e splash screens de Android e iOS.

Quando a arte-fonte final estiver pronta, usar preferencialmente:

- `assets/logo.png` ou `assets/icon.png` em alta resolução, ou
- modo completo com `icon-only.png`, `icon-foreground.png`,
  `icon-background.png`, `splash.png` e `splash-dark.png`.

Requisitos recomendados pelo Capacitor:
- ícones: pelo menos 1024 x 1024 px;
- splash: pelo menos 2732 x 2732 px.

Depois, executar:

```bash
npm run app:assets
```

A geração será aplicada às plataformas nativas que já tiverem sido criadas.
