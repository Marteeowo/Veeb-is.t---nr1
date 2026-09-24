"use strict";

// Kõik tabeli andmeread luuakse Fetch API kaudu saadud JSON-ist.
const SOURCE_URL = "https://metshein.com/kordamine/json/broneeringud.json";
const services = {
  Juuksur: { className: "juuksur", symbol: "✂" },
  Massaaž: { className: "massaaz", symbol: "≋" },
  Spa: { className: "spa", symbol: "◈" },
  Kosmeetika: { className: "kosmeetika", symbol: "✧" },
};
const tbody = document.querySelector("#bookings-body");
const search = document.querySelector("#search");
const sort = document.querySelector("#sort");
const filterButtons = document.querySelectorAll(".filter");
const dateFormat = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const weekdayFormat = new Intl.DateTimeFormat("et-EE", { weekday: "long" });
let bookings = [];
let activeService = "all";
let loadState = "loading";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Kohalik kuupäev: ajavööndi teisendus ei tohi broneeringu päeva muuta.
function bookingDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function updateStatistics() {
  const total = bookings.length;
  document.querySelector("#total-count").textContent =
    loadState === "ready" ? total : "—";
  document.querySelector("#heading-count").textContent =
    loadState === "ready" ? total : "—";
  const summary = document.querySelector("#service-summary");
  const strip = document.querySelector("#service-strip");
  summary.replaceChildren();
  strip.replaceChildren();
  for (const [name, service] of Object.entries(services)) {
    const count = bookings.filter((booking) => booking.teenus === name).length;
    const share = total ? Math.round((count / total) * 100) : 0;
    const card = element("div", `stat ${service.className}`);
    const label = element("span", "stat-label");
    label.append(element("span", "dot"), document.createTextNode(name));
    const symbol = element("span", "stat-symbol", service.symbol);
    symbol.setAttribute("aria-hidden", "true");
    card.append(
      label,
      element("strong", "stat-number", loadState === "ready" ? count : "—"),
      symbol,
      element(
        "span",
        "stat-share",
        loadState === "ready" ? `${share}% broneeringutest` : "Andmete ootel",
      ),
    );
    summary.append(card);
    if (count) {
      const segment = element("span", service.className);
      segment.style.flexGrow = count;
      strip.append(segment);
    }
  }
  const dates = bookings.map((booking) => booking.kuupäev).sort();
  document.querySelector("#date-range").textContent = dates.length
    ? `${dateFormat.format(bookingDate(dates[0]))} – ${dateFormat.format(bookingDate(dates.at(-1)))}`
    : loadState === "ready"
      ? "Broneeringud puuduvad"
      : loadState === "loading"
        ? "Laadin perioodi…"
        : "Periood pole saadaval";
}

function renderBookings() {
  tbody.replaceChildren();
  if (loadState !== "ready") return;
  const query = search.value.trim().toLocaleLowerCase("et");
  const filtered = bookings.filter(
    (booking) =>
      (activeService === "all" || booking.teenus === activeService) &&
      `${booking.klient} ${booking.teenus}`
        .toLocaleLowerCase("et")
        .includes(query),
  );
  // JSON-is on ka ühekohalisi tunde, nt 8:30. padStart tagab õige järjestuse.
  const key = (booking) => `${booking.kuupäev}T${booking.aeg.padStart(5, "0")}`;
  filtered.sort(
    (a, b) =>
      (key(a).localeCompare(key(b)) || a.klient.localeCompare(b.klient, "et")) *
      (sort.value === "asc" ? 1 : -1),
  );
  const fragment = document.createDocumentFragment();
  for (const booking of filtered) {
    const row = element("tr", services[booking.teenus].className);
    const clientCell = element("td");
    const client = element("span", "client");
    const initials = booking.klient
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("");
    const avatar = element("span", "avatar", initials);
    avatar.setAttribute("aria-hidden", "true");
    client.append(avatar, document.createTextNode(booking.klient));
    clientCell.append(client);
    const serviceCell = element("td");
    const badge = element("span", "service-badge");
    badge.append(
      element("span", "dot"),
      document.createTextNode(booking.teenus),
    );
    serviceCell.append(badge);
    const dateCell = element("td", "date");
    const date = bookingDate(booking.kuupäev);
    const time = element("time", "", dateFormat.format(date));
    time.dateTime = booking.kuupäev;
    dateCell.append(
      time,
      element("span", "weekday", weekdayFormat.format(date)),
    );
    const timeCell = element("td");
    const clock = element("time", "", booking.aeg.padStart(5, "0"));
    clock.dateTime = booking.aeg.padStart(5, "0");
    timeCell.append(clock);
    row.append(clientCell, serviceCell, dateCell, timeCell);
    fragment.append(row);
  }
  tbody.append(fragment);
  document.querySelector("#empty").hidden = filtered.length !== 0;
  document.querySelector("#empty h3").textContent = bookings.length
    ? "Ühtegi vastet ei leitud"
    : "Broneeringuid veel pole";
  document.querySelector("#empty p").textContent = bookings.length
    ? "Proovi teist nime või vali mõni muu teenus."
    : "Andmeallikas on praegu tühi. Värskenda ülevaadet hiljem uuesti.";
  document.querySelector("#reset").hidden = !bookings.length;
  document.querySelector("#result-count").textContent =
    `${filtered.length} / ${bookings.length} broneeringut`;
  document
    .querySelector("#date-heading")
    .setAttribute(
      "aria-sort",
      sort.value === "asc" ? "ascending" : "descending",
    );
  document.querySelector("#sort-arrow").textContent =
    sort.value === "asc" ? "↑" : "↓";
}

async function fetchBookings(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  // Õpetaja nõue: kuvame vastuse konsoolis ENNE tabeli loomist.
  console.log("Fetch API — broneeringud:", data);
  if (!Array.isArray(data.broneeringud))
    throw new Error("JSON-is puudub broneeringute massiiv.");
  for (const booking of data.broneeringud) {
    if (
      typeof booking.klient !== "string" ||
      !booking.klient.trim() ||
      !Object.hasOwn(services, booking.teenus) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(booking.kuupäev) ||
      !/^([01]?\d|2[0-3]):[0-5]\d$/.test(booking.aeg)
    ) {
      throw new Error("Broneeringu andmed on vigased.");
    }
    const parsedDate = bookingDate(booking.kuupäev);
    const [year, month, day] = booking.kuupäev.split("-").map(Number);
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() + 1 !== month ||
      parsedDate.getDate() !== day
    ) {
      throw new Error("Broneeringu kuupäev on vigane.");
    }
  }
  return data.broneeringud;
}

async function loadBookings() {
  loadState = "loading";
  bookings = [];
  tbody.replaceChildren();
  document.querySelector("#loading").hidden = false;
  document.querySelector("#empty").hidden = true;
  document.querySelector("#error").hidden = true;
  document.querySelector("#table-region").setAttribute("aria-busy", "true");
  document.querySelector("#refresh").disabled = true;
  document.querySelector("#retry").disabled = true;
  document.querySelector("#result-count").textContent = "Laadin broneeringuid…";
  document.querySelector("#source-status").textContent =
    "Ühendan andmeallikaga…";
  updateStatistics();
  try {
    try {
      bookings = await fetchBookings(SOURCE_URL);
      document.querySelector("#source-status").textContent =
        "Andmed laaditud otse allikast";
    } catch (sourceError) {
      // Allikas ei saada CORS-päist. GitHub Pagesis kasutame sama JSON-i varukoopiat.
      console.warn(
        "Otsepäring ebaõnnestus; laadin allika muutmata varukoopia.",
        sourceError.message,
      );
      bookings = await fetchBookings("./data/broneeringud.json");
      document.querySelector("#source-status").textContent =
        "Allika otsepäring pole saadaval · varukoopia 24.09.2026";
    }
    loadState = "ready";
    updateStatistics();
    renderBookings();
  } catch (error) {
    loadState = "error";
    updateStatistics();
    console.error("Broneeringute laadimine ebaõnnestus:", error.message);
    document.querySelector("#error").hidden = false;
    document.querySelector("#result-count").textContent =
      "Andmed pole saadaval";
    document.querySelector("#source-status").textContent =
      "Andmeallikat ega varukoopiat ei saanud laadida";
  } finally {
    document.querySelector("#loading").hidden = true;
    document.querySelector("#table-region").setAttribute("aria-busy", "false");
    document.querySelector("#refresh").disabled = false;
    document.querySelector("#retry").disabled = false;
  }
}

search.addEventListener("input", renderBookings);
sort.addEventListener("change", renderBookings);
for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeService = button.dataset.service;
    for (const filter of filterButtons) {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    }
    renderBookings();
  });
}
document.querySelector("#reset").addEventListener("click", () => {
  search.value = "";
  filterButtons[0].click();
  search.focus();
});
document.querySelector("#refresh").addEventListener("click", loadBookings);
document.querySelector("#retry").addEventListener("click", loadBookings);
loadBookings();
