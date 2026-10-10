import { Capacitor } from "@capacitor/core";
import {
  AccessControl,
  NativeBiometric,
} from "@capgo/capacitor-native-biometric";

const BIOMETRIC_KEY = "combinado-familia.biometric-login";

let desbloqueadoNestaExecucao = false;

export function biometriaEhNativa() {
  return Capacitor.isNativePlatform();
}

export function liberarBiometriaNestaExecucao() {
  desbloqueadoNestaExecucao = true;
}

export function biometriaLiberadaNestaExecucao() {
  return desbloqueadoNestaExecucao;
}

export async function biometriaDisponivelNesteAparelho() {
  if (!biometriaEhNativa()) return false;
  const resultado = await NativeBiometric.isAvailable({ useFallback: false });
  return resultado.isAvailable;
}

export async function biometriaAtivaNesteAparelho() {
  if (!biometriaEhNativa()) return false;
  const resultado = await NativeBiometric.isDataSaved({ key: BIOMETRIC_KEY });
  return resultado.isSaved;
}

export async function ativarBiometriaNesteAparelho() {
  if (!biometriaEhNativa()) {
    throw new Error("Biometria disponível apenas no aplicativo instalado.");
  }

  const disponivel = await biometriaDisponivelNesteAparelho();
  if (!disponivel) {
    throw new Error("Biometria não está disponível ou cadastrada neste aparelho.");
  }

  await NativeBiometric.setData({
    key: BIOMETRIC_KEY,
    value: "enabled",
    accessControl: AccessControl.BIOMETRY_CURRENT_SET,
    authValidityDuration: 0,
    title: "Ativar biometria",
    negativeButtonText: "Cancelar",
  });

  desbloqueadoNestaExecucao = true;
}

export async function autenticarComBiometria() {
  if (!biometriaEhNativa()) return false;

  const ativa = await biometriaAtivaNesteAparelho();
  if (!ativa) return false;

  const resultado = await NativeBiometric.getSecureData({
    key: BIOMETRIC_KEY,
    reason: "Use sua biometria para entrar no Combinado Família.",
    title: "Entrar no Combinado Família",
    subtitle: "Confirme sua identidade",
    description: "Use a biometria cadastrada neste aparelho.",
    negativeButtonText: "Usar senha",
    fallbackTitle: "",
    maxAttempts: 3,
  });

  const autorizado = resultado.value === "enabled";
  desbloqueadoNestaExecucao = autorizado;
  return autorizado;
}

export async function desativarBiometriaNesteAparelho() {
  desbloqueadoNestaExecucao = false;
  if (!biometriaEhNativa()) return;

  const ativa = await biometriaAtivaNesteAparelho();
  if (ativa) {
    await NativeBiometric.deleteData({ key: BIOMETRIC_KEY });
  }
}

export async function podeAcessarAreaAutenticada() {
  if (!biometriaEhNativa() || desbloqueadoNestaExecucao) return true;
  const ativa = await biometriaAtivaNesteAparelho();
  return !ativa;
}
