(() => {
  "use strict";

  const data = window.GALLERY_DATA;
  const app = document.querySelector("#app");
  const backLink = document.querySelector("#back-link");
  const topbarTitle = document.querySelector("#topbar-title");
  let activeRoute = null;

  if (!data || !Array.isArray(data.albums)) {
    app.innerHTML = '<p class="empty-state">The gallery catalogue could not be loaded.</p>';
    return;
  }

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const escapeHTML = (value) => String(value).replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);

  const albumHash = (album) => `#album/${encodeURIComponent(album.id)}`;
  const photoHash = (album, photo) => `${albumHash(album)}/photo/${photo.id}`;

  function picture(photo, kind, eager = false) {
    const source = kind === "thumb" ? photo.thumb : photo.display;
    const loading = eager ? "eager" : "lazy";
    const priority = eager ? ' fetchpriority="high"' : "";
    return `
      <picture>
        <source srcset="${source}" type="image/webp">
        <img src="${photo.original}" alt="${escapeHTML(photo.title)}" width="${photo.width}" height="${photo.height}" loading="${loading}" decoding="async"${priority}>
      </picture>`;
  }

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] !== "album" || !parts[1]) {
      return { kind: "home" };
    }

    const albumId = decodeURIComponent(parts[1]);
    const album = data.albums.find((candidate) => candidate.id === albumId);
    if (!album) {
      return { kind: "home" };
    }

    if (parts[2] === "photo" && parts[3]) {
      const photo = album.photos.find((candidate) => candidate.id === parts[3]);
      if (photo) {
        return { kind: "feed", album, photo };
      }
    }

    return { kind: "album", album };
  }

  function setTopbar(href, label, title) {
    backLink.href = href;
    backLink.textContent = label;
    topbarTitle.textContent = title;
  }

  function renderHome() {
    document.body.dataset.view = "home";
    setTopbar("../index.html", "Projects", "Revision Notes");
    app.innerHTML = `
      <div class="album-home">
        <section class="hero" aria-label="Revision and enrichment notes">
          <picture class="hero-picture">
            <source srcset="../assets/notes.webp" type="image/webp">
            <img src="../assets/notes.png" alt="Revision and Enrichment — review deeply, learn beyond" width="1672" height="941" fetchpriority="high">
          </picture>
        </section>
        <section aria-labelledby="albums-heading">
          <div class="section-heading">
            <h1 id="albums-heading">Albums</h1>
            <p>${data.photoCount} pages · ${data.albumCount} albums</p>
          </div>
          <div class="album-grid">
            ${data.albums.map((album) => `
              <a class="album-card" href="${albumHash(album)}">
                ${picture(album.cover, "thumb")}
                <span class="album-card-copy">
                  <span>
                    <h2>${escapeHTML(album.title)}</h2>
                    <p>${album.count} pages</p>
                  </span>
                  <span class="album-card-arrow" aria-hidden="true">→</span>
                </span>
              </a>`).join("")}
          </div>
        </section>
      </div>`;
    window.scrollTo(0, 0);
  }

  function renderAlbum(route, previousRoute) {
    const { album } = route;
    document.body.dataset.view = "album";
    setTopbar("#albums", "Albums", album.title);
    app.innerHTML = `
      <section class="album-view" aria-labelledby="album-heading">
        <div class="album-heading">
          <h1 id="album-heading">${escapeHTML(album.title)}</h1>
          <p>${album.count} pages</p>
        </div>
        <div class="photo-grid">
          ${album.photos.map((photo) => `
            <a class="photo-thumb" href="${photoHash(album, photo)}" data-photo-link data-album="${escapeHTML(album.id)}" aria-label="Open ${escapeHTML(photo.title)}">
              ${picture(photo, "thumb")}
            </a>`).join("")}
        </div>
      </section>`;

    const returningFromFeed = previousRoute?.kind === "feed" && previousRoute.album.id === album.id;
    const storedPosition = Number(sessionStorage.getItem(`notes-scroll-${album.id}`)) || 0;
    requestAnimationFrame(() => window.scrollTo(0, returningFromFeed ? storedPosition : 0));
  }

  function renderFeed(route) {
    const { album, photo: selectedPhoto } = route;
    document.body.dataset.view = "feed";
    setTopbar(albumHash(album), "Grid", album.title);
    app.innerHTML = `
      <section class="feed" aria-label="${escapeHTML(album.title)} scrolling photo view">
        <div class="feed-intro">Scroll to continue through ${album.count} pages</div>
        ${album.photos.map((photo, index) => `
          <article class="feed-photo" id="photo-${photo.id}">
            ${picture(photo, "display", photo.id === selectedPhoto.id)}
            <div class="feed-caption">
              <strong>${escapeHTML(photo.title)}</strong>
              <span>${index + 1} / ${album.count}</span>
            </div>
          </article>`).join("")}
      </section>`;

    requestAnimationFrame(() => {
      const selected = document.querySelector(`#photo-${selectedPhoto.id}`);
      if (selected) {
        selected.scrollIntoView({ block: "start" });
      }
    });
  }

  function render() {
    const previousRoute = activeRoute;
    const route = parseRoute();
    activeRoute = route;

    if (route.kind === "album") {
      renderAlbum(route, previousRoute);
    } else if (route.kind === "feed") {
      renderFeed(route);
    } else {
      renderHome();
    }
  }

  document.addEventListener("click", (event) => {
    const photoLink = event.target.closest("[data-photo-link]");
    if (photoLink) {
      sessionStorage.setItem(`notes-scroll-${photoLink.dataset.album}`, String(window.scrollY));
    }
  });

  window.addEventListener("hashchange", render);
  render();
})();
