const USE_MOCK = true;
const STORAGE_KEYS = {
  user: "bw_user",
  polls: "bw_polls"
};

const api = {
  async getPolls() {
    if (!USE_MOCK) {
      return fetch("/api/polls").then((r) => r.json());
    }
    return loadPolls();
  },
  async getPoll(id) {
    if (!USE_MOCK) {
      return fetch(`/api/polls/${id}`).then((r) => r.json());
    }
    return loadPolls().find((poll) => poll.id === id);
  },
  async createPoll(payload) {
    if (!USE_MOCK) {
      return fetch("/api/polls", {
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
      return fetch(`/api/polls/${id}`, {
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

function getUserName() {
  return localStorage.getItem(STORAGE_KEYS.user);
}

function setUserName(name) {
  localStorage.setItem(STORAGE_KEYS.user, name.trim());
}

function requireUser() {
  const user = getUserName();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  return user;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function hasVoted(poll, user) {
  return poll.votes.yes.includes(user) || poll.votes.no.includes(user);
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

function initLogin() {
  const form = document.querySelector("[data-login-form]");
  const input = document.querySelector("[data-login-input]");
  const cached = getUserName();
  if (cached) input.value = cached;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    setUserName(name);
    window.location.href = "polls.html";
  });
}

async function initPolls() {
  const user = requireUser();
  if (!user) return;
  const list = document.querySelector("[data-poll-list]");
  const polls = await api.getPolls();
  list.innerHTML = "";

  if (!polls.length) {
    list.innerHTML = "<div class=\"card card--soft\">Noch keine Abstimmungen vorhanden.</div>";
    return;
  }

  polls.forEach((poll) => {
    const card = document.createElement("div");
    card.className = "card poll-card";
    card.innerHTML = `
      <div class="flex">
        <h3>${poll.title}</h3>
        <span class="badge ${poll.active ? "badge--active" : "badge--closed"}">
          ${poll.active ? "Aktiv" : "Geschlossen"}
        </span>
      </div>
      <p>${poll.question}</p>
      <div class="flex">
        <span class="helper">${formatDate(poll.createdAt)}</span>
        <span class="helper">${hasVoted(poll, user) ? "Bereits abgestimmt" : "Noch nicht abgestimmt"}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `vote.html?id=${poll.id}`;
    });
    list.appendChild(card);
  });
}

async function initVote() {
  const user = requireUser();
  if (!user) return;
  const params = new URLSearchParams(window.location.search);
  const pollId = params.get("id");
  if (!pollId) {
    window.location.href = "polls.html";
    return;
  }

  const poll = await api.getPoll(pollId);
  if (!poll) {
    window.location.href = "polls.html";
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

  const voted = hasVoted(poll, user);

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
      if (!poll.active || hasVoted(poll, user)) return;
      const choice = button.dataset.vote;
      if (choice === "yes") {
        poll.votes.yes.push(user);
      } else {
        poll.votes.no.push(user);
      }
      await api.updatePoll(poll.id, { votes: poll.votes });
      voteSection.classList.add("hidden");
      resultSection.classList.remove("hidden");
      renderResults();
    });
  });
}

async function initAdmin() {
  const user = requireUser();
  if (!user) return;
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
        <div class="flex">
          <div>
            <h3>${poll.title}</h3>
            <p>${poll.question}</p>
          </div>
          <span class="badge ${poll.active ? "badge--active" : "badge--closed"}">
            ${poll.active ? "Aktiv" : "Geschlossen"}
          </span>
        </div>
        <div class="helper">${results.total} Stimmen · ${formatDate(poll.createdAt)}</div>
        <div class="grid grid--2" style="margin-top: 14px;">
          <button class="button button--ghost" data-action="toggle" data-id="${poll.id}">
            ${poll.active ? "Deaktivieren" : "Aktivieren"}
          </button>
          <button class="button button--ghost" data-action="reset" data-id="${poll.id}">Stimmen zurücksetzen</button>
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

const page = document.body?.dataset.page;
if (page === "login") initLogin();
if (page === "polls") initPolls();
if (page === "vote") initVote();
if (page === "admin") initAdmin();
