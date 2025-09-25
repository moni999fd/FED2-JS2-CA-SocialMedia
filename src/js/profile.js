import { BASE, getToken, ensureApiKey } from "./config.js";

const headerEl = document.getElementById("profileHeader");
const avatarEl = document.getElementById("profileAvatar");
const nameEl = document.getElementById("profileName");
const bioEl = document.getElementById("profileBio");
const followersEl = document.getElementById("followersCount");
const followingEl = document.getElementById("followingCount");
const postsWrap = document.getElementById("myPosts");
const logoutBtn = document.getElementById("logoutBtn");

const editForm = document.getElementById("editProfileForm");
const bioInput = document.getElementById("bio");
const avatarUrlInput = document.getElementById("avatarUrl");
const avatarAltInput = document.getElementById("avatarAlt");
const saveStatus = document.getElementById("profileSaveStatus");
const saveError = document.getElementById("profileSaveError");
const saveSuccess = document.getElementById("profileSaveSuccess");

const token = getToken();
if (!token) window.location.href = "login.html";

let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem("user") || "null");
} catch {}
const userName = currentUser?.name;
if (!userName) {
  localStorage.removeItem("accessToken");
  window.location.href = "login.html";
}

function escapeHTML(s = "") {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}
function setHeaderLoading() {
  if (nameEl) nameEl.textContent = "Loading…";
  if (bioEl) bioEl.textContent = "Fetching your profile…";
}
function setPostsLoading() {
  postsWrap.innerHTML = `<p>Loading your posts…</p>`;
}
function setPostsError(message) {
  postsWrap.innerHTML = `
    <div class="card" style="border-left:4px solid #b00020;">
      <p class="error" style="margin:0;">${escapeHTML(message || "Something went wrong loading posts.")}</p>
    </div>
  `;
}
function cardImage(url, alt = "") {
  return url ? `<img src="${url}" alt="${escapeHTML(alt)}" loading="lazy" />` : "";
}

const profileUrl = (name) =>
  `${BASE}/social/profiles/${encodeURIComponent(name)}?_followers=true&_following=true`;
const userPostsUrl = (name) =>
  `${BASE}/social/profiles/${encodeURIComponent(name)}/posts?_author=true&_reactions=true&_comments=true&limit=50`;
const updateProfileUrl = (name) =>
  `${BASE}/social/profiles/${encodeURIComponent(name)}`;

async function getProfile(name) {
  const apiKey = await ensureApiKey();
  const res = await fetch(profileUrl(name), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.message ||
      data?.message ||
      `Failed to load profile (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data?.data;
}

async function getUserPosts(name) {
  const apiKey = await ensureApiKey();
  const res = await fetch(userPostsUrl(name), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.message ||
      data?.message ||
      `Failed to load posts (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data?.data ?? [];
}

async function updateProfile(name, payload) {
  const apiKey = await ensureApiKey();
  const res = await fetch(updateProfileUrl(name), {
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
      `Failed to update profile (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data?.data;
}

function renderHeader(profile) {
  const name = profile?.name || currentUser?.name || "Me";
  const bio = profile?.bio || "No bio yet.";
  const avatarUrl = profile?.avatar?.url || "";

  const followersArr = Array.isArray(profile?.followers) ? profile.followers : [];
  const followingArr = Array.isArray(profile?.following) ? profile.following : [];

  const followersCount =
    typeof profile?._count?.followers === "number" ? profile._count.followers : followersArr.length;
  const followingCount =
    typeof profile?._count?.following === "number" ? profile._count.following : followingArr.length;

  if (avatarEl) {
    if (avatarUrl) {
      avatarEl.src = avatarUrl;
      avatarEl.alt = `${name}'s avatar`;
    } else {
      avatarEl.src =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
            <rect width='100%' height='100%' fill='#ececec'/>
            <circle cx='60' cy='60' r='28' fill='#c4c4c4'/>
          </svg>`
        );
      avatarEl.alt = "Default avatar";
    }
    avatarEl.onerror = () => {
      avatarEl.src =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
            <rect width='100%' height='100%' fill='#ececec'/>
            <circle cx='60' cy='60' r='28' fill='#c4c4c4'/>
          </svg>`
        );
      avatarEl.alt = "Default avatar";
    };
  }

  if (nameEl) nameEl.textContent = name;
  if (bioEl) bioEl.textContent = bio;
  if (followersEl) followersEl.textContent = followersCount;
  if (followingEl) followingEl.textContent = followingCount;

  addFollowerLinks({ followersArr, followingArr });
}

function addFollowerLinks({ followersArr = [], followingArr = [] }) {
  let followersListBox = document.getElementById("followersListBox");
  if (!followersListBox) {
    followersListBox = document.createElement("div");
    followersListBox.id = "followersListBox";
    followersListBox.className = "muted";
    followersListBox.style.margin = ".25rem 0 .5rem";
    if (followersEl && followersEl.parentElement) {
      followersEl.parentElement.insertAdjacentElement("afterend", followersListBox);
    } else if (headerEl) {
      headerEl.appendChild(followersListBox);
    }
  }
  followersListBox.innerHTML =
    followersArr.length > 0
      ? `Followers: ${followersArr
          .map((f) => {
            const n = f?.name || "";
            return n
              ? `<a class="author-link" href="user.html?name=${encodeURIComponent(n)}">${escapeHTML(n)}</a>`
              : "";
          })
          .filter(Boolean)
          .join(", ")}`
      : "Followers: None";

  let followingListBox = document.getElementById("followingListBox");
  if (!followingListBox) {
    followingListBox = document.createElement("div");
    followingListBox.id = "followingListBox";
    followingListBox.className = "muted";
    followingListBox.style.margin = ".25rem 0 1rem";
    if (followingEl && followingEl.parentElement) {
      followingEl.parentElement.insertAdjacentElement("afterend", followingListBox);
    } else if (headerEl) {
      headerEl.appendChild(followingListBox);
    }
  }
  followingListBox.innerHTML =
    followingArr.length > 0
      ? `Following: ${followingArr
          .map((f) => {
            const n = f?.name || "";
            return n
              ? `<a class="author-link" href="user.html?name=${encodeURIComponent(n)}">${escapeHTML(n)}</a>`
              : "";
          })
          .filter(Boolean)
          .join(", ")}`
      : "Following: None";
}

function renderPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    postsWrap.innerHTML = `<p class="muted">You haven’t posted yet. Create your first post!</p>`;
    return;
  }

  postsWrap.innerHTML = `
    <div class="grid-posts" id="myPostsGrid">
      ${posts
        .map((p) => {
          const title = escapeHTML(p.title || "Untitled");
          const body = escapeHTML(p.body || "");
          const media = p.media?.url ? cardImage(p.media.url, p.media.alt || "") : "";
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
            <article class="card">
              <h3>${title}</h3>
              ${media}
              ${body ? `<p style="margin-top:.5rem;">${body}</p>` : ""}
              <p style="margin-top:.5rem;">
                <small>👍 ${reactions} • 💬 ${commentsCount}</small>
              </p>
              <a href="single-post.html?id=${encodeURIComponent(p.id)}" class="button-link" style="display:inline-block;margin-top:.5rem;">Open</a>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});

editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!saveStatus || !saveError || !saveSuccess) return;

  saveError.textContent = "";
  saveSuccess.style.display = "none";
  saveStatus.textContent = "Saving…";

  const payload = {};
  const bioVal = bioInput?.value?.trim();
  if (bioVal) payload.bio = bioVal;

  const avatarUrl = avatarUrlInput?.value?.trim();
  const avatarAlt = avatarAltInput?.value?.trim();
  if (avatarUrl) {
    try {
      const u = new URL(avatarUrl);
      if (u.protocol === "http:" || u.protocol === "https:") {
        payload.avatar = { url: avatarUrl };
        if (avatarAlt) payload.avatar.alt = avatarAlt;
      } else {
        saveError.textContent = "Avatar URL must start with http:// or https://";
        saveStatus.textContent = "";
        return;
      }
    } catch {
      saveError.textContent = "Avatar URL must be a valid URL.";
      saveStatus.textContent = "";
      return;
    }
  } else if (avatarAlt) {
    saveError.textContent = "Please add an Avatar URL to use Avatar Alt text.";
    saveStatus.textContent = "";
    return;
  }

  try {
    const updated = await updateProfile(userName, payload);
    saveSuccess.textContent = "Profile updated!";
    saveSuccess.style.display = "block";
    saveStatus.textContent = "";

    renderHeader(updated);
  } catch (err) {
    saveError.textContent = err?.message || "Could not update profile.";
    saveStatus.textContent = "";
  }
});

(async function init() {
  try {
    setHeaderLoading();
    setPostsLoading();

    const [profile, posts] = await Promise.all([
      getProfile(userName),
      getUserPosts(userName),
    ]);

    renderHeader(profile);
    renderPosts(posts);
  } catch (err) {
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="card" style="border-left:4px solid #b00020;">
          <p class="error" style="margin:0;">${escapeHTML(err?.message || "Failed to load profile.")}</p>
        </div>
      `;
    }
    setPostsError(err?.message);
  }
})();
