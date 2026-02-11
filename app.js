const USE_MOCK = true;
const STORAGE_KEYS = {
  userEmail: "bw_userEmail",
  userPassword: "bw_userPassword",
  isLoggedIn: "bw_isLoggedIn",
  polls: "bw_polls"
};

// ==================== API Layer ====================
const api = {
  async getPolls() {
    if (!USE_MOCK) {
      return fetch("./api/polls").then((r) => r.json());
    }
    return loadPolls();
  },
  async getPoll(id) {
    if (!USE_MOCK) {
      return fetch(`./api/polls/${id}`).then((r) => r.json());
    }
    return loadPolls().find((poll) => poll.id === id);
  },
  async createPoll(payload) {
    if (!USE_MOCK) {
      return fetch("./api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then((r) => r.json());
    }
    const polls = loadPolls();
    polls.unshift(payload);
    savePolls(polls);
    return payload;
  },
  async updatePoll(id, updates) {
    if (!USE_MOCK) {
      return fetch(`./api/polls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      }).then((r) => r.json());
    }
    const polls = loadPolls();
    const index = polls.findIndex((poll) => poll.id === id);
    if (index === -1) return null;
    polls[index] = { ...polls[index], ...updates };
    savePolls(polls);
    return polls[index];
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

function isRegistered() {
  return !!localStorage.getItem(STORAGE_KEYS.userEmail);
}

function isLoggedIn() {
  return localStorage.getItem(STORAGE_KEYS.isLoggedIn) === "true";
}

function getRegisteredEmail() {
  return localStorage.getItem(STORAGE_KEYS.userEmail);
}

function getRegisteredPassword() {
  return localStorage.getItem(STORAGE_KEYS.userPassword);
}

function register(email, password) {
  localStorage.setItem(STORAGE_KEYS.userEmail, email.trim().toLowerCase());
  localStorage.setItem(STORAGE_KEYS.userPassword, password);
  localStorage.setItem(STORAGE_KEYS.isLoggedIn, "true");
}

function login() {
  localStorage.setItem(STORAGE_KEYS.isLoggedIn, "true");
}

function logout() {
  localStorage.setItem(STORAGE_KEYS.isLoggedIn, "false");
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

  // Check if already registered
  if (isRegistered()) {
    form.innerHTML = `
      <div class="alert alert--info">Du bist bereits registriert. Bitte melde dich an.</div>
      <a href="./login.html" class="button button--full">Zum Login</a>
    `;
    return;
  }

  form.addEventListener("submit", (event) => {
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

    // Register and login
    register(email, password);
    window.location.href = "./polls.html";
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

  // Check if not registered
  if (!isRegistered()) {
    showAlert(card, "Du hast noch keinen Account. Bitte registriere dich zuerst.", "info");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    const registeredEmail = getRegisteredEmail();
    const registeredPassword = getRegisteredPassword();

    // Check if registered
    if (!registeredEmail) {
      showAlert(card, "Kein Account gefunden. Bitte registriere dich zuerst.");
      return;
    }

    // Check email
    if (email !== registeredEmail) {
      showAlert(card, "E-Mail-Adresse stimmt nicht überein.");
      emailInput.classList.add("input--error");
      return;
    }

    // Check password
    if (password !== registeredPassword) {
      showAlert(card, "Falsches Passwort.");
      passwordInput.classList.add("input--error");
      return;
    }

    // Login successful
    login();
    window.location.href = "./polls.html";
  });

  // Remove error styling on input
  emailInput.addEventListener("input", () => emailInput.classList.remove("input--error"));
  passwordInput.addEventListener("input", () => passwordInput.classList.remove("input--error"));
}

// ==================== Page: Polls ====================
async function initPolls() {
  if (!requireLogin(true)) return;
  
  const list = document.querySelector("[data-poll-list]");
  const userEmail = getRegisteredEmail();
  const polls = await api.getPolls();
  list.innerHTML = "";

  if (!polls.length) {
    list.innerHTML = '<div class="card card--soft"><p class="mb-0">Noch keine Abstimmungen vorhanden.</p></div>';
    return;
  }

  polls.forEach((poll) => {
    const voted = hasVoted(poll, userEmail);
    const results = updateResults(poll);
    
    const card = document.createElement("div");
    card.className = "card card--clickable poll-card";
    card.innerHTML = `
      <div class="poll-card__header">
        <h3 class="poll-card__title">${poll.title}</h3>
        <span class="badge ${poll.active ? "badge--active" : "badge--closed"}">
          ${poll.active ? "Aktiv" : "Geschlossen"}
        </span>
      </div>
      <p class="poll-card__question">${poll.question}</p>
      <div class="poll-card__meta">
        <span class="text-small text-muted">${results.total} Stimmen · ${formatDate(poll.createdAt)}</span>
        <span class="text-small ${voted ? "text-muted" : ""}">${voted ? "✓ Abgestimmt" : "Noch nicht abgestimmt"}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `./vote.html?id=${poll.id}`;
    });
    list.appendChild(card);
  });
}

// ==================== Page: Vote ====================
async function initVote() {
  if (!requireLogin(true)) return;
  
  const userEmail = getRegisteredEmail();
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
  question.textContent = poll.question;
  status.textContent = poll.active ? "Aktiv" : "Geschlossen";
  status.className = `badge ${poll.active ? "badge--active" : "badge--closed"}`;

  const voted = hasVoted(poll, userEmail);

  voteSection.classList.toggle("hidden", !poll.active || voted);
  resultSection.classList.toggle("hidden", !voted && poll.active);

  const renderResults = () => {
    const results = updateResults(poll);
    info.textContent = `${results.total} Stimmen insgesamt`;
    yesBar.style.width = `${results.yesPercent}%`;
    noBar.style.width = `${results.noPercent}%`;
    yesPercentEl.textContent = `${results.yesPercent}% Ja (${results.yes})`;
    noPercentEl.textContent = `${results.noPercent}% Nein (${results.no})`;
  };

  renderResults();

  const buttons = document.querySelectorAll("[data-vote]");
  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (!poll.active || hasVoted(poll, userEmail)) return;
      const choice = button.dataset.vote;
      if (choice === "yes") {
        poll.votes.yes.push(userEmail);
      } else {
        poll.votes.no.push(userEmail);
      }
      await api.updatePoll(poll.id, { votes: poll.votes });
      voteSection.classList.add("hidden");
      resultSection.classList.remove("hidden");
      renderResults();
    });
  });
}

// ==================== Page: Admin ====================
async function initAdmin() {
  if (!requireLogin(true)) return;
  
  const list = document.querySelector("[data-admin-list]");
  const form = document.querySelector("[data-admin-form]");
  const titleInput = document.querySelector("[data-admin-title]");
  const questionInput = document.querySelector("[data-admin-question]");

  const render = async () => {
    const polls = await api.getPolls();
    list.innerHTML = "";
    polls.forEach((poll) => {
      const results = updateResults(poll);
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="poll-card__header">
          <div>
            <h3 class="poll-card__title">${poll.title}</h3>
            <p class="poll-card__question mb-0">${poll.question}</p>
          </div>
          <span class="badge ${poll.active ? "badge--active" : "badge--closed"}">
            ${poll.active ? "Aktiv" : "Geschlossen"}
          </span>
        </div>
        <div class="text-small text-muted mt-2">${results.total} Stimmen · ${formatDate(poll.createdAt)}</div>
        <div class="grid grid--2 mt-3">
          <button class="button button--secondary button--small" data-action="toggle" data-id="${poll.id}">
            ${poll.active ? "Deaktivieren" : "Aktivieren"}
          </button>
          <button class="button button--ghost button--small" data-action="reset" data-id="${poll.id}">Stimmen zurücksetzen</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.id;
        const action = button.dataset.action;
        const poll = await api.getPoll(id);
        if (!poll) return;
        if (action === "toggle") {
          await api.updatePoll(id, { active: !poll.active });
        }
        if (action === "reset") {
          await api.updatePoll(id, { votes: { yes: [], no: [] } });
        }
        render();
      });
    });
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const question = questionInput.value.trim();
    if (!title || !question) return;
    const poll = {
      id: crypto.randomUUID(),
      title,
      question,
      active: true,
      createdAt: new Date().toISOString(),
      votes: { yes: [], no: [] }
    };
    await api.createPoll(poll);
    titleInput.value = "";
    questionInput.value = "";
    render();
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
if (page === "polls") initPolls();
if (page === "vote") initVote();
if (page === "admin") initAdmin();

// Always init logout button if present
initLogout();
