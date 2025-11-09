console.log("feed.js loaded ✅");

const BASE = "https://v2.api.noroff.dev";
const LS_TOKEN = "accessToken";
const LS_API_KEY = "apiKey";

const list = document.getElementById("postList");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("q");
const clearBtn = document.getElementById("clearSearch");
const statusLine = document.getElementById("searchStatusLine");


const token = localStorage.getItem(LS_TOKEN);
console.log("Token from localStorage:", token);
if (!token) {
  console.warn("No access token found, redirecting to login.");
  window.location.href = "login.html";
}



function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function setStatusLine(text) {
  if (statusLine) statusLine.textContent = text || "";
}

function setLoading() {
  if (!list) return;
  list.innerHTML = `<div class="card"><p>Loading…</p></div>`;
}

function setError(message, details) {
  if (!list) return;
  const cleanMessage = (message || "").trim() || "Something went wrong.";
  const cleanDetails = (details || "").trim();

  list.innerHTML = `
    <div class="card" style="border-left:4px solid #b00020;">
      <p class="error" style="margin:0 0 .5rem 0;">${cleanMessage}</p>
      ${
        cleanDetails
          ? `<pre style="white-space:pre-wrap;font-size:.9rem;opacity:.85;margin:0;">${cleanDetails}</pre>`
          : ""
      }
    </div>
  `;
}

function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, (m) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[m];
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function buildPostsUrl(q) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("_author", "true");
  params.set("_reactions", "true");
  params.set("_comments", "true");
  params.set("limit", "100");
  const qs = params.toString();
  const url = `${BASE}/social/posts${qs ? "?" + qs : ""}`;
  console.log("Posts URL:", url);
  return url;
}


async function ensureApiKey() {
  const existing = localStorage.getItem(LS_API_KEY);
  if (existing) {
    console.log("Using existing API key from localStorage.");
    return existing;
  }

  console.log("No API key found, creating a new one…");

  let res, text, payload;
  try {
    res = await fetch(`${BASE}/auth/create-api-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    text = await res.text().catch(() => "");
    payload = text ? JSON.parse(text) : null;
  } catch (networkErr) {
    throw new Error(
      `Network error while creating API key: ${
        networkErr?.message || networkErr
      }`,
    );
  }

  if (!res.ok) {
    const msg =
      payload?.errors?.[0]?.message ||
      payload?.message ||
      `Failed to create API key (HTTP ${res.status} ${res.statusText})`;
    throw new Error(`${msg}${text ? `\n${text}` : ""}`);
  }

  const key = payload?.data?.key;
  if (!key) {
    throw new Error("API key creation succeeded but no key was returned.");
  }

  console.log("New API key created and stored.");
  localStorage.setItem(LS_API_KEY, key);
  return key;
}


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
    console.log("Posts response status:", res.status);
  } catch (networkErr) {
    throw new Error(
      `Network error while fetching posts: ${
        networkErr?.message || networkErr
      }`,
    );
  }

  if (!res.ok) {
    const first =
      payload?.errors?.[0]?.message ||
      payload?.message ||
      `Failed to load posts (HTTP ${res.status} ${res.statusText})`;
    throw new Error(`${first}${text ? `\n${text}` : ""}`);
  }

  const posts = payload?.data ?? [];
  console.log("Posts received:", posts);
  return posts;
}



function clientFilter(posts, q) {
  const term = (q || "").trim().toLowerCase();
  if (!term) return posts;
  return posts.filter((p) => {
    const title = (p.title || "").toLowerCase();
    const body = (p.body || "").toLowerCase();
    const author = (p.author?.name || "").toLowerCase();
    return (
      title.includes(term) || body.includes(term) || author.includes(term)
    );
  });
}

function render(posts) {
  if (!list) return;

  if (!Array.isArray(posts) || posts.length === 0) {
    list.innerHTML = `<div class="card"><p class="muted">No posts found.</p></div>`;
    return;
  }

  list.innerHTML = posts
    .map((p) => {
      const title = escapeHTML(p.title || "Untitled");
      const body = escapeHTML(p.body || "");
      const authorName = p.author?.name || "";
      const author = escapeHTML(authorName || "Unknown");
      const created = p.created ? formatDate(p.created) : "";
      const mediaUrl = p.media?.url
        ? `<img src="${p.media.url}" alt="${escapeHTML(
            p.media.alt || "",
          )}" loading="lazy" />`
        : "";
      const reactions = Array.isArray(p.reactions)
        ? p.reactions.reduce((sum, r) => sum + (r.count || 0), 0)
        : 0;
      const commentsCount =
        typeof p._count?.comments === "number"
          ? p._count.comments
          : Array.isArray(p.comments)
          ? p.comments.length
          : 0;

      return `
        <article class="card" data-id="${p.id}">
          <h3>${title}</h3>
          <p><small>by <a class="author-link" href="user.html?name=${encodeURIComponent(
            authorName,
          )}">${author}</a>${
            created ? ` • ${created}` : ""
          }</small></p>
          ${mediaUrl}
          ${body ? `<p style="margin-top:.5rem;">${body}</p>` : ""}
          <p style="margin-top:.5rem;">
            <small>👍 ${reactions} • 💬 ${commentsCount}</small>
          </p>
          <a href="single-post.html?id=${encodeURIComponent(
            p.id,
          )}" class="button-link" style="display:inline-block;margin-top:.5rem;">Open</a>
        </article>
      `;
    })
    .join("");
}

async function load(q) {
  try {
    setLoading();
    setStatusLine(q ? `Searching for “${q}”…` : "Loading latest posts…");
    const serverPosts = await getPosts(q);
    const posts = clientFilter(serverPosts, q);
    render(posts);
    setStatusLine(
      `${posts.length} result${posts.length === 1 ? "" : "s"}${
        q ? ` for “${q}”` : ""
      }`,
    );
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

if (searchForm) {
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput?.value?.trim() || "";
    const params = new URLSearchParams(location.search);
    if (q) params.set("q", q);
    else params.delete("q");
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
    load(q);
  });
}

const debouncedLiveSearch = debounce(() => {
  const q = searchInput?.value?.trim() || "";
  const params = new URLSearchParams(location.search);
  if (q) params.set("q", q);
  else params.delete("q");
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  load(q);
}, 400);

if (searchInput) {
  searchInput.addEventListener("input", debouncedLiveSearch);
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (!searchInput) return;
    searchInput.value = "";
    const params = new URLSearchParams(location.search);
    params.delete("q");
    history.replaceState(
      null,
      "",
      `${location.pathname}?${params.toString()}`,
    );
    load("");
    searchInput.focus();
  });
}


load(initialQ);
