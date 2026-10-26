# Verification notes

## Version 1.0.1 regression checks

- Reproduced live feedback requests with both synthetic WAV and browser-style WebM audio; both succeeded in the initial diagnosis. The user's exact intermittent service error was not consistently reproduced.
- Google returned HTTP 429 and explicitly reported `generate_content_free_tier_requests, limit: 0` for Nano Banana 2.1. This is a project/model quota issue, not an illustration rendering defect.
- Added browser audio decoding and mono 16 kHz WAV conversion, one fallback model attempt for temporary server errors, specific zero-quota messages, and successful-only practice counting.
- The updated WAV preparation and live audio-feedback request succeeded against Gemini 3.1 Flash-Lite.
- All 18 automated tests passed, including stereo downmix/resampling, actual decode before relabelling, invalid audio, bounded server-error fallback, cancellation, no fallback on quota/auth/input errors, private provider-error handling, and WebM files labelled video/webm by browsers.
- Browser regression passed: an uploaded 2.5-second WebM/Opus clip was decoded in-browser, converted to WAV, and sent through the real feedback button. Suggestions appeared and correctly reported that the clip said 小猫饿了 instead of the displayed sentence. The completed analysis counter advanced to 1/3.
- The browser also displayed the specific zero-quota image error rather than only the generic illustration placeholder.
- These checks use synthetic media, not private student recordings. Physical microphone capture was reported working by the user; automated feedback reliability with real learner voices still needs testing.

Checked on 26 October 2026. This is a small prototype, not validated pronunciation-assessment software.

## Verified

- Supplied key authenticated against the Gemini model-list endpoint; the key is never printed in reports.
- Live image understanding worked with Gemini 3.5 Flash-Lite, using a synthetic stick-figure drawing of a child feeding a cat.
- The browser completed upload → live interpretation → student confirmation → three Chinese/Pinyin/English sentences → speaking screen.
- Live Gemini model-audio playback worked in the browser. TTS audio was also generated and saved as a correctly handled WAV in a developer-only smoke test.
- Audio feedback worked with a synthetic Gemini-generated Mandarin recording. This verifies request/response integration, not accuracy with learner pronunciation.
- Demo mode, explicit sample feedback, Chinese-first/English-first switching, sentence navigation, review, and downloadable JSON notes worked in browser checks.
- Audio-file upload recognised a 2.5-second synthetic WAV and exposed playback controls.
- Responsive layout inspected at 360-pixel mobile and 1280-pixel desktop breakpoints. Mobile home page had no horizontal overflow in the measured DOM.
- Local syntax checks and automated response/audio lifecycle tests passed. The tests cover token alignment, unsafe text escaping, uncertainty handling, WAV headers, microphone cleanup, and late permission resolution.

## Known live-service limits

- Image generation returned HTTP 429 (quota) with the supplied project for Nano Banana 2.1 and a checked alternative image model. Redrawing is implemented, but successful live image output could not be verified. The app preserves the original drawing and allows sentence/speaking practice to continue.
- Some listed models failed real generation calls. Gemini 2.5 Flash returned 404; other combinations timed out or returned service errors. Defaults were adjusted to the models that worked in checks.
- Native responseSchema requests failed or timed out in tested combinations. The current implementation uses JSON-mode generation with a schema description and strict local validation. No malformed response is treated as a valid result.
- Provider availability and quotas can change. There are no automatic billable retry loops.

## Still requiring groupmate testing

- Physical microphone capture, permission prompts, and learner voice quality on the actual devices. Unit tests and uploaded synthetic recordings do not replace this.
- Accuracy of word-level suggestions with real mispronunciations, omissions, silence, different accents, and noisy rooms.
- Chinese/Pinyin quality and vocabulary suitability. AI output can contain inconsistent tone spelling or words outside the target curriculum; review is necessary.
- Touch/pen input on actual tablets, Safari/iOS, and other non-target browsers.
- Published GitHub Pages origin and repository subpath. Paths are relative and prepared for Pages, but the site has not been pushed or published in this task.

Raw smoke-test media/results remain in the ignored qa/ folder and are excluded from the delivery ZIP. The app performs no automatic cloud storage of learning records; this does not make assertions about Google's provider-side data handling.
