import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { toast } from "sonner";
import { registrarPushFilho } from "@/lib/child-push-notifications";
import { garantirCanalPushAndroid } from "@/lib/push-channel";

export function AppFilhoPushNotifications({
  onAbrir,
}: {
  onAbrir: () => void;
}) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelado = false;
    const removerListeners: Array<() => Promise<void>> = [];

    async function configurar() {
      try {
        const registration = await PushNotifications.addListener("registration", async ({ value }) => {
          if (cancelado) return;
          try {
            await registrarPushFilho(value);
          } catch (error) {
            console.error("Não foi possível registrar o aparelho do filho para notificações push:", error);
          }
        });
        removerListeners.push(() => registration.remove());

        const registrationError = await PushNotifications.addListener("registrationError", (error) => {
          console.error("Falha ao registrar notificações push do filho:", error);
        });
        removerListeners.push(() => registrationError.remove());

        const received = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          const mensagem = notification.body?.trim();
          if (mensagem) toast.info(mensagem);
        });
        removerListeners.push(() => received.remove());

        const action = await PushNotifications.addListener("pushNotificationActionPerformed", () => {
          onAbrir();
        });
        removerListeners.push(() => action.remove());

        let permissao = await PushNotifications.checkPermissions();
        if (permissao.receive === "prompt" || permissao.receive === "prompt-with-rationale") {
          permissao = await PushNotifications.requestPermissions();
        }
        if (permissao.receive !== "granted" || cancelado) return;

        await PushNotifications.register();
      } catch (error) {
        console.error("Não foi possível inicializar notificações push do filho:", error);
      }
    }

    void configurar();

    return () => {
      cancelado = true;
      for (const remover of removerListeners) void remover();
    };
  }, [onAbrir]);

  return null;
}
