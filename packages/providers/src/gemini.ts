import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { GeminiConfig } from "@contextcode/types";
import { GeminiConfigSchema, type GeminiRequest, type GeminiResponse } from "@contextcode/types";

import { registerAuthMethods } from "./authMethods.js";
import { loadCredential, saveCredential, getCredentialsFilePath } from "./credentials.js";
import type { AiProvider, Message, ProviderFactoryOptions, TokenUsage } from "./provider.js";
import { registerProviderFactory } from "./provider.js";

const PROVIDER_ID = "gemini";
const API_KEY_PORTAL = "https://aistudio.google.com/app/apikey";
const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-3-pro-preview";

registerProviderFactory(
	PROVIDER_ID,
	async (options = {}) => {
		const config = await resolveGeminiConfig(options);
		return createGeminiProvider(config);
	},
	{
		title: "Google Gemini",
		description: "Use Gemini 2.x/3.x models with an API key",
		supportsInteractiveLogin: true,
		login: async (options) => {
			await ensureGeminiApiKey(options);
		}
	}
);

registerAuthMethods(PROVIDER_ID, async () => ({
	methods: [
		{
			label: "Gemini API key",
			authorize: async () => {
				return {
					url: API_KEY_PORTAL,
					instructions: "Paste your Gemini API key (starts with 'AI') below:",
					callback: async (inputKey: string) => {
						const apiKey = normalizeGeminiApiKey(inputKey);
						await saveCredential(PROVIDER_ID, apiKey);
						console.log(`Saved Gemini API key to ${getCredentialsFilePath()}`);
					}
				};
			}
		}
	]
}));

export function createGeminiProvider(config: GeminiConfig): AiProvider {
	const endpoint = (config.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "");
	const baseTemperature = config.temperature ?? 0.3;
	const baseMaxTokens = config.maxOutputTokens ?? 2048;

	return {
		name: PROVIDER_ID,
		async request({ model, messages, max_tokens, temperature }) {
			const resolvedModel = model?.trim() || config.model || DEFAULT_MODEL;
			const body = buildGeminiRequest(messages, {
				temperature: temperature ?? baseTemperature,
				maxOutputTokens: max_tokens ?? baseMaxTokens
			});

			const response = await fetch(`${endpoint}/models/${resolvedModel}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});

			const rawText = await response.text();
			if (!response.ok) {
				throw new Error(`Gemini request failed (${response.status}): ${rawText}`);
			}

			const json: GeminiResponse = rawText ? JSON.parse(rawText) : { candidates: [] };
			if (json.error) {
				throw new Error(`Gemini error (${json.error.status ?? json.error.code ?? "unknown"}): ${json.error.message ?? "No message"}`);
			}

			const text = extractGeminiText(json);
			if (!text) {
				throw new Error("Gemini response did not include text content.");
			}

			return { text, usage: mapGeminiUsage(json) };
		}
	};
}

async function resolveGeminiConfig(options: ProviderFactoryOptions = {}): Promise<GeminiConfig> {
	const userConfig = (options?.config ?? {}) as Record<string, unknown>;
	const stored = await loadCredential(PROVIDER_ID);

	const apiKey =
		typeof userConfig?.geminiApiKey === "string" && userConfig.geminiApiKey.trim().length
			? userConfig.geminiApiKey.trim()
			: process.env.GEMINI_API_KEY?.trim() || stored?.key;

	if (!apiKey) {
		throw new Error("[ERR_GEMINI_AUTH] Gemini API key not found. Run `contextcode auth login` or set GEMINI_API_KEY.");
	}

	const model =
		typeof userConfig?.geminiModel === "string" && userConfig.geminiModel.trim().length
			? userConfig.geminiModel.trim()
			: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

	const endpoint =
		typeof userConfig?.geminiEndpoint === "string" && userConfig.geminiEndpoint.trim().length
			? userConfig.geminiEndpoint.trim()
			: process.env.GEMINI_API_BASE?.trim() || DEFAULT_ENDPOINT;

	const maxOutputTokens = typeof userConfig?.geminiMaxOutputTokens === "number" ? userConfig.geminiMaxOutputTokens : undefined;
	const temperature = typeof userConfig?.geminiTemperature === "number" ? userConfig.geminiTemperature : undefined;

	return GeminiConfigSchema.parse({ apiKey, model, endpoint, maxOutputTokens, temperature });
}

async function ensureGeminiApiKey(options?: ProviderFactoryOptions) {
	const current = await loadCredential(PROVIDER_ID);
	if (current?.key) {
		console.log("Gemini API key already configured.");
		return;
	}

	if (options?.interactive === false || !process.stdin.isTTY) {
		throw new Error("Gemini API key not configured. Run `contextcode auth login` in an interactive terminal or set GEMINI_API_KEY.");
	}

	const rl = readline.createInterface({ input, output });
	try {
		const answer = (await rl.question("Enter your Gemini API key: ")).trim();
		const apiKey = normalizeGeminiApiKey(answer);
		await saveCredential(PROVIDER_ID, apiKey);
		console.log(`Saved Gemini API key to ${getCredentialsFilePath()}`);
	} finally {
		rl.close();
	}
}

export function normalizeGeminiApiKey(value: string) {
	const trimmed = value.trim();
	if (!/^AI[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
		throw new Error("Gemini API keys must start with 'AI' and be at least 20 characters long.");
	}
	return trimmed;
}

function buildGeminiRequest(messages: Message[], overrides: { temperature?: number; maxOutputTokens?: number }): GeminiRequest {
	const systemText = messages
		.filter((msg) => msg.role === "system")
		.map((msg) => msg.content.trim())
		.filter(Boolean)
		.join("\n\n");

	const conversation = messages
		.filter((msg) => msg.role !== "system")
		.map((msg) => ({
			role: (msg.role === "assistant" ? "model" : "user") as "model" | "user",
			parts: [{ text: msg.content }]
		}));

	if (!conversation.length) {
		conversation.push({ role: "user", parts: [{ text: "" }] });
	}

	const request: GeminiRequest = {
		contents: conversation
	};

	if (systemText) {
		request.systemInstruction = {
			role: "user",
			parts: [{ text: systemText }]
		};
	}

	request.generationConfig = {};
	if (typeof overrides.temperature === "number") {
		request.generationConfig.temperature = overrides.temperature;
	}
	if (typeof overrides.maxOutputTokens === "number") {
		request.generationConfig.maxOutputTokens = overrides.maxOutputTokens;
	}
	if (!Object.keys(request.generationConfig).length) {
		delete request.generationConfig;
	}

	return request;
}

function extractGeminiText(response: GeminiResponse): string {
	const candidate = response.candidates?.[0];
	if (!candidate?.content?.parts?.length) {
		return "";
	}
	return candidate.content.parts
		.map((part) => part.text || "")
		.join("\n")
		.trim();
}

function mapGeminiUsage(response: GeminiResponse): TokenUsage | undefined {
	const usage = response.usageMetadata;
	if (!usage) return undefined;
	const inputTokens = usage.promptTokenCount;
	const outputTokens = usage.candidatesTokenCount;
	const fallbackTotal = (inputTokens ?? 0) + (outputTokens ?? 0);
	const totalTokens = usage.totalTokenCount ?? (fallbackTotal || undefined);
	if (inputTokens == null && outputTokens == null && totalTokens == null) {
		return undefined;
	}
	return {
		inputTokens,
		outputTokens,
		totalTokens
	};
}
