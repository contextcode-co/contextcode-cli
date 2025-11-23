import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { registerProviderFactory } from "./provider.js";
import { registerAuthMethods } from "./authMethods.js";
import { CREDENTIALS_FILE, loadCredential, saveOAuthCredential } from "./credentials.js";
import type { AiProvider, Message, ProviderFactoryOptions } from "./provider.js";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const PROVIDER_ID = "anthropic";
const TOKEN_ENDPOINT = "https://console.anthropic.com/v1/oauth/token";

registerProviderFactory(
  PROVIDER_ID,
  async (options) => {
    const oauth = await resolveAnthropicCredential(options);
    return createAnthropicProvider(oauth);
  },
  {
    title: "Anthropic Claude",
    description: "Use Claude models via Anthropic's OAuth flow",
    supportsInteractiveLogin: true,
    login: async () => {
      await runInteractiveConsoleAuthorization();
    }
  }
);

registerAuthMethods(PROVIDER_ID, async () => {
  return {
    methods: [
      {
        label: "Claude Pro/Max",
        authorize: async () => {
          const { url, verifier } = await authorize("max");
          return {
            url,
            instructions: "Paste the authorization code here:",
            callback: async (code: string) => {
              const credentials = await exchange(code, verifier);
              if (credentials.type !== "success" || !credentials.access) {
                throw new Error("Anthropic OAuth authorization failed. Try again.");
              }
              await saveOAuthCredential(
                PROVIDER_ID,
                credentials.access,
                credentials.refresh,
                credentials.expires
              );
            }
          };
        }
      }
    ]
  };
});

async function resolveAnthropicCredential(options: ProviderFactoryOptions = {}) {
  const stored = await loadCredential(PROVIDER_ID);
  if (stored?.oauth) {
    return stored.oauth;
  }

  if (options.interactive === false || !process.stdin.isTTY) {
    throw new Error("[ERR_ANTHROPIC_AUTH] No Anthropic OAuth token found. Run 'contextcode auth login'.");
  }

  return await runInteractiveConsoleAuthorization();
}

async function runInteractiveConsoleAuthorization() {
  console.log("Starting OAuth flow for Claude Pro/MAX...");
  const { url, verifier } = await authorize("max");
  console.log("1. Open the following URL in a browser and complete the login:");
  console.log(`   ${url}`);
  console.log("2. Copy the final redirect URL fragment (code#state) and paste it below when prompted.\n");
  const code = await promptForInput("Paste authorization code (code#state): ");
  const credentials = await exchange(code, verifier);
  if (credentials.type !== "success" || !credentials.access) {
    throw new Error("Anthropic OAuth authorization failed. Try again.");
  }
  console.log("Successfully authenticated with Claude Pro/MAX!");
  await saveOAuthCredential(
    PROVIDER_ID,
    credentials.access,
    credentials.refresh,
    credentials.expires
  );
  console.log(`Saved OAuth tokens to ${CREDENTIALS_FILE}`);
  return {
    access_token: credentials.access,
    refresh_token: credentials.refresh,
    expires_at: credentials.expires
  };
}

function createAnthropicProvider(oauth: { access_token: string; refresh_token: string; expires_at: number }): AiProvider {
  let currentToken = oauth.access_token;
  let expiresAt = oauth.expires_at;

  async function ensureValidToken() {
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return currentToken;
    }
    console.log("[anthropic] Refreshing expired OAuth token...");
    const refreshed = await refreshToken(oauth.refresh_token);
    if (refreshed.type !== "success") {
      throw new Error("Failed to refresh Anthropic OAuth token. Run 'contextcode auth login' again.");
    }
    currentToken = refreshed.access;
    expiresAt = refreshed.expires;
    await saveOAuthCredential(PROVIDER_ID, currentToken, refreshed.refresh, expiresAt);
    return currentToken;
  }

  return {
    name: "anthropic",
    async request({ model, messages, max_tokens, temperature }) {
      const token = await ensureValidToken();
      const body = buildAnthropicBody(model, messages, {
        max_tokens: max_tokens ?? 1024,
        temperature: temperature ?? 0.2
      });
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14"
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Anthropic request failed (${response.status}): ${text}`);
      }
      const json = await response.json();
      const text = Array.isArray(json.content)
        ? json.content.map((entry: any) => entry?.text ?? "").join("\n").trim()
        : String(json.content ?? "");
      return { text };
    }
  };
}

function buildAnthropicBody(model: string, messages: Message[], opts: { max_tokens: number; temperature: number }) {
  const userSystem = messages
    .filter((msg) => msg.role === "system")
    .map((msg) => msg.content)
    .join("\n\n")
    .trim();

  const systemArray = [
    {
      type: "text" as const,
      text: "You are Claude Code, Anthropic's official CLI for Claude."
    }
  ];

  if (userSystem) {
    systemArray.push({
      type: "text" as const,
      text: userSystem
    });
  }

  const conversation = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: [{ type: "text", text: msg.content }]
    }));

  if (conversation.length === 0) {
    conversation.push({ role: "user", content: [{ type: "text", text: "" }] });
  }

  return {
    model,
    system: systemArray,
    messages: conversation,
    max_tokens: opts.max_tokens,
    temperature: opts.temperature
  };
}

async function authorize(mode: "max" | "console") {
  const pkce = generatePkcePair();
  const base = mode === "console" ? "https://console.anthropic.com" : "https://claude.ai";
  const url = new URL("/oauth/authorize", base);
  url.searchParams.set("code", "true");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "org:create_api_key user:profile user:inference");
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", pkce.verifier);
  return { url: url.toString(), verifier: pkce.verifier };
}

async function exchange(code: string, verifier: string) {
  const [authCode, state] = code.split("#");
  const result = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: authCode,
      state,
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    })
  });
  if (!result.ok) {
    return { type: "failed" as const };
  }
  const json = await result.json();
  return {
    type: "success" as const,
    refresh: json.refresh_token,
    access: json.access_token,
    expires: Date.now() + json.expires_in * 1000
  };
}

async function refreshToken(refreshToken: string) {
  const result = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken
    })
  });
  if (!result.ok) {
    return { type: "failed" as const };
  }
  const json = await result.json();
  return {
    type: "success" as const,
    refresh: json.refresh_token,
    access: json.access_token,
    expires: Date.now() + json.expires_in * 100000
  };
}

async function promptForInput(question: string) {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

function generatePkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function base64Url(data: Buffer | Uint8Array | string) {
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
