const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { attentionEvents, recommendations, oppositionProfiles } = require("./data");

const PORT = Number(process.env.PORT || 5050);
const lgasWithWards = JSON.parse(
  fs.readFileSync(path.join(__dirname, "lgas-with-wards.json"), "utf8"),
);

const stateAliases = new Map([
  ["Abuja", "Federal Capital Territory"],
  ["Abuja Federal Capital Territory", "Federal Capital Territory"],
  ["FCT", "Federal Capital Territory"],
]);

function geographyStateName(name) {
  return stateAliases.get(name) || name;
}

function eventStateName(name) {
  if (name === "Federal Capital Territory") return "Abuja";
  if (name === "Abuja Federal Capital Territory") return "Abuja";
  return name;
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

function matches(event, filters) {
  return Object.entries(filters).every(([key, value]) => {
    if (!value || value === "all") return true;
    if (key === "state") {
      return eventStateName(value).toLowerCase() === event.state.toLowerCase();
    }
    const actual = String(event[key] || "").toLowerCase();
    return actual === String(value).toLowerCase();
  });
}

function groupBy(events, key) {
  const groups = new Map();
  for (const event of events) {
    const name = event[key] || "Unknown";
    const current = groups.get(name) || {
      name,
      attention: 0,
      count: 0,
      velocity: 0,
      intensity: 0,
      urgency: 0,
      influence: 0,
      negative: 0,
      positive: 0,
      mixed: 0,
    };
    current.attention += event.attention;
    current.count += 1;
    current.velocity += event.velocity;
    current.intensity += event.intensity;
    current.urgency += event.urgency;
    current.influence += event.influence;
    current[event.sentiment] = (current[event.sentiment] || 0) + 1;
    groups.set(name, current);
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      velocity: Math.round(item.velocity / item.count),
      intensity: Math.round(item.intensity / item.count),
      urgency: Math.round(item.urgency / item.count),
      influence: Math.round(item.influence / item.count),
      risk:
        item.negative > item.positive && item.urgency > 65
          ? "red"
          : item.mixed > item.positive
            ? "amber"
            : "green",
    }))
    .sort((a, b) => b.attention - a.attention);
}

function hashNumber(text) {
  return String(text)
    .split("")
    .reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
}

function buildStateDetail(stateName) {
  const geoState = geographyStateName(stateName);
  const eventState = eventStateName(stateName);
  const lgas = lgasWithWards[geoState] || {};
  const stateEvents = attentionEvents.filter((event) => event.state === eventState);
  const baseAttention =
    stateEvents.reduce((sum, event) => sum + event.attention, 0) ||
    Math.max(18000, hashNumber(geoState) * 17);
  const topTopic =
    groupBy(stateEvents.length ? stateEvents : attentionEvents, "topic")[0]?.name ||
    "General attention";

  const lgaRows = Object.entries(lgas).map(([lgaName, wards]) => {
    const seed = hashNumber(`${geoState}:${lgaName}`);
    const attention = Math.round(baseAttention * (0.025 + (seed % 76) / 1900));
    const velocity = 8 + (seed % 46);
    const urgency = 28 + (seed % 68);
    const sentiment =
      urgency > 78 ? "negative" : urgency > 56 ? "mixed" : seed % 3 === 0 ? "positive" : "mixed";
    const risk = urgency > 78 ? "red" : urgency > 56 ? "amber" : "green";
    return {
      name: lgaName,
      attention,
      velocity,
      urgency,
      sentiment,
      risk,
      wardCount: Array.isArray(wards) ? wards.length : 0,
      topTopic,
      wards: (Array.isArray(wards) ? wards : []).slice(0, 8).map((ward, index) => ({
        name: ward.name,
        latitude: ward.latitude,
        longitude: ward.longitude,
        attention: Math.round(attention * (0.04 + ((seed + index * 13) % 30) / 500)),
        risk: index % 5 === 0 && urgency > 58 ? "red" : index % 3 === 0 ? "amber" : "green",
      })),
    };
  });

  return {
    state: eventState,
    geographyState: geoState,
    lgaCount: lgaRows.length,
    wardCount: lgaRows.reduce((sum, lga) => sum + lga.wardCount, 0),
    totalAttention: lgaRows.reduce((sum, lga) => sum + lga.attention, 0),
    topTopic,
    lgas: lgaRows.sort((a, b) => b.attention - a.attention),
  };
}

function summarize(events) {
  const totalAttention = events.reduce((sum, event) => sum + event.attention, 0);
  const avgVelocity = events.length
    ? Math.round(events.reduce((sum, event) => sum + event.velocity, 0) / events.length)
    : 0;
  const avgIntensity = events.length
    ? Math.round(events.reduce((sum, event) => sum + event.intensity, 0) / events.length)
    : 0;
  const redZones = groupBy(events, "state").filter((zone) => zone.risk === "red").length;

  return {
    totalAttention,
    eventCount: events.length,
    avgVelocity,
    avgIntensity,
    redZones,
    topics: groupBy(events, "topic"),
    states: groupBy(events, "state"),
    platforms: groupBy(events, "platform"),
    emotions: groupBy(events, "emotion"),
    entities: groupBy(events, "entity"),
  };
}

function buildResponseStudio(events) {
  const slice = events.length ? events : attentionEvents;
  const lead = [...slice].sort((a, b) => b.attention - a.attention)[0];
  const topic = lead?.topic || "Public concern";
  const state = lead?.state || "Nigeria";
  const emotion = lead?.emotion || "concern";
  const urgency = lead?.urgency || 0;
  const relatedClaims = oppositionProfiles
    .flatMap((profile) =>
      profile.publicClaims
        .filter((claim) => claim.topic === topic)
        .map((claim) => ({ ...claim, opposition: profile.name, party: profile.party })),
    )
    .slice(0, 4);

  const posture =
    urgency > 80
      ? "Empathy first, factual contrast second, avoid triumphal tone"
      : lead?.sentiment === "positive"
        ? "Amplify constructive proof with source-backed detail"
        : "Clarify policy, show evidence, invite public accountability";

  return {
    generatedAt: new Date().toISOString(),
    slice: {
      topic,
      state,
      emotion,
      sentiment: lead?.sentiment || "mixed",
      urgency,
      attention: slice.reduce((sum, event) => sum + event.attention, 0),
      evidence: slice.slice(0, 4).map((event) => ({
        id: event.id,
        source: event.platform,
        text: event.text,
        url: event.evidenceUrl,
      })),
    },
    guardrails: [
      "Human approval required before publishing.",
      "Use only verified public claims and evidence links.",
      "Do not target or profile individual voters.",
      "Do not fabricate claims about opponents.",
      "Use contrast language only when factual and review-approved.",
    ],
    oppositionResearch: relatedClaims.length
      ? relatedClaims
      : oppositionProfiles.flatMap((profile) =>
          profile.publicClaims.slice(0, 1).map((claim) => ({
            ...claim,
            opposition: profile.name,
            party: profile.party,
          })),
        ),
    drafts: [
      {
        id: "draft-social-001",
        channel: "X / short post",
        approvalStatus: "ready for review",
        risk: urgency > 80 ? "amber" : "green",
        title: `${topic}: empathy-led response`,
        copy: `People in ${state} are raising a serious concern about ${topic.toLowerCase()}. The right response is not noise; it is a practical plan, clear timelines, and accountability. Our team is reviewing the evidence and will publish the specific steps, costs, and delivery owners for public scrutiny.`,
      },
      {
        id: "draft-social-002",
        channel: "Facebook / community post",
        approvalStatus: "ready for review",
        risk: "amber",
        title: `${topic}: public contrast note`,
        copy: `The frustration around ${topic.toLowerCase()} deserves facts, not blame games. We will compare every public proposal, including opposition claims, against three tests: who is responsible, what is funded, and when relief reaches communities. Any contrast we publish should link to the public record so citizens can judge for themselves.`,
      },
      {
        id: "draft-brief-001",
        channel: "Candidate briefing",
        approvalStatus: "internal only",
        risk: "green",
        title: `Talking points for ${state}`,
        copy: `Open with empathy for ${emotion}. Acknowledge the lived experience. Reference the strongest evidence links. Avoid attacking teachers or citizens. If discussing opposition, frame it as a public-record comparison: what they have proposed, what is missing, and what our plan will publish for verification.`,
      },
    ],
  };
}

function buildResponse(pathname, searchParams) {
  const filters = {
    topic: searchParams.get("topic"),
    state: searchParams.get("state"),
    platform: searchParams.get("platform"),
    sentiment: searchParams.get("sentiment"),
    emotion: searchParams.get("emotion"),
    entity: searchParams.get("entity"),
    language: searchParams.get("language"),
  };
  const filtered = attentionEvents.filter((event) => matches(event, filters));

  if (pathname === "/api/health") {
    return { status: "ok", service: "civic-pulse-backend", port: PORT };
  }

  if (pathname === "/api/filters") {
    const geographyStates = Object.keys(lgasWithWards)
      .map((name) => (name === "Federal Capital Territory" ? "Abuja" : name));
    return {
      topics: unique(attentionEvents.map((event) => event.topic)),
      states: unique([...attentionEvents.map((event) => event.state), ...geographyStates]),
      platforms: unique(attentionEvents.map((event) => event.platform)),
      sentiments: unique(attentionEvents.map((event) => event.sentiment)),
      emotions: unique(attentionEvents.map((event) => event.emotion)),
      entities: unique(attentionEvents.map((event) => event.entity)),
      languages: unique(attentionEvents.map((event) => event.language)),
    };
  }

  if (pathname === "/api/events") {
    return { filters, events: filtered.sort((a, b) => b.attention - a.attention) };
  }

  if (pathname === "/api/recommendations") {
    return { recommendations };
  }

  if (pathname === "/api/opposition") {
    return { oppositionProfiles };
  }

  if (pathname === "/api/response-studio") {
    return buildResponseStudio(filtered);
  }

  if (pathname === "/api/geography/state") {
    const state = searchParams.get("state") || "Lagos";
    return buildStateDetail(state);
  }

  if (pathname === "/api/attention") {
    return {
      generatedAt: new Date().toISOString(),
      filters,
      summary: summarize(filtered),
      topEvents: filtered.sort((a, b) => b.attention - a.attention).slice(0, 8),
      recommendations,
      responseStudio: buildResponseStudio(filtered),
    };
  }

  return null;
}

function requestHandler(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const payload = buildResponse(url.pathname, url.searchParams);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!payload) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

if (require.main === module) {
  const server = http.createServer(requestHandler);

  server.listen(PORT, () => {
    console.log(`Civic Pulse backend listening on http://localhost:${PORT}`);
  });
}

module.exports = { buildResponse, requestHandler };
