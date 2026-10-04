# Assinatura Android

A assinatura de produção do Combinado Família será configurada somente quando o keystore real for criado no computador pessoal.

## Arquivos e segredos que nunca devem ir para o GitHub

- `*.jks`
- `*.keystore`
- `key.properties`
- senha do keystore
- alias da chave
- senha da chave

O `.gitignore` do projeto protege esses arquivos.

## Dados que serão necessários depois

Quando o keystore for criado, registrar com segurança:

- caminho local do arquivo `.jks`;
- alias;
- senha do keystore;
- senha da chave;
- SHA-256 do certificado.

## Fluxo de publicação

1. Criar o keystore de produção no computador pessoal.
2. Fazer backup seguro fora do repositório.
3. Obter o SHA-256.
4. Finalizar `assetlinks.json`.
5. Configurar assinatura de release.
6. Gerar AAB de release assinado.
7. Fazer teste interno no Google Play.
8. Publicar somente após validar a versão instalada.

## O que o CI valida sem a chave real

O workflow `Build Android Release` gera um AAB de release sem a assinatura de produção. Isso valida que o código e a configuração Android conseguem chegar ao estágio de release antes da inclusão do keystore real.
