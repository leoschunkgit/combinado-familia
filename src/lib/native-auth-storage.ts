import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

const PREFIXO_CHAVE_NATIVA = "combinado-familia.supabase-auth.";
const SUFIXO_LOGOUT = ".logout";

const aguardar = (ms: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));

function chaveNativa(key: string) {
  return `${PREFIXO_CHAVE_NATIVA}${key}`;
}

function chaveLogout(key: string) {
  return `${key}${SUFIXO_LOGOUT}`;
}

function logoutMarcado(key: string) {
  return lerLocalStorage(chaveLogout(key)) === "1";
}

function marcarLogout(key: string) {
  salvarLocalStorage(chaveLogout(key), "1");
}

function limparMarcaLogout(key: string) {
  removerLocalStorage(chaveLogout(key));
}

function lerLocalStorage(key: string) {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function salvarLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A persistência nativa continua sendo a fonte principal no app.
  }
}

function removerLocalStorage(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sem armazenamento web disponível.
  }
}

async function lerNativo(key: string) {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      const { value } = await NativeBiometric.getData({ key: chaveNativa(key) });
      if (typeof value === "string" && value.length > 0) return value;
    } catch {
      // O Keystore pode levar um instante para responder depois de um cold start.
    }

    if (tentativa < 2) await aguardar(150 * (tentativa + 1));
  }

  return null;
}

/**
 * Storage da sessão Supabase.
 *
 * No app nativo, mantém uma cópia no Keystore e outra no localStorage.
 * O Keystore evita perder a sessão quando o processo/WebView é encerrado;
 * o localStorage mantém compatibilidade e serve de contingência.
 *
 * Sessões de versões anteriores são migradas silenciosamente na primeira leitura.
 */
export function criarStorageAuthPersistente() {
  return {
    async getItem(key: string): Promise<string | null> {
      if (!Capacitor.isNativePlatform()) {
        return lerLocalStorage(key);
      }

      // Um logout explícito sempre vence qualquer credencial nativa antiga.
      if (logoutMarcado(key)) {
        try {
          await NativeBiometric.deleteData({ key: chaveNativa(key) });
        } catch {
          // Mantém a marca de logout e tenta novamente numa próxima inicialização.
        }
        return null;
      }

      const nativo = await lerNativo(key);
      if (nativo) {
        // Repara a cópia web caso o WebView tenha perdido o storage.
        salvarLocalStorage(key, nativo);
        return nativo;
      }

      const legado = lerLocalStorage(key);
      if (!legado) return null;

      // Migra automaticamente a sessão já existente para o armazenamento nativo.
      try {
        await NativeBiometric.setData({
          key: chaveNativa(key),
          value: legado,
        });
      } catch {
        // A sessão legada continua válida; não provoque logout por falha de migração.
      }

      return legado;
    },

    async setItem(key: string, value: string): Promise<void> {
      if (!Capacitor.isNativePlatform()) {
        salvarLocalStorage(key, value);
        return;
      }

      limparMarcaLogout(key);

      // Mantém redundância: a sessão só some quando houver logout explícito
      // ou quando o próprio Supabase a invalidar.
      salvarLocalStorage(key, value);

      try {
        await NativeBiometric.setData({
          key: chaveNativa(key),
          value,
        });
      } catch {
        // O localStorage já recebeu a sessão e continua como contingência.
      }
    },

    async removeItem(key: string): Promise<void> {
      removerLocalStorage(key);

      if (!Capacitor.isNativePlatform()) return;

      // A marca impede que uma credencial nativa antiga seja restaurada caso
      // a exclusão do Keystore falhe temporariamente.
      marcarLogout(key);

      try {
        await NativeBiometric.deleteData({ key: chaveNativa(key) });
      } catch {
        // Mantém a marca de logout para impedir restauração indevida.
      }
    },
  };
}
