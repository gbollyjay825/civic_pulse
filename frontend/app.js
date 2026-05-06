const API_BASE = window.location.hostname === "localhost" ? "http://localhost:5050" : "";

const filterIds = {
  topic: "topicFilter",
  state: "stateFilter",
  platform: "platformFilter",
  sentiment: "sentimentFilter",
  emotion: "emotionFilter",
};

const formatNumber = new Intl.NumberFormat("en-NG", { notation: "compact" });
let map;
let stateLayer;
let latestStateStats = [];
let selectedState = "all";
let activeConversationCategory = "all";
let navLockUntil = 0;
const savedScope = JSON.parse(localStorage.getItem("campaignScope") || "{}");
const campaignScope = {
  mode: savedScope.mode || "national",
  focusState: savedScope.focusState || "Lagos",
};
const navTargets = [
  "attentionSection",
  "heatmapSection",
  "sentimentSection",
  "riskSection",
  "commsSection",
  "sourcesSection",
];

function qs(id) {
  return document.getElementById(id);
}

function statusClass(risk) {
  return risk === "red" ? "red" : risk === "amber" ? "amber" : "green";
}

function mapStateName(name) {
  return name === "Abuja Federal Capital Territory" ? "Abuja" : name;
}

function geoStateName(name) {
  return name === "Abuja" ? "Abuja Federal Capital Territory" : name;
}

function optionList(select, values) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "All";
  select.appendChild(all);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function stateOptionList(select, values) {
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function currentFilters() {
  const filters = Object.fromEntries(
    Object.entries(filterIds).map(([key, id]) => [key, qs(id).value || "all"]),
  );
  if (campaignScope.mode === "state") {
    filters.state = campaignScope.focusState;
  }
  return filters;
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  return params.toString();
}

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

async function loadFilters() {
  const filters = await getJson("/api/filters");
  optionList(qs("topicFilter"), filters.topics);
  optionList(qs("stateFilter"), filters.states);
  stateOptionList(qs("focusStateConfig"), filters.states);
  if (!filters.states.includes(campaignScope.focusState)) {
    campaignScope.focusState = filters.states.includes("Lagos") ? "Lagos" : filters.states[0];
  }
  qs("scopeMode").value = campaignScope.mode;
  qs("focusStateConfig").value = campaignScope.focusState;
  optionList(qs("platformFilter"), filters.platforms);
  optionList(qs("sentimentFilter"), filters.sentiments);
  optionList(qs("emotionFilter"), filters.emotions);
}

function saveCampaignScope() {
  localStorage.setItem("campaignScope", JSON.stringify(campaignScope));
}

function zoomToState(stateName) {
  if (!stateLayer) return;
  if (!stateName || stateName === "all") {
    map.fitBounds(stateLayer.getBounds(), { padding: [10, 10] });
    return;
  }
  stateLayer.eachLayer((layer) => {
    const displayName = mapStateName(layer.feature.properties.shapeName);
    if (displayName === stateName) {
      map.fitBounds(layer.getBounds(), { padding: [24, 24] });
    }
  });
}

function updateScopeUi() {
  const isStateRoom = campaignScope.mode === "state";
  qs("stateFilter").disabled = isStateRoom;
  qs("stateFilter").value = isStateRoom ? campaignScope.focusState : qs("stateFilter").value;
  qs("scopeTitle").textContent = isStateRoom
    ? `${campaignScope.focusState} State Room`
    : "National Command";
  qs("scopeCopy").textContent = isStateRoom
    ? `All attention, heat, sentiment, opposition research, and content drafts are locked to ${campaignScope.focusState}.`
    : "Scanning all Nigerian states before drilling into hot zones.";
  document.body.classList.toggle("state-room", isStateRoom);
}

function setActiveNav(targetId) {
  document.querySelectorAll(".nav-list button").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === targetId);
  });
}

function scrollToSection(targetId) {
  const section = qs(targetId);
  if (!section) return;
  navLockUntil = Date.now() + 900;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  setActiveNav(targetId);
}

function syncActiveNav() {
  if (Date.now() < navLockUntil) return;
  const visibleTarget =
    navTargets
      .map((id) => {
        const section = qs(id);
        if (!section) return null;
        return { id, top: Math.abs(section.getBoundingClientRect().top - 24) };
      })
      .filter(Boolean)
      .sort((a, b) => a.top - b.top)[0]?.id || "attentionSection";
  setActiveNav(visibleTarget);
}

function renderMetrics(summary) {
  qs("totalAttention").textContent = formatNumber.format(summary.totalAttention);
  qs("avgVelocity").textContent = `${summary.avgVelocity}%`;
  qs("avgIntensity").textContent = `${summary.avgIntensity}`;
  qs("redZones").textContent = summary.redZones;
}

function colorForRisk(risk) {
  if (risk === "red") return "#ff5147";
  if (risk === "amber") return "#6eb7ff";
  return "#3f8cff";
}

function stateStatFor(name) {
  const eventName = mapStateName(name);
  return latestStateStats.find((state) => state.name === eventName);
}

function styleFeature(feature) {
  const name = feature.properties.shapeName;
  const stat = stateStatFor(name);
  const risk = stat?.risk || "green";
  const attention = stat?.attention || 0;
  const max = Math.max(...latestStateStats.map((state) => state.attention), 1);
  return {
    color: colorForRisk(risk),
    fillColor: colorForRisk(risk),
    fillOpacity: stat ? 0.2 + Math.min(0.55, attention / max) : 0.07,
    weight: stat ? 1.4 : 0.8,
    opacity: stat ? 0.9 : 0.38,
  };
}

function renderMap(states) {
  latestStateStats = states;
  if (stateLayer) {
    stateLayer.setStyle(styleFeature);
  }
}

function renderBars(containerId, items, colorMode = "green") {
  const max = Math.max(...items.map((item) => item.attention), 1);
  qs(containerId).innerHTML = items
    .slice(0, 7)
    .map((item) => {
      const width = Math.max(7, Math.round((item.attention / max) * 100));
      const color =
        colorMode === "emotion"
          ? item.risk === "red"
            ? "linear-gradient(90deg, #a7201c, #ff5147)"
            : item.risk === "amber"
              ? "linear-gradient(90deg, #0b4dcc, #6eb7ff)"
              : "linear-gradient(90deg, #0b4dcc, #3f8cff)"
          : "linear-gradient(90deg, #0b4dcc, #3f8cff)";
      return `
        <div class="bar-row">
          <span>${item.name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${color}"></div></div>
          <span>${formatNumber.format(item.attention)}</span>
        </div>
      `;
    })
    .join("");
}

function renderEvents(events) {
  qs("eventList").innerHTML = events
    .slice(0, 6)
    .map(
      (event) => `
      <article class="event-item">
        <div class="event-top">
          <strong>${event.topic} · ${event.state}</strong>
          <span class="tag ${event.sentiment === "negative" ? "red" : event.sentiment === "mixed" ? "amber" : "green"}">${event.platform}</span>
        </div>
        <p>${event.text}</p>
        <p>${event.emotion} · ${event.stance} · ${formatNumber.format(event.attention)} attention · confidence ${Math.round(event.confidence * 100)}%</p>
      </article>
    `,
    )
    .join("");
}

function renderRecommendations(recommendations) {
  qs("recommendations").innerHTML = recommendations
    .map(
      (rec) => `
      <article class="recommendation">
        <div class="rec-top">
          <strong>${rec.title}</strong>
          <span class="tag ${rec.status}">${rec.status}</span>
        </div>
        <p>${rec.rationale}</p>
        <p><strong>Action:</strong> ${rec.action}</p>
        <p>Owner: ${rec.owner}</p>
      </article>
    `,
    )
    .join("");
}

function sentimentTag(sentiment) {
  return sentiment === "negative" ? "red" : sentiment === "mixed" ? "amber" : "green";
}

function renderConversationIntel(intel) {
  if (!intel) return;
  qs("conversationVolume").textContent = formatNumber.format(intel.totalVolume);
  qs("conversationPace").textContent = intel.messagesPerMinute;
  qs("conversationSources").textContent = intel.sourceCount;

  qs("hashtagList").innerHTML = intel.hashtags
    .map(
      (tag) => `
      <div class="hashtag-item">
        <strong>${tag.name}</strong>
        <span>${formatNumber.format(tag.attention)}</span>
      </div>
    `,
    )
    .join("");

  const categories = [{ name: "All", key: "all", attention: intel.totalVolume }, ...intel.categories.map((category) => ({
    name: category.name,
    key: category.name,
    attention: category.attention,
  }))];
  if (!categories.some((category) => category.key === activeConversationCategory)) {
    activeConversationCategory = "all";
  }
  qs("categoryTabs").innerHTML = categories
    .map(
      (category) => `
      <button class="${category.key === activeConversationCategory ? "active" : ""}" data-category="${category.key}">
        <span>${category.name}</span>
        <strong>${formatNumber.format(category.attention)}</strong>
      </button>
    `,
    )
    .join("");

  const stream =
    activeConversationCategory === "all"
      ? intel.stream
      : intel.stream.filter((item) => item.category === activeConversationCategory);
  qs("commentStream").innerHTML = stream
    .slice(0, 12)
    .map(
      (item) => `
      <article class="comment-item">
        <div class="comment-head">
          <div>
            <strong>${item.author}</strong>
            <span>${item.platform} · ${item.state} · ${new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <span class="tag ${sentimentTag(item.sentiment)}">${item.emotion}</span>
        </div>
        <p>${item.body}</p>
        <div class="comment-meta">
          <span>${formatNumber.format(item.engagement)} engagements</span>
          <span>${item.category}</span>
          <span>${Math.round(item.confidence * 100)}% confidence</span>
        </div>
      </article>
    `,
    )
    .join("");

  qs("mediaMosaic").innerHTML = intel.media
    .map(
      (item) => `
      <article class="media-tile ${sentimentTag(item.sentiment)}">
        <span>${item.label}</span>
        <strong>${item.topic}</strong>
        <small>${item.platform} · ${item.state}</small>
      </article>
    `,
    )
    .join("");
}

function renderResponseStudio(studio) {
  if (!studio) return;
  qs("studioTrigger").textContent =
    `${studio.slice.topic} · ${studio.slice.state} · ${formatNumber.format(studio.slice.attention)} attention`;
  qs("studioPosture").textContent =
    `${studio.slice.emotion} / ${studio.slice.sentiment} signal. Urgency ${studio.slice.urgency}. ${studio.guardrails[0]}`;
  qs("studioGuardrails").innerHTML = studio.guardrails
    .map((item) => `<div><span></span>${item}</div>`)
    .join("");
  qs("oppositionResearch").innerHTML = studio.oppositionResearch
    .map(
      (claim) => `
      <div class="oppo-item">
        <strong>${claim.opposition} · ${claim.status}</strong>
        <p>${claim.claim}</p>
      </div>
    `,
    )
    .join("");
  qs("contentDrafts").innerHTML = studio.drafts
    .map(
      (draft) => `
      <article class="draft-item">
        <div class="draft-top">
          <strong>${draft.channel}</strong>
          <span class="tag ${draft.risk}">${draft.approvalStatus}</span>
        </div>
        <h3>${draft.title}</h3>
        <p>${draft.copy}</p>
        <div class="draft-actions">
          <button class="assign-review" data-draft-id="${draft.id}">Assign review</button>
          <button class="copy-draft" data-copy="${draft.copy.replaceAll('"', "&quot;")}">Copy draft</button>
        </div>
      </article>
    `,
    )
    .join("");
}

function renderTicker(topEvents) {
  if (!topEvents.length) {
    qs("tickerText").textContent = "No matching attention signals for the selected slice.";
    return;
  }
  const lead = topEvents[0];
  qs("tickerText").textContent = `${lead.topic} is hottest in ${lead.state} on ${lead.platform}: ${lead.emotion}, ${lead.stance}, ${formatNumber.format(lead.attention)} attention.`;
}

async function loadStateDetail(stateName) {
  if (!stateName || stateName === "all") {
    qs("activeStateLabel").textContent = "National map";
    qs("stateDetailName").textContent = "Select a state";
    qs("stateDetailMeta").textContent = "LGA and ward attention will appear here";
    qs("lgaList").innerHTML = "";
    return;
  }

  const data = await getJson(`/api/geography/state?state=${encodeURIComponent(stateName)}`);
  qs("activeStateLabel").textContent = data.state;
  qs("stateDetailName").textContent = `${data.state} detail`;
  qs("stateDetailMeta").textContent =
    `${data.lgaCount} LGAs · ${data.wardCount} ward points · ${formatNumber.format(data.totalAttention)} modeled attention`;
  qs("lgaList").innerHTML = data.lgas
    .slice(0, 12)
    .map(
      (lga) => `
      <article class="lga-item">
        <strong>${lga.name}</strong>
        <span>${formatNumber.format(lga.attention)} attention · ${lga.velocity}% velocity</span>
        <span>${lga.risk.toUpperCase()} · ${lga.wardCount} wards · ${lga.topTopic}</span>
      </article>
    `,
    )
    .join("");
}

async function initMap() {
  map = L.map("leafletMap", {
    zoomControl: true,
    attributionControl: false,
    scrollWheelZoom: false,
  }).setView([9.08, 8.68], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    maxZoom: 12,
  }).addTo(map);

  const geo = await fetch("./data/nigeria-states.geojson").then((res) => res.json());
  stateLayer = L.geoJSON(geo, {
    style: styleFeature,
    onEachFeature(feature, layer) {
      const geoName = feature.properties.shapeName;
      const displayName = mapStateName(geoName);
      layer.on({
        click: async () => {
          if (campaignScope.mode === "state") {
            campaignScope.focusState = displayName;
            qs("focusStateConfig").value = displayName;
            saveCampaignScope();
          }
          selectedState = campaignScope.mode === "state" ? campaignScope.focusState : displayName;
          qs("stateFilter").value = displayName;
          updateScopeUi();
          await loadDashboard();
          await loadStateDetail(selectedState);
          map.fitBounds(layer.getBounds(), { padding: [24, 24] });
        },
        mouseover: () => {
          layer.setStyle({ weight: 2.4, opacity: 1 });
          const stat = stateStatFor(geoName);
          layer
            .bindPopup(
              `<strong>${displayName}</strong><br>${stat ? `${formatNumber.format(stat.attention)} attention<br>${stat.risk.toUpperCase()} · urgency ${stat.urgency}` : "No current signal"}`,
            )
            .openPopup();
        },
        mouseout: () => {
          stateLayer.resetStyle(layer);
          layer.closePopup();
        },
      });
    },
  }).addTo(map);

  map.fitBounds(stateLayer.getBounds(), { padding: [10, 10] });
}

async function loadDashboard() {
  try {
    const query = buildQuery(currentFilters());
    const data = await getJson(`/api/attention${query ? `?${query}` : ""}`);
    qs("generatedAt").textContent = new Date(data.generatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    renderMetrics(data.summary);
    renderMap(data.summary.states);
    renderBars("topicBars", data.summary.topics);
    renderBars("emotionBars", data.summary.emotions, "emotion");
    renderEvents(data.topEvents);
    renderRecommendations(data.recommendations);
    renderConversationIntel(data.conversationIntel);
    renderResponseStudio(data.responseStudio);
    renderTicker(data.topEvents);
  } catch (error) {
    qs("tickerText").textContent =
      "Backend is offline. Start it with `cd backend && npm run dev`.";
    console.error(error);
  }
}

async function init() {
  await loadFilters();
  await initMap();
  updateScopeUi();
  Object.values(filterIds).forEach((id) => {
    qs(id).addEventListener("change", async () => {
      selectedState = qs("stateFilter").value;
      await loadDashboard();
      await loadStateDetail(selectedState);
      if (id === "stateFilter" && selectedState === "all" && stateLayer) {
        map.fitBounds(stateLayer.getBounds(), { padding: [10, 10] });
      }
    });
  });
  qs("scopeMode").addEventListener("change", async () => {
    campaignScope.mode = qs("scopeMode").value;
    saveCampaignScope();
    updateScopeUi();
    selectedState = campaignScope.mode === "state" ? campaignScope.focusState : qs("stateFilter").value;
    await loadDashboard();
    await loadStateDetail(campaignScope.mode === "state" ? campaignScope.focusState : selectedState);
    zoomToState(campaignScope.mode === "state" ? campaignScope.focusState : selectedState);
  });
  qs("focusStateConfig").addEventListener("change", async () => {
    campaignScope.focusState = qs("focusStateConfig").value;
    saveCampaignScope();
    updateScopeUi();
    if (campaignScope.mode === "state") {
      selectedState = campaignScope.focusState;
      await loadDashboard();
      await loadStateDetail(campaignScope.focusState);
      zoomToState(campaignScope.focusState);
    }
  });
  qs("resetFilters").addEventListener("click", () => {
    Object.values(filterIds).forEach((id) => {
      qs(id).value = "all";
    });
    selectedState = campaignScope.mode === "state" ? campaignScope.focusState : "all";
    updateScopeUi();
    loadDashboard();
    loadStateDetail(selectedState);
    zoomToState(selectedState);
  });
  qs("clearState").addEventListener("click", async () => {
    campaignScope.mode = "national";
    qs("scopeMode").value = "national";
    saveCampaignScope();
    qs("stateFilter").value = "all";
    selectedState = "all";
    updateScopeUi();
    await loadDashboard();
    await loadStateDetail("all");
    zoomToState("all");
  });
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches(".copy-draft")) {
      const copy = target.getAttribute("data-copy") || "";
      await navigator.clipboard?.writeText(copy);
      target.textContent = "Copied";
      setTimeout(() => {
        target.textContent = "Copy draft";
      }, 1400);
    }
    if (target.matches(".assign-review")) {
      target.textContent = "In review";
      target.classList.add("is-assigned");
    }
    if (target.matches(".category-tabs button")) {
      activeConversationCategory = target.getAttribute("data-category") || "all";
      await loadDashboard();
    }
    if (target.matches(".nav-list button")) {
      scrollToSection(target.getAttribute("data-target"));
    }
  });
  window.addEventListener("scroll", syncActiveNav, { passive: true });
  await loadDashboard();
  selectedState = campaignScope.mode === "state" ? campaignScope.focusState : "all";
  await loadStateDetail(selectedState);
  zoomToState(selectedState);
  setInterval(loadDashboard, 15000);
}

init();
