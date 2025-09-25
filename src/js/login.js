const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const errorEl = document.getElementById("loginError");
const successEl = document.getElementById("loginSuccess");
const submitBtn = form?.querySelector('button[type="submit"]');

const BASE = "https://v2.api.noroff.dev";

/**
 * Log a user in via Noroff Auth API.
 * @param {{email:string, password:string}} payload
 * @returns {Promise<{accessToken:string,name:string,email:string}>}
 */
async function login(payload) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.message ||
      data?.message ||
      `Login failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data?.data ?? {};
}

function onLoginSuccess(auth) {
  localStorage.setItem("accessToken", auth.accessToken);
  localStorage.setItem("user", JSON.stringify({ name: auth.name, email: auth.email }));


  if (successEl) {
    successEl.textContent = `🎉 Welcome back, ${auth.name || "friend"}! Redirecting to your feed…`;
    successEl.style.display = "block";
  }

  setTimeout(() => {
    window.location.href = "feed.html";
  }, 1500);
}

function setLoading(loading) {
  if (!submitBtn) return;
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? "Logging in…" : "Login";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  if (successEl) successEl.style.display = "none";

  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();

  if (!email || !password) {
    errorEl.textContent = "Please enter both email and password.";
    return;
  }

  try {
    setLoading(true);
    const auth = await login({ email, password });
    onLoginSuccess(auth);
  } catch (err) {
    errorEl.textContent = err.message || "Something went wrong. Please try again.";
  } finally {
    setLoading(false);
  }
});
