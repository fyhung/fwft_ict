# Local AI Chat

A small browser-only chat client for personal use with Google Gemini or the OpenAI Responses API.

## Run it

From the repository root:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000/api_test/>.

Choose Google Gemini or OpenAI, paste the matching API key, choose or type a model, and start chatting. The key is kept in `sessionStorage` for the current browser tab. Chat history, the selected provider/model, and assistant instructions are stored locally in the browser.

The built-in picker includes common current and legacy text-chat models. Select **Refresh** after entering a key to replace that list with text-capable models currently returned for your account.

## Important

This page sends requests directly from your browser. Keep it local and do not deploy it publicly. For any shared or public app, put the API call behind a server so the key is never exposed to the browser.
