import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export const ANDROID_PUSH_CHANNEL_ID = "combinado_alertas";

/**
 * Canal único para todos os pushes do Combinado Família no Android.
 *
 * Usar um canal próprio evita depender do canal fallback do Firebase, que pode
 * ficar silencioso ou desativado no aparelho mesmo quando o FCM aceita a mensagem.
 */
export async function garantirCanalPushAndroid() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

  await PushNotifications.createChannel({
    id: ANDROID_PUSH_CHANNEL_ID,
    name: "Alertas do Combinado Família",
    description: "Lembretes de tarefas, respostas e recompensas.",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: "#0C5C3C",
  });
}
