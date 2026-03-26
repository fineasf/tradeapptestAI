<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Trade App Test AI

This app shows market data, technical levels, and an AI report panel.

## Run locally

**Prerequisites:** Node.js 18+.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Supply your Gemini API key. Choose **one** of the options below:

   **Option A – `.env.local` file (recommended):** Copy the template and fill in your key:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   GEMINI_API_KEY="YOUR_REAL_KEY_HERE"
   ```

   **Option B – Windows system/user environment variable:** If `GEMINI_API_KEY` is already set in your Windows environment variables, no `.env` file is needed. Node.js inherits it automatically when you run `npm run dev`.

   - The key is read by `server.ts` only.
   - Do **not** put API keys in frontend files such as `src/App.tsx`.

3. (Optional) Choose Gemini model in `.env.local`:

   ```env
   GEMINI_MODEL="gemini-2.5-flash"
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## LM Studio backup (for region-restricted Gemini access)

If Gemini returns a `User location is not supported` error you can run analysis locally via [LM Studio](https://lmstudio.ai).

### Setup

1. Install and open LM Studio.
2. Download a model (e.g. `qwen3.5-27b-claude-4.6-opus-reasoning-distilled`).
3. Go to **Local Server** tab → click **Start Server** (default port 1234).
4. (Optional) Override defaults in `.env.local`:

   ```env
   LMSTUDIO_URL="http://localhost:1234/api/v1/chat"
   LMSTUDIO_MODEL="qwen3.5-27b-claude-4.6-opus-reasoning-distilled"
   ```

### Automatic fallback

`POST /api/analysis` automatically retries with LM Studio when Gemini fails with a location/region error (`FAILED_PRECONDITION`). No frontend changes are needed.

### Dedicated backup route

Use `POST /api/analyze-lmstudio` to call LM Studio directly, bypassing Gemini entirely:

```bash
curl -X POST http://localhost:3000/api/analyze-lmstudio \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NVDA", "context": "Timeframe D"}'
```

Expected response:

```json
{
  "symbol": "NVDA",
  "signal": "Buy",
  "confidence": 72,
  "summary": "...",
  "keyFactors": ["...", "...", "..."]
}
```

If LM Studio is not running the route returns HTTP 503 with an actionable error message.

## How to activate the AI report

- The AI report is activated automatically when `GEMINI_API_KEY` is present in your server environment — via `.env.local`, `.env`, or a system/user environment variable (e.g. Windows environment variables).
- The frontend sends requests to `POST /api/analysis`.
- If Gemini is unavailable due to region restrictions the server automatically retries via LM Studio (if configured).
- If key/model is missing or both providers fail, the UI shows explicit **"Analysis unavailable"** fallback messaging while technical levels still load.

## API summary

### `POST /api/analysis`

Request body:

```json
{
  "symbol": "NVDA",
  "context": "Timeframe D"
}
```

- `symbol` is required.
- `context` is optional.
- Server validates request fields, calls Gemini (with automatic LM Studio fallback on location errors), validates the AI output schema, and returns sanitized JSON only.

### `POST /api/analyze-lmstudio`

Same request body as `/api/analysis`. Calls the LM Studio local endpoint directly without invoking Gemini. Useful for testing when Gemini is unavailable.
