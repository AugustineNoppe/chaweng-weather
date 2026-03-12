import { useState, useEffect, useCallback } from "react";

const LAT = 9.531;
const LON = 100.061;
const TIMEZONE = "Asia/Bangkok";

const WMO_CODES = {
  0: { label: "Clear Sky", icon: "☀️" },
  1: { label: "Mainly Clear", icon: "🌤️" },
  2: { label: "Partly Cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Rime Fog", icon: "🌫️" },
  51: { label: "Light Drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy Drizzle", icon: "🌧️" },
  61: { label: "Light Rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy Rain", icon: "🌧️" },
  80: { label: "Light Showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy Showers", icon: "⛈️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm + Hail", icon: "⛈️" },
  99: { label: "Heavy Thunderstorm", icon: "⛈️" },
};

function getRainRisk(prob, precip) {
  if (prob >= 70 || precip >= 5) return { level: "HIGH", color: "#f87171", text: "Cancel / Postpone", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" };
  if (prob >= 40 || precip >= 2) return { level: "MODERATE", color: "#fbbf24", text: "Monitor Closely", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)" };
  return { level: "LOW", color: "#4ade80", text: "Good to Go", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.25)" };
}

function getEventWindow(hourlyData, startHour, durationHours) {
  if (!hourlyData) return null;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const windowHours = hourlyData.time
    .map((t, i) => ({ time: t, prob: hourlyData.precipitation_probability[i], precip: hourlyData.precipitation[i], wmo: hourlyData.weathercode[i] }))
    .filter(h => {
      const d = new Date(h.time);
      return d.toISOString().split("T")[0] === todayStr && d.getHours() >= startHour && d.getHours() < startHour + durationHours;
    });
  if (!windowHours.length) return null;
  const maxProb = Math.max(...windowHours.map(h => h.prob));
  const totalPrecip = windowHours.reduce((s, h) => s + h.precip, 0);
  return { maxProb, totalPrecip, hours: windowHours };
}

const STORAGE_KEY = "chaweng_feedback_log";

function loadFeedback() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

function saveFeedback(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function ChawengWeather() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [eventStart, setEventStart] = useState(14);
  const [eventDuration, setEventDuration] = useState(4);
  const [activeTab, setActiveTab] = useState("today");
  const [view, setView] = useState("dashboard"); // dashboard | feedback
  const [feedback, setFeedback] = useState(loadFeedback);
  const [fbForm, setFbForm] = useState({ date: new Date().toISOString().split("T")[0], predicted: "", actual: "", heavy: false, notes: "" });
  const [fbSaved, setFbSaved] = useState(false);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,precipitation,weathercode,windspeed_10m,apparent_temperature&hourly=temperature_2m,precipitation_probability,precipitation,weathercode,windspeed_10m&timezone=${encodeURIComponent(TIMEZONE)}&forecast_days=3`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch { setError("Failed to fetch weather data."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const now = new Date();
  const bangkokOffset = 7 * 60;
  const bangkokTime = new Date(now.getTime() + (bangkokOffset + now.getTimezoneOffset()) * 60000);
  const currentHourStr = bangkokTime.toISOString().slice(0, 13).replace("T", "T").slice(0, 13);

  const getHourlyForDay = (dayOffset) => {
    if (!data) return [];
    const target = new Date(now);
    target.setDate(target.getDate() + dayOffset);
    const bangkokOffset = 7 * 60;
    const bangkokNow = new Date(target.getTime() + (bangkokOffset + target.getTimezoneOffset()) * 60000);
    const dateStr = bangkokNow.toISOString().split("T")[0];
    return data.hourly.time.map((t, i) => ({
      time: t, hour: new Date(t).getHours(),
      prob: data.hourly.precipitation_probability[i],
      precip: data.hourly.precipitation[i],
      temp: data.hourly.temperature_2m[i],
      wind: data.hourly.windspeed_10m[i],
      wmo: data.hourly.weathercode[i],
      isCurrent: t.startsWith(currentHourStr),
    })).filter(h => h.time.startsWith(dateStr));
  };

  const todayHours = getHourlyForDay(0);
  const tomorrowHours = getHourlyForDay(1);
  const day3Hours = getHourlyForDay(2);
  const displayHours = activeTab === "today" ? todayHours : activeTab === "tomorrow" ? tomorrowHours : day3Hours;

  const eventWindow = getEventWindow(data?.hourly, eventStart, eventDuration);
  const eventRisk = eventWindow ? getRainRisk(eventWindow.maxProb, eventWindow.totalPrecip) : null;
  const cur = data?.current;
  const curWmo = cur ? (WMO_CODES[cur.weathercode] || { label: "Unknown", icon: "🌡️" }) : null;

  const formatTime = (h) => {
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };

  const dayLabel = (offset) => {
    if (offset === 0) return "Today";
    if (offset === 1) return "Tomorrow";
    const d = new Date(now); d.setDate(d.getDate() + offset);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  };

  const submitFeedback = () => {
    if (!fbForm.predicted || !fbForm.actual) return;
    const entry = { ...fbForm, id: Date.now(), saved: new Date().toISOString() };
    const updated = [entry, ...feedback];
    setFeedback(updated);
    saveFeedback(updated);
    setFbSaved(true);
    setTimeout(() => setFbSaved(false), 2000);
    setFbForm({ date: new Date().toISOString().split("T")[0], predicted: "", actual: "", heavy: false, notes: "" });
  };

  const deleteFeedback = (id) => {
    const updated = feedback.filter(f => f.id !== id);
    setFeedback(updated);
    saveFeedback(updated);
  };

  const accuracy = feedback.length > 0 ? (() => {
    const correct = feedback.filter(f => {
      const p = parseInt(f.predicted);
      const a = f.actual === "yes";
      return (p >= 60 && a) || (p < 60 && !a);
    }).length;
    return Math.round((correct / feedback.length) * 100);
  })() : null;

  const S = {
    page: { minHeight: "100vh", background: "#0c1a27", fontFamily: "'Inter', system-ui, sans-serif", color: "#cbd5e1" },
    header: { background: "#0f2236", borderBottom: "1px solid #1e3448", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" },
    card: { background: "#0f2236", border: "1px solid #1e3448", borderRadius: "10px", padding: "20px", marginBottom: "14px" },
    label: { fontSize: "11px", color: "#4a7a9b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" },
    val: { fontSize: "22px", fontWeight: 600, color: "#e2e8f0" },
    subval: { fontSize: "13px", color: "#4a7a9b", marginTop: "2px" },
    navBtn: (active) => ({ background: active ? "rgba(125,211,252,0.12)" : "transparent", color: active ? "#7dd3fc" : "#4a7a9b", border: `1px solid ${active ? "rgba(125,211,252,0.3)" : "#1e3448"}`, borderRadius: "6px", padding: "7px 16px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }),
    tabBtn: (active) => ({ background: active ? "rgba(125,211,252,0.1)" : "transparent", color: active ? "#7dd3fc" : "#4a7a9b", border: `1px solid ${active ? "rgba(125,211,252,0.25)" : "#1e3448"}`, borderRadius: "6px", padding: "6px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }),
    input: { background: "#0c1a27", border: "1px solid #1e3448", color: "#e2e8f0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit", width: "100%" },
    btn: (color) => ({ background: color || "rgba(125,211,252,0.1)", color: color ? "#0c1a27" : "#7dd3fc", border: "none", borderRadius: "6px", padding: "9px 18px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }),
  };

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea { outline: none; }
        input:focus, select:focus, textarea:focus { border-color: #7dd3fc !important; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .fade { animation: fadeIn 0.3s ease; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        a { color: inherit; text-decoration: none; }
        a:hover { opacity: 0.7; }
        button:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3448; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", letterSpacing: "0.01em" }}>Chaweng Weather Ops</div>
          <div style={{ fontSize: "12px", color: "#4a7a9b", marginTop: "2px" }}>Koh Samui · ECMWF via Open-Meteo</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lastUpdated && <span style={{ fontSize: "12px", color: "#4a7a9b" }}>{lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button style={S.navBtn(view === "dashboard")} onClick={() => setView("dashboard")}>Dashboard</button>
          <button style={S.navBtn(view === "feedback")} onClick={() => setView("feedback")}>
            Feedback {feedback.length > 0 && <span style={{ background: "#1e3448", borderRadius: "10px", padding: "1px 7px", fontSize: "11px", marginLeft: "4px" }}>{feedback.length}</span>}
          </button>
          <button onClick={fetchWeather} style={{ ...S.btn(), padding: "7px 14px", fontSize: "12px" }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: "900px", margin: "0 auto" }}>

        {loading && <div style={{ textAlign: "center", padding: "60px", color: "#4a7a9b", fontSize: "13px", animation: "pulse 1.5s infinite" }}>Fetching Chaweng data...</div>}
        {error && <div style={{ ...S.card, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>⚠ {error}</div>}

        {/* DASHBOARD */}
        {!loading && data && view === "dashboard" && (
          <div className="fade">

            {/* Current Conditions */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "14px" }}>
              {[
                { label: "Conditions", value: `${curWmo?.icon} ${curWmo?.label}` },
                { label: "Temperature", value: `${cur.temperature_2m}°C`, sub: `Feels like ${cur.apparent_temperature}°C` },
                { label: "Humidity", value: `${cur.relative_humidity_2m}%` },
                { label: "Wind", value: `${cur.windspeed_10m} km/h` },
                { label: "Precip Now", value: `${cur.precipitation} mm`, alert: cur.precipitation > 0 },
              ].map((c, i) => (
                <div key={i} style={{ ...S.card, marginBottom: 0, borderColor: c.alert ? "rgba(248,113,113,0.35)" : "#1e3448", background: c.alert ? "rgba(248,113,113,0.07)" : "#0f2236" }}>
                  <div style={S.label}>{c.label}</div>
                  <div style={{ ...S.val, fontSize: "18px", color: c.alert ? "#f87171" : "#e2e8f0" }}>{c.value}</div>
                  {c.sub && <div style={S.subval}>{c.sub}</div>}
                </div>
              ))}
            </div>

            {/* Event Planner */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: "14px" }}>Event Go / No-Go · Today</div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "16px" }}>
                <div style={{ minWidth: "120px" }}>
                  <div style={S.label}>Start time</div>
                  <select value={eventStart} onChange={e => setEventStart(Number(e.target.value))} style={S.input}>
                    {Array.from({ length: 18 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{formatTime(h)}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: "110px" }}>
                  <div style={S.label}>Duration</div>
                  <select value={eventDuration} onChange={e => setEventDuration(Number(e.target.value))} style={S.input}>
                    {[1,2,3,4,5,6,7,8].map(d => <option key={d} value={d}>{d} hours</option>)}
                  </select>
                </div>
                {eventWindow && eventRisk && (
                  <div style={{ flex: 1, minWidth: "220px", background: eventRisk.bg, border: `1px solid ${eventRisk.border}`, borderRadius: "8px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={S.label}>Rain Risk</div>
                      <div style={{ fontSize: "22px", fontWeight: 700, color: eventRisk.color, lineHeight: 1.1 }}>{eventRisk.level}</div>
                      <div style={{ fontSize: "13px", color: eventRisk.color, marginTop: "4px", opacity: 0.85 }}>{eventRisk.text}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "36px", fontWeight: 600, color: eventRisk.color, lineHeight: 1 }}>{eventWindow.maxProb}%</div>
                      <div style={{ fontSize: "12px", color: "#4a7a9b", marginTop: "4px" }}>{eventWindow.totalPrecip.toFixed(1)}mm forecast</div>
                    </div>
                  </div>
                )}
              </div>

              {eventWindow && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {eventWindow.hours.map((h, i) => {
                    const r = getRainRisk(h.prob, h.precip);
                    return (
                      <div key={i} style={{ flex: "1 1 60px", minWidth: "54px", background: "#0c1a27", border: `1px solid ${r.border}`, borderRadius: "6px", padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", color: "#4a7a9b", marginBottom: "4px" }}>{formatTime(new Date(h.time).getHours())}</div>
                        <div style={{ fontSize: "15px", color: r.color, fontWeight: 600 }}>{h.prob}%</div>
                        <div style={{ fontSize: "11px", color: "#4a7a9b", marginTop: "2px" }}>{h.precip}mm</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hourly Chart */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                <div style={S.label}>Hourly Rain Probability</div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[{ id: "today", label: "Today" }, { id: "tomorrow", label: "Tomorrow" }, { id: "day3", label: dayLabel(2) }].map(t => (
                    <button key={t.id} style={S.tabBtn(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "90px", marginBottom: "6px" }}>
                {displayHours.map((h, i) => {
                  const r = getRainRisk(h.prob, h.precip);
                  const ht = Math.max(4, (h.prob / 100) * 88);
                  return (
                    <div key={i} title={`${formatTime(h.hour)}: ${h.prob}% · ${h.precip}mm · ${h.temp}°C`}
                      style={{ flex: 1, height: `${ht}px`, background: h.isCurrent ? "#7dd3fc" : r.color, borderRadius: "3px 3px 0 0", opacity: h.isCurrent ? 1 : 0.5, position: "relative", cursor: "default", transition: "opacity 0.15s" }}>
                      {h.isCurrent && <div style={{ position: "absolute", top: "-18px", left: "50%", transform: "translateX(-50%)", fontSize: "9px", color: "#7dd3fc", whiteSpace: "nowrap", fontWeight: 600 }}>NOW</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "3px", marginBottom: "12px" }}>
                {displayHours.map((h, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "10px", color: h.isCurrent ? "#7dd3fc" : "#2a4a60", overflow: "hidden" }}>
                    {h.hour % 6 === 0 ? formatTime(h.hour) : ""}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {[["#4ade80", "< 40% Low"], ["#fbbf24", "40–70% Moderate"], ["#f87171", "> 70% High"], ["#7dd3fc", "Current hour"]].map(([c, l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#4a7a9b" }}>
                    <div style={{ width: "10px", height: "10px", background: c, borderRadius: "2px", flexShrink: 0 }} />{l}
                  </div>
                ))}
              </div>
            </div>

            {/* Hourly Table */}
            <div style={{ ...S.card, overflowX: "auto" }}>
              <div style={{ ...S.label, marginBottom: "12px" }}>Hourly Detail — {activeTab === "today" ? "Today" : activeTab === "tomorrow" ? "Tomorrow" : dayLabel(2)}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "500px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e3448" }}>
                    {["Time", "Conditions", "Rain %", "Precip", "Temp", "Wind"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: "11px", color: "#4a7a9b", fontWeight: 500, letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayHours.map((h, i) => {
                    const wmo = WMO_CODES[h.wmo] || { label: "—", icon: "" };
                    const r = getRainRisk(h.prob, h.precip);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #0f2236", background: h.isCurrent ? "rgba(125,211,252,0.04)" : "transparent" }}>
                        <td style={{ padding: "8px 10px", color: h.isCurrent ? "#7dd3fc" : "#e2e8f0", fontWeight: h.isCurrent ? 600 : 400 }}>{formatTime(h.hour)}{h.isCurrent ? " ◀" : ""}</td>
                        <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{wmo.icon} {wmo.label}</td>
                        <td style={{ padding: "8px 10px", color: r.color, fontWeight: 600 }}>{h.prob}%</td>
                        <td style={{ padding: "8px 10px", color: h.precip > 0 ? r.color : "#4a7a9b" }}>{h.precip} mm</td>
                        <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{h.temp}°C</td>
                        <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{h.wind} km/h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick Links */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              {[
                { label: "TMD Live Radar", sub: "Real-time rain cells", href: "https://www.tmd.go.th/en/", color: "#7dd3fc" },
                { label: "Windy — ECMWF", sub: "Multi-model comparison", href: "https://www.windy.com/9.531/100.061?9.531,100.061,10", color: "#a78bfa" },
                { label: "AccuWeather", sub: "MinuteCast hourly", href: "https://www.accuweather.com/en/th/ko-samui/5470/hourly-weather-forecast/5470", color: "#4ade80" },
              ].map((l, i) => (
                <a key={i} href={l.href} target="_blank" rel="noopener noreferrer"
                  style={{ ...S.card, marginBottom: 0, borderColor: `${l.color}20`, display: "block" }}>
                  <div style={{ fontSize: "13px", color: l.color, fontWeight: 500, marginBottom: "3px" }}>↗ {l.label}</div>
                  <div style={{ fontSize: "12px", color: "#4a7a9b" }}>{l.sub}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* FEEDBACK VIEW */}
        {view === "feedback" && (
          <div className="fade">
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: "16px" }}>Log a Prediction vs Reality</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <div style={S.label}>Date</div>
                  <input type="date" value={fbForm.date} onChange={e => setFbForm(f => ({ ...f, date: e.target.value }))} style={S.input} />
                </div>
                <div>
                  <div style={S.label}>App predicted rain % (approx)</div>
                  <input type="number" min="0" max="100" placeholder="e.g. 65" value={fbForm.predicted} onChange={e => setFbForm(f => ({ ...f, predicted: e.target.value }))} style={S.input} />
                </div>
                <div>
                  <div style={S.label}>Did it actually rain?</div>
                  <select value={fbForm.actual} onChange={e => setFbForm(f => ({ ...f, actual: e.target.value }))} style={S.input}>
                    <option value="">Select...</option>
                    <option value="yes">Yes — it rained</option>
                    <option value="no">No — stayed dry</option>
                    <option value="light">Light drizzle only</option>
                  </select>
                </div>
                <div>
                  <div style={S.label}>Was it heavy enough to cancel?</div>
                  <select value={fbForm.heavy} onChange={e => setFbForm(f => ({ ...f, heavy: e.target.value === "true" }))} style={S.input}>
                    <option value="false">No</option>
                    <option value="true">Yes — would have cancelled</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <div style={S.label}>Notes (optional)</div>
                <textarea value={fbForm.notes} onChange={e => setFbForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. App said HIGH but rain was light and passed in 20 mins..." rows={2} style={{ ...S.input, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button onClick={submitFeedback} style={S.btn("#7dd3fc")}>Save Entry</button>
                {fbSaved && <span style={{ fontSize: "13px", color: "#4ade80" }}>✓ Saved</span>}
              </div>
            </div>

            {/* Accuracy summary */}
            {feedback.length >= 3 && (
              <div style={{ ...S.card, display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div>
                  <div style={S.label}>Logged entries</div>
                  <div style={S.val}>{feedback.length}</div>
                </div>
                <div>
                  <div style={S.label}>App accuracy</div>
                  <div style={{ ...S.val, color: accuracy >= 70 ? "#4ade80" : accuracy >= 50 ? "#fbbf24" : "#f87171" }}>{accuracy}%</div>
                  <div style={S.subval}>Based on 60% threshold</div>
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={S.label}>Pattern notes</div>
                  <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
                    {accuracy >= 75 ? "App is performing well for Chaweng conditions." : accuracy >= 55 ? "Some discrepancy — consider raising your cancel threshold." : "App may be over-predicting rain. Raise threshold to 75%+ before cancelling."}
                  </div>
                </div>
              </div>
            )}

            {/* Log */}
            {feedback.length === 0 && (
              <div style={{ ...S.card, textAlign: "center", color: "#4a7a9b", padding: "40px" }}>
                No entries yet. Log your first prediction above after checking the dashboard.
              </div>
            )}
            {feedback.map(f => {
              const r = getRainRisk(parseInt(f.predicted) || 0, 0);
              return (
                <div key={f.id} style={{ ...S.card, marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                      <div>
                        <div style={S.label}>Date</div>
                        <div style={{ fontSize: "14px", color: "#e2e8f0" }}>{f.date}</div>
                      </div>
                      <div>
                        <div style={S.label}>Predicted</div>
                        <div style={{ fontSize: "14px", color: r.color, fontWeight: 600 }}>{f.predicted}%</div>
                      </div>
                      <div>
                        <div style={S.label}>Actual</div>
                        <div style={{ fontSize: "14px", color: f.actual === "yes" ? "#f87171" : f.actual === "light" ? "#fbbf24" : "#4ade80", fontWeight: 600 }}>
                          {f.actual === "yes" ? "Rained" : f.actual === "no" ? "Stayed dry" : "Light drizzle"}
                        </div>
                      </div>
                      <div>
                        <div style={S.label}>Cancel-worthy?</div>
                        <div style={{ fontSize: "14px", color: f.heavy ? "#f87171" : "#4ade80" }}>{f.heavy ? "Yes" : "No"}</div>
                      </div>
                    </div>
                    <button onClick={() => deleteFeedback(f.id)} style={{ background: "transparent", border: "none", color: "#4a7a9b", cursor: "pointer", fontSize: "16px" }}>×</button>
                  </div>
                  {f.notes && <div style={{ fontSize: "12px", color: "#4a7a9b", marginTop: "10px", borderTop: "1px solid #1e3448", paddingTop: "8px" }}>{f.notes}</div>}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
