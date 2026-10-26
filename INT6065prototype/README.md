# 語寵故事工房 · Lingo-Pet Story Studio

A buildless Chinese/English Mandarin-speaking prototype for groupmate testing.

## Run locally

From this folder run:

```powershell
python -m http.server 4186 --bind 127.0.0.1
```

Open http://127.0.0.1:4186 in Chrome or Edge. Do not double-click index.html: browser modules and microphone access need an HTTP/HTTPS origin. No npm install or build is needed. Google Fonts are optional; system fonts work offline.

On this Windows computer you can also run `powershell -ExecutionPolicy Bypass -File .\start-preview.ps1`; the helper uses the bundled Python runtime when available.

## Use

1. Select a story, draw or upload a PNG/JPEG under 5 MB, and optionally explain the scene.
2. Ask AI to interpret it. Correct the meaning, then create sentences and an illustration.
3. Choose a sentence. Listen, record up to 15 seconds, replay, and request suggestions.
4. Practise the suggested words and retry. Review or retell without the full script.
5. Download anonymous JSON notes for the group discussion. Notes exclude credentials and raw media.

The Chinese-first/English-first switch changes UI emphasis; both languages remain visible. Learning text is simplified Chinese with Pinyin. The Chinese interface is Traditional Chinese.

If a microphone is unavailable, you can upload a short WAV/MP3/MP4/WebM/OGG recording for playback and the same feedback flow (0.5–15 seconds, under 5 MB). This is also useful for repeatable group testing. Uploaded audio is not automatically sent; select Get AI suggestions explicitly.

## Gemini configuration

config.js contains the embedded testing credential, explicitly requested by the project owner. The key is visible in published browser files. All users share its project quota. Replace/revoke it after testing. Never copy the key into bug reports or screenshots.

Models are configured separately for text/vision, audio feedback, illustration, and TTS. Defaults use Gemini 3.5 Flash-Lite for text/vision, Gemini 3.1 Flash-Lite for audio feedback, Nano Banana 2.1 for images, and Gemini 2.5 Flash Preview TTS. All were present in the supplied key's model list. Availability, quota, and media generation access can still vary. The gear button allows model changes for the current tab and a non-generating connection/model-list check. Change config.js for permanent settings.

The app calls the generateContent REST API directly. There is no hidden proxy or backend. Gemini receives drawings/recordings for the requested AI features; browser speech synthesis is an explicitly labelled model-audio fallback. Browser voices can depend on operating-system services. The app keeps media only in page memory, but this does not assert that provider-side processing/storage never occurs. Refreshing clears the activity.

## GitHub Pages

- For a dedicated repository, upload the CONTENTS of this folder to its root. Include .nojekyll, index.html and the JavaScript, CSS and assets files.
- In Settings → Pages, select Deploy from a branch, select your branch and root folder, then save.
- Open the published HTTPS URL. Relative asset/module paths support repository-name subpaths.
- If keeping this inside another repository, the folder must be in that repository's Pages publishing source. Then visit `/INT6065/prototype/` under the published site.
- GitHub Pages only publishes static content; GitHub itself does not execute AI requests. Requests run from each tester's browser.

## Demo and failure behaviour

Explore a demo opens a prepared cat story and an obvious demo banner. It never pretends to analyse a new recording. Sample feedback requires its own explicitly labelled button. No AI calls are needed in demo mode; Mandarin browser TTS availability varies.

Live failures remain errors: requests are not silently replaced by samples. Illustration failure leaves original-drawing speaking practice usable. Connection checks do not prove generation quota. Browser soft limits are for avoiding accidental repetition, not secure account spending controls.

## Feedback limitations

Gemini offers experimental audio-based suggestions, not validated pronunciation assessment. The UI uses Sounds clear / Suggested practice / Uncertain, not definitive right/wrong or numeric pronunciation scores. Missing/misaligned results become Uncertain. No precise tone diagnosis is promised. Groupmate testing cannot establish effectiveness for child learners.

## Version 1.0.1 fixes

- Recordings are decoded and converted to mono 16 kHz PCM WAV before analysis; the original clip remains available for playback.
- Temporary HTTP 500/502/503/504 errors trigger one transparent attempt with the configured fallback audio model. There is no retry loop, and quota/authentication/input failures are not retried on another model.
- Failed feedback requests do not consume the three successful practice analyses per sentence.
- Error messages include the HTTP status and model, without raw account details or credentials.
- A zero model quota is reported separately from a temporary usage limit. Google returned a free-tier limit of zero for this project's image model: enable appropriate model quota/billing in AI Studio or configure a project that has access. Code changes and extra keys in the same project cannot create quota.

When replacing an older published version, upload all updated files, including the new media.js, then hard-refresh once (Ctrl+Shift+R). The footer should show v1.0.1.

## Verification

Optional local checks (Node.js, no packages required):

```powershell
npm test
npm run check
```

See QA-NOTES.md for actual verified capabilities and remaining limits. Test with a Chinese-speaking reviewer before interpreting feedback quality.
