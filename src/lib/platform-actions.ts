import { Browser } from "@capacitor/browser";
import { Clipboard } from "@capacitor/clipboard";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export async function copyText(value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Clipboard.write({ string: value });
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("Clipboard unavailable");
}

export async function shareLink(options: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Share.canShare();
    if (!value) return false;
    await Share.share(options);
    return true;
  }

  if (navigator.share) {
    await navigator.share(options);
    return true;
  }

  return false;
}

export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
