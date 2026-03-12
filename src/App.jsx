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
  if (prob >= 70 || precip >= 5) return { level: "HIGH", color: "#ef4444", text: "CANCEL / POSTPONE", bg: "rgba(239,68,68,0.12)" };
  if (prob >= 40 || precip >= 2) return { level: "MODERATE", color: "#f59e0b", text: "MONITOR CLOSELY", bg: "rgba(245,158,11,0.12)" };
  return { level: "LOW", color: "#22c55e", text: "GOOD TO GO", bg: "rgba(34,197,94,0.12)" };
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

export default function ChawengWeather() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [eventStart, setEventStart] = useState(14);
  const [eventDuration, setEventDuration] = useState(4);
  const [activeTab, setActiveTab] = useState("today");

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
    } catch (e) {
      setError("Failed to fetch weather data. Check connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const now = new Date();
  const currentHourStr = now.toISOString().slice(0, 13);

  const getHourlyForDay = (dayOffset) => {
    if (!data) return [];
    const target = new Date(now);
    target.setDate(target.getDate() + dayOffset);
    const dateStr = target.toISOString().split("T")[0];
    return data.hourly.time
      .map((t, i) => ({
        time: t,
        hour: new Date(t).getHours(),
        prob: data.hourly.precipitation_probability[i],
        precip: data.hourly.precipitation[i],
        temp: data.hourly.temperature_2m[i],
        wind: data.hourly.windspeed_10m[i],
        wmo: data.hourly.weathercode[i],
        isCurrent: t.startsWith(currentHourStr),
      }))
      .filter(h => h.time.startsWith(dateStr));
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a1628 0%, #0d2137 40%, #0a1e2e 100%)",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#e0eaf5",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .hour-bar { transition: all 0.2s ease; }
        .hour-bar:hover { filter: brightness(1.4); }
        .tab-btn { transition: all 0.15s ease; cursor: pointer; border: none; }
        .tab-btn:hover { opacity: 0.8; }
        .refresh-btn { cursor: pointer; border: none; transition: all 0.2s ease; }
        .refresh-btn:hover { opacity: 0.7; }
        .ext-link { text-decoration: none; transition: opacity 0.2s; display: block; }
        .ext-link:hover { opacity: 0.7; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        select { cursor: pointer; }
      `}</style>

      <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, letterSpacing: "0.05em", color: "#7dd3fc" }}>◈ CHAWENG WEATHER OPS</div>
          <div style={{ fontSize: "10px", color: "#3d6680", letterSpacing: "0.1em", marginTop: "2px" }}>KOH SAMUI · {LAT}°N {LON}°E · ECMWF MODEL · OPEN-METEO</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {lastUpdated && <div style={{ fontSize: "10px", color: "#3d6680" }}>Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>}
          <button className="refresh-btn" onClick={fetchWeather} style={{ background: "rgba(125,211,252,0.1)", color: "#7dd3fc", padding: "6px 12px", borderRadius: "4px", fontSize: "11px", letterSpacing: "0.05em" }}>↻ REFRESH</button>
        </div>
      </div>

      <div style={{ padding: "16px 20px", maxWidth: "860px", margin: "0 auto" }}>
        {loading && <div style={{ textAlign: "center", padding: "60px 20px", color: "#3d6680", fontSize: "12px", letterSpacing: "0.1em", animation: "pulse 1.5s infinite" }}>FETCHING CHAWENG DATA...</div>}
        {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", padding: "14px", color: "#ef4444", fontSize: "12px", marginBottom: "14px" }}>⚠ {error}</div>}

        {!loading && data && (
          <div className="fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginBottom: "14px" }}>
              {[
                { label: "CONDITIONS", value: `${curWmo?.icon} ${curWmo?.label}` },
                { label: "TEMPERATURE", value: `${cur.temperature_2m}°C`, sub: `Feels ${cur.apparent_temperature}°C` },
                { label: "HUMIDITY", value: `${cur.relative_humidity_2m}%` },
                { label: "WIND", value: `${cur.windspeed_10m} km/h` },
                { label: "PRECIP NOW", value: `${cur.precipitation} mm`, alert: cur.precipitation > 0 },
              ].map((c, i) => (
                <div key={i} style={{ background: c.alert ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${c.alert ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: "6px", padding: "12px" }}>
                  <div style={{ fontSize: "9px", color: "#3d6680", letterSpacing: "0.12em", marginBottom: "5px" }}>{c.label}</div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: c.alert ? "#ef4444" : "#e0eaf5" }}>{c.value}</div>
                  {c.sub && <div style={{ fontSize: "10px", color: "#3d6680", marginTop: "2px" }}>{c.sub}</div>}
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: "16px", marginBottom: "14px" }}>
              <div style={{ fontSize: "9px", color: "#3d6680", letterSpacing: "0.12em", marginBottom: "12px" }}>EVENT GO / NO-GO · TODAY</div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "9px", color: "#3d6680", marginBottom: "4px" }}>START TIME</div>
                  <select value={eventStart} onChange={e => setEventStart(Number(e.target.value))} style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.12)", color: "#e0eaf5", padding: "7px 10px", borderRadius: "4px", fontSize: "12px" }}>
                    {Array.from({ length: 18 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{formatTime(h)}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "#3d6680", marginBottom: "4px" }}>DURATION</div>
                  <select value={eventDuration} onChange={e => setEventDuration(Number(e.target.value))} style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.12)", color: "#e0eaf5", padding: "7px 10px", borderRadius: "4px", fontSize: "12px" }}>
                    {[1,2,3,4,5,6,7,8].map(d => <option key={d} value={d}>{d} hrs</option>)}
                  </select>
                </div>
                {eventWindow && eventRisk && (
                  <div style={{ flex: 1, minWidth: "200px", background: eventRisk.bg, border: `1px solid ${eventRisk.color}50`, borderRadius: "6px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "9px", color: "#3d6680", letterSpacing: "0.1em" }}>RAIN RISK</div>
                      <div style={{ fontSize: "18px", fontFamily: "'Syne', sans-serif", fontWeight: 800, color: eventRisk.color }}>{eventRisk.level}</div>
                      <div style={{ fontSize: "10px", color: eventRisk.color }}>{eventRisk.text}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "22px", color: eventRisk.color, fontWeight: 500 }}>{eventWindow.maxProb}%</div>
                      <div style={{ fontSize: "9px", color: "#3d6680" }}>max probability</div>
                      <div style={{ fontSize: "10px", color: "#3d6680", marginTop: "2px" }}>{eventWindow.totalPrecip.toFixed(1)}mm forecast</div>
                    </div>
                  </div>
                )}
              </div>
              {eventWindow && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {eventWindow.hours.map((h, i) => {
                    const r = getRainRisk(h.prob, h.precip);
                    return (
                      <div key={i} style={{ flex: "1 1 55px", minWidth: "48px", background: "rgba(255,255,255,0.03)", border: `1px solid ${r.color}25`, borderRadius: "4px", padding: "6px 4px", textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: "#3d6680" }}>{formatTime(new Date(h.time).getHours())}</div>
                        <div style={{ fontSize: "13px", color: r.color, fontWeight: 500, margin: "2px 0" }}>{h.prob}%</div>
                        <div style={{ fontSize: "9px", color: "#3d6680" }}>{h.precip}mm</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: "16px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "9px", color: "#3d6680", letterSpacing: "0.12em" }}>HOURLY RAIN PROBABILITY</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[{ id: "today", label: "TODAY" }, { id: "tomorrow", label: "TMR" }, { id: "day3", label: dayLabel(2).toUpperCase() }].map(t => (
                    <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)} style={{ padding: "5px 10px", borderRadius: "4px", fontSize: "10px", letterSpacing: "0.05em", background: activeTab === t.id ? "rgba(125,211,252,0.15)" : "rgba(255,255,255,0.04)", color: activeTab === t.id ? "#7dd3fc" : "#3d6680", border: `1px solid ${activeTab === t.id ? "rgba(125,211,252,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "80px", marginBottom: "4px" }}>
                {displayHours.map((h, i) => {
                  const r = getRainRisk(h.prob, h.precip);
                  const ht = Math.max(3, (h.prob / 100) * 78);
                  return (
                    <div key={i} title={`${formatTime(h.hour)}: ${h.prob}% · ${h.precip}mm · ${h.temp}°C`} className="hour-bar"
                      style={{ flex: 1, height: `${ht}px`, background: h.isCurrent ? "#7dd3fc" : r.color, borderRadius: "2px 2px 0 0", opacity: h.isCurrent ? 1 : 0.55, position: "relative", cursor: "default" }}>
                      {h.isCurrent && <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", fontSize: "8px", color: "#7dd3fc", whiteSpace: "nowrap" }}>NOW</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "2px" }}>
                {displayHours.map((h, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "8px", color: h.isCurrent ? "#7dd3fc" : "#2a4a60", overflow: "hidden" }}>
                    {h.hour % 6 === 0 ? formatTime(h.hour) : ""}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "14px", marginTop: "10px", flexWrap: "wrap" }}>
                {[["#22c55e", "< 40% Low"], ["#f59e0b", "40–70% Moderate"], ["#ef4444", "> 70% High"], ["#7dd3fc", "Current hour"]].map(([c, l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: "#3d6680" }}>
                    <div style={{ width: "8px", height: "8px", background: c, borderRadius: "1px", flexShrink: 0 }} />{l}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: "16px", marginBottom: "14px", overflowX: "auto" }}>
              <div style={{ fontSize: "9px", color: "#3d6680", letterSpacing: "0.12em", marginBottom: "10px" }}>HOURLY DETAIL</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", minWidth: "480px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["TIME", "CONDITIONS", "RAIN %", "PRECIP", "TEMP", "WIND"].map(h => (
                      <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: "9px", color: "#3d6680", letterSpacing: "0.1em", fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayHours.map((h, i) => {
                    const wmo = WMO_CODES[h.wmo] || { label: "—", icon: "" };
                    const r = getRainRisk(h.prob, h.precip);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: h.isCurrent ? "rgba(125,211,252,0.05)" : "transparent" }}>
                        <td style={{ padding: "6px 8px", color: h.isCurrent ? "#7dd3fc" : "#e0eaf5", fontWeight: h.isCurrent ? 500 : 300 }}>{formatTime(h.hour)}{h.isCurrent ? " ◀" : ""}</td>
                        <td style={{ padding: "6px 8px", color: "#8ba7bf" }}>{wmo.icon} {wmo.label}</td>
                        <td style={{ padding: "6px 8px", color: r.color, fontWeight: 500 }}>{h.prob}%</td>
                        <td style={{ padding: "6px 8px", color: h.precip > 0 ? r.color : "#3d6680" }}>{h.precip} mm</td>
                        <td style={{ padding: "6px 8px", color: "#8ba7bf" }}>{h.temp}°C</td>
                        <td style={{ padding: "6px 8px", color: "#8ba7bf" }}>{h.wind} km/h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px", marginBottom: "12px" }}>
              {[
                { label: "TMD LIVE RADAR", sub: "Real-time rain cells · Thailand Met Dept", href: "https://www.tmd.go.th/en/", color: "#7dd3fc" },
                { label: "WINDY — ECMWF", sub: "Multi-model comparison · Chaweng pinned", href: "https://www.windy.com/9.531/100.061?9.531,100.061,10", color: "#a78bfa" },
                { label: "ACCUWEATHER", sub: "MinuteCast · Hourly breakdown", href: "https://www.accuweather.com/en/th/ko-samui/5470/hourly-weather-forecast/5470", color: "#34d399" },
              ].map((l, i) => (
                <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className="ext-link" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${l.color}20`, borderRadius: "6px", padding: "12px", color: "inherit" }}>
                  <div style={{ fontSize: "10px", color: l.color, letterSpacing: "0.07em", marginBottom: "3px", fontWeight: 500 }}>↗ {l.label}</div>
                  <div style={{ fontSize: "9px", color: "#3d6680" }}>{l.sub}</div>
                </a>
              ))}
            </div>

            <div style={{ fontSize: "9px", color: "#1e3a52", textAlign: "center", letterSpacing: "0.05em" }}>
              Data: Open-Meteo (ECMWF) · Chaweng Beach, Koh Samui · Refresh for latest
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
