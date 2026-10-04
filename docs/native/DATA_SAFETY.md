# Google Play — Data Safety

Este documento é um guia para preencher o formulário Data Safety no Google Play Console.

## Dados usados pelo app

Com base na implementação atual, o app trabalha com dados fornecidos pelo próprio usuário e dados operacionais da conta.

### Dados de conta
- Nome
- Email

Finalidade:
- autenticação;
- identificação do responsável;
- funcionamento da conta.

### Dados familiares cadastrados pelo usuário
- Nome dos filhos
- Tarefas
- Vigências
- Ocorrências
- Registros de “Fez” e “Não fez”
- Bonificações
- Penalidades
- Valores relacionados a mesada, quando utilizados

Finalidade:
- oferecer as funcionalidades principais do produto.

## Dados que o app não solicita por permissão nativa
A validação automática do Android confirmou ausência de permissões para:
- câmera;
- localização;
- microfone;
- contatos;
- fotos;
- vídeos;
- áudio;
- armazenamento externo desnecessário.

## Compartilhamento de dados
O painel público do filho pode ser acessado por link com token e é somente leitura.

O preenchimento final do Data Safety deve refletir:
- quais dados são armazenados no backend;
- se algum provedor terceirizado processa dados;
- se os dados são criptografados em trânsito;
- política de exclusão de conta/dados;
- retenção aplicável.

## Pontos que ainda exigem confirmação antes da publicação
- texto final da política de privacidade;
- mecanismo final de exclusão de conta e dados;
- declaração exata sobre coleta e compartilhamento no Play Console;
- URL pública da política de privacidade.
