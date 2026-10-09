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
          const mensagem = notification.body?.trim();
          if (mensagem) toast.info(mensagem);
        });
        removerListeners.push(() => received.remove());

        const action = await PushNotifications.addListener("pushNotificationActionPerformed", () => {
          void queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
          navigate({ to: "/ocorrencias" });
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
