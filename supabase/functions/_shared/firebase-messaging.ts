export const ANDROID_NOTIFICATION_STYLE = {
  icon: "ic_notification",
  color: "#0C5C3C",
} as const;

export type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemPkcs8ToBytes(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function obterFirebaseAccessToken(serviceAccount: FirebaseServiceAccount) {
  const agora = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  }));
  const unsigned = header + "." + payload;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemPkcs8ToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    ),
  );

  const assertion = unsigned + "." + base64Url(signature);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = await response.json();
  if (!response.ok || typeof body.access_token !== "string") {
    console.error("Erro ao obter token OAuth do Firebase:", body);
    throw new Error("Não foi possível autenticar no Firebase");
  }

  return body.access_token as string;
}

export async function enviarFirebaseMensagem(args: {
  serviceAccount: FirebaseServiceAccount;
  accessToken: string;
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}) {
  const response = await fetch(
    "https://fcm.googleapis.com/v1/projects/" +
      encodeURIComponent(args.serviceAccount.project_id) +
      "/messages:send",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + args.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: args.token,
          notification: {
            title: args.title,
            body: args.body,
          },
          data: args.data,
          android: {
            priority: "high",
            notification: ANDROID_NOTIFICATION_STYLE,
          },
        },
      }),
    },
  );

  if (response.ok) return { ok: true, tokenInvalido: false };

  const errorBody = await response.text();
  const tokenInvalido =
    response.status === 404 ||
    errorBody.includes("UNREGISTERED") ||
    errorBody.includes("registration-token-not-registered");

  return {
    ok: false,
    tokenInvalido,
    status: response.status,
    errorBody,
  };
}
