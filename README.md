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

2. Create your local server env file from the template:

   ```bash
   cp .env.example .env.local
   ```

3. Put your Gemini API key in `.env.local` (this is the exact position):

   ```env
   GEMINI_API_KEY="YOUR_REAL_KEY_HERE"
   ```

   - The key is read by `server.ts` only.
   - Do **not** put API keys in frontend files such as `src/App.tsx`.

4. (Optional) Choose model in `.env.local`:

   ```env
   GEMINI_MODEL="gemini-2.5-flash"
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## How to activate the AI report

- The AI report is activated automatically when `GEMINI_API_KEY` is present in your server env (`.env.local` or deployment env).
- The frontend sends requests to `POST /api/analysis`.
- If key/model is missing or provider fails, the UI shows explicit **"Analysis unavailable"** fallback messaging while technical levels still load.

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
- Server validates request fields, calls Gemini with server-side env vars, validates the AI output schema, and returns sanitized JSON only.
