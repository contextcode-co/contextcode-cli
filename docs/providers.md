# Provider setup

## Anthropic (Claude)
- Run `contextcode auth login` and pick **Anthropic Claude**.
- Complete the OAuth flow in your browser and paste the code fragment back into the CLI.
- Tokens are stored in `~/.contextcode/credentials.json` and refreshed automatically.

## Google Gemini
- Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key (looks like `AIxxxx`).
- Run `contextcode auth login`, choose **Google Gemini**, and paste the API key when prompted.
- The CLI saves the key in `~/.contextcode/credentials.json` and also writes it into `~/.contextcode/config.json` as `geminiApiKey`.
- Configure defaults either via environment variables (`CONTEXTCODE_PROVIDER`, `CONTEXTCODE_MODEL`, `GEMINI_API_KEY`) or by editing the config file so long-running commands can run non-interactively.

## Example configuration snippet

```json
{
  "defaultProvider": "gemini",
  "defaultModel": "gemini-1.5-pro",
  "geminiApiKey": "AIxyz...",
  "geminiTemperature": 0.3,
  "geminiMaxOutputTokens": 2048
}
```

## Environment variables

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `CONTEXTCODE_PROVIDER`| Preferred provider (`anthropic` or `gemini`).     |
| `CONTEXTCODE_MODEL`   | Default model name passed to the provider.       |
| `GEMINI_API_KEY`      | Inline Gemini API key (fallback if no credential).|
| `GEMINI_MODEL`        | Override default Gemini model globally.          |
| `GEMINI_API_BASE`     | Custom Gemini endpoint (advanced usage).         |

Set these before invoking `contextcode` to override anything stored in the config file.
