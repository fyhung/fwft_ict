const slides = Array.from(document.querySelectorAll(".deck-slide"));
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const progressBar = document.querySelector("#progressBar");
const slideCounter = document.querySelector("#slideCounter");
const fileName = document.querySelector("#fileName");
const sectionName = document.querySelector("#sectionName");
const slideAnnouncement = document.querySelector("#slideAnnouncement");
const helpButton = document.querySelector("#helpButton");
const keyboardHint = document.querySelector("#keyboardHint");
const storyButtons = Array.from(document.querySelectorAll(".story-nav button"));
const workspace = document.querySelector(".editor-workspace");
const petFrame = document.querySelector("#sweetchie");

let currentIndex = 0;
let hintTimer;
let pointerStartX = null;
let petCueTimer;

const petActions = ["wave", "walk", "wave", "review", "think", "walk", "review", "wave", "think", "walk", "review", "think", "wave"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function updateChapterNavigation(section) {
  storyButtons.forEach((button) => {
    const target = slides[Number(button.dataset.go)];
    const isCurrent = target?.dataset.section === section;
    button.classList.toggle("is-current", isCurrent);
    button.setAttribute("aria-current", isCurrent ? "page" : "false");
  });
}

function notifyPet(index) {
  if (!petFrame?.contentWindow) return;
  petFrame.contentWindow.postMessage({ type: "sweetchie-pet", action: petActions[index] }, "*");
}

function schedulePetCue() {
  clearTimeout(petCueTimer);
  const delay = 5200 + Math.random() * 6200;
  petCueTimer = setTimeout(() => {
    if (petFrame?.contentWindow) {
      const action = Math.random() < 0.28 ? "wave" : "walk";
      petFrame.contentWindow.postMessage({ type: "sweetchie-pet", action }, "*");
    }
    schedulePetCue();
  }, delay);
}

function showSlide(index, { announce = true } = {}) {
  const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
  if (nextIndex === currentIndex && slides[nextIndex].classList.contains("is-active")) {
    updateInterface(nextIndex, announce);
    return;
  }

  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === nextIndex;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", active ? "false" : "true");
  });

  currentIndex = nextIndex;
  updateInterface(nextIndex, announce);
  notifyPet(nextIndex);
}

function updateInterface(index, announce) {
  const slide = slides[index];
  const section = slide.dataset.section;
  fileName.textContent = slide.dataset.file;
  sectionName.textContent = section;
  slideCounter.textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
  progressBar.style.width = `${((index + 1) / slides.length) * 100}%`;
  prevButton.disabled = index === 0;
  nextButton.disabled = index === slides.length - 1;
  nextButton.setAttribute("aria-label", index === slides.length - 1 ? "已到最後一張投影片" : "下一張投影片");
  updateChapterNavigation(section);

  if (announce) {
    slideAnnouncement.textContent = `第 ${index + 1} 張，共 ${slides.length} 張：${slide.getAttribute("aria-label").replace(/^第\s*\d+\s*張[：:]?\s*/, "")}`;
  }

  const url = new URL(window.location.href);
  url.hash = `slide-${index + 1}`;
  history.replaceState(null, "", url);
}

function move(delta) {
  showSlide(currentIndex + delta);
}

function showHint() {
  keyboardHint.classList.add("is-visible");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => keyboardHint.classList.remove("is-visible"), 3200);
}

prevButton.addEventListener("click", () => move(-1));
nextButton.addEventListener("click", () => move(1));

storyButtons.forEach((button) => {
  button.addEventListener("click", () => showSlide(Number(button.dataset.go)));
});

helpButton.addEventListener("click", showHint);

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const tagName = document.activeElement?.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;

  if (["ArrowRight", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    move(1);
  } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    move(-1);
  } else if (event.key === "Home") {
    event.preventDefault();
    showSlide(0);
  } else if (event.key === "End") {
    event.preventDefault();
    showSlide(slides.length - 1);
  } else if (event.key === "?") {
    showHint();
  }
});

workspace.addEventListener("pointerdown", (event) => {
  pointerStartX = event.clientX;
});

workspace.addEventListener("pointerup", (event) => {
  if (pointerStartX === null) return;
  const distance = event.clientX - pointerStartX;
  pointerStartX = null;
  if (Math.abs(distance) < 55) return;
  move(distance < 0 ? 1 : -1);
});

workspace.addEventListener("pointercancel", () => {
  pointerStartX = null;
});

window.addEventListener("message", (event) => {
  if (event.source !== petFrame?.contentWindow) return;
  if (event.data?.type === "sweetchie-pet-ready") {
    notifyPet(currentIndex);
    schedulePetCue();
  }
});

const initialHash = window.location.hash.match(/^#slide-(\d+)$/);
currentIndex = -1;
showSlide(initialHash ? Number(initialHash[1]) - 1 : 0, { announce: false });
setTimeout(showHint, 900);
