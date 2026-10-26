import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.combinadofamilia",
  appName: "Combinado Família",
  webDir: "dist/client",
  loggingBehavior: "none",
  plugins: {
    PushNotifications: {
      presentationOptions: ["sound", "alert"],
    },
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
      style: "LIGHT",
    },
  },
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
