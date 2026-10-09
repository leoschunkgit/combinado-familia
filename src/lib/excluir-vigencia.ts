import { supabase } from "@/integrations/supabase/client";

export async function excluirVigenciaComRegra(idVigencia: number) {
  const { data, error } = await supabase.rpc("excluir_vigencia_com_regra", {
    p_id_vigencia: idVigencia,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("A vigência não foi excluída");
}
