import { z } from "zod";

export const ENTITLEMENTS_CONTRACT_VERSION = 1 as const;
export const LIMITE_ILIMITADO = -1 as const;

export const DIREITOS_BOOLEANOS = [
  "VIGENCIAS.HABILITADA",
  "VIGENCIAS.CLONAR",
  "APP_FILHO.TERMINEI",
  "MESADA.HABILITADA",
  "HISTORICO.PDF",
  "TAREFAS.SUGESTOES",
] as const;

export const DIREITOS_LIMITES = [
  "FILHOS.LIMITE",
  "RECOMPENSAS.LIMITE",
  "TAREFAS.LIMITE",
  "APP_FILHO.ACESSOS.LIMITE",
] as const;

export type DireitoBooleano = (typeof DIREITOS_BOOLEANOS)[number];
export type DireitoLimite = (typeof DIREITOS_LIMITES)[number];
export type ChaveDireito = DireitoBooleano | DireitoLimite;

const limiteSchema = z
  .number()
  .int()
  .refine((valor) => valor === LIMITE_ILIMITADO || valor >= 0, {
    message: "Limite deve ser -1 (ilimitado) ou um inteiro maior ou igual a zero",
  });

const direitosSchema = z
  .object({
    "FILHOS.LIMITE": limiteSchema,
    "RECOMPENSAS.LIMITE": limiteSchema,
    "TAREFAS.LIMITE": limiteSchema,
    "VIGENCIAS.HABILITADA": z.boolean(),
    "VIGENCIAS.CLONAR": z.boolean(),
    "APP_FILHO.TERMINEI": z.boolean(),
    "MESADA.HABILITADA": z.boolean(),
    "HISTORICO.PDF": z.boolean(),
    "APP_FILHO.ACESSOS.LIMITE": limiteSchema,
    "TAREFAS.SUGESTOES": z.boolean(),
  })
  // Novos direitos podem ser adicionados no backend sem quebrar clientes
  // que ainda estejam no mesmo contrato v1.
  .passthrough();

export const entitlementsSnapshotSchema = z
  .object({
    versao_contrato: z.literal(ENTITLEMENTS_CONTRACT_VERSION),
    direitos: direitosSchema,
  })
  .passthrough();

export type EntitlementsSnapshot = z.infer<typeof entitlementsSnapshotSchema>;

export function validarEntitlementsSnapshot(valor: unknown): EntitlementsSnapshot {
  return entitlementsSnapshotSchema.parse(valor);
}
