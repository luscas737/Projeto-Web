(() => {
  const MB = "https://musicbrainz.org/ws/2";
  const APP_ID = "&app=SonoraMusicResearch";

  const state = { kind: "all", query: "" };

  const els = {
    form: document.getElementById("search-form"),
    input: document.getElementById("search-input"),
    tabs: document.getElementById("tabs"),
    title: document.getElementById("results-title"),
    count: document.getElementById("results-count"),
    empty: document.getElementById("state-empty"),
    loading: document.getElementById("state-loading"),
    error: document.getElementById("state-error"),
    none: document.getElementById("state-none"),
    grid: document.getElementById("results-grid"),
  };

  function show(which) {
    for (const k of ["empty", "loading", "error", "none", "grid"]) {
      const el = els[k];
      el.classList.add("hidden");
      el.classList.remove("is-visible");
    }
    const el = els[which];
    el.classList.remove("hidden");
    if (which === "grid" || which === "loading") el.classList.add("is-visible");
  }

  async function mb(path) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${MB}${path}${sep ? "" : ""}${APP_ID}`.replace("?&", "?"), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
    return res.json();
  }

  const cover = (id) => `https://coverartarchive.org/release-group/${id}/front-250`;

  async function searchMusic(query, kind) {
    const q = query.trim();
    if (!q) return [];
    const enc = encodeURIComponent(q);
    const out = [];

    const wantArtists = kind === "all" || kind === "artists";
    const wantBands = kind === "all" || kind === "bands";
    const wantAlbums = kind === "all" || kind === "albums";
    const wantMovements = kind === "movements";

    if (wantArtists || wantBands) {
      const json = await mb(`/artist/?query=${enc}&fmt=json&limit=12`);
      for (const a of json.artists ?? []) {
        const isGroup = a.type === "Group";
        if (kind === "artists" && isGroup) continue;
        if (kind === "bands" && !isGroup) continue;
        out.push({
          id: `artist-${a.id}`,
          title: a.name,
          subtitle: [a.type, a.country].filter(Boolean).join(" · ") || "Artista",
          year: (a["life-span"]?.begin ?? "").slice(0, 4) || "—",
          desc:
            a.disambiguation ||
            (a.tags?.slice(0, 3).map((t) => t.name).join(", ")) ||
            "Artista catalogado no MusicBrainz.",
          image: null,
        });
      }
    }

    if (wantAlbums) {
      const json = await mb(`/release-group/?query=${enc}&fmt=json&limit=12`);
      for (const rg of json["release-groups"] ?? []) {
        const artist = rg["artist-credit"]?.[0]?.name ?? "Vários artistas";
        out.push({
          id: `rg-${rg.id}`,
          title: rg.title,
          subtitle: `${artist} · ${rg["primary-type"] ?? "Álbum"}`,
          year: (rg["first-release-date"] ?? "").slice(0, 4) || "—",
          desc: rg.disambiguation || `${rg["primary-type"] ?? "Lançamento"} de ${artist}.`,
          image: cover(rg.id),
        });
      }
    }

    if (wantMovements) {
      const json = await mb(`/recording/?query=${enc}&fmt=json&limit=12`);
      for (const r of json.recordings ?? []) {
        const artist = r["artist-credit"]?.[0]?.name ?? "—";
        const rg = r.releases?.[0]?.["release-group"]?.id;
        out.push({
          id: `rec-${r.id}`,
          title: r.title,
          subtitle: `${artist} · Gravação`,
          year: (r["first-release-date"] ?? "").slice(0, 4) || "—",
          desc: r.disambiguation || `Gravação interpretada por ${artist}.`,
          image: rg ? cover(rg) : null,
        });
      }
    }

    return out.slice(0, 18);
  }

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fallbackIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="size-10 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

  function renderCards(results) {
    els.grid.innerHTML = results
      .map((r) => {
        const img = r.image
          ? `<img src="${escapeHTML(r.image)}" alt="${escapeHTML(r.title)}" width="500" height="500" loading="lazy" class="card-img w-full h-full object-cover" onerror="this.outerHTML='${fallbackIcon.replace(/'/g, "&#39;")}'" />`
          : fallbackIcon;
        return `
          <article class="card group cursor-pointer">
            <div class="w-full aspect-square bg-zinc-900 rounded-[12px] outline outline-1 -outline-offset-1 outline-white/5 mb-4 overflow-hidden grid place-items-center">
              ${img}
            </div>
            <div class="space-y-2">
              <div class="flex items-start justify-between gap-3">
                <h3 class="card-title text-zinc-100 font-medium transition-colors leading-tight">${escapeHTML(r.title)}</h3>
                <span class="text-xs text-zinc-500 font-mono shrink-0 mt-0.5">${escapeHTML(r.year)}</span>
              </div>
              <p class="text-xs text-zinc-500 uppercase tracking-wider">${escapeHTML(r.subtitle)}</p>
              <p class="text-sm text-zinc-500 text-pretty max-w-[40ch] line-clamp-3">${escapeHTML(r.desc)}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function run() {
    if (!state.query) {
      els.title.textContent = "Resultados da pesquisa";
      els.count.textContent = "0 resultados";
      show("empty");
      return;
    }
    els.title.textContent = `Resultados para "${state.query}"`;
    els.count.textContent = "Carregando...";
    show("loading");
    try {
      const results = await searchMusic(state.query, state.kind);
      els.count.textContent = `${results.length} resultados`;
      if (results.length === 0) {
        show("none");
      } else {
        renderCards(results);
        show("grid");
      }
    } catch (err) {
      console.error(err);
      els.count.textContent = "Erro";
      show("error");
    }
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    state.query = els.input.value.trim();
    run();
  });

  els.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-kind]");
    if (!btn) return;
    state.kind = btn.dataset.kind;
    for (const b of els.tabs.querySelectorAll("button[data-kind]")) {
      const active = b === btn;
      b.classList.toggle("tab-active", active);
      b.classList.toggle("tab-idle", !active);
    }
    if (state.query) run();
  });
})();