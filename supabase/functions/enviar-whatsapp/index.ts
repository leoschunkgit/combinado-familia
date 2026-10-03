import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Payload = {
  telefone: string;
  mensagem: string;
};

function normalizarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, "");
  if (!numeros) return "";
  if (numeros.startsWith("55")) return numeros;
  return `55${numeros}`;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v23.0";

    if (!token || !phoneNumberId) {
      return new Response(
        JSON.stringify({
          error: "Integração do WhatsApp ainda não configurada",
          missing: {
            WHATSAPP_TOKEN: !token,
            WHATSAPP_PHONE_NUMBER_ID: !phoneNumberId,
          },
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Partial<Payload>;
    const telefone = normalizarTelefone(body.telefone ?? "");
    const mensagem = (body.mensagem ?? "").trim();

    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ error: "Telefone e mensagem são obrigatórios" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefone,
          type: "text",
          text: { body: mensagem },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro WhatsApp:", data);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem pelo WhatsApp", details: data }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Erro interno ao enviar WhatsApp" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
