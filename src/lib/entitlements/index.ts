import {
  LIMITE_ILIMITADO,
  type DireitoBooleano,
  type DireitoLimite,
  type EntitlementsSnapshot,
} from "./contract";
import { carregarEntitlementsDaConta } from "./service";

export {
  DIREITOS_BOOLEANOS,
  DIREITOS_LIMITES,
  ENTITLEMENTS_CONTRACT_VERSION,
  LIMITE_ILIMITADO,
  entitlementsSnapshotSchema,
  validarEntitlementsSnapshot,
} from "./contract";

export type {
  ChaveDireito,
  DireitoBooleano,
  DireitoLimite,
  EntitlementsSnapshot,
} from "./contract";

export {
  EntitlementsContractError,
  carregarEntitlementsDaConta,
} from "./service";

export type Entitlements = Readonly<{
  snapshot: EntitlementsSnapshot;
  pode: (chave: DireitoBooleano) => boolean;
  limite: (chave: DireitoLimite) => number;
  ilimitado: (chave: DireitoLimite) => boolean;
  permiteQuantidade: (
    chave: DireitoLimite,
    quantidadeAtual: number,
    incremento?: number,
  ) => boolean;
}>;

export function criarEntitlements(snapshot: EntitlementsSnapshot): Entitlements {
  const direitos = Object.freeze({ ...snapshot.direitos });

  const limite = (chave: DireitoLimite): number => direitos[chave];

  const entitlements: Entitlements = {
    snapshot: Object.freeze({
      ...snapshot,
      direitos,
    }),
    pode: (chave) => direitos[chave],
    limite,
    ilimitado: (chave) => limite(chave) === LIMITE_ILIMITADO,
    permiteQuantidade: (chave, quantidadeAtual, incremento = 1) => {
      if (!Number.isInteger(quantidadeAtual) || quantidadeAtual < 0) {
        throw new RangeError("quantidadeAtual deve ser um inteiro maior ou igual a zero.");
      }

      if (!Number.isInteger(incremento) || incremento < 0) {
        throw new RangeError("incremento deve ser um inteiro maior ou igual a zero.");
      }

      const valorLimite = limite(chave);

      return (
        valorLimite === LIMITE_ILIMITADO ||
        quantidadeAtual + incremento <= valorLimite
      );
    },
  };

  return Object.freeze(entitlements);
}

export async function obterEntitlements(): Promise<Entitlements> {
  const snapshot = await carregarEntitlementsDaConta();
  return criarEntitlements(snapshot);
}
