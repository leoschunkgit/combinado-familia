import { supabase } from "@/integrations/supabase/client";

export type TipoInteracaoFilho = "SOLICITACAO" | "REVISAO";

export async function notificarRespostaFilho(
  tipoInteracao: TipoInteracaoFilho,
  idInteracao: number,
) {
  let ultimoErro: unknown = null;

  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      const { data, error } = await supabase.functions.invoke(
        "notificar-resposta-filho",
        {
          body: {
            tipo_interacao: tipoInteracao,
            id_interacao: idInteracao,
          },
        },
      );

      if (error) throw error;
      return data as {
        ok?: boolean;
        ja_enviada?: boolean;
        notificacoes_enviadas?: number;
      } | null;
    } catch (error) {
      ultimoErro = error;
    }
  }

  console.error(
    "A resposta foi salva, mas não foi possível notificar o filho:",
    ultimoErro,
  );

  return null;
}
