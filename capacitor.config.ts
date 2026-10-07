import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.combinadofamilia",
  appName: "Combinado Família",
  webDir: ".output/public",
  loggingBehavior: "none",
  plugins: {
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
      autoBackdropColor: "auto",
    },
    StatusBar: {
      style: "DARK",
    },
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
    },
  },
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
