// Scrobblelytics (Public Version)
var LASTFM_API_KEY = "b70e67417e70edf414679d2478d9daad";
var LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

var PERIODS = [
  { key: "7day", label: "Week" }, { key: "1month", label: "Month" }, { key: "3month", label: "3 Months" },
  { key: "6month", label: "6 Months" }, { key: "12month", label: "Year" }, { key: "overall", label: "All Time" }
];

function lfm(method, params, user) {
  var qs = "?method=" + method + "&user=" + user + "&api_key=" + LASTFM_API_KEY + "&format=json";
  if (params) Object.keys(params).forEach(function (k) { qs += "&" + k + "=" + encodeURIComponent(params[k]); });
  return fetch(LASTFM_BASE + qs).then(function (r) { if (!r.ok) throw new Error("last.fm " + r.status); return r.json(); });
}
function fmtNum(n) { return parseInt(n).toLocaleString(); }
function timeAgo(uts) {
  var diff = Math.floor(Date.now() / 1000) - parseInt(uts);
  if (diff < 60) return "Just now"; if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago"; if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return new Date(parseInt(uts) * 1000).toLocaleDateString();
}
function pct(n, total) { return total > 0 ? (n / total * 100).toFixed(1) + "%" : "0%"; }

var h;
function useData(fetcher, deps) {
  var R = Spicetify.React; var st = R.useState({ loading: true, error: null, data: null }); var s = st[0], set = st[1];
  R.useEffect(function () {
    var alive = true; set({ loading: true, error: null, data: null });
    fetcher().then(function (d) { if (alive) set({ loading: false, error: null, data: d }); })
      .catch(function (e) { if (alive) set({ loading: false, error: e.message, data: null }); });
    return function () { alive = false; };
  }, deps || []);
  return s;
}

function StatusMsg(p) {
  if (p.loading) return h("div", { className: "lfm-status" }, "Loading...");
  if (p.error) return h("div", { className: "lfm-status lfm-error" }, "Error: " + p.error);
  return null;
}
function Card(p) {
  return h("div", { className: "lfm-card" + (p.accent ? " accent-" + p.accent : "") + (p.className ? " " + p.className : ""), onClick: p.onClick, style: p.style },
    h("div", { className: "lfm-card-val" }, p.value), h("div", { className: "lfm-card-lbl" }, p.label), p.sub ? h("div", { className: "lfm-card-sub" }, p.sub) : null
  );
}
function PeriodPills(p) {
  return h("div", { className: "lfm-periods" }, PERIODS.map(function (pr) { return h("button", { key: pr.key, className: "lfm-pill" + (pr.key === p.value ? " on" : ""), onClick: function () { p.onChange(pr.key); } }, pr.label); }));
}
function HBar(p) {
  var items = p.limit ? p.items.slice(0, p.limit) : p.items; var mx = p.max || (items.length > 0 ? items[0].value : 1);
  return h("div", { className: "lfm-hbar" }, items.map(function (it, i) {
    var w = Math.max(2, (it.value / mx) * 100);
    return h("div", { key: i, className: "lfm-hbar-row" }, h("span", { className: "lfm-hbar-rank" }, i + 1), h("div", { className: "lfm-hbar-body" }, h("div", { className: "lfm-hbar-name" }, it.name), it.sub ? h("div", { className: "lfm-hbar-sub" }, it.sub) : null, h("div", { className: "lfm-hbar-track" }, h("div", { className: "lfm-hbar-fill c-" + (p.color || "green"), style: { width: w + "%" } }), h("span", { className: "lfm-hbar-ct" }, fmtNum(it.value))))
    );
  }));
}
function VBars(p) {
  var mx = p.max || 1; var ht = p.height || 160;
  return h("div", { className: "lfm-vbars", style: { height: (ht + 26) + "px", marginTop: "12px" } }, p.items.map(function (it, i) {
    var barH = Math.max(2, (it.value / mx) * ht);
    return h("div", { key: i, className: "lfm-vbar-col", title: it.label + ": " + fmtNum(it.value) }, h("div", { className: "lfm-vbar-bar c-" + (p.color || "green"), style: { height: barH + "px" } }), h("div", { className: "lfm-vbar-lbl" }, it.label));
  }));
}
function Sect(p) { return h("div", { className: "lfm-sect" }, p.title ? h("h2", { className: "lfm-sect-t" }, p.title) : null, p.children); }

function TabOverview(p) {
  var ps = Spicetify.React.useState("1month"); var per = ps[0], setPer = ps[1];
  var info = useData(function () { return lfm("user.getinfo", null, p.user); }, []);
  var art = useData(function () { return lfm("user.gettopartists", { period: per, limit: 10 }, p.user); }, [per]);
  var trk = useData(function () { return lfm("user.gettoptracks", { period: per, limit: 10 }, p.user); }, [per]);
  var rec = useData(function () { return lfm("user.getrecenttracks", { limit: 5 }, p.user); }, []);

  if (info.loading) return h(StatusMsg, { loading: true }); if (info.error) return h(StatusMsg, { error: info.error });

  var u = info.data.user;
  var days = Math.floor((Date.now() - parseInt(u.registered.unixtime) * 1000) / 86400000);
  var avg = days > 0 ? (parseInt(u.playcount) / days).toFixed(1) : "0";
  var artPerScrobble = parseInt(u.playcount) > 0 ? (parseInt(u.playcount) / parseInt(u.artist_count)).toFixed(1) : "0";

  var aItems = [], tItems = [];
  if (art.data) { aItems = (art.data.topartists.artist || []).map(function (a) { return { name: a.name, value: parseInt(a.playcount) }; }); }
  if (trk.data) { tItems = (trk.data.toptracks.track || []).map(function (t) { return { name: t.name, value: parseInt(t.playcount), sub: t.artist.name }; }); }

  var recentRows = null;
  if (rec.data) {
    recentRows = h("div", { className: "lfm-recent-mini" }, (rec.data.recenttracks.track || []).slice(0, 5).map(function (t, i) {
      var np = t["@attr"] && t["@attr"].nowplaying === "true";
      return h("div", { key: i, className: "lfm-rr" + (np ? " np" : "") }, h("div", { className: "lfm-rr-info" }, h("span", { className: "lfm-rr-name" }, t.name), h("span", { className: "lfm-rr-sep" }, "\u2014"), h("span", { className: "lfm-rr-art" }, t.artist["#text"])), h("div", { className: "lfm-rr-time" }, np ? "\u25B6 Now" : (t.date ? timeAgo(t.date.uts) : "")));
    }));
  }

  return h("div", null,
    h("div", { className: "lfm-cards" }, h(Card, { value: fmtNum(u.playcount), label: "Scrobbles", accent: "green" }), h(Card, { value: fmtNum(u.artist_count), label: "Artists", accent: "green" }), h(Card, { value: fmtNum(u.track_count), label: "Unique Tracks", accent: "green" }), h(Card, { value: fmtNum(u.album_count), label: "Albums", accent: "green" }), h(Card, { value: avg, label: "Avg / Day" }), h(Card, { value: fmtNum(days), label: "Days Scrobbling" }), h(Card, { value: artPerScrobble, label: "Plays / Artist" })),
    h("div", { style: { marginTop: 24 } }, h(PeriodPills, { value: per, onChange: setPer })),
    h("div", { className: "lfm-2col" }, h(Sect, { title: "Top Artists" }, art.loading ? h(StatusMsg, { loading: true }) : h(HBar, { items: aItems, color: "green" })), h(Sect, { title: "Top Tracks" }, trk.loading ? h(StatusMsg, { loading: true }) : h(HBar, { items: tItems, color: "green" }))),
    h(Sect, { title: "Recent Scrobbles" }, rec.loading ? h(StatusMsg, { loading: true }) : recentRows)
  );
}

function TabTopList(p) {
  var ps = Spicetify.React.useState("1month"); var per = ps[0], setPer = ps[1];
  var d = useData(function () { return lfm(p.method, { period: per, limit: 50 }, p.user); }, [per]);
  if (d.loading) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { loading: true }));
  if (d.error) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { error: d.error }));
  return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(HBar, { items: p.extract(d.data), color: p.color }));
}
function TabArtists(p) { return h(TabTopList, { method: "user.gettopartists", color: "green", user: p.user, extract: function (j) { return (j.topartists.artist || []).map(function (a) { return { name: a.name, value: parseInt(a.playcount) }; }); } }); }
function TabTracks(p) { return h(TabTopList, { method: "user.gettoptracks", color: "green", user: p.user, extract: function (j) { return (j.toptracks.track || []).map(function (t) { return { name: t.name, value: parseInt(t.playcount), sub: t.artist.name }; }); } }); }
function TabAlbums(p) { return h(TabTopList, { method: "user.gettopalbums", color: "green", user: p.user, extract: function (j) { return (j.topalbums.album || []).map(function (a) { return { name: a.name, value: parseInt(a.playcount), sub: a.artist.name }; }); } }); }

function TabRecent(p) {
  var ps = Spicetify.React.useState(1); var page = ps[0], setPage = ps[1];
  var d = useData(function () { return lfm("user.getrecenttracks", { limit: 50, page: page }, p.user); }, [page]);
  if (d.loading) return h(StatusMsg, { loading: true }); if (d.error) return h(StatusMsg, { error: d.error });
  var tracks = d.data.recenttracks.track || []; var tp = parseInt(d.data.recenttracks["@attr"].totalPages) || 1;
  var groups = {};
  tracks.forEach(function (t) {
    var np = t["@attr"] && t["@attr"].nowplaying === "true"; var ds = np ? "Now Playing" : (t.date ? t.date["#text"].split(",")[0] : "Unknown");
    if (!groups[ds]) groups[ds] = []; groups[ds].push(t);
  });
  return h("div", null, Object.keys(groups).map(function (ds) { return h("div", { key: ds, className: "lfm-rg" }, h("h3", { className: "lfm-rg-d" }, ds), groups[ds].map(function (t, i) { var np = t["@attr"] && t["@attr"].nowplaying === "true"; return h("div", { key: i, className: "lfm-rr" + (np ? " np" : "") }, h("div", { className: "lfm-rr-info" }, h("span", { className: "lfm-rr-name" }, t.name), h("span", { className: "lfm-rr-sep" }, "\u2014"), h("span", { className: "lfm-rr-art" }, t.artist["#text"]), t.album && t.album["#text"] ? h("span", { className: "lfm-rr-alb" }, t.album["#text"]) : null), h("div", { className: "lfm-rr-time" }, np ? "\u25B6 Now" : (t.date ? timeAgo(t.date.uts) : ""))); })); }), tp > 1 ? h("div", { className: "lfm-pag" }, h("button", { className: "lfm-pbtn", disabled: page <= 1, onClick: function () { setPage(Math.max(1, page - 1)); } }, "\u2190 Newer"), h("span", { className: "lfm-pinfo" }, "Page " + page + " / " + tp), h("button", { className: "lfm-pbtn", disabled: page >= tp, onClick: function () { setPage(page + 1); } }, "Older \u2192")) : null);
}

function TabGenres(p) {
  var ps = Spicetify.React.useState("1month"); var per = ps[0], setPer = ps[1];
  var d = useData(function () { return lfm("user.gettopartists", { period: per, limit: 20 }, p.user).then(function (j) { return Promise.all((j.topartists.artist || []).slice(0, 15).map(function (a) { return lfm("artist.gettoptags", { artist: a.name }, p.user).then(function (r) { return { playcount: parseInt(a.playcount), tags: (r.toptags.tag || []).slice(0, 5) }; }).catch(function () { return { playcount: parseInt(a.playcount), tags: [] }; }); })); }); }, [per]);
  if (d.loading) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { loading: true })); if (d.error) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { error: d.error }));
  var gm = {}; d.data.forEach(function (a) { a.tags.forEach(function (tag, i) { var n = tag.name.toLowerCase(); gm[n] = (gm[n] || 0) + a.playcount * (1 - i * 0.15); }); });
  var sorted = Object.keys(gm).map(function (k) { return { name: k, value: Math.round(gm[k]) }; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 25);
  return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h("p", { className: "lfm-note" }, "Genres derived from your top 15 artists, weighted by play count."), h(HBar, { items: sorted, color: "green" }));
}

function TabClock(p) {
  var d = useData(function () { return lfm("user.getrecenttracks", { limit: 200 }, p.user); }, []);
  if (d.loading) return h(StatusMsg, { loading: true }); if (d.error) return h(StatusMsg, { error: d.error });
  var tracks = d.data.recenttracks.track || []; var hours = new Array(24).fill(0); var days = new Array(7).fill(0); var heatmap = []; for (var di = 0; di < 7; di++) { heatmap[di] = new Array(24).fill(0); } var count = 0;
  tracks.forEach(function (t) { if (t["@attr"] && t["@attr"].nowplaying === "true") return; if (!t.date) return; var dt = new Date(parseInt(t.date.uts) * 1000); hours[dt.getHours()]++; days[dt.getDay()]++; heatmap[dt.getDay()][dt.getHours()]++; count++; });
  var maxH = Math.max.apply(null, hours); var maxD = Math.max.apply(null, days); var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; var peakHour = hours.indexOf(maxH); var peakDay = days.indexOf(maxD); var hmMax = 0; heatmap.forEach(function (row) { row.forEach(function (v) { if (v > hmMax) hmMax = v; }); });
  return h("div", null, h("p", { className: "lfm-note" }, "Based on your last " + count + " scrobbles."), h("div", { className: "lfm-cards" }, h(Card, { value: (peakHour < 10 ? "0" : "") + peakHour + ":00", label: "Peak Hour", accent: "green" }), h(Card, { value: dayNames[peakDay], label: "Peak Day", accent: "green" }), h(Card, { value: fmtNum(count), label: "Scrobbles Analyzed" })), h(Sect, { title: "Scrobbles by Hour" }, h(VBars, { items: hours.map(function (v, i) { return { label: (i < 10 ? "0" : "") + i, value: v }; }), max: maxH, color: "green", height: 140 })), h(Sect, { title: "Scrobbles by Day" }, h(VBars, { items: days.map(function (v, i) { return { label: dayNames[i], value: v }; }), max: maxD, color: "green", height: 120 })), h(Sect, { title: "Activity Heatmap" }, h("div", { className: "lfm-heatmap" }, h("div", { className: "lfm-hm-corner" }), [0,2,4,6,8,10,12,14,16,18,20,22].map(function (hr) { return h("div", { key: "hh" + hr, className: "lfm-hm-hdr", style: { gridColumn: (hr + 2) } }, (hr < 10 ? "0" : "") + hr); }), dayNames.map(function (dn, di) { var cells = [h("div", { key: "dl" + di, className: "lfm-hm-day" }, dn)]; for (var hi = 0; hi < 24; hi++) { var val = heatmap[di][hi]; var op = hmMax > 0 ? Math.max(0.05, val / hmMax) : 0.05; cells.push(h("div", { key: "c" + di + "-" + hi, className: "lfm-hm-cell", style: { opacity: op }, title: dn + " " + hi + ":00 \u2014 " + val + " plays" })); } return cells; }))) );
}

function TabTrends(p) {
  var d = useData(function () { return lfm("user.getweeklychartlist", null, p.user).then(function (j) { return Promise.all((j.weeklychartlist.chart || []).slice(-16).map(function (c) { return lfm("user.getweeklyartistchart", { from: c.from, to: c.to }, p.user).then(function (r) { var aa = r.weeklyartistchart.artist || []; return { from: parseInt(c.from), to: parseInt(c.to), total: aa.reduce(function (s, a) { return s + parseInt(a.playcount); }, 0), unique: aa.length }; }); })); }); }, []);
  if (d.loading) return h(StatusMsg, { loading: true }); if (d.error) return h(StatusMsg, { error: d.error });
  var weeks = d.data; var maxTotal = weeks.reduce(function (m, w) { return Math.max(m, w.total); }, 1); var maxUnique = weeks.reduce(function (m, w) { return Math.max(m, w.unique); }, 1); var avgTotal = Math.round(weeks.reduce(function (s, w) { return s + w.total; }, 0) / weeks.length); var totalAll = weeks.reduce(function (s, w) { return s + w.total; }, 0); var bestWeek = weeks.reduce(function (best, w) { return w.total > best.total ? w : best; }, weeks[0]); var bestDate = new Date(bestWeek.from * 1000).toLocaleDateString();
  return h("div", null, h("div", { className: "lfm-cards" }, h(Card, { value: fmtNum(totalAll), label: "16-Week Total", accent: "green" }), h(Card, { value: fmtNum(avgTotal), label: "Weekly Average" }), h(Card, { value: fmtNum(bestWeek.total), label: "Best Week", sub: bestDate, accent: "green" })), h(Sect, { title: "Weekly Scrobbles" }, h(VBars, { items: weeks.map(function (w) { var dt = new Date(w.from * 1000); return { label: (dt.getMonth() + 1) + "/" + dt.getDate(), value: w.total }; }), max: maxTotal, color: "green", height: 180 })), h(Sect, { title: "Unique Artists per Week" }, h(VBars, { items: weeks.map(function (w) { var dt = new Date(w.from * 1000); return { label: (dt.getMonth() + 1) + "/" + dt.getDate(), value: w.unique }; }), max: maxUnique, color: "green", height: 140 })) );
}

function TabDeepDive(p) {
  var R = Spicetify.React; var sel = R.useState(null); var selected = sel[0], setSelected = sel[1]; var ps = R.useState("overall"); var per = ps[0], setPer = ps[1];
  var top = useData(function () { return lfm("user.gettopartists", { period: per, limit: 20 }, p.user); }, [per]);
  var detail = useData(function () { if (!selected) return Promise.resolve(null); return Promise.all([lfm("artist.getinfo", { artist: selected }, p.user), lfm("artist.gettoptags", { artist: selected }, p.user)]).then(function (r) { return { info: r[0].artist, tags: (r[1].toptags.tag || []).slice(0, 10) }; }); }, [selected]);
  if (top.loading) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { loading: true })); if (top.error) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { error: top.error }));
  var artists = top.data.topartists.artist || [];
  var grid = h("div", { className: "lfm-dd-grid" }, artists.map(function (a, i) { var isSel = selected === a.name; return h("div", { key: i, className: "lfm-dd-chip" + (isSel ? " on" : ""), onClick: function () { setSelected(isSel ? null : a.name); } }, h("span", { className: "lfm-dd-rank" }, "#" + (i + 1)), h("span", { className: "lfm-dd-name" }, a.name), h("span", { className: "lfm-dd-plays" }, fmtNum(a.playcount) + " plays")); }));
  var detailPanel = null;
  if (selected && detail.data) {
    var inf = detail.data.info; var tags = detail.data.tags; var myPlays = 0; artists.forEach(function (a) { if (a.name === selected) myPlays = parseInt(a.playcount); });
    detailPanel = h("div", { className: "lfm-dd-detail" }, h("h2", { className: "lfm-dd-h" }, selected), h("div", { className: "lfm-cards" }, h(Card, { value: fmtNum(myPlays), label: "Your Scrobbles", accent: "green" }), inf.stats ? h(Card, { value: fmtNum(inf.stats.listeners), label: "Global Listeners", accent: "green" }) : null, inf.stats ? h(Card, { value: fmtNum(inf.stats.playcount), label: "Global Scrobbles", accent: "green" }) : null, inf.stats && parseInt(inf.stats.listeners) > 0 ? h(Card, { value: (parseInt(inf.stats.playcount) / parseInt(inf.stats.listeners)).toFixed(1), label: "Avg Plays / Listener" }) : null), tags.length > 0 ? h(Sect, { title: "Tags" }, h("div", { className: "lfm-tag-cloud" }, tags.map(function (t, i) { return h("span", { key: i, className: "lfm-tag" }, t.name); }))) : null, inf.similar && inf.similar.artist && inf.similar.artist.length > 0 ? h(Sect, { title: "Similar Artists" }, h("div", { className: "lfm-tag-cloud" }, inf.similar.artist.slice(0, 8).map(function (s, i) { return h("span", { key: i, className: "lfm-tag sim" }, s.name); }))) : null, inf.bio && inf.bio.summary ? h(Sect, { title: "About" }, h("p", { className: "lfm-bio", dangerouslySetInnerHTML: { __html: inf.bio.summary } })) : null);
  } else if (selected && detail.loading) { detailPanel = h(StatusMsg, { loading: true }); }
  return h("div", null, h("p", { className: "lfm-note" }, "Click an artist to explore their stats."), h(PeriodPills, { value: per, onChange: setPer }), grid, detailPanel);
}

function TabNerdStats(p) {
  var ps = Spicetify.React.useState("1month"); var per = ps[0], setPer = ps[1];
  var d = useData(function () { return Promise.all([lfm("user.gettopartists", { period: per, limit: 200 }, p.user), lfm("user.getinfo", null, p.user)]).then(function (r) { return { artists: r[0].topartists.artist || [], user: r[1].user }; }); }, [per]);
  if (d.loading) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { loading: true })); if (d.error) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h(StatusMsg, { error: d.error }));
  var aa = d.data.artists; var u = d.data.user; if (aa.length === 0) return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h("div", { className: "lfm-status" }, "Not enough data."));
  var plays = aa.map(function (a) { return parseInt(a.playcount); }); var totalPlays = plays.reduce(function (s, v) { return s + v; }, 0); var n = plays.length; var sortedPlays = plays.slice().sort(function (a, b) { return a - b; }); var giniSum = 0; sortedPlays.forEach(function (v, i) { giniSum += (2 * (i + 1) - n - 1) * v; }); var gini = n > 0 && totalPlays > 0 ? (giniSum / (n * totalPlays)).toFixed(3) : "0"; var entropy = 0; plays.forEach(function (v) { if (v > 0 && totalPlays > 0) { var p = v / totalPlays; entropy -= p * Math.log2(p); } }); var maxEntropy = n > 0 ? Math.log2(n) : 1; var normalizedEntropy = maxEntropy > 0 ? (entropy / maxEntropy).toFixed(3) : "0"; var top1 = plays[0]; var top5 = plays.slice(0, 5).reduce(function (s, v) { return s + v; }, 0); var top10 = plays.slice(0, 10).reduce(function (s, v) { return s + v; }, 0); var topDecile = plays.slice(0, Math.ceil(n * 0.1)).reduce(function (s, v) { return s + v; }, 0); var oneHits = plays.filter(function (v) { return v === 1; }).length; var median = sortedPlays[Math.floor(n / 2)]; var loyalty = totalPlays > 0 ? (top1 / totalPlays * 100).toFixed(1) : "0"; var breadth = totalPlays > 0 ? (n / totalPlays * 100).toFixed(1) : "0";
  var buckets = [ { label: "1 play", min: 1, max: 1, count: 0 }, { label: "2-5", min: 2, max: 5, count: 0 }, { label: "6-10", min: 6, max: 10, count: 0 }, { label: "11-25", min: 11, max: 25, count: 0 }, { label: "26-50", min: 26, max: 50, count: 0 }, { label: "51-100", min: 51, max: 100, count: 0 }, { label: "100+", min: 101, max: Infinity, count: 0 } ]; plays.forEach(function (v) { buckets.forEach(function (b) { if (v >= b.min && v <= b.max) b.count++; }); }); var maxBucket = buckets.reduce(function (m, b) { return Math.max(m, b.count); }, 1);
  return h("div", null, h(PeriodPills, { value: per, onChange: setPer }), h("p", { className: "lfm-note" }, "Statistical analysis of " + n + " artists, " + fmtNum(totalPlays) + " total scrobbles."), h(Sect, { title: "Diversity & Concentration" }, h("div", { className: "lfm-cards" }, h(Card, { value: gini, label: "Gini Coefficient", sub: parseFloat(gini) > 0.7 ? "Concentrated" : parseFloat(gini) > 0.4 ? "Moderate" : "Diverse", accent: "green" }), h(Card, { value: normalizedEntropy, label: "Norm. Entropy", sub: parseFloat(normalizedEntropy) > 0.8 ? "Very diverse" : parseFloat(normalizedEntropy) > 0.6 ? "Balanced" : "Focused", accent: "green" }), h(Card, { value: breadth, label: "Artists / 100 plays", accent: "green" }), h(Card, { value: pct(top1, totalPlays), label: "#1 Artist Share", accent: "green" }), h(Card, { value: pct(top5, totalPlays), label: "Top 5 Share" }), h(Card, { value: pct(top10, totalPlays), label: "Top 10 Share" }), h(Card, { value: pct(topDecile, totalPlays), label: "Top 10% Share" }))), h(Sect, { title: "Distribution Metrics" }, h("div", { className: "lfm-cards" }, h(Card, { value: fmtNum(top1), label: "#1 Artist Plays" }), h(Card, { value: fmtNum(median), label: "Median Plays" }), h(Card, { value: (totalPlays / n).toFixed(1), label: "Mean Plays" }), h(Card, { value: fmtNum(oneHits), label: "One-Hit Artists", sub: pct(oneHits, n) + " of total" }), h(Card, { value: loyalty + "%", label: "Loyalty Score", sub: "Top artist dominance" }))), h(Sect, { title: "Play Count Distribution" }, h(VBars, { items: buckets.map(function (b) { return { label: b.label, value: b.count }; }), max: maxBucket, color: "green", height: 140 })), h(Sect, { title: "Cumulative Concentration" }, h("div", { className: "lfm-cumul" }, [1, 5, 10, 20, 50, 100].filter(function (x) { return x <= n; }).map(function (x) { var sum = plays.slice(0, x).reduce(function (s, v) { return s + v; }, 0); var w = totalPlays > 0 ? (sum / totalPlays * 100) : 0; return h("div", { key: x, className: "lfm-cumul-row" }, h("span", { className: "lfm-cumul-lbl" }, "Top " + x + " artist" + (x > 1 ? "s" : "")), h("div", { className: "lfm-cumul-bar" }, h("div", { className: "lfm-cumul-fill", style: { width: w + "%" } }), h("span", { className: "lfm-cumul-pct" }, w.toFixed(1) + "%"))); }))) );
}

var TABS = [
  { key: "overview", label: "Overview" }, { key: "artists", label: "Top Artists" }, { key: "tracks", label: "Top Tracks" }, { key: "albums", label: "Top Albums" },
  { key: "recent", label: "Recent" }, { key: "genres", label: "Genres" }, { key: "clock", label: "Listening Clock" }, { key: "trends", label: "Trends" },
  { key: "deepdive", label: "Deep Dive" }, { key: "nerd", label: "Nerd Stats" },
];

function App() {
  h = Spicetify.React.createElement;
  var savedUser = localStorage.getItem("scrobblelytics_user") || "";
  var ts = Spicetify.React.useState(savedUser ? "overview" : "settings"); 
  var tab = ts[0], setTab = ts[1];
  var u = Spicetify.React.useState(savedUser);
  var currentUser = u[0], setCurrentUser = u[1];

  if (tab === "settings") {
    return h("section", { className: "lfm-app" },
      h("header", { className: "lfm-hdr" }, h("h1", { className: "lfm-h1" }, "Scrobblelytics")),
      h(Sect, { title: "Setup" },
        h("p", { className: "lfm-note" }, "Enter your Last.fm username to pull your stats."),
        h("input", { 
          defaultValue: currentUser,
          placeholder: "Username",
          id: "lfm-user-input",
          style: { padding: "10px", fontSize: "14px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "var(--spice-text)", marginRight: "10px", width: "200px" }
        }),
        h("button", {
          onClick: function() { 
            var inputUser = document.getElementById("lfm-user-input").value.trim();
            if (inputUser) {
              localStorage.setItem("scrobblelytics_user", inputUser);
              setCurrentUser(inputUser);
              setTab("overview");
            }
          },
          className: "lfm-pbtn",
          style: { padding: "10px 20px" }
        }, "Connect")
      )
    );
  }

  var content;
  switch (tab) {
    case "overview": content = h(TabOverview, { user: currentUser }); break; case "artists": content = h(TabArtists, { user: currentUser }); break; case "tracks": content = h(TabTracks, { user: currentUser }); break;
    case "albums": content = h(TabAlbums, { user: currentUser }); break; case "recent": content = h(TabRecent, { user: currentUser }); break; case "genres": content = h(TabGenres, { user: currentUser }); break;
    case "clock": content = h(TabClock, { user: currentUser }); break; case "trends": content = h(TabTrends, { user: currentUser }); break; case "deepdive": content = h(TabDeepDive, { user: currentUser }); break;
    case "nerd": content = h(TabNerdStats, { user: currentUser }); break; default: content = null;
  }
  return h("section", { className: "lfm-app" },
    h("header", { className: "lfm-hdr" },
      h("h1", { className: "lfm-h1" }, "Scrobblelytics"),
      h("div", { className: "lfm-usr", style: { cursor: "pointer", textDecoration: "underline" }, title: "Change User", onClick: function() { setTab("settings"); } }, "@" + currentUser)
    ),
    h("nav", { className: "lfm-nav" }, TABS.map(function (t) { return h("button", { key: t.key, className: "lfm-tab" + (t.key === tab ? " on" : ""), onClick: function () { setTab(t.key); } }, t.label); })),
    h("div", { className: "lfm-body" }, content)
  );
}

(function () {
  var old = document.getElementById("lfm-css-v4"); if (old) old.remove();
  var el = document.createElement("style"); el.id = "lfm-css-v4";
  el.textContent = [
    ".lfm-app{padding:20px 28px;color:var(--spice-text);height:100%;overflow-y:auto}",
    ".lfm-hdr{display:flex;align-items:baseline;gap:14px;margin-bottom:20px}",
    ".lfm-h1{font-size:34px;font-weight:800;margin:0;letter-spacing:-.5px}",
    ".lfm-usr{color:var(--spice-subtext);font-size:15px;font-weight:600}",
    ".lfm-body{padding-bottom:80px}",
    ".lfm-nav{display:flex;gap:2px;margin-bottom:22px;border-bottom:1px solid rgba(255,255,255,.08);overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}",
    ".lfm-nav::-webkit-scrollbar{display:none}",
    ".lfm-tab{background:0 0;color:var(--spice-subtext);border:none;border-bottom:3px solid transparent;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;transition:color .15s,border-color .15s}",
    ".lfm-tab:hover{color:var(--spice-text)}",
    ".lfm-tab.on{color:var(--spice-text);border-color:var(--spice-button)}",
    ".lfm-periods{display:flex;gap:7px;margin-bottom:18px;flex-wrap:wrap}",
    ".lfm-pill{background:rgba(255,255,255,.07);color:var(--spice-text);border:none;border-radius:999px;padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s}",
    ".lfm-pill:hover{background:rgba(255,255,255,.14)}",
    ".lfm-pill.on{background:var(--spice-button);color:var(--spice-main)}",
    ".lfm-status{padding:36px 0;color:var(--spice-subtext);font-size:15px;text-align:center}",
    ".lfm-error{color:#ff6b6b}",
    ".lfm-note{color:var(--spice-subtext);font-size:12px;margin:0 0 14px;font-style:italic}",
    ".lfm-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}",
    ".lfm-card{background:rgba(255,255,255,.05);padding:16px;border-radius:10px;text-align:center;transition:transform .2s,background .2s;cursor:default}",
    ".lfm-card:hover{background:rgba(255,255,255,.09);transform:translateY(-1px)}",
    ".lfm-card-val{font-size:24px;font-weight:800;margin-bottom:4px;color:#1db954}",
    ".lfm-card-lbl{font-size:10px;color:var(--spice-subtext);text-transform:uppercase;letter-spacing:1.2px;font-weight:600}",
    ".lfm-card-sub{font-size:10px;color:var(--spice-subtext);margin-top:3px;opacity:.7}",
    ".accent-green .lfm-card-val{color:#1db954}",
    ".accent-blue .lfm-card-val{color:#4a90d9}",
    ".accent-purple .lfm-card-val{color:#b266ff}",
    ".accent-orange .lfm-card-val{color:#e8912d}",
    ".lfm-sect{margin-top:22px}",
    ".lfm-sect-t{font-size:16px;font-weight:700;margin:0 0 10px}",
    ".lfm-2col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:6px}",
    "@media(max-width:900px){.lfm-2col{grid-template-columns:1fr}}",
    ".lfm-hbar{display:flex;flex-direction:column;gap:5px}",
    ".lfm-hbar-row{display:flex;align-items:center;gap:10px;padding:3px 0}",
    ".lfm-hbar-rank{width:22px;text-align:right;color:var(--spice-subtext);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;flex-shrink:0}",
    ".lfm-hbar-body{flex:1;min-width:0}",
    ".lfm-hbar-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".lfm-hbar-sub{font-size:11px;color:var(--spice-subtext);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".lfm-hbar-track{position:relative;height:18px;margin-top:3px;border-radius:4px;background:rgba(255,255,255,.04);overflow:hidden}",
    ".lfm-hbar-fill{position:absolute;top:0;left:0;height:100%;border-radius:4px;transition:width .5s ease;min-width:3px}",
    ".lfm-hbar-fill.c-green{background:#1db954;opacity:.65}",
    ".lfm-hbar-fill.c-blue{background:#4a90d9;opacity:.65}",
    ".lfm-hbar-fill.c-purple{background:#b266ff;opacity:.65}",
    ".lfm-hbar-fill.c-orange{background:#1db954;opacity:.65}",
    ".lfm-hbar-ct{position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;opacity:.85}",
    ".lfm-vbars{display:flex;align-items:flex-end;gap:3px;padding-top:8px}",
    ".lfm-vbar-col{flex:1;display:flex;flex-direction:column;align-items:center;min-width:0}",
    ".lfm-vbar-bar{width:100%;border-radius:3px 3px 0 0;transition:height .5s ease;min-height:2px}",
    ".lfm-vbar-bar.c-green{background:#1db954;opacity:.7}",
    ".lfm-vbar-bar.c-blue{background:#4a90d9;opacity:.7}",
    ".lfm-vbar-bar.c-purple{background:#b266ff;opacity:.7}",
    ".lfm-vbar-bar.c-orange{background:#1db954;opacity:.7}",
    ".lfm-vbar-lbl{font-size:9px;color:var(--spice-subtext);margin-top:4px;font-weight:600;white-space:nowrap}",
    ".lfm-rg{margin-bottom:18px}",
    ".lfm-rg-d{font-size:12px;font-weight:700;color:var(--spice-subtext);text-transform:uppercase;letter-spacing:.8px;margin:0 0 6px;padding-bottom:5px;border-bottom:1px solid rgba(255,255,255,.06)}",
    ".lfm-rr{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:5px;transition:background .15s}",
    ".lfm-rr:hover{background:rgba(255,255,255,.05)}",
    ".lfm-rr.np{background:rgba(29,185,84,.1);border-left:3px solid #1db954}",
    ".lfm-rr-info{display:flex;align-items:center;gap:6px;min-width:0;flex:1}",
    ".lfm-rr-name{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".lfm-rr-sep{color:var(--spice-subtext);font-size:11px;flex-shrink:0}",
    ".lfm-rr-art{color:var(--spice-subtext);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".lfm-rr-alb{color:rgba(255,255,255,.3);font-size:11px;margin-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".lfm-rr-time{color:var(--spice-subtext);font-size:11px;font-weight:600;flex-shrink:0;margin-left:10px}",
    ".lfm-recent-mini{display:flex;flex-direction:column;gap:1px}",
    ".lfm-pag{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)}",
    ".lfm-pbtn{background:rgba(255,255,255,.07);color:var(--spice-text);border:none;border-radius:999px;padding:7px 18px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s}",
    ".lfm-pbtn:hover:not(:disabled){background:rgba(255,255,255,.14)}",
    ".lfm-pbtn:disabled{opacity:.3;cursor:default}",
    ".lfm-pinfo{color:var(--spice-subtext);font-size:12px;font-weight:600}",
    ".lfm-heatmap{display:grid;grid-template-columns:40px repeat(24,1fr);gap:2px;margin-top:8px}",
    ".lfm-hm-corner{grid-column:1}",
    ".lfm-hm-hdr{font-size:9px;color:var(--spice-subtext);text-align:center;font-weight:600}",
    ".lfm-hm-day{font-size:10px;color:var(--spice-subtext);font-weight:600;display:flex;align-items:center}",
    ".lfm-hm-cell{aspect-ratio:1;border-radius:3px;background:#1db954;min-height:8px}",
    ".lfm-dd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:20px}",
    ".lfm-dd-chip{background:rgba(255,255,255,.05);border:1px solid transparent;border-radius:8px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .15s}",
    ".lfm-dd-chip:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.1)}",
    ".lfm-dd-chip.on{background:rgba(29,185,84,.15);border-color:#1db954}",
    ".lfm-dd-rank{color:var(--spice-subtext);font-size:11px;font-weight:700;flex-shrink:0}",
    ".lfm-dd-name{font-weight:600;font-size:13px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".lfm-dd-plays{color:var(--spice-subtext);font-size:11px;flex-shrink:0}",
    ".lfm-dd-detail{margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08)}",
    ".lfm-dd-h{font-size:22px;font-weight:800;margin:0 0 14px}",
    ".lfm-tag-cloud{display:flex;flex-wrap:wrap;gap:6px}",
    ".lfm-tag{background:rgba(255,255,255,.08);border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600}",
    ".lfm-tag.sim{background:rgba(29,185,84,.2);color:#1db954}",
    ".lfm-bio{color:var(--spice-subtext);font-size:13px;line-height:1.6;margin:0}",
    ".lfm-bio a{color:var(--spice-button);text-decoration:none}",
    ".lfm-cumul{display:flex;flex-direction:column;gap:8px}",
    ".lfm-cumul-row{display:flex;align-items:center;gap:12px}",
    ".lfm-cumul-lbl{width:130px;font-size:12px;font-weight:600;color:var(--spice-subtext);flex-shrink:0;text-align:right}",
    ".lfm-cumul-bar{flex:1;height:22px;background:rgba(255,255,255,.04);border-radius:4px;position:relative;overflow:hidden}",
    ".lfm-cumul-fill{height:100%;background:#1db954;opacity:.6;border-radius:4px;transition:width .6s ease}",
    ".lfm-cumul-pct{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700}"
  ].join("\n");
  document.head.appendChild(el);
})();

function render() { return Spicetify.React.createElement(App); }



