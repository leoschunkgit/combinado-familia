import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.combinadofamilia",
  appName: "Combinado Família",
  webDir: ".output/public",
  loggingBehavior: "debug",
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
