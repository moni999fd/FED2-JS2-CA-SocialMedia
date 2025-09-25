import { BASE, getToken, ensureApiKey } from "./config.js";

const token = getToken();
if (!token) {
  window.location.href = "login.html";
}

const form = document.getElementById("createForm");
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const mediaUrlEl = document.getElementById("mediaUrl");
const mediaAltEl = document.getElementById("mediaAlt");
const errorEl = document.getElementById("createError");
const successEl = document.getElementById("createSuccess");
const submitBtn = form?.querySelector('button[type="submit"]');

function setLoading(loading) {
  if (!submitBtn) return;
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? "Publishing…" : "Publish";
}

function isHttpUrl(value = "") {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function createPost(payload) {
  const apiKey = await ensureApiKey();

  const res = await fetch(`${BASE}/social/posts`, {
    method: "POST",
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
      `Failed to publish (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data?.data; 
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!errorEl || !successEl) return;

  errorEl.textContent = "";
  successEl.style.display = "none";
  successEl.textContent = "";

  const title = titleEl?.value?.trim() || "";
  const body = bodyEl?.value?.trim() || "";
  const mediaUrl = mediaUrlEl?.value?.trim() || "";
  const mediaAlt = mediaAltEl?.value?.trim() || "";

  if (!title) {
    errorEl.textContent = "Please add a title.";
    titleEl?.focus();
    return;
  }

  const payload = { title };
  if (body) payload.body = body;

  if (mediaUrl) {
    if (!isHttpUrl(mediaUrl)) {
      errorEl.textContent = "Image URL must start with http:// or https://";
      mediaUrlEl?.focus();
      return;
    }
    payload.media = { url: mediaUrl };
    if (mediaAlt) payload.media.alt = mediaAlt;
  } else if (mediaAlt) {
    errorEl.textContent = "Please add an Image URL to use alt text.";
    mediaUrlEl?.focus();
    return;
  }

  try {
    setLoading(true);
    const created = await createPost(payload);

    successEl.textContent = "Post published! Redirecting…";
    successEl.style.display = "block";

    setTimeout(() => {
      if (created?.id) {
        window.location.href = `single-post.html?id=${encodeURIComponent(created.id)}`;
      } else {
        window.location.href = "feed.html";
      }
    }, 1200);
  } catch (err) {
    errorEl.textContent = err?.message || "Something went wrong. Please try again.";
  } finally {
    setLoading(false);
  }
});
