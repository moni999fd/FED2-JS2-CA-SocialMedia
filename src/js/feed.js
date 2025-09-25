const BASE = "https://v2.api.noroff.dev";
const LS_TOKEN = "accessToken";
const LS_API_KEY = "apiKey";

const list = document.getElementById("postList");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("q");
const clearBtn = document.getElementById("clearSearch");
const statusLine = document.getElementById("searchStatusLine");
const token = localStorage.getItem(LS_TOKEN);
if (!token) window.location.href = "login.html";


function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
function setStatusLine(txt) { if (statusLine) statusLine.textContent = txt || ""; }
function setLoading() { list.innerHTML = `<div class="card"><p>Loading…</p></div>`; }
function setError(message, details) {
  const cleanMessage = (message || "").trim() || "Something went wrong.";
  const cleanDetails = (details || "").trim();
  const showDetails = cleanDetails && cleanDetails !== cleanMessage;
  list.innerHTML = `
    <div class="card" style="border-left:4px solid #b00020;">
      <p class="error" style="margin:0 0 .5rem 0;">${cleanMessage}</p>
      ${showDetails ? `<pre style="white-space:pre-wrap;font-size:.9rem;opacity:.85;margin:0;">${cleanDetails}</pre>` : ""}
    </div>
  `;
}
function escapeHTML(s = "") {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}
function formatDate(iso) { try { return new Date(iso).toLocaleString(); } catch { return ""; } }

function buildPostsUrl(q) {
  const params = new URLSearchParams();
  if (q) params.set("q", q); 
  params.set("_author", "true");
  params.set("_reactions", "true");
  params.set("_comments", "true");
  params.set("limit", "100"); 
  const qs = params.toString();
  return `${BASE}/social/posts${qs ? "?" + qs : ""}`;
}


async function ensureApiKey() {
  const existing = localStorage.getItem(LS_API_KEY);
  if (existing) return existing;

  let res = await fetch(`${BASE}/auth/create-api-key`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  let text = await res.text().catch(() => "");
  let payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    res = await fetch(`${BASE}/auth/create-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    text = await res.text().catch(() => "");
    payload = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const msg = payload?.errors?.[0]?.message || payload?.message || `Failed to create API key (HTTP ${res.status} ${res.statusText})`;
      throw new Error(`${msg}${text ? `\n${text}` : ""}`);
    }
  }
  const key = payload?.data?.key;
  if (!key) throw new Error("API key creation returned no key.");
  localStorage.setItem(LS_API_KEY, key);
  return key;
}

/**
 * Fetches posts from the Noroff API.
 * @async
 * @param {string} [q] - Optional search query to filter posts.
 * @returns {Promise<Object[]>} A list of post objects.
 * @throws {Error} If fetching posts fails.
 */

async function getPosts(q) {
  const apiKey = await ensureApiKey();
  const url = buildPostsUrl(q);

  let res, text, payload;
  try {
    res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Noroff-API-Key": apiKey,
      },
    });
    text = await res.text().catch(() => "");
    payload = text ? JSON.parse(text) : null;
  } catch (networkErr) {
    throw new Error(`Network error while fetching posts: ${networkErr?.message || networkErr}`);
  }

  if (!res.ok) {
    const first = payload?.errors?.[0]?.message || payload?.message || `Failed to load posts (HTTP ${res.status} ${res.statusText})`;
    throw new Error(`${first}${text ? `\n${text}` : ""}`);
  }

  return payload?.data ?? [];
}


function clientFilter(posts, q) {
  const term = (q || "").trim().toLowerCase();
  if (!term) return posts;
  return posts.filter((p) => {
    const title = (p.title || "").toLowerCase();
    const body = (p.body || "").toLowerCase();
    const author = (p.author?.name || "").toLowerCase();
    return title.includes(term) || body.includes(term) || author.includes(term);
  });
}


function render(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    list.innerHTML = `<div class="card"><p class="muted">No posts match your search.</p></div>`;
    return;
  }
  list.innerHTML = posts.map((p) => {
    const title = escapeHTML(p.title || "Untitled");
    const body = escapeHTML(p.body || "");
    const authorName = p.author?.name || "";
    const author = escapeHTML(authorName || "Unknown");
    const created = p.created ? formatDate(p.created) : "";
    const mediaUrl = p.media?.url ? `<img src="${p.media.url}" alt="${escapeHTML(p.media.alt || "")}" loading="lazy" />` : "";
    const reactions = Array.isArray(p.reactions) ? p.reactions.reduce((sum, r) => sum + (r.count || 0), 0) : 0;
    const commentsCount =
      typeof p._count?.comments === "number"
        ? p._count.comments
        : Array.isArray(p.comments)
        ? p.comments.length
        : 0;
    return `
      <article class="card" data-id="${p.id}">
        <h3>${title}</h3>
        <p><small>by <a class="author-link" href="user.html?name=${encodeURIComponent(authorName)}">${author}</a>${created ? ` • ${created}` : ""}</small></p>
        ${mediaUrl}
        ${body ? `<p style="margin-top:.5rem;">${body}</p>` : ""}
        <p style="margin-top:.5rem;">
          <small>👍 ${reactions} • 💬 ${commentsCount}</small>
        </p>
        <a href="single-post.html?id=${encodeURIComponent(p.id)}" class="button-link" style="display:inline-block;margin-top:.5rem;">Open</a>
      </article>
    `;
  }).join("");
}


async function load(q) {
  try {
    setLoading();
    setStatusLine(q ? `Searching for “${q}”…` : "Showing latest posts");
    const serverPosts = await getPosts(q);
    const posts = clientFilter(serverPosts, q);   
    render(posts);
    setStatusLine(`${posts.length} result${posts.length === 1 ? "" : "s"}${q ? ` for “${q}”` : ""}`);
  } catch (err) {
    const raw = String(err?.message || err || "");
    const [firstLine, ...rest] = raw.split("\n");
    const details = rest.join("\n");
    console.error("[feed] error:", raw);
    setError(firstLine || "Something went wrong.", details);
    setStatusLine("Error loading posts");
  }
}


const urlParams = new URLSearchParams(location.search);
const initialQ = urlParams.get("q") || "";
if (searchInput) searchInput.value = initialQ;


searchForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput?.value?.trim() || "";
  const params = new URLSearchParams(location.search);
  if (q) params.set("q", q); else params.delete("q");
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  load(q);
});


const debouncedLiveSearch = debounce(() => {
  const q = searchInput?.value?.trim() || "";
  const params = new URLSearchParams(location.search);
  if (q) params.set("q", q); else params.delete("q");
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  load(q);
}, 400);

searchInput?.addEventListener("input", debouncedLiveSearch);


clearBtn?.addEventListener("click", () => {
  if (!searchInput) return;
  searchInput.value = "";
  const params = new URLSearchParams(location.search);
  params.delete("q");
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  load("");
  searchInput.focus();
});


load(initialQ);
