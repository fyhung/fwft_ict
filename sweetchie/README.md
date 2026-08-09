# Sweetchie website pet

`sweetchie-pet.html` is a self-contained animated website pet. It includes Sweetchie's full WebP spritesheet, CSS, and JavaScript; it does not load any external files or services.

## Embed it

Upload `sweetchie-pet.html` to your website, then add:

```html
<iframe
  src="/sweetchie-pet.html?embed=1&scale=0.72"
  title="Sweetchie animated website pet"
  sandbox="allow-scripts"
  style="position:fixed;right:0;bottom:0;width:min(560px,100vw);height:260px;border:0;background:transparent;pointer-events:none;z-index:9999"
></iframe>
```

Query parameters:

- `embed=1` hides the demo panel and leaves a transparent pet overlay.
- `scale=0.72` controls pet size; values from `0.28` to `1.4` are supported.
- `speed=1` controls animation and walking speed; values from `0.35` to `2.5` are supported.
- `random=0` disables automatic random behavior.

## Optional control from the parent page

```js
const petFrame = document.querySelector('iframe[title="Sweetchie animated website pet"]');

petFrame.contentWindow.postMessage({ type: "sweetchie-pet", action: "wave" }, "*");
petFrame.contentWindow.postMessage({ type: "sweetchie-pet", action: "walk" }, "*");
petFrame.contentWindow.postMessage({ type: "sweetchie-pet", action: "surprise" }, "*");
petFrame.contentWindow.postMessage({ type: "sweetchie-pet", action: "pause" }, "*");
petFrame.contentWindow.postMessage({ type: "sweetchie-pet", action: "resume" }, "*");
```

Available actions are `idle`, `walk`, `wave`, `surprise`, `oops`, `wait`, `think`, and `review`.

The widget respects the visitor's `prefers-reduced-motion` setting by showing Sweetchie at rest instead of auto-animating.
