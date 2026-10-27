import { supabase } from "@/integrations/supabase/client";
import {
  entitlementsSnapshotSchema,
  type EntitlementsSnapshot,
} from "./contract";

export class EntitlementsContractError extends Error {
  readonly code = "ENTITLEMENTS_CONTRACT_INVALID";

  constructor(cause?: unknown) {
    super("A resposta de direitos recebida do servidor é incompatível com o contrato do aplicativo.");
    this.name = "EntitlementsContractError";
    this.cause = cause;
  }
}

export async function carregarEntitlementsDaConta(): Promise<EntitlementsSnapshot> {
  const { data, error } = await supabase.rpc("entitlements_obter");

  if (error) {
    throw error;
  }

  const resultado = entitlementsSnapshotSchema.safeParse(data);

  if (!resultado.success) {
    throw new EntitlementsContractError(resultado.error);
  }

  return resultado.data;
}
