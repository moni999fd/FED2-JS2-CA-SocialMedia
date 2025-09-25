const form = document.getElementById("registerForm");
const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const errEl = document.getElementById("registerError");
const successEl = document.getElementById("registerSuccess");
const submitBtn = form?.querySelector('button[type="submit"]');

const BASE = "https://v2.api.noroff.dev";
const ALLOWED_DOMAIN = "@stud.noroff.no";

function friendlyError(message = "") {
  const m = message.toLowerCase();
  if (m.includes("already exists")) return "That email is already registered. Try logging in instead.";
  if (m.includes("stud.noroff.no")) return "Use your @stud.noroff.no student email to register.";
  if (m.includes("password")) return "Password must be at least 8 characters.";
  return message || "Registration failed. Please try again.";
}

/**
 * Registers a new user on the Noroff API.
 * @async
 * @param {Object} payload - The user registration data.
 * @param {string} payload.name - The username.
 * @param {string} payload.email - The user's email (must end with @stud.noroff.no).
 * @param {string} payload.password - The user's password (min 8 chars).
 * @returns {Promise<Object>} The created user data.
 * @throws {Error} If the registration fails.
 */
async function register(payload) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || `Registration failed (HTTP ${res.status})`;
    throw new Error(friendlyError(msg));
  }

  return data?.data ?? {};
}

function setLoading(loading) {
  if (!submitBtn) return;
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? "Creating account…" : "Create Account";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.textContent = "";
  if (successEl) {
    successEl.textContent = "";
    successEl.style.display = "none";
  }

  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();

  if (!name || !email || !password) {
    errEl.textContent = "Please fill in name, email, and password.";
    return;
  }
  if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    errEl.textContent = "Use your @stud.noroff.no student email to register.";
    emailEl.focus();
    return;
  }
  if (password.length < 8) {
    errEl.textContent = "Password must be at least 8 characters.";
    passwordEl.focus();
    return;
  }

  try {
    setLoading(true);
    await register({ name, email, password });

    if (successEl) {
      successEl.textContent = "🎉 Account created successfully! Redirecting to login…";
      successEl.style.display = "block";
    }

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1800);
  } catch (err) {
    errEl.textContent = err.message || "Something went wrong. Please try again.";
  } finally {
    setLoading(false);
  }
});
