import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.combinadofamilia",
  appName: "Combinado Família",
  webDir: ".output/public",
  loggingBehavior: "none",
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
