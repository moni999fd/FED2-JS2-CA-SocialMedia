const BASE = "https://v2.api.noroff.dev";
const LS_TOKEN = "accessToken";
const LS_API_KEY = "apiKey";

const headerCard = document.getElementById("userHeader");
const avatarEl = document.getElementById("userAvatar");
const nameEl = document.getElementById("userName");
const bioEl = document.getElementById("userBio");
const followersEl = document.getElementById("userFollowers");
const followingEl = document.getElementById("userFollowing");
const postsWrap = document.getElementById("userPosts");
const postsHeading = document.getElementById("postsHeading");
const followBtn = document.getElementById("followBtn");
const unfollowBtn = document.getElementById("unfollowBtn");
const followStatus = document.getElementById("followStatus");

const token = localStorage.getItem(LS_TOKEN);
if (!token) {
  window.location.href = "login.html";
}

let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem("user") || "null"); } catch {}
const currentName = currentUser?.name;

const params = new URLSearchParams(location.search);
const targetName = params.get("name");
if (!targetName) {
  window.location.href = "profile.html";
}

function escapeHTML(s = "") {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

function setHeaderLoading() {
  nameEl.textContent = "Loading…";
  bioEl.textContent = "Fetching profile…";
}

function setPostsLoading() {
  postsWrap.innerHTML = `<p>Loading posts…</p>`;
}

function setPostsError(message) {
  postsWrap.innerHTML = `
    <div class="card" style="border-left:4px solid #b00020;">
      <p class="error" style="margin:0;">${escapeHTML(message || "Could not load posts.")}</p>
    </div>
  `;
}

function cardImage(url, alt = "") {
  return url ? `<img src="${url}" alt="${escapeHTML(alt)}" loading="lazy" />` : "";
}

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
      const msg = payload?.errors?.[0]?.message || payload?.message || `Failed to create API key (HTTP ${res.status} ${res.statusText})`;
      throw new Error(`${msg}${text ? `\n${text}` : ""}`);
    }
  }

  const key = payload?.data?.key;
  if (!key) throw new Error("API key creation returned no key.");
  localStorage.setItem(LS_API_KEY, key);
  return key;
}

const profileUrl = (name) =>
  `${BASE}/social/profiles/${encodeURIComponent(name)}?_followers=true&_following=true`;
const userPostsUrl = (name) =>
  `${BASE}/social/profiles/${encodeURIComponent(name)}/posts?_author=true&_reactions=true&_comments=true&limit=50`;
const followUrl = (name) =>
  `${BASE}/social/profiles/${encodeURIComponent(name)}/follow`;
const unfollowUrl = (name) =>
  `${BASE}/social/profiles/${encodeURIComponent(name)}/unfollow`;

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
    const msg = data?.errors?.[0]?.message || data?.message || `Failed to load profile (HTTP ${res.status})`;
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
    const msg = data?.errors?.[0]?.message || data?.message || `Failed to load posts (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data?.data ?? [];
}

async function follow(name) {
  const apiKey = await ensureApiKey();
  const res = await fetch(followUrl(name), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
  });

  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || `Failed to follow (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data?.data;
}

async function unfollow(name) {
  const apiKey = await ensureApiKey();
  const res = await fetch(unfollowUrl(name), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Noroff-API-Key": apiKey,
    },
  });

  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || `Failed to unfollow (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data?.data;
}

function renderHeader(profile) {
  const name = profile?.name || targetName;
  const bio = profile?.bio || "No bio yet.";
  const avatarUrl = profile?.avatar?.url || "";
  const followersCount = Array.isArray(profile?.followers)
    ? profile.followers.length
    : (profile?._count?.followers ?? profile?.followers?.length ?? 0);
  const followingCount = Array.isArray(profile?.following)
    ? profile.following.length
    : (profile?._count?.following ?? profile?.following?.length ?? 0);

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

  nameEl.textContent = name;
  bioEl.textContent = bio;
  followersEl.textContent = followersCount;
  followingEl.textContent = followingCount;

  const amIFollowing = Array.isArray(profile?.followers)
    ? profile.followers.some(f => f?.name === currentName)
    : false;

  setFollowButtons(amIFollowing);
}

function setFollowButtons(isFollowing) {
  if (currentName === targetName) {
    followBtn.style.display = "none";
    unfollowBtn.style.display = "none";
    return;
  }
  followBtn.style.display = isFollowing ? "none" : "inline-block";
  unfollowBtn.style.display = isFollowing ? "inline-block" : "none";
}

function renderPosts(posts) {
  postsHeading.textContent = `${targetName}'s Posts`;
  if (!Array.isArray(posts) || posts.length === 0) {
    postsWrap.innerHTML = `<p class="muted">No posts yet.</p>`;
    return;
  }

  postsWrap.innerHTML = `
    <div class="grid-posts">
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

followBtn?.addEventListener("click", async () => {
  followStatus.textContent = "";
  try {
    followBtn.disabled = true;
    followStatus.textContent = "Following…";
    await follow(targetName);
    followStatus.textContent = "Followed!";
    setFollowButtons(true);
    const p = await getProfile(targetName);
    renderHeader(p);
    setTimeout(() => (followStatus.textContent = ""), 1200);
  } catch (err) {
    followStatus.textContent = err.message || "Could not follow.";
  } finally {
    followBtn.disabled = false;
  }
});

unfollowBtn?.addEventListener("click", async () => {
  followStatus.textContent = "";
  try {
    unfollowBtn.disabled = true;
    followStatus.textContent = "Unfollowing…";
    await unfollow(targetName);
    followStatus.textContent = "Unfollowed.";
    setFollowButtons(false);
    const p = await getProfile(targetName);
    renderHeader(p);
    setTimeout(() => (followStatus.textContent = ""), 1200);
  } catch (err) {
    followStatus.textContent = err.message || "Could not unfollow.";
  } finally {
    unfollowBtn.disabled = false;
  }
});

(async function init() {
  try {
    setHeaderLoading();
    setPostsLoading();

    const [profile, posts] = await Promise.all([
      getProfile(targetName),
      getUserPosts(targetName),
    ]);

    renderHeader(profile);
    renderPosts(posts);
  } catch (err) {
    console.error("[user-profile] error:", err);
    headerCard.innerHTML = `
      <div class="card" style="border-left:4px solid #b00020;">
        <p class="error" style="margin:0;">${escapeHTML(err?.message || "Failed to load user profile.")}</p>
      </div>
    `;
    setPostsError(err?.message);
  }
})();
