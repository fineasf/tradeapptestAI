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

3. (Optional) Choose model in `.env.local`:

   ```env
   GEMINI_MODEL="gemini-2.5-flash"
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## How to activate the AI report

- The AI report is activated automatically when `GEMINI_API_KEY` is present in your server environment — via `.env.local`, `.env`, or a system/user environment variable (e.g. Windows environment variables).
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
