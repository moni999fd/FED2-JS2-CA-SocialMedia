const BASE = "https://v2.api.noroff.dev";
const LS_TOKEN = "accessToken";
const LS_API_KEY = "apiKey";

const container = document.getElementById("singlePost");
const commentForm = document.getElementById("commentForm");
const commentBodyEl = document.getElementById("commentBody");
const commentStatus = document.getElementById("commentStatus");
const addCommentSection = document.getElementById("addCommentSection");
const reactBar = document.getElementById("reactBar");
const reactStatus = document.getElementById("reactStatus");

const manageSection = document.getElementById("manageSection");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");
const manageStatus = document.getElementById("manageStatus");
const editForm = document.getElementById("editForm");
const editTitle = document.getElementById("editTitle");
const editBody = document.getElementById("editBody");
const editMediaUrl = document.getElementById("editMediaUrl");
const editMediaAlt = document.getElementById("editMediaAlt");
const cancelEdit = document.getElementById("cancelEdit");
const editError = document.getElementById("editError");
const editSuccess = document.getElementById("editSuccess");

function getParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

function escapeHTML(s = "") {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return ""; }
}

function setLoading() {
  container.innerHTML = `<p>Loading…</p>`;
}

function setError(message) {
  container.innerHTML = `
    <div class="card" style="border-left:4px solid #b00020;">
      <p class="error" style="margin:0;">${escapeHTML(message || "Something went wrong.")}</p>
    </div>
  `;
}

const token = localStorage.getItem(LS_TOKEN);
if (!token) {
  window.location.href = "login.html";
}

let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem("user") || "null"); } catch {}

async function ensureApiKey() {
  const existing = localStorage.getItem(LS_API_KEY);
  if (existing) return existing;

  let res, text, payload;

  try {
    res = await fetch(`${BASE}/auth/create-api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    text = await res.text().catch(() => "");
    payload = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error(`Could not reach API to create key: ${e?.message || e}`);
  }

  if (!res.ok) {
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
    } catch (e2) {
      throw new Error(`API key error (retry failed): ${e2?.message || e2}`);
    }

    if (!res.ok) {
      const msg =
        payload?.errors?.[0]?.message ||
        payload?.message ||
        `Failed to create API key (HTTP ${res.status} ${res.statusText})`;
      throw new Error(`${msg}${text ? `\n${text}` : ""}`);
    }
  }

  const key = payload?.data?.key;
  if (!key) throw new Error("API key creation returned no key.");
  localStorage.setItem(LS_API_KEY, key);
  return key;
}

function buildPostUrl(id) {
  const params = new URLSearchParams();
  params.set("_author", "true");
  params.set("_reactions", "true");
  params.set("_comments", "true");
  return `${BASE}/social/posts/${encodeURIComponent(id)}?${params.toString()}`;
}
const buildCommentUrl = (id) => `${BASE}/social/posts/${encodeURIComponent(id)}/comment`;
const buildReactUrl = (id, emoji) => `${BASE}/social/posts/${encodeURIComponent(id)}/react/${encodeURIComponent(emoji)}`;
const buildUpdateUrl = (id) => `${BASE}/social/posts/${encodeURIComponent(id)}`;
const buildDeleteUrl = (id) => `${BASE}/social/posts/${encodeURIComponent(id)}`;

// ===== API calls =====
async function getPost(id) {
  const apiKey = await ensureApiKey();
  const url = buildPostUrl(id);

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
    throw new Error(`Network error while fetching post: ${networkErr?.message || networkErr}`);
  }

  if (!res.ok) {
    const first =
      payload?.errors?.[0]?.message ||
      payload?.message ||
      `Failed to load post (HTTP ${res.status} ${res.statusText})`;
    throw new Error(`${first}${text ? `\n${text}` : ""}`);
  }

  return payload?.data;
}

async function addComment(postId, body) {
  const apiKey = await ensureApiKey();
  const url = buildCommentUrl(postId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
    body: JSON.stringify({ body }),
  });

  let payload = null;
  try { payload = await res.json(); } catch {}

  if (!res.ok) {
    const msg =
      payload?.errors?.[0]?.message ||
      payload?.message ||
      `Failed to add comment (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return payload?.data;
}

async function reactToPost(postId, emoji) {
  const apiKey = await ensureApiKey();
  const url = buildReactUrl(postId, emoji);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
  });

  let payload = null;
  try { payload = await res.json(); } catch {}

  if (!res.ok) {
    const msg =
      payload?.errors?.[0]?.message ||
      payload?.message ||
      `Failed to react (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return payload?.data; 
}

async function updatePost(postId, payload) {
  const apiKey = await ensureApiKey();
  const url = buildUpdateUrl(postId);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.message ||
      data?.message ||
      `Failed to update (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data?.data;
}

async function deletePost(postId) {
  const apiKey = await ensureApiKey();
  const url = buildDeleteUrl(postId);

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
  });

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    const msg =
      data?.errors?.[0]?.message ||
      data?.message ||
      `Failed to delete (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return true;
}

function renderPost(post) {
  if (!post) {
    setError("Post not found.");
    return;
  }

  const title = escapeHTML(post.title || "Untitled");
  const body = escapeHTML(post.body || "");
  const authorName = post.author?.name || "Unknown";
  const authorLink = `<a class="author-link" href="user.html?name=${encodeURIComponent(authorName)}">${escapeHTML(authorName)}</a>`;
  const created = post.created ? formatDate(post.created) : "";
  const media = post.media?.url
    ? `<img class="post-hero" src="${post.media.url}" alt="${escapeHTML(post.media.alt || "")}" loading="lazy" />`
    : "";

  const reactionsSummary = Array.isArray(post.reactions) && post.reactions.length
    ? post.reactions.map(r => `${escapeHTML(r.symbol || "👍")} ${r.count || 0}`).join(" • ")
    : "No reactions yet";

  const comments = Array.isArray(post.comments) && post.comments.length
    ? post.comments.map(c => {
        const name = c.author?.name || "Anon";
        const link = `<a class="author-link" href="user.html?name=${encodeURIComponent(name)}">${escapeHTML(name)}</a>`;
        const when = c.created ? formatDate(c.created) : "";
        const text = escapeHTML(c.body || "");
        return `<li data-comment-id="${c.id}">
          <p><strong>${link}</strong>${when ? ` • <small>${when}</small>` : ""}</p>
          <p>${text}</p>
        </li>`;
      }).join("")
    : `<li class="muted">No comments yet</li>`;

  container.innerHTML = `
    <article class="card" data-id="${post.id}">
      <h2 style="margin-bottom:.25rem;">${title}</h2>
      <p><small>by ${authorLink}${created ? ` • ${created}` : ""}</small></p>
      ${media}
      ${body ? `<p style="margin-top:.75rem;">${body}</p>` : ""}

      <section style="margin-top:1rem;">
        <h3 style="margin-bottom:.25rem;">Reactions</h3>
        <p id="reactionSummary" style="opacity:.85;">${reactionsSummary}</p>
      </section>

      <section style="margin-top:1rem;">
        <h3 style="margin-bottom:.5rem;">Comments</h3>
        <ul id="commentList" class="comment-list">
          ${comments}
        </ul>
      </section>
    </article>
  `;

  addCommentSection.style.display = "block";
  reactBar.style.display = "block";

  if (currentUser?.name && currentUser.name === post.author?.name) {
    manageSection.style.display = "block";
    editTitle.value = post.title || "";
    editBody.value = post.body || "";
    editMediaUrl.value = post.media?.url || "";
    editMediaAlt.value = post.media?.alt || "";
  } else {
    manageSection.style.display = "none";
  }
}

function prependCommentToList({ authorName = "You", body, created = new Date().toISOString() }) {
  const list = document.getElementById("commentList");
  if (!list) return;
  const link = `<a class="author-link" href="user.html?name=${encodeURIComponent(authorName)}">${escapeHTML(authorName)}</a>`;
  const item = document.createElement("li");
  item.innerHTML = `<p><strong>${link}</strong> • <small>${formatDate(created)}</small></p><p>${escapeHTML(body)}</p>`;
  list.prepend(item);

  const empty = list.querySelector(".muted");
  if (empty) empty.remove();
}

function updateReactionSummary(symbol, count) {
  const el = document.getElementById("reactionSummary");
  if (!el) return;
  const text = el.textContent || "";
  const regex = new RegExp(`${symbol}\\s\\d+`);
  if (regex.test(text)) {
    el.textContent = text.replace(regex, `${symbol} ${count}`);
  } else if (text === "No reactions yet") {
    el.textContent = `${symbol} ${count}`;
  } else {
    el.textContent = `${text} • ${symbol} ${count}`;
  }
}

const postId = getParam("id");

(async function init() {
  if (!postId) {
    container.innerHTML = `
      <div class="card">
        <p>No post selected.</p>
        <a href="feed.html" class="button-link" style="margin-top:.5rem;display:inline-block;">Back to feed</a>
      </div>`;
    return;
  }
  try {
    setLoading();
    const post = await getPost(postId);
    renderPost(post);
  } catch (err) {
    const msg = String(err?.message || err || "Something went wrong.");
    setError(msg);
    console.error("[single-post] error:", msg);
  }
})();

commentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  commentStatus.textContent = "";

  const text = commentBodyEl.value.trim();
  if (!text) {
    commentStatus.textContent = "Please write a comment.";
    return;
  }

  try {
    commentForm.querySelector("button[type='submit']").disabled = true;
    commentStatus.textContent = "Posting…";

    const created = await addComment(postId, text);
    prependCommentToList({
      authorName: created?.author?.name || "You",
      body: created?.body || text,
      created: created?.created,
    });

    commentBodyEl.value = "";
    commentStatus.textContent = "Posted!";
    setTimeout(() => (commentStatus.textContent = ""), 1200);
  } catch (err) {
    commentStatus.textContent = err.message || "Could not post comment.";
  } finally {
    commentForm.querySelector("button[type='submit']").disabled = false;
  }
});

document.querySelectorAll(".react-btn")?.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const emoji = btn.dataset.emoji;
    reactStatus.textContent = "";
    try {
      btn.disabled = true;
      reactStatus.textContent = `Reacting ${emoji}…`;
      const data = await reactToPost(postId, emoji);
      updateReactionSummary(data.symbol, data.count || 0);
      reactStatus.textContent = "Done!";
      setTimeout(() => (reactStatus.textContent = ""), 1000);
    } catch (err) {
      reactStatus.textContent = err.message || "Could not react.";
    } finally {
      btn.disabled = false;
    }
  });
});

editBtn?.addEventListener("click", () => {
  editError.textContent = "";
  editSuccess.style.display = "none";
  editForm.style.display = "block";
});

cancelEdit?.addEventListener("click", () => {
  editForm.style.display = "none";
  editError.textContent = "";
  editSuccess.style.display = "none";
});

editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  editError.textContent = "";
  editSuccess.style.display = "none";

  const title = editTitle.value.trim();
  const body = editBody.value.trim();
  const mediaUrl = editMediaUrl.value.trim();
  const mediaAlt = editMediaAlt.value.trim();

  if (!title) {
    editError.textContent = "Please enter a title.";
    editTitle.focus();
    return;
  }

  const payload = { title };
  if (body) payload.body = body;
  if (mediaUrl) {
    try {
      const u = new URL(mediaUrl);
      if (u.protocol === "http:" || u.protocol === "https:") {
        payload.media = { url: mediaUrl };
        if (mediaAlt) payload.media.alt = mediaAlt;
      } else {
        editError.textContent = "Image URL must start with http:// or https://";
        return;
      }
    } catch {
      editError.textContent = "Image URL must be a valid URL.";
      return;
    }
  } else {
    payload.media = null;
  }

  try {
    editBtn.disabled = true;
    deleteBtn.disabled = true;
    manageStatus.textContent = "Saving…";

    await updatePost(postId, payload);

    editSuccess.textContent = "Saved!";
    editSuccess.style.display = "block";
    manageStatus.textContent = "";

    const updated = await getPost(postId);
    renderPost(updated);

    editForm.style.display = "none";
  } catch (err) {
    editError.textContent = err.message || "Could not save changes.";
  } finally {
    editBtn.disabled = false;
    deleteBtn.disabled = false;
  }
});

deleteBtn?.addEventListener("click", async () => {
  editError.textContent = "";
  editSuccess.style.display = "none";

  const ok = confirm("Delete this post? This cannot be undone.");
  if (!ok) return;

  try {
    editBtn.disabled = true;
    deleteBtn.disabled = true;
    manageStatus.textContent = "Deleting…";

    await deletePost(postId);

    manageStatus.textContent = "Deleted. Redirecting…";
    setTimeout(() => {
      window.location.href = "feed.html";
    }, 800);
  } catch (err) {
    manageStatus.textContent = "";
    editError.textContent = err.message || "Could not delete post.";
    editBtn.disabled = false;
    deleteBtn.disabled = false;
  }
});

