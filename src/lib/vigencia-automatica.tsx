import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  funcionalidadeAtiva,
  obterAppConfigPublico,
} from "@/lib/app-system-config";

export const CHAVE_VIGENCIA_AUTOMATICA = "vigencia_automatica";
export const MENSAGEM_VIGENCIA_AUTOMATICA_GERENCIAMENTO =
  "Os períodos e os próximos ciclos são gerenciados automaticamente pelo sistema.";

export type EstadoVigenciaAutomatica = {
  ativa: boolean;
  carregando: boolean;
  erro: boolean;
  atualizar: () => Promise<void>;
};

const VigenciaAutomaticaContext = createContext<EstadoVigenciaAutomatica | null>(null);

export async function obterVigenciaAutomaticaAtiva(): Promise<boolean> {
  const config = await obterAppConfigPublico();
  return funcionalidadeAtiva(config, CHAVE_VIGENCIA_AUTOMATICA);
}

export function VigenciaAutomaticaProvider({ children }: { children: ReactNode }) {
  const [ativa, setAtiva] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const atualizar = useCallback(async () => {
    try {
      const novaAtiva = await obterVigenciaAutomaticaAtiva();
      setAtiva(novaAtiva);
      setErro(false);
    } catch {
      // Falha de configuração nunca deve esconder o fluxo manual.
      setAtiva(false);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void atualizar();

    const atualizarPorEvento = () => void atualizar();
    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") void atualizar();
    };

    window.addEventListener("app-config-updated", atualizarPorEvento);
    window.addEventListener("focus", atualizarPorEvento);
    document.addEventListener("visibilitychange", atualizarAoVoltar);

    const channel = supabase
      .channel("vigencia-automatica-config")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "t_app_config_signal",
          filter: "id=eq.1",
        },
        () => {
          void atualizar();
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener("app-config-updated", atualizarPorEvento);
      window.removeEventListener("focus", atualizarPorEvento);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
      void supabase.removeChannel(channel);
    };
  }, [atualizar]);

  const valor = useMemo<EstadoVigenciaAutomatica>(
    () => ({
      ativa,
      carregando,
      erro,
      atualizar,
    }),
    [ativa, carregando, erro, atualizar],
  );

  return (
    <VigenciaAutomaticaContext.Provider value={valor}>
      {children}
    </VigenciaAutomaticaContext.Provider>
  );
}

export function useVigenciaAutomatica(): EstadoVigenciaAutomatica {
  const contexto = useContext(VigenciaAutomaticaContext);

  if (!contexto) {
    throw new Error(
      "useVigenciaAutomatica deve ser usado dentro de VigenciaAutomaticaProvider",
    );
  }

  return contexto;
}
