import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { registrarPushToken } from "@/lib/push-notifications";

export function AppPushNotifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelado = false;
    const removerListeners: Array<() => Promise<void>> = [];

    async function configurar() {
      try {
        const registration = await PushNotifications.addListener("registration", async ({ value }) => {
          if (cancelado) return;
          try {
            await registrarPushToken(value);
          } catch (error) {
            console.error("Não foi possível registrar o aparelho para notificações push:", error);
          }
        });
        removerListeners.push(() => registration.remove());

        const registrationError = await PushNotifications.addListener("registrationError", (error) => {
          console.error("Falha ao registrar notificações push:", error);
        });
        removerListeners.push(() => registrationError.remove());

        const received = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          void queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
          void queryClient.invalidateQueries({ queryKey: ["solicitacoes_tarefa_filho"] });
          void queryClient.invalidateQueries({ queryKey: ["revisoes_tarefa_filho"] });
          const mensagem = notification.body?.trim();
          if (mensagem) toast.info(mensagem);
        });
        removerListeners.push(() => received.remove());

        const action = await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          void queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
          void queryClient.invalidateQueries({ queryKey: ["solicitacoes_tarefa_filho"] });
          void queryClient.invalidateQueries({ queryKey: ["revisoes_tarefa_filho"] });

          const dados = event.notification.data ?? {};
          if (
            dados["target"] === "solicitacao_tarefa_filho" ||
            dados["target"] === "revisao_tarefa_filho"
          ) {
            const filho = Number(dados["id_filho"]);
            const atribuicao = Number(dados["id_filho_tarefa"]);
            const aviso = Number(dados["id_solicitacao"]);
            const revisao = Number(dados["id_revisao"]);
            const data = typeof dados["data_referencia"] === "string"
              ? dados["data_referencia"]
              : undefined;

            navigate({
              to: "/ocorrencias",
              search: {
                filho: Number.isInteger(filho) && filho > 0 ? filho : undefined,
                atribuicao: Number.isInteger(atribuicao) && atribuicao > 0 ? atribuicao : undefined,
                data,
                aviso: Number.isInteger(aviso) && aviso > 0 ? aviso : undefined,
                revisao: Number.isInteger(revisao) && revisao > 0 ? revisao : undefined,
              },
            });
            return;
          }

          navigate({ to: "/ocorrencias", search: {} });
        });
        removerListeners.push(() => action.remove());

        let permissao = await PushNotifications.checkPermissions();
        if (permissao.receive === "prompt" || permissao.receive === "prompt-with-rationale") {
          permissao = await PushNotifications.requestPermissions();
        }
        if (permissao.receive !== "granted" || cancelado) return;

        await PushNotifications.register();
      } catch (error) {
        console.error("Não foi possível inicializar notificações push:", error);
      }
    }

    void configurar();

    return () => {
      cancelado = true;
      for (const remover of removerListeners) void remover();
    };
  }, [navigate, queryClient]);

  return null;
}
