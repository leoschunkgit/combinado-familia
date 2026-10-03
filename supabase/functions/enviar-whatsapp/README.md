# enviar-whatsapp

Edge Function isolada para envio de mensagens pelo WhatsApp Business Cloud API.

## Importante

Esta função ainda não está conectada a nenhuma tela ou fluxo do Combinado Família.

Ela não altera:
- banco de dados;
- cadastro de ocorrências;
- regras de vigência;
- regras de mesada;
- fluxo de "Não fez".

## Secrets necessários

- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION` (opcional, padrão: `v23.0`)

## Payload de teste

```json
{
  "telefone": "21999999999",
  "mensagem": "Teste do Combinado Família"
}
```

A função normaliza automaticamente números brasileiros sem o prefixo 55.
