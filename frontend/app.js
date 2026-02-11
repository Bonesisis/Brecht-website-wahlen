const USE_MOCK = false;
const API_BASE = "http://localhost:3000/api";
const STORAGE_KEYS = {
  token: "bw_token",
  userEmail: "bw_userEmail",
  userId: "bw_userId"
};

// ==================== Token Management ====================
function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function setToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token);
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEYS.token);
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// ==================== API Layer ====================
const api = {
  // Auth
  async register(email, password) {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok && !data.requiresVerification) {
      throw new Error(data.message || "Registrierung fehlgeschlagen");
    }
    return data;
  },

  async verify(email, code) {
    const res = await fetch(`${API_BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Bestätigung fehlgeschlagen");
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    // Bei requiresVerification nicht als Fehler werfen
    if (!res.ok && !data.requiresVerification) {
      throw new Error(data.message || "Login fehlgeschlagen");
    }
    return data;
  },

  // Polls
  async getPolls() {
    if (USE_MOCK) return loadPolls();
    const res = await fetch(`${API_BASE}/polls`);
    return res.json();
  },

  async getPoll(id) {
    if (USE_MOCK) return loadPolls().find((poll) => poll.id === id);
    const res = await fetch(`${API_BASE}/polls/${id}`);
    if (!res.ok) return null;
    return res.json();
  },

  async getResults(pollId) {
    const res = await fetch(`${API_BASE}/results?poll_id=${pollId}`);
    return res.json();
  },

  // Voting
  async vote(pollId, choice) {
    const res = await fetch(`${API_BASE}/vote`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify({ poll_id: pollId, choice })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Abstimmung fehlgeschlagen");
    return data;
  },

  // Admin (mit Admin-Code Header)
  async createPoll(title, adminCode) {
    if (USE_MOCK) {
      const polls = loadPolls();
      const payload = {
        id: crypto.randomUUID(),
        title,
        active: true,
        createdAt: new Date().toISOString(),
        votes: { yes: [], no: [] }
      };
      polls.unshift(payload);
      savePolls(polls);
      return { poll: payload };
    }
    const res = await fetch(`${API_BASE}/admin/polls`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Code": adminCode
      },
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Erstellen fehlgeschlagen");
    return data;
  },

  async updatePoll(id, updates, adminCode) {
    if (USE_MOCK) {
      const polls = loadPolls();
      const index = polls.findIndex((poll) => poll.id === id);
      if (index === -1) return null;
      polls[index] = { ...polls[index], ...updates };
      savePolls(polls);
      return { poll: polls[index] };
    }
    const res = await fetch(`${API_BASE}/admin/polls/${id}`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Code": adminCode
      },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Update fehlgeschlagen");
    return data;
  },

  async deletePoll(id, adminCode) {
    const res = await fetch(`${API_BASE}/admin/polls/${id}`, {
      method: "DELETE",
      headers: { "X-Admin-Code": adminCode }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Löschen fehlgeschlagen");
    return data;
  }
};

// ==================== Poll Storage ====================
function loadPolls() {
  const raw = localStorage.getItem(STORAGE_KEYS.polls);
  if (!raw) return seedPolls();
  try {
    return JSON.parse(raw);
  } catch (error) {
    return seedPolls();
  }
}

function savePolls(polls) {
  localStorage.setItem(STORAGE_KEYS.polls, JSON.stringify(polls));
}

function seedPolls() {
  const initial = [
    {
      id: crypto.randomUUID(),
      title: "Mehr Sitzmöglichkeiten im Innenhof",
      question: "Soll der Innenhof zusätzliche Sitzmöglichkeiten bekommen?",
      active: true,
      createdAt: new Date().toISOString(),
      votes: { yes: [], no: [] }
    },
    {
      id: crypto.randomUUID(),
      title: "Handyregelung in der Pause",
      question: "Sollen Handys in der ersten großen Pause erlaubt sein?",
      active: false,
      createdAt: new Date().toISOString(),
      votes: { yes: [], no: [] }
    }
  ];
  savePolls(initial);
  return initial;
}

// ==================== Auth Functions ====================
function isValidSchoolEmail(email) {
  // Must end with @brecht-schulen.de
  // Must have at least one dot before @
  const regex = /^[a-zA-ZäöüÄÖÜß]+\.[a-zA-ZäöüÄÖÜß]+@brecht-schulen\.de$/i;
  return regex.test(email.trim());
}

function isLoggedIn() {
  return !!getToken();
}

function getRegisteredEmail() {
  return localStorage.getItem(STORAGE_KEYS.userEmail);
}

function getUserId() {
  return localStorage.getItem(STORAGE_KEYS.userId);
}

function saveUser(token, email, userId) {
  setToken(token);
  localStorage.setItem(STORAGE_KEYS.userEmail, email);
  localStorage.setItem(STORAGE_KEYS.userId, userId);
}

function logout() {
  clearToken();
  localStorage.removeItem(STORAGE_KEYS.userEmail);
  localStorage.removeItem(STORAGE_KEYS.userId);
}

function requireLogin(redirectMessage = false) {
  if (!isLoggedIn()) {
    const url = redirectMessage 
      ? "./login.html?redirect=true" 
      : "./login.html";
    window.location.href = url;
    return false;
  }
  return true;
}

// ==================== Helper Functions ====================
function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function hasVoted(poll, userEmail) {
  return poll.votes.yes.includes(userEmail) || poll.votes.no.includes(userEmail);
}

function countVotes(poll) {
  const yes = poll.votes.yes.length;
  const no = poll.votes.no.length;
  const total = yes + no;
  return { yes, no, total };
}

function updateResults(poll) {
  const { yes, no, total } = countVotes(poll);
  const yesPercent = total === 0 ? 0 : Math.round((yes / total) * 100);
  const noPercent = total === 0 ? 0 : 100 - yesPercent;
  return { yes, no, total, yesPercent, noPercent };
}

function showAlert(container, message, type = "error") {
  const existing = container.querySelector(".alert");
  if (existing) existing.remove();
  
  const alert = document.createElement("div");
  alert.className = `alert alert--${type}`;
  alert.textContent = message;
  container.prepend(alert);
}

// ==================== Page: Index (Startseite) ====================
async function initIndex() {
  const list = document.querySelector("[data-poll-list]");
  if (!list) return;
  
  const polls = await api.getPolls();
  const activePolls = polls.filter(p => p.active);
  list.innerHTML = "";

  if (!activePolls.length) {
    list.innerHTML = '<div class="card card--soft"><p class="mb-0">Aktuell keine aktiven Abstimmungen.</p></div>';
    return;
  }

  activePolls.forEach((poll) => {
    const userEmail = getRegisteredEmail();
    const voted = userEmail ? hasVoted(poll, userEmail) : false;
    const results = updateResults(poll);
    
    const card = document.createElement("div");
    card.className = "card poll-card";
    card.innerHTML = `
      <div class="poll-card__header">
        <h3 class="poll-card__title">${poll.title}</h3>
        <span class="badge badge--active">Aktiv</span>
      </div>
      <p class="poll-card__question">${poll.question}</p>
      <div class="poll-card__meta">
        <span class="text-small text-muted">${results.total} Stimmen · ${formatDate(poll.createdAt)}</span>
        <a href="${isLoggedIn() ? `./vote.html?id=${poll.id}` : './login.html?redirect=true'}" class="button button--small">
          ${voted ? "Ergebnis ansehen" : "Abstimmen"}
        </a>
      </div>
    `;
    list.appendChild(card);
  });
}

// ==================== Page: Register ====================
function initRegister() {
  const form = document.querySelector("[data-register-form]");
  const emailInput = document.querySelector("[data-register-email]");
  const passwordInput = document.querySelector("[data-register-password]");
  const card = document.querySelector("[data-register-card]");
  
  if (!form) return;

  // Check if already logged in
  if (isLoggedIn()) {
    form.innerHTML = `
      <div class="alert alert--info">Du bist bereits angemeldet.</div>
      <a href="./polls.html" class="button button--full">Zu den Abstimmungen</a>
    `;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validate email format
    if (!isValidSchoolEmail(email)) {
      showAlert(card, "Bitte nutze deine Schul-E-Mail im Format vorname.nachname@brecht-schulen.de");
      emailInput.classList.add("input--error");
      return;
    }

    // Validate password
    if (password.length < 4) {
      showAlert(card, "Bitte wähle ein Passwort mit mindestens 4 Zeichen.");
      passwordInput.classList.add("input--error");
      return;
    }

    try {
      const data = await api.register(email, password);
      
      // Weiterleitung zur Bestätigungsseite
      if (data.requiresVerification) {
        localStorage.setItem("bw_pendingEmail", data.email);
        window.location.href = "./verify.html";
        return;
      }
      
      // Falls direkt eingeloggt (sollte nicht mehr passieren)
      if (data.token) {
        saveUser(data.token, data.user.email, data.user.id);
        window.location.href = "./polls.html";
      }
    } catch (error) {
      showAlert(card, error.message);
    }
  });

  // Remove error styling on input
  emailInput.addEventListener("input", () => emailInput.classList.remove("input--error"));
  passwordInput.addEventListener("input", () => passwordInput.classList.remove("input--error"));
}

// ==================== Page: Login ====================
function initLogin() {
  const form = document.querySelector("[data-login-form]");
  const emailInput = document.querySelector("[data-login-email]");
  const passwordInput = document.querySelector("[data-login-password]");
  const card = document.querySelector("[data-login-card]");
  
  if (!form) return;

  // Show redirect message if needed
  const params = new URLSearchParams(window.location.search);
  if (params.get("redirect") === "true") {
    showAlert(card, "Du musst dich erst anmelden, um abzustimmen.", "info");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    try {
      const data = await api.login(email, password);
      
      // Falls Verifizierung nötig
      if (data.requiresVerification) {
        localStorage.setItem("bw_pendingEmail", data.email);
        showAlert(card, data.message, "info");
        setTimeout(() => {
          window.location.href = "./verify.html";
        }, 1500);
        return;
      }
      
      saveUser(data.token, data.user.email, data.user.id);
      window.location.href = "./polls.html";
    } catch (error) {
      showAlert(card, error.message);
      emailInput.classList.add("input--error");
      passwordInput.classList.add("input--error");
    }
  });

  // Remove error styling on input
  emailInput.addEventListener("input", () => emailInput.classList.remove("input--error"));
  passwordInput.addEventListener("input", () => passwordInput.classList.remove("input--error"));
}

// ==================== Page: Verify ====================
function initVerify() {
  const form = document.querySelector("[data-verify-form]");
  const emailInput = document.querySelector("[data-verify-email]");
  const codeInput = document.querySelector("[data-verify-code]");
  const card = document.querySelector("[data-verify-card]");
  const resendBtn = document.querySelector("[data-resend]");
  
  if (!form) return;

  // E-Mail aus localStorage laden
  const pendingEmail = localStorage.getItem("bw_pendingEmail");
  if (!pendingEmail) {
    window.location.href = "./register.html";
    return;
  }
  
  emailInput.value = pendingEmail;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = codeInput.value.trim();

    if (code.length !== 6) {
      showAlert(card, "Bitte gib den 6-stelligen Code ein.");
      codeInput.classList.add("input--error");
      return;
    }

    try {
      const data = await api.verify(pendingEmail, code);
      localStorage.removeItem("bw_pendingEmail");
      saveUser(data.token, data.user.email, data.user.id);
      showAlert(card, "E-Mail erfolgreich bestätigt!", "success");
      setTimeout(() => {
        window.location.href = "./polls.html";
      }, 1000);
    } catch (error) {
      showAlert(card, error.message);
      codeInput.classList.add("input--error");
    }
  });

  // Code erneut senden
  resendBtn.addEventListener("click", async () => {
    try {
      // Erneute Registrierung triggert neuen Code
      await api.register(pendingEmail, "dummy-resend");
      showAlert(card, "Neuer Code wurde gesendet. Schau in die Server-Konsole.", "success");
    } catch (error) {
      showAlert(card, "Neuer Code wurde gesendet. Schau in die Server-Konsole.", "success");
    }
  });

  codeInput.addEventListener("input", () => codeInput.classList.remove("input--error"));
}

// ==================== Page: Polls ====================
async function initPolls() {
  if (!requireLogin(true)) return;
  
  const list = document.querySelector("[data-poll-list]");
  const polls = await api.getPolls();
  list.innerHTML = "";

  if (!polls.length) {
    list.innerHTML = '<div class="card card--soft"><p class="mb-0">Noch keine Abstimmungen vorhanden.</p></div>';
    return;
  }

  // Für jede Abstimmung die Ergebnisse laden
  for (const poll of polls) {
    let results = { yes: 0, no: 0, total: 0 };
    try {
      results = await api.getResults(poll.id);
    } catch (e) { /* ignore */ }
    
    const yesPercent = results.total === 0 ? 0 : Math.round((results.yes / results.total) * 100);
    const noPercent = results.total === 0 ? 0 : 100 - yesPercent;
    
    const card = document.createElement("div");
    card.className = "card card--clickable poll-card";
    card.innerHTML = `
      <div class="poll-card__header">
        <h3 class="poll-card__title">${poll.title}</h3>
        <span class="badge ${poll.active ? "badge--active" : "badge--closed"}">
          ${poll.active ? "Aktiv" : "Geschlossen"}
        </span>
      </div>
      <div class="poll-card__meta">
        <span class="text-small text-muted">${results.total} Stimmen · ${formatDate(poll.created_at)}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `./vote.html?id=${poll.id}`;
    });
    list.appendChild(card);
  }
}

// ==================== Page: Vote ====================
async function initVote() {
  if (!requireLogin(true)) return;
  
  const params = new URLSearchParams(window.location.search);
  const pollId = params.get("id");
  
  if (!pollId) {
    window.location.href = "./polls.html";
    return;
  }

  const poll = await api.getPoll(pollId);
  if (!poll) {
    window.location.href = "./polls.html";
    return;
  }

  const title = document.querySelector("[data-poll-title]");
  const question = document.querySelector("[data-poll-question]");
  const status = document.querySelector("[data-poll-status]");
  const voteSection = document.querySelector("[data-vote-section]");
  const resultSection = document.querySelector("[data-result-section]");
  const info = document.querySelector("[data-result-info]");
  const yesBar = document.querySelector("[data-yes-bar]");
  const noBar = document.querySelector("[data-no-bar]");
  const yesPercentEl = document.querySelector("[data-yes-percent]");
  const noPercentEl = document.querySelector("[data-no-percent]");

  title.textContent = poll.title;
  question.textContent = poll.title; // Backend hat nur title, keine separate question
  status.textContent = poll.active ? "Aktiv" : "Geschlossen";
  status.className = `badge ${poll.active ? "badge--active" : "badge--closed"}`;

  // Zeige erst Voting-Buttons, nach Abstimmung oder bei geschlossener Poll die Ergebnisse
  let hasVotedAlready = false;
  voteSection.classList.remove("hidden");
  resultSection.classList.add("hidden");

  const renderResults = async () => {
    const results = await api.getResults(pollId);
    const yesPercent = results.total === 0 ? 0 : Math.round((results.yes / results.total) * 100);
    const noPercent = results.total === 0 ? 0 : 100 - yesPercent;
    
    info.textContent = `${results.total} Stimmen insgesamt`;
    yesBar.style.width = `${yesPercent}%`;
    noBar.style.width = `${noPercent}%`;
    yesPercentEl.textContent = `${yesPercent}% Ja (${results.yes})`;
    noPercentEl.textContent = `${noPercent}% Nein (${results.no})`;
  };

  // Bei geschlossener Poll direkt Ergebnisse zeigen
  if (!poll.active) {
    voteSection.classList.add("hidden");
    resultSection.classList.remove("hidden");
    await renderResults();
    return;
  }

  const buttons = document.querySelectorAll("[data-vote]");
  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (hasVotedAlready) return;
      const choice = button.dataset.vote;
      
      try {
        await api.vote(pollId, choice);
        hasVotedAlready = true;
        voteSection.classList.add("hidden");
        resultSection.classList.remove("hidden");
        await renderResults();
      } catch (error) {
        // Wenn bereits abgestimmt, zeige Ergebnisse
        if (error.message.includes("bereits")) {
          hasVotedAlready = true;
          voteSection.classList.add("hidden");
          resultSection.classList.remove("hidden");
          await renderResults();
        } else {
          showAlert(document.querySelector(".container"), error.message);
        }
      }
    });
  });
}

// ==================== Page: Admin ====================
async function initAdmin() {
  const list = document.querySelector("[data-admin-list]");
  const form = document.querySelector("[data-admin-form]");
  const titleInput = document.querySelector("[data-admin-title]");
  const adminCodeInput = document.querySelector("[data-admin-code]");
  const container = document.querySelector(".container");

  // Admin-Code aus localStorage (einmal eingeben, dann speichern)
  let adminCode = localStorage.getItem("bw_adminCode") || "";

  const render = async () => {
    try {
      const polls = await api.getPolls();
      list.innerHTML = "";
      
      for (const poll of polls) {
        let results = { yes: 0, no: 0, total: 0 };
        try {
          results = await api.getResults(poll.id);
        } catch (e) { /* ignore */ }
        
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="poll-card__header">
            <div>
              <h3 class="poll-card__title">${poll.title}</h3>
            </div>
            <span class="badge ${poll.active ? "badge--active" : "badge--closed"}">
              ${poll.active ? "Aktiv" : "Geschlossen"}
            </span>
          </div>
          <div class="text-small text-muted mt-2">${results.total} Stimmen · ${formatDate(poll.created_at)}</div>
          <div class="grid grid--2 mt-3">
            <button class="button button--secondary button--small" data-action="toggle" data-id="${poll.id}">
              ${poll.active ? "Deaktivieren" : "Aktivieren"}
            </button>
            <button class="button button--ghost button--small" data-action="delete" data-id="${poll.id}">Löschen</button>
          </div>
        `;
        list.appendChild(card);
      }

      list.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.dataset.id;
          const action = button.dataset.action;
          
          if (!adminCode) {
            adminCode = prompt("Bitte Admin-Code eingeben:");
            if (!adminCode) return;
            localStorage.setItem("bw_adminCode", adminCode);
          }

          try {
            if (action === "toggle") {
              const poll = await api.getPoll(id);
              if (!poll) return;
              await api.updatePoll(id, { active: !poll.active }, adminCode);
            }
            if (action === "delete") {
              if (!confirm("Abstimmung wirklich löschen?")) return;
              await api.deletePoll(id, adminCode);
            }
            render();
          } catch (error) {
            showAlert(container, error.message);
            // Bei falschem Code, Code löschen
            if (error.message.includes("Admin")) {
              localStorage.removeItem("bw_adminCode");
              adminCode = "";
            }
          }
        });
      });
    } catch (error) {
      list.innerHTML = '<div class="alert alert--error">Fehler beim Laden der Abstimmungen</div>';
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;

    if (!adminCode) {
      adminCode = prompt("Bitte Admin-Code eingeben:");
      if (!adminCode) return;
      localStorage.setItem("bw_adminCode", adminCode);
    }

    try {
      await api.createPoll(title, adminCode);
      titleInput.value = "";
      render();
    } catch (error) {
      showAlert(container, error.message);
      if (error.message.includes("Admin")) {
        localStorage.removeItem("bw_adminCode");
        adminCode = "";
      }
    }
  });

  render();
}

// ==================== Logout Handler ====================
function initLogout() {
  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
      window.location.href = "./index.html";
    });
  }
}

// ==================== Page Router ====================
const page = document.body?.dataset.page;
if (page === "index") initIndex();
if (page === "register") initRegister();
if (page === "login") initLogin();
if (page === "verify") initVerify();
if (page === "polls") initPolls();
if (page === "vote") initVote();
if (page === "admin") initAdmin();

// Always init logout button if present
initLogout();
