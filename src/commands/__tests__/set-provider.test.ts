import { beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { runSetProviderCommand } from "../set-provider.js";
import { readUserConfig } from "../../shared/user-config.js";
import { getCredentialsFilePath } from "../../providers/index.js";

const GEMINI_DEFAULT_MODEL = "gemini-3-pro-preview";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-5";

let contextHomeDir: string;

beforeEach(async () => {
  contextHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), "contextcode-home-"));
  process.env.CONTEXTCODE_HOME = contextHomeDir;
});

afterEach(async () => {
  await fs.rm(contextHomeDir, { recursive: true, force: true }).catch(() => {});
  delete process.env.CONTEXTCODE_HOME;
});

async function writeCredentials(entries: Array<Record<string, unknown>>) {
  const credentialsPath = getCredentialsFilePath();
  await fs.mkdir(path.dirname(credentialsPath), { recursive: true });
  await fs.writeFile(credentialsPath, JSON.stringify({ credentials: entries }, null, 2), "utf8");
}

test("sets provider and default model from stored credentials", async () => {
  await writeCredentials([
    { provider: "gemini", key: "AI123", date: new Date().toISOString() },
    { provider: "anthropic", oauth: { access_token: "t", refresh_token: "r", expires_at: Date.now() } }
  ]);

  await runSetProviderCommand([], {
    interactive: true,
    selectProvider: async () => "gemini"
  });

  const config = await readUserConfig();
  assert.equal(config.defaultProvider, "gemini");
  assert.equal(config.defaultModel, GEMINI_DEFAULT_MODEL);
});

test("throws when no credentials are available", async () => {
  await assert.rejects(
    runSetProviderCommand([], {
      interactive: true,
      selectProvider: async () => "gemini"
    }),
    /No providers found/
  );
});

test("throws when selection is not part of the credential list", async () => {
  await writeCredentials([{ provider: "gemini", key: "AI123", date: new Date().toISOString() }]);

  await assert.rejects(
    runSetProviderCommand([], {
      interactive: true,
      selectProvider: async () => "unknown-provider"
    }),
    /Unknown provider selection/
  );
});

test("surface errors when persisting selection fails", async () => {
  await writeCredentials([{ provider: "gemini", key: "AI123", date: new Date().toISOString() }]);
  const failure = new Error("write failed");

  await assert.rejects(
    runSetProviderCommand([], {
      interactive: true,
      selectProvider: async () => "gemini",
      persistSelection: async () => {
        throw failure;
      }
    }),
    /write failed/
  );
});

test("replaces default model when switching providers", async () => {
  await writeCredentials([
    { provider: "gemini", key: "AI123", date: new Date().toISOString() },
    { provider: "anthropic", oauth: { access_token: "t", refresh_token: "r", expires_at: Date.now() } }
  ]);

  await runSetProviderCommand([], {
    interactive: true,
    selectProvider: async () => "gemini"
  });

  await runSetProviderCommand([], {
    interactive: true,
    selectProvider: async () => "anthropic"
  });

  const config = await readUserConfig();
  assert.equal(config.defaultProvider, "anthropic");
  assert.equal(config.defaultModel, ANTHROPIC_DEFAULT_MODEL);
});
