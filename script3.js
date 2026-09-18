1: 
2:         // ============================================================================
3:         // JOSHFIREAWARENESS - CONSOLIDATED VERSION (ChatGPT + Claude)
4:         // ============================================================================
5: 
6:         const FEEDS = {
7:             // Official EMV incident feed (may block file:// origins due to CORS)
8:             incidentsVicEmergency: "https://data.emergency.vic.gov.au/Show?pageId=getIncidentJSON",
9:             // Local/serverless proxy endpoint (preferred if available)
10:             incidentsVicEmergencyProxy: "/api/emv",
11:             // ArcGIS fallback feed
12:             incidentsArcGISLayer0: "https://emapdev.ffm.vic.gov.au/arcgis/rest/services/Incidents_all/FeatureServer/0/query",
13:             osrmRoute: "https://router.project-osrm.org/route/v1/driving"
14:         };
15: 
16:         const DEFAULTS = {
17:             radiusKm: 200,
18:             routeBufferKm: 10,
19:             homeZoom: 10,
20:             homeFallback: { lat: -36.717, lon: 144.275 },
21:             destFallback: { lat: -37.548, lon: 143.798 }
22:         };
23: 
24:         const $ = (id) => document.getElementById(id);
25: 
26:         const state = {
27:             home: { address: "", lat: null, lon: null },
28:             dest: { address: "", lat: null, lon: null },
29:             mode: "home",
30:             incidents: [],
31:             incidentsHome: [],
32:             incidentsDest: [],
33:             incidentsRoute: [],
34:             routes: [],
35:             chosenRouteIdx: 0,
36:             todayOnly: true,
37:             dayCards: [],
38:             wind: { dir: "", speed: "" },
39:             checkinPhone: ""
40:         };
41: 
42:         // Refresh control state
43:         let lastRefreshTime = null;
44:         let isRefreshDisabled = false;
45:         let map = null;
46:         let lastFeedSource = null;
47: 
48:         // ============================================================================
49:         // UTILITIES
50:         // ============================================================================
51:         function fmt(n, digits = 3) {
52:             return n == null || Number.isNaN(n) ? "--" : Number(n).toFixed(digits);
53:         }
54: 
55:         function km(n) {
56:             return n == null ? "--" : `${n.toFixed(1)} km`;
57:         }
58: 
59:         function haversineKm(lat1, lon1, lat2, lon2) {
60:             const R = 6371;
61:             const toRad = (d) => (d * Math.PI) / 180;
62:             const dLat = toRad(lat2 - lat1);
63:             const dLon = toRad(lon2 - lon1);
64:             const a =
65:                 Math.sin(dLat / 2) ** 2 +
66:                 Math.cos(toRad(lat1)) *
67:                     Math.cos(toRad(lat2)) *
68:                     Math.sin(dLon / 2) ** 2;
69:             return 2 * R * Math.asin(Math.sqrt(a));
70:         }
71: 
72:         function bearingDeg(lat1, lon1, lat2, lon2) {
73:             const toRad = (d) => (d * Math.PI) / 180;
74:             const toDeg = (r) => (r * 180) / Math.PI;
75:             const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
76:             const x =
77:                 Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
78:                 Math.sin(toRad(lat1)) *
79:                     Math.cos(toRad(lat2)) *
80:                     Math.cos(toRad(lon2 - lon1));
81:             let brng = toDeg(Math.atan2(y, x));
82:             brng = (brng + 360) % 360;
83:             return brng;
84:         }
85: 
86:         function compass(b) {
87:             const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
88:             return dirs[Math.round(b / 45) % 8];
89:         }
90: 
91:         function nowStr() {
92:             const d = new Date();
93:             return d.toLocaleString(undefined, {
94:                 weekday: "short",
95:                 year: "numeric",
96:                 month: "short",
97:                 day: "2-digit",
98:                 hour: "2-digit",
99:                 minute: "2-digit"
100:             });
101:         }
102: 
103:         function todayKey() {
104:             return new Date().toISOString().slice(0, 10);
105:         }
106: 
107:         function toDateKey(d) {
108:             return d.toISOString().slice(0, 10);
109:         }
110: 
111:         function formatCardDate(dateKey) {
112:             if (!dateKey) return "";
113:             const d = new Date(`${dateKey}T00:00:00`);
114:             return d.toLocaleDateString(undefined, {
115:                 weekday: "short",
116:                 day: "2-digit",
117:                 month: "short"
118:             });
119:         }
120: 
121:         function relativeTitleForDate(dateKey) {
122:             if (!dateKey) return "Day Card";
123:             const today = new Date();
124:             today.setHours(0, 0, 0, 0);
125:             const target = new Date(`${dateKey}T00:00:00`);
126:             const diffDays = Math.round((target - today) / (24 * 60 * 60 * 1000));
127:             if (diffDays === 0) return "Today";
128:             if (diffDays === 1) return "Tomorrow";
129:             return "Upcoming";
130:         }
131: 
132:         function updateWindSummary() {
133:             const dir = state.wind.dir;
134:             const speed = state.wind.speed;
135:             const summary = $("windSummary");
136:             const needle = $("windCompassNeedle");
137:             if (!dir && !speed) {
138:                 summary.textContent = "Wind not set.";
139:                 if (needle) needle.setAttribute("transform", "rotate(0)");
140:                 return;
141:             }
142:             if (dir && speed) {
143:                 summary.textContent = `Wind ${dir} at ${speed} km/h.`;
144:             } else if (dir) {
145:                 summary.textContent = `Wind direction: ${dir}.`;
146:             } else {
147:                 summary.textContent = `Wind speed: ${speed} km/h.`;
148:             }
149:             if (needle && dir) {
150:                 const deg = windDirToDeg(dir);
151:                 needle.setAttribute("transform", `rotate(${deg})`);
152:             }
153:         }
154: 
155:         function windDirToDeg(dir) {
156:             const map = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
157:             return map[dir] ?? 0;
158:         }
159: 
160:         function updateOfflineBanner() {
161:             const banner = $("offlineBanner");
162:             if (!banner) return;
163:             banner.style.display = navigator.onLine ? "none" : "block";
164:         }
165: 
166:         function updateGoogleRouteLink() {
167:             const home = (state.home.address || "").trim();
168:             const dest = (state.dest.address || "").trim();
169:             const link = $("googleRouteLink");
170:             if (!link) return;
171:             if (!home || !dest) {
172:                 link.href = "https://www.google.com/maps";
173:                 return;
174:             }
175:             const base = "https://www.google.com/maps/dir/?api=1";
176:             const params = new URLSearchParams({
177:                 origin: home,
178:                 destination: dest,
179:                 travelmode: "driving"
180:             });
181:             link.href = `${base}&${params.toString()}`;
182:         }
183: 
184:         function updateCheckin() {
185:             const phone = (state.checkinPhone || "").trim();
186:             const preview = $("checkinPreview");
187:             const btn = $("checkinSend");
188:             const home = (state.home.address || "").trim();
189:             const dest = (state.dest.address || "").trim();
190:             const messageBase = "We're safe. Heading from";
191:             const message =
192:                 home && dest
193:                     ? `${messageBase} ${home} to ${dest}.`
194:                     : "We're safe. Will update again soon.";
195:             const smsBase = `sms:${encodeURIComponent(phone)}`;
196:             const smsHref = phone ? `${smsBase}?body=${encodeURIComponent(message)}` : "";
197: 
198:             preview.textContent = message;
199:             btn.disabled = !phone;
200:             btn.setAttribute("data-sms", smsHref);
201:         }
202: 
203:         function escapeHtml(s) {
204:             return String(s)
205:                 .replaceAll("&", "&amp;")
206:                 .replaceAll("<", "&lt;")
207:                 .replaceAll(">", "&gt;")
208:                 .replaceAll('"', "&quot;");
209:         }
210: 
211:         // ============================================================================
212:         // GEOCODING
213:         // ============================================================================
214:         async function geocodeAddress(q) {
215:             try {
216:                 const url =
217:                     "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
218:                     encodeURIComponent(q);
219:                 const res = await fetch(url, {
220:                     headers: { Accept: "application/json" }
221:                 });
222:                 if (!res.ok) throw new Error("Geocode service unavailable");
223:                 const data = await res.json();
224:                 if (!data || !data.length) throw new Error("Address not found");
225:                 return {
226:                     lat: Number(data[0].lat),
227:                     lon: Number(data[0].lon),
228:                     display: data[0].display_name
229:                 };
230:             } catch (err) {
231:                 throw new Error(`Geocoding failed: ${err.message}. Try a different address or use GPS.`);
232:             }
233:         }
234: 
235:         async function useGPS() {
236:             return new Promise((resolve, reject) => {
237:                 if (!navigator.geolocation) return reject(new Error("No GPS"));
238:                 navigator.geolocation.getCurrentPosition(
239:                     (pos) =>
240:                         resolve({
241:                             lat: pos.coords.latitude,
242:                             lon: pos.coords.longitude
243:                         }),
244:                     (err) => reject(err),
245:                     { enableHighAccuracy: true, timeout: 10000 }
246:                 );
247:             });
248:         }
249: 
250:         // ============================================================================
251:         // STORAGE
252:         // ============================================================================
253:         function loadCached() {
254:             try {
255:                 const raw = localStorage.getItem("JoshFireAwareness.v1");
256:                 if (!raw) return;
257:                 const obj = JSON.parse(raw);
258:                 if (obj?.home) {
259:                     state.home = { ...state.home, ...obj.home };
260:                 }
261:                 if (obj?.dest) {
262:                     state.dest = { ...state.dest, ...obj.dest };
263:                 }
264:                 if (obj?.radiusKm) {
265:                     $("radiusKm").value = String(obj.radiusKm);
266:                 }
267:                 if (typeof obj?.todayOnly === "boolean") {
268:                     state.todayOnly = obj.todayOnly;
269:                     $("todayOnly").checked = obj.todayOnly;
270:                 }
271:                 if (Array.isArray(obj?.dayCards)) {
272:                     state.dayCards = obj.dayCards.map((card) => {
273:                         const autoTitle =
274:                             typeof card.autoTitle === "boolean"
275:                                 ? card.autoTitle
276:                                 : ["Tonight", "Today", "Tomorrow"].includes(card.title);
277:                         return { ...card, autoTitle };
278:                     });
279:                 }
280:                 if (obj?.wind) {
281:                     state.wind = {
282:                         dir: String(obj.wind.dir || ""),
283:                         speed: String(obj.wind.speed || "")
284:                     };
285:                     $("windDir").value = state.wind.dir;
286:                     $("windSpeed").value = state.wind.speed;
287:                     updateWindSummary();
288:                 }
289:                 if (typeof obj?.checkinPhone === "string") {
290:                     state.checkinPhone = obj.checkinPhone;
291:                     $("checkinPhone").value = obj.checkinPhone;
292:                     updateCheckin();
293:                 }
294:             } catch (e) {}
295:         }
296: 
297:         function saveCached() {
298:             const obj = {
299:                 home: {
300:                     address: state.home.address,
301:                     lat: state.home.lat,
302:                     lon: state.home.lon
303:                 },
304:                 dest: {
305:                     address: state.dest.address,
306:                     lat: state.dest.lat,
307:                     lon: state.dest.lon
308:                 },
309:                 radiusKm: Number($("radiusKm").value),
310:                 todayOnly: Boolean(state.todayOnly),
311:                 dayCards: state.dayCards,
312:                 wind: state.wind,
313:                 checkinPhone: state.checkinPhone
314:             };
315:             localStorage.setItem("JoshFireAwareness.v1", JSON.stringify(obj));
316:         }
317: 
318:         function clearCached() {
319:             localStorage.removeItem("JoshFireAwareness.v1");
320:         }
321: 
322:         function defaultDayCards() {
323:             const today = new Date();
324:             const tomorrow = new Date();
325:             tomorrow.setDate(today.getDate() + 1);
326:             return [
327:                 makeTodayCard(toDateKey(today)),
328:                 {
329:                     id: `day-${Math.random().toString(16).slice(2)}`,
330:                     title: "Tomorrow",
331:                     date: toDateKey(tomorrow),
332:                     items: [
333:                         "Route: Calder Hwy -> Western Fwy",
334:                         "Distance: ~95km (1h 15m)",
335:                         "Depart: 8:00-9:00am (cooler, safer)",
336:                         "Conditions: High danger (improving)",
337:                         "Psalm 23:1-2"
338:                     ],
339:                     hidden: false,
340:                     autoTitle: true
341:                 }
342:             ];
343:         }
344: 
345:         let showHiddenDayCards = false;
346: 
347:         function defaultTodayItems() {
348:             return [
349:                 "6:30pm: Simple dinner (dairy-free)",
350:                 "7:00pm: Wind-down, dark room, fan",
351:                 "7:30pm: Check VicEmergency",
352:                 "8:00pm: Bed time",
353:                 "ABC Radio on low volume"
354:             ];
355:         }
356: 
357:         function makeTodayCard(dateKey) {
358:             return {
359:                 id: `day-${Math.random().toString(16).slice(2)}`,
360:                 title: "Today",
361:                 date: dateKey,
362:                 items: defaultTodayItems(),
363:                 hidden: false,
364:                 autoTitle: true
365:             };
366:         }
367: 
368:         function ensureTodayCard() {
369:             const key = todayKey();
370:             const hasToday = state.dayCards.some((card) => card.date === key);
371:             if (!hasToday) {
372:                 state.dayCards.push(makeTodayCard(key));
373:                 saveCached();
374:             }
375:         }
376: 
377:         function renderDayCards() {
378:             const container = $("dayCards");
379:             if (!container) return;
380:             container.innerHTML = "";
381: 
382:             const today = new Date();
383:             today.setHours(0, 0, 0, 0);
384: 
385:             const visibleCards = state.dayCards.filter((card) => {
386:                 if (!card || !card.date) return false;
387:                 const cardDate = new Date(`${card.date}T00:00:00`);
388:                 if (cardDate < today) return false;
389:                 if (card.hidden && !showHiddenDayCards) return false;
390:                 return true;
391:             });
392: 
393:             if (!visibleCards.length) {
394:                 const empty = document.createElement("div");
395:                 empty.className = "card";
396:                 empty.innerHTML = `<div class="small">No active day cards. Add one if needed.</div>`;
397:                 container.appendChild(empty);
398:                 return;
399:             }
400: 
401:             for (const card of visibleCards) {
402:                 const cardEl = document.createElement("div");
403:                 cardEl.className = `card${card.hidden ? " day-card-hidden" : ""}`;
404:                 const dateLabel = formatCardDate(card.date);
405:                 const titleText = card.autoTitle
406:                     ? relativeTitleForDate(card.date)
407:                     : card.title || "Day Card";
408:                 const items = Array.isArray(card.items) ? card.items : [];
409:                 
410:                 // Initialize checklist state if missing
411:                 if (!card.checklist) card.checklist = {};
412:                 
413:                 const itemHtml = items.length
414:                     ? `<ul class="checklist">${items
415:                           .map((i, idx) => {
416:                               const itemId = `${card.id}-${idx}`;
417:                               const isChecked = card.checklist[itemId] ? 'checked' : '';
418:                               return `<li><label><input type="checkbox" class="checklist-item" data-card-id="${card.id}" data-item-idx="${idx}" ${isChecked} /> <span>${escapeHtml(i)}</span></label></li>`;
419:                           })
420:                           .join("")}</ul>`
421:                     : `<div class="small">No items yet.</div>`;
422: 
423:                 cardEl.innerHTML = `
424:                     <div class="day-card-title">
425:                         <h2>${escapeHtml(titleText)}</h2>
426:                         <div class="date">${escapeHtml(dateLabel)}</div>
427:                     </div>
428:                     ${itemHtml}
429:                     <div class="card-actions">
430:                         <button class="btn" data-action="edit" data-id="${card.id}">Edit</button>
431:                         <button class="btn" data-action="hide" data-id="${card.id}">
432:                             ${card.hidden ? "Unhide" : "Hide"}
433:                         </button>
434:                         <button class="btn warning" data-action="delete" data-id="${card.id}">Delete</button>
435:                     </div>
436:                 `;
437:                 container.appendChild(cardEl);
438:             }
439: 
440:             // Wire up checklist item toggles
441:             document.querySelectorAll('.checklist-item').forEach((checkbox) => {
442:                 checkbox.addEventListener('change', (event) => {
443:                     const cardId = event.target.getAttribute('data-card-id');
444:                     const itemIdx = parseInt(event.target.getAttribute('data-item-idx'), 10);
445:                     const card = state.dayCards.find((c) => c.id === cardId);
446:                     if (card) {
447:                         if (!card.checklist) card.checklist = {};
448:                         const itemId = `${cardId}-${itemIdx}`;
449:                         if (event.target.checked) {
450:                             card.checklist[itemId] = true;
451:                         } else {
452:                             delete card.checklist[itemId];
453:                         }
454:                         saveCached();
455:                     }
456:                 });
457:             });
458:         }
459: 
460:         // ============================================================================
461:         // INCIDENT FEED (Victoria Emergency Management)
462:         // ============================================================================
463:         function normaliseIncident(f) {
464:             // Support both ArcGIS format (attributes/geometry) and EMV format (direct properties)
465:             const a = f.attributes || f; // EMV data is direct properties, ArcGIS uses attributes
466:             const g = f.geometry || {};
467:             
468:             // Try multiple latitude/longitude field names
469:             const lat = g.y ?? g.latitude ?? a.latitude ?? a.Latitude ?? null;
470:             const lon = g.x ?? g.longitude ?? a.longitude ?? a.Longitude ?? null;
471: 
472:             const updated = a.UPDATED
473:                 ? new Date(a.UPDATED).toISOString()
474:                 : a.lastUpdatedDtStr
475:                 ? new Date(a.lastUpdatedDtStr).toISOString()
476:                 : a.LastUpdatedAt
477:                 ? new Date(a.LastUpdatedAt).toISOString()
478:                 : null;
479:             const started = a.STARTED
480:                 ? new Date(a.STARTED).toISOString()
481:                 : a.originDateTimeStr
482:                 ? new Date(a.originDateTimeStr).toISOString()
483:                 : a.INC_DATE_TIME
484:                 ? new Date(a.INC_DATE_TIME).toISOString()
485:                 : null;
486: 
487:             return {
488:                 id:
489:                     a.EMI_GUID ||
490:                     a.INCIDENTNUM ||
491:                     a.incidentNo ||
492:                     a.INC_NUMBER ||
493:                     a.INC_ID ||
494:                     a.INC_KEY ||
495:                     a.INCIDENTNAME ||
496:                     a.NAME ||
497:                     a.name ||
498:                     Math.random().toString(16).slice(2),
499:                 name: a.INCIDENTNAME || a.NAME || a.name || "Unnamed incident",
500:                 status: a.STATUS || a.Status || a.incidentStatus || "Unknown",
501:                 type:
502:                     a.TYPE ||
503:                     a.Type ||
504:                     a.category2 ||
505:                     a.category1 ||
506:                     a.incidentType ||
507:                     "Unknown",
508:                 location: a.LOCATION || a.Location || a.incidentLocation || "",
509:                 agency: a.AGENCY || a.Agency || a.agency || "",
510:                 lat,
511:                 lon,
512:                 updatedISO: updated,
513:                 startedISO: started
514:             };
515:         }
516: 
517:         function isFireType(incident, filter) {
518:             if (filter === "all") return true;
519:             const t = (incident.type || "").toLowerCase();
520:             if (filter === "Fire") return t.includes("fire");
521:             return t.includes(filter.toLowerCase());
522:         }
523: 
524:         function statusLevel(statusText) {
525:             const s = (statusText || "").toLowerCase();
526:             if (
527:                 s.includes("safe") ||
528:                 s.includes("closed") ||
529:                 s.includes("contained") ||
530:                 s.includes("patrol")
531:             )
532:                 return "good";
533:             if (
534:                 s.includes("controlled") ||
535:                 s.includes("being controlled") ||
536:                 s.includes("under control")
537:             )
538:                 return "warn";
539:             if (
540:                 s.includes("out of control") ||
541:                 s.includes("going") ||
542:                 s.includes("not controlled") ||
543:                 s.includes("spreading")
544:             )
545:                 return "bad";
546:             return "warn";
547:         }
548: 
549:         function statusTooltip(statusText) {
550:             const s = (statusText || "").toLowerCase();
551:             if (s.includes("emergency warning")) {
552:                 return "Emergency Warning: Immediate danger. Leave now or take shelter as advised.";
553:             }
554:             if (s.includes("watch") && s.includes("act")) {
555:                 return "Watch and Act: Conditions are changing. Prepare to leave and monitor updates.";
556:             }
557:             if (s.includes("advice")) {
558:                 return "Advice: Stay informed. No immediate action required but monitor updates.";
559:             }
560:             if (s.includes("not yet under control")) {
561:                 return "Not Yet Under Control: Active spread risk.";
562:             }
563:             if (s.includes("being controlled") || s.includes("under control")) {
564:                 return "Under Control: Containment is improving but remain alert.";
565:             }
566:             if (s.includes("contained")) {
567:                 return "Contained: Spread has been stopped, but hot spots may remain.";
568:             }
569:             return "See Incident Dictionary for definitions.";
570:         }
571: 
572:         function filterIncidentsByToday(incidents) {
573:             if (!state.todayOnly) return incidents;
574:             const today = new Date().toDateString();
575:             return incidents.filter((inc) => {
576:                 const iso = inc.updatedISO || inc.startedISO;
577:                 if (!iso) return false;
578:                 const d = new Date(iso);
579:                 return d.toDateString() === today;
580:             });
581:         }
582: 
583:         function buildArcGISQueryURL(lat, lon, radiusKm) {
584:             const params = new URLSearchParams({
585:                 where: "1=1",
586:                 outFields: "*",
587:                 f: "json",
588:                 geometry: `${lon},${lat}`,
589:                 geometryType: "esriGeometryPoint",
590:                 inSR: "4326",
591:                 spatialRel: "esriSpatialRelIntersects",
592:                 distance: String(radiusKm),
593:                 units: "esriSRUnit_Kilometer"
594:             });
595:             return `${FEEDS.incidentsArcGISLayer0}?${params.toString()}`;
596:         }
597: 
598:         async function fetchIncidentsFromArcGIS(lat, lon, radiusKm) {
599:             const url = buildArcGISQueryURL(lat, lon, radiusKm);
600:             const res = await fetch(url, { headers: { Accept: "application/json" } });
601:             if (!res.ok) throw new Error("ArcGIS incident feed failed");
602:             const data = await res.json();
603:             const incidents = data?.features || [];
604:             return incidents
605:                 .map(normaliseIncident)
606:                 .filter((x) => x.lat != null && x.lon != null);
607:         }
608: 
609:         async function fetchIncidentsFromEMV(url) {
610:             // Robust fetch: use local cache (2min), retries with backoff, and record source
611:             const cacheKey = `JoshFireAwareness.emv.${url}`;
612:             const now = Date.now();
613:             try {
614:                 const raw = localStorage.getItem(cacheKey);
615:                 if (raw) {
616:                     const obj = JSON.parse(raw);
617:                     if (obj?.ts && now - new Date(obj.ts).getTime() < 2 * 60 * 1000) {
618:                         setFeedSourceDisplay('cache');
619:                         const items = Array.isArray(obj.body) ? obj.body : obj.body?.incidents || obj.body?.features || [];
620:                         return (items || []).map(normaliseIncident).filter((x) => x.lat != null && x.lon != null);
621:                     }
622:                 }
623:             } catch (e) {
624:                 // ignore cache errors
625:             }
626: 
627:             const maxAttempts = 3;
628:             let lastErr = null;
629:             for (let attempt = 1; attempt <= maxAttempts; attempt++) {
630:                 try {
631:                     const res = await fetch(url, { headers: { Accept: 'application/json' } });
632:                     if (!res.ok) throw new Error(`EMV fetch failed: ${res.status}`);
633:                     const data = await res.json();
634:                     // cache the raw response
635:                     try {
636:                         localStorage.setItem(cacheKey, JSON.stringify({ ts: new Date().toISOString(), body: data }));
637:                     } catch (e) {}
638:                     setFeedSourceDisplay(url === FEEDS.incidentsVicEmergencyProxy ? 'proxy' : 'emv');
639:                     const items = Array.isArray(data) ? data : data?.incidents || data?.features || [];
640:                     return (items || []).map(normaliseIncident).filter((x) => x.lat != null && x.lon != null);
641:                 } catch (err) {
642:                     lastErr = err;
643:                     console.warn(`EMV fetch attempt ${attempt} failed for ${url}:`, err);
644:                     // exponential backoff
645:                     await new Promise((r) => setTimeout(r, attempt * 500));
646:                 }
647:             }
648:             throw lastErr || new Error('EMV fetch failed');
649:         }
650: 
651:         async function fetchIncidentsNear(lat, lon, radiusKm) {
652:             // Try serverless/local proxy first (if deployed or running locally)
653:             const isLocalHost =
654:                 location.hostname === "localhost" || location.hostname === "127.0.0.1";
655:             const tryUrls = [
656:                 FEEDS.incidentsVicEmergencyProxy,
657:                 isLocalHost ? FEEDS.incidentsVicEmergencyProxyLocal : "",
658:                 FEEDS.incidentsVicEmergency
659:             ];
660:             
661:             let lastError = null;
662:             for (const u of tryUrls) {
663:                 if (!u) continue;
664:                 try {
665:                     const incidents = await fetchIncidentsFromEMV(u);
666:                     // Filter by distance
667:                     const filtered = incidents.filter((inc) => haversineKm(lat, lon, inc.lat, inc.lon) <= radiusKm);
668:                     return filtered;
669:                 } catch (err) {
670:                     console.warn(`EMV source failed (${u}):`, err);
671:                     lastError = err;
672:                     // try next
673:                 }
674:             }
675: 
676:             // Fall back to ArcGIS which has historically worked from the browser
677:             try {
678:                 const results = await fetchIncidentsFromArcGIS(lat, lon, radiusKm);
679:                 if (results.length === 0 && lastError) {
680:                     // No incidents found even after fallback - show warning
681:                     showError(
682:                         '⚠️ Incident data unavailable. Using cached data or no incidents nearby. Check VicEmergency.vic.gov.au directly.',
683:                         () => render()
684:                     );
685:                 }
686:                 return results;
687:             } catch (error) {
688:                 console.error("All incident feed sources failed:", error);
689:                 showError(
690:                     '❌ Cannot load incident data. Check your internet connection or visit VicEmergency.vic.gov.au directly.',
691:                     () => render()
692:                 );
693:                 return [];
694:             }
695:         }
696:         }
697: 
698:         // ============================================================================
699:         // ROUTING (OSRM)
700:         // ============================================================================
701:         async function fetchRoutes(origin, dest) {
702:             const url = `${FEEDS.osrmRoute}/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
703:             const res = await fetch(url, { headers: { Accept: "application/json" } });
704:             if (!res.ok) throw new Error("Routing failed");
705:             const data = await res.json();
706:             if (data.code !== "Ok") throw new Error("Routing not OK");
707:             return (data.routes || []).map((r, idx) => ({
708:                 idx,
709:                 distanceKm: r.distance / 1000,
710:                 durationMin: r.duration / 60,
711:                 geometry: r.geometry
712:             }));
713:         }
714: 
715:         function scoreRouteAgainstIncidents(route, incidents, bufferKm) {
716:             const line = turf.lineString(route.geometry.coordinates);
717:             let near = [];
718:             for (const inc of incidents) {
719:                 const pt = turf.point([inc.lon, inc.lat]);
720:                 const d = turf.pointToLineDistance(pt, line, { units: "kilometers" });
721:                 if (d <= bufferKm) {
722:                     near.push({ ...inc, routeDistKm: d });
723:                 }
724:             }
725:             near.sort((a, b) => a.routeDistKm - b.routeDistKm);
726:             return { count: near.length, near };
727:         }
728: 
729:         // ============================================================================
730:         // MAP
731:         // ============================================================================
732:         const layers = {
733:                 homeMarker: null,
734:                 destMarker: null,
735:                 homeCircle: null,
736:                 destCircle: null,
737:             incidentMarkers: [],
738:             incidentCluster: null,
739:                 routeLine: null
740:             };
741: 
742:         function initMap() {
743:             map = L.map("map", { zoomControl: true });
744:             L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
745:                 maxZoom: 19,
746:                 attribution: "(c) OpenStreetMap"
747:             }).addTo(map);
748: 
749:             // Add marker cluster group for incidents
750:             if (window.L && L.markerClusterGroup) {
751:                 layers.incidentCluster = L.markerClusterGroup();
752:                 map.addLayer(layers.incidentCluster);
753:             }
754: 
755:             const start = state.home.lat
756:                 ? [state.home.lat, state.home.lon]
757:                 : [DEFAULTS.homeFallback.lat, DEFAULTS.homeFallback.lon];
758:             map.setView(start, DEFAULTS.homeZoom);
759:         }
760: 
761:         function clearIncidentMarkers() {
762:             if (!map) return;
763:             if (layers.incidentCluster) {
764:                 try { layers.incidentCluster.clearLayers(); } catch (e) {}
765:             }
766:             for (const m of layers.incidentMarkers) {
767:                 try { map.removeLayer(m); } catch (e) {}
768:             }
769:             layers.incidentMarkers = [];
770:         }
771: 
772:         function setRouteLine(geojson) {
773:             if (!map) return;
774:             if (layers.routeLine) {
775:                 map.removeLayer(layers.routeLine);
776:                 layers.routeLine = null;
777:             }
778:             layers.routeLine = L.geoJSON(geojson, { style: { weight: 4, color: "#93c5fd" } }).addTo(map);
779:         }
780: 
781:         function setMarker(which, lat, lon, label) {
782:             if (!map) return;
783:             const pos = [lat, lon];
784:             if (which === "home") {
785:                 if (layers.homeMarker) map.removeLayer(layers.homeMarker);
786:                 layers.homeMarker = L.marker(pos)
787:                     .addTo(map)
788:                     .bindPopup(`<b>Home</b><br>${escapeHtml(label)}`);
789:                 if (layers.homeCircle) map.removeLayer(layers.homeCircle);
790:                 layers.homeCircle = L.circle(pos, {
791:                     radius: 50000,
792:                     color: "#4ade80",
793:                     weight: 1,
794:                     opacity: 0.3,
795:                     fillOpacity: 0.05
796:                 }).addTo(map);
797:             } else {
798:                 if (layers.destMarker) map.removeLayer(layers.destMarker);
799:                 layers.destMarker = L.marker(pos)
800:                     .addTo(map)
801:                     .bindPopup(`<b>Destination</b><br>${escapeHtml(label)}`);
802:                 if (layers.destCircle) map.removeLayer(layers.destCircle);
803:                 layers.destCircle = L.circle(pos, {
804:                     radius: 50000,
805:                     color: "#93c5fd",
806:                     weight: 1,
807:                     opacity: 0.3,
808:                     fillOpacity: 0.05
809:                 }).addTo(map);
810:             }
811:         }
812: 
813:         function plotIncidents(baseLat, baseLon, incidents) {
814:             if (!map) return incidents;
815:             clearIncidentMarkers();
816:             const filtered = incidents;
817:             for (const inc of filtered) {
818:                 const d = haversineKm(baseLat, baseLon, inc.lat, inc.lon);
819:                 const b = bearingDeg(baseLat, baseLon, inc.lat, inc.lon);
820:                 const lvl = statusLevel(inc.status);
821:                 const color =
822:                     lvl === "bad" ? "#fb7185" : lvl === "warn" ? "#fbbf24" : "#4ade80";
823:                 const icon = L.divIcon({
824:                     html: `<div style="background:${color}; color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">${escapeHtml(
825:                         inc.type || "Fire"
826:                     )}</div>`,
827:                     className: "",
828:                     iconSize: [80, 18],
829:                     iconAnchor: [40, 9]
830:                 });
831:                 const m = L.marker([inc.lat, inc.lon], { icon });
832:                 if (layers.incidentCluster && layers.incidentCluster.addLayer) {
833:                     layers.incidentCluster.addLayer(m);
834:                 } else {
835:                     m.addTo(map);
836:                 }
837:                 const vicEmLink = inc.id
838:                     ? `https://emergency.vic.gov.au/respond/#/incident/${encodeURIComponent(inc.id)}`
839:                     : "https://emergency.vic.gov.au/";
840:                 m.bindPopup(`
841:           <b>${escapeHtml(inc.name)}</b><br>
842:           <small>${escapeHtml(inc.type)} - <span title="${escapeHtml(
843:               statusTooltip(inc.status)
844:           )}">${escapeHtml(inc.status)}</span></small><br>
845:           ${escapeHtml(inc.location)}<br>
846:           <code>${km(d)} - ${compass(b)}</code><br>
847:           <a href="${vicEmLink}" target="_blank">VicEmergency</a>
848:         `);
849:                 layers.incidentMarkers.push(m);
850:             }
851:             if (filtered.length) {
852:                 try {
853:                     const bounds = layers.incidentCluster && layers.incidentCluster.getBounds
854:                         ? layers.incidentCluster.getBounds()
855:                         : L.featureGroup(layers.incidentMarkers).getBounds();
856:                     if (bounds && bounds.isValid && bounds.isValid()) {
857:                         map.fitBounds(bounds.pad(0.25));
858:                     } else if (bounds && bounds.getSouthWest) {
859:                         map.fitBounds(bounds.pad(0.25));
860:                     }
861:                 } catch (e) {
862:                     // ignore fitBounds errors
863:                 }
864:             }
865:             return filtered;
866:         }
867: 
868:         // ============================================================================
869:         // UI RENDERING
870:         // ============================================================================
871:         function renderCoords() {
872:             $("homeCoords").textContent =
873:                 state.home.lat && state.home.lon
874:                     ? `${fmt(state.home.lat, 4)}, ${fmt(state.home.lon, 4)}`
875:                     : "--";
876:             $("destCoords").textContent =
877:                 state.dest.lat && state.dest.lon
878:                     ? `${fmt(state.dest.lat, 4)}, ${fmt(state.dest.lon, 4)}`
879:                     : "--";
880:         }
881: 
882:         function renderIncList(baseLat, baseLon, incidents) {
883:             const list = $("incList");
884:             list.innerHTML = "";
885: 
886:             const rows = incidents
887:                 .map((i) => {
888:                     const d = haversineKm(baseLat, baseLon, i.lat, i.lon);
889:                     const b = bearingDeg(baseLat, baseLon, i.lat, i.lon);
890:                     return { ...i, distKm: d, bearing: b };
891:                 })
892:                 .sort((a, b) => a.distKm - b.distKm)
893:                 .slice(0, 30);
894: 
895:             if (!rows.length) {
896:                 list.innerHTML = `<div class="small">No incidents returned. Use official links above.</div>`;
897:                 return;
898:             }
899: 
900:             for (const inc of rows) {
901:                 const lvl = statusLevel(inc.status);
902:                 const vicEmLink = inc.id
903:                     ? `https://emergency.vic.gov.au/respond/#/incident/${encodeURIComponent(inc.id)}`
904:                     : "https://emergency.vic.gov.au/";
905:                 const el = document.createElement("div");
906:                 el.className = "incident-item";
907:                 const tooltip = escapeHtml(statusTooltip(inc.status));
908:                 el.innerHTML = `
909:           <div style="display:flex; justify-content:space-between; align-items:flex-start">
910:             <div class="name">${escapeHtml(inc.name)}</div>
911:             <span class="badge ${lvl}" title="${tooltip}">${escapeHtml(inc.status)}</span>
912:           </div>
913:           <div class="meta">
914:             <div>${escapeHtml(inc.type)} - ${escapeHtml(inc.location || "")}</div>
915:             <div class="mono">${km(inc.distKm)} - ${compass(inc.bearing)}</div>
916:             <a href="${vicEmLink}" target="_blank">VicEmergency</a>
917:           </div>
918:         `;
919:                 list.appendChild(el);
920:             }
921:         }
922: 
923:         function setRiskFromNearest(labelEl, whyEl, nearest) {
924:             if (!nearest) {
925:                 labelEl.textContent = "?";
926:                 labelEl.className = "value warn";
927:                 whyEl.textContent = "No live data. Check VicEmergency.";
928:                 return;
929:             }
930:             const lvl = statusLevel(nearest.status);
931:             if (nearest.distKm <= 30 && lvl === "bad") {
932:                 labelEl.textContent = "Higher";
933:                 labelEl.className = "value bad";
934:                 whyEl.textContent = `${nearest.name} ~${nearest.distKm.toFixed(1)} km away (${nearest.status}).`;
935:                 return;
936:             }
937:             if (nearest.distKm <= 50 && (lvl === "bad" || lvl === "warn")) {
938:                 labelEl.textContent = "Moderate";
939:                 labelEl.className = "value warn";
940:                 whyEl.textContent = `${nearest.name} ~${nearest.distKm.toFixed(1)} km away (${nearest.status}).`;
941:                 return;
942:             }
943:             labelEl.textContent = "Lower";
944:             labelEl.className = "value good";
945:             whyEl.textContent = nearest
946:                 ? `Nearest: ${nearest.name} ~${nearest.distKm.toFixed(1)} km (${nearest.status}).`
947:                 : "";
948:         }
949: 
950:         function rescoreRoutes() {
951:             const homeList = filterIncidentsByToday(state.incidentsHome);
952:             const destList = filterIncidentsByToday(state.incidentsDest);
953:             const allForRoute = homeList.length ? homeList : destList;
954:             state.incidentsRoute = [];
955: 
956:             if (state.routes.length && allForRoute.length) {
957:                 const scored = state.routes
958:                     .map((r) => {
959:                         const s = scoreRouteAgainstIncidents(r, allForRoute, DEFAULTS.routeBufferKm);
960:                         return { ...r, nearCount: s.count, near: s.near };
961:                     })
962:                     .sort((a, b) => a.nearCount - b.nearCount || a.durationMin - b.durationMin);
963: 
964:                 state.routes = scored;
965:                 state.chosenRouteIdx = 0;
966:                 state.incidentsRoute = scored[0].near.map((x) => ({
967:                     ...x,
968:                     distKm: x.routeDistKm
969:                 }));
970:                 setRouteLine(scored[0].geometry);
971:             } else {
972:                 if (layers.routeLine) {
973:                     map.removeLayer(layers.routeLine);
974:                     layers.routeLine = null;
975:                 }
976:             }
977:         }
978: 
979:         // ============================================================================
980:         // MAIN FLOW
981:         // ============================================================================
982:         async function refreshAll() {
983:             $("refreshBtn").disabled = true;
984:             $("lastUpdate").textContent = "Updating...";
985: 
986:             if (!state.home.lat || !state.home.lon) {
987:                 state.home = { ...state.home, ...DEFAULTS.homeFallback };
988:             }
989:             if (!state.dest.lat || !state.dest.lon) {
990:                 state.dest = { ...state.dest, ...DEFAULTS.destFallback };
991:             }
992: 
993:             const radiusKm = Number($("radiusKm").value || DEFAULTS.radiusKm);
994: 
995:             setMarker("home", state.home.lat, state.home.lon, state.home.address || "Home");
996:             setMarker("dest", state.dest.lat, state.dest.lon, state.dest.address || "Destination");
997: 
998:             try {
999:                 state.incidentsHome = await fetchIncidentsNear(
1000:                     state.home.lat,
1001:                     state.home.lon,
1002:                     radiusKm
1003:                 );
1004:             } catch (e) {
1005:                 state.incidentsHome = [];
1006:                 console.warn("Home incident feed failed:", e);
1007:             }
1008: 
1009:             try {
1010:                 state.incidentsDest = await fetchIncidentsNear(
1011:                     state.dest.lat,
1012:                     state.dest.lon,
1013:                     radiusKm
1014:                 );
1015:             } catch (e) {
1016:                 state.incidentsDest = [];
1017:                 console.warn("Dest incident feed failed:", e);
1018:             }
1019: 
1020:             try {
1021:                 state.routes = await fetchRoutes(
1022:                     { lat: state.home.lat, lon: state.home.lon },
1023:                     { lat: state.dest.lat, lon: state.dest.lon }
1024:                 );
1025:             } catch (e) {
1026:                 state.routes = [];
1027:                 console.warn("Routes failed:", e);
1028:             }
1029: 
1030:             rescoreRoutes();
1031: 
1032:             render();
1033: 
1034:             $("lastUpdate").textContent = nowStr();
1035:             $("refreshBtn").disabled = false;
1036:             saveCached();
1037:             
1038:             // Record the time this refresh completed
1039:             recordRefreshTime();
1040:         }
1041: 
1042:         function render() {
1043:             renderCoords();
1044: 
1045:             let base = state.home,
1046:                 list = state.incidentsHome;
1047:             if (state.mode === "dest") {
1048:                 base = state.dest;
1049:                 list = state.incidentsDest;
1050:             }
1051:             if (state.mode === "route") {
1052:                 base = state.home;
1053:                 list = state.incidentsRoute;
1054:             }
1055: 
1056:             const filteredList =
1057:                 state.mode === "route" ? list : filterIncidentsByToday(list);
1058:             renderIncList(base.lat, base.lon, filteredList);
1059:             plotIncidents(base.lat, base.lon, filteredList);
1060: 
1061:             const nearestHome = nearestIncident(
1062:                 state.home.lat,
1063:                 state.home.lon,
1064:                 filterIncidentsByToday(state.incidentsHome)
1065:             );
1066:             setRiskFromNearest($("homeRisk"), $("homeRiskWhy"), nearestHome);
1067: 
1068:             const routeBest = state.routes?.[0];
1069:             if (!routeBest) {
1070:                 $("routeRisk").textContent = "?";
1071:                 $("routeRisk").className = "value warn";
1072:                 $("routeRiskWhy").textContent = "Route data not loaded.";
1073:             } else {
1074:                 if (routeBest.nearCount >= 6) {
1075:                     $("routeRisk").textContent = "Higher";
1076:                     $("routeRisk").className = "value bad";
1077:                 } else if (routeBest.nearCount >= 2) {
1078:                     $("routeRisk").textContent = "Moderate";
1079:                     $("routeRisk").className = "value warn";
1080:                 } else {
1081:                     $("routeRisk").textContent = "Lower";
1082:                     $("routeRisk").className = "value good";
1083:                 }
1084:                 $("routeRiskWhy").textContent = `${routeBest.distanceKm.toFixed(
1085:                     0
1086:                 )} km, ~${routeBest.durationMin.toFixed(0)} min, ${routeBest.nearCount} incident(s) within ${DEFAULTS.routeBufferKm} km.`;
1087:             }
1088:         }
1089: 
1090:         function nearestIncident(lat, lon, incidents) {
1091:             if (!incidents?.length) return null;
1092:             let best = null;
1093:             for (const i of incidents) {
1094:                 const d = haversineKm(lat, lon, i.lat, i.lon);
1095:                 const b = bearingDeg(lat, lon, i.lat, i.lon);
1096:                 const cand = { ...i, distKm: d, bearing: b };
1097:                 if (!best || cand.distKm < best.distKm) best = cand;
1098:             }
1099:             return best;
1100:         }
1101: 
1102:         // ============================================================================
1103:         // WIRING
1104:         // ============================================================================
1105:         function wire() {
1106:             $("homeAddr").addEventListener("change", () => {
1107:                 state.home.address = $("homeAddr").value;
1108:                 updateGoogleRouteLink();
1109:                 updateCheckin();
1110:             });
1111:             $("destAddr").addEventListener("change", () => {
1112:                 state.dest.address = $("destAddr").value;
1113:                 updateGoogleRouteLink();
1114:                 updateCheckin();
1115:             });
1116: 
1117:             $("homeGeocode").addEventListener("click", async () => {
1118:                 $("homeGeocode").disabled = true;
1119:                 try {
1120:                     const q = $("homeAddr").value.trim();
1121:                     state.home.address = q;
1122:                     const r = await geocodeAddress(q);
1123:                     state.home.lat = r.lat;
1124:                     state.home.lon = r.lon;
1125:                     renderCoords();
1126:                     setMarker("home", r.lat, r.lon, q);
1127:                     map.setView([r.lat, r.lon], DEFAULTS.homeZoom);
1128:                     updateGoogleRouteLink();
1129:                     updateCheckin();
1130:                     saveCached();
1131:                 } catch (e) {
1132:                     alert("Could not geocode. Using Bendigo fallback.");
1133:                     state.home = { ...state.home, ...DEFAULTS.homeFallback };
1134:                     renderCoords();
1135:                     updateGoogleRouteLink();
1136:                     updateCheckin();
1137:                     saveCached();
1138:                 } finally {
1139:                     $("homeGeocode").disabled = false;
1140:                 }
1141:             });
1142: 
1143:             $("destGeocode").addEventListener("click", async () => {
1144:                 $("destGeocode").disabled = true;
1145:                 try {
1146:                     const q = $("destAddr").value.trim();
1147:                     state.dest.address = q;
1148:                     const r = await geocodeAddress(q);
1149:                     state.dest.lat = r.lat;
1150:                     state.dest.lon = r.lon;
1151:                     renderCoords();
1152:                     setMarker("dest", r.lat, r.lon, q);
1153:                     updateGoogleRouteLink();
1154:                     updateCheckin();
1155:                     saveCached();
1156:                 } catch (e) {
1157:                     alert("Could not geocode. Using Ballarat fallback.");
1158:                     state.dest = { ...state.dest, ...DEFAULTS.destFallback };
1159:                     renderCoords();
1160:                     updateGoogleRouteLink();
1161:                     updateCheckin();
1162:                     saveCached();
1163:                 } finally {
1164:                     $("destGeocode").disabled = false;
1165:                 }
1166:             });
1167: 
1168:             $("homeHere").addEventListener("click", async () => {
1169:                 $("homeHere").disabled = true;
1170:                 try {
1171:                     const r = await useGPS();
1172:                     state.home.lat = r.lat;
1173:                     state.home.lon = r.lon;
1174:                     renderCoords();
1175:                     setMarker("home", r.lat, r.lon, "GPS location");
1176:                     map.setView([r.lat, r.lon], 12);
1177:                     updateGoogleRouteLink();
1178:                     updateCheckin();
1179:                     saveCached();
1180:                 } catch (e) {
1181:                     alert("Could not access GPS.");
1182:                 } finally {
1183:                     $("homeHere").disabled = false;
1184:                 }
1185:             });
1186: 
1187:             $("destHere").addEventListener("click", async () => {
1188:                 $("destHere").disabled = true;
1189:                 try {
1190:                     const r = await useGPS();
1191:                     state.dest.lat = r.lat;
1192:                     state.dest.lon = r.lon;
1193:                     renderCoords();
1194:                     setMarker("dest", r.lat, r.lon, "GPS location");
1195:                     updateGoogleRouteLink();
1196:                     updateCheckin();
1197:                     saveCached();
1198:                 } catch (e) {
1199:                     alert("Could not access GPS.");
1200:                 } finally {
1201:                     $("destHere").disabled = false;
1202:                 }
1203:             });
1204: 
1205:             $("refreshBtn").addEventListener("click", refreshAll);
1206: 
1207:             $("clearBtn").addEventListener("click", () => {
1208:                 clearCached();
1209:                 alert("Cleared cached locations. Reload the page.");
1210:             });
1211: 
1212:             $("radiusKm").addEventListener("change", () => {
1213:                 saveCached();
1214:                 refreshAll();
1215:             });
1216: 
1217:             $("todayOnly").addEventListener("change", () => {
1218:                 state.todayOnly = $("todayOnly").checked;
1219:                 saveCached();
1220:                 rescoreRoutes();
1221:                 render();
1222:             });
1223: 
1224:             $("windDir").addEventListener("change", () => {
1225:                 state.wind.dir = $("windDir").value;
1226:                 updateWindSummary();
1227:                 saveCached();
1228:             });
1229: 
1230:             $("windSpeed").addEventListener("input", () => {
1231:                 state.wind.speed = $("windSpeed").value;
1232:                 updateWindSummary();
1233:                 saveCached();
1234:             });
1235: 
1236:             $("checkinPhone").addEventListener("input", () => {
1237:                 state.checkinPhone = $("checkinPhone").value;
1238:                 updateCheckin();
1239:                 saveCached();
1240:             });
1241: 
1242:             $("checkinSend").addEventListener("click", () => {
1243:                 const smsHref = $("checkinSend").getAttribute("data-sms") || "";
1244:                 if (!smsHref) return;
1245:                 window.location.href = smsHref;
1246:             });
1247: 
1248:             $("addDayCard").addEventListener("click", () => {
1249:                 openDayCardModal();
1250:             });
1251: 
1252:             $("toggleHiddenCards").addEventListener("click", () => {
1253:                 showHiddenDayCards = !showHiddenDayCards;
1254:                 $("toggleHiddenCards").textContent = showHiddenDayCards ? "Hide hidden" : "Show hidden";
1255:                 renderDayCards();
1256:             });
1257: 
1258:             $("addKidsChecklist").addEventListener("click", () => {
1259:                 const items = [
1260:                     "Water bottles (x2)",
1261:                     "Spare clothes & jumper",
1262:                     "Essential medication",
1263:                     "Snacks & drinks",
1264:                     "Comfort toy / blanket",
1265:                     "IDs & emergency contacts",
1266:                     "Face masks",
1267:                     "Phone + charger",
1268:                     "Plan: meeting point",
1269:                     "Vehicle: full tank"
1270:                 ];
1271:                 const card = {
1272:                     id: `kids-${Date.now()}`,
1273:                     title: "Kids Checklist - Sylvie & Elias",
1274:                     date: todayKey(),
1275:                     items,
1276:                     hidden: false,
1277:                     autoTitle: false
1278:                 };
1279:                 state.dayCards.unshift(card);
1280:                 saveCached();
1281:                 renderDayCards();
1282:                 alert("Kids checklist added to Day Cards.");
1283:             });
1284: 
1285:             $("dayCards").addEventListener("click", (event) => {
1286:                 const target = event.target;
1287:                 if (!(target instanceof HTMLElement)) return;
1288:                 const action = target.getAttribute("data-action");
1289:                 const id = target.getAttribute("data-id");
1290:                 if (!action || !id) return;
1291:                 const card = state.dayCards.find((c) => c.id === id);
1292:                 if (!card) return;
1293: 
1294:                 if (action === "edit") {
1295:                     openDayCardModal(card);
1296:                     return;
1297:                 }
1298:                 if (action === "hide") {
1299:                     card.hidden = !card.hidden;
1300:                     saveCached();
1301:                     renderDayCards();
1302:                     return;
1303:                 }
1304:                 if (action === "delete") {
1305:                     const ok = confirm("Delete this day card?");
1306:                     if (!ok) return;
1307:                     state.dayCards = state.dayCards.filter((c) => c.id !== id);
1308:                     saveCached();
1309:                     renderDayCards();
1310:                 }
1311:             });
1312: 
1313:             // Evacuation Centres Search
1314:             $("searchEvacCentres").addEventListener("click", () => {
1315:                 const query = $("evacuationSearch").value;
1316:                 searchEvacuationCentres(query);
1317:             });
1318: 
1319:             $("evacuationSearch").addEventListener("keypress", (e) => {
1320:                 if (e.key === "Enter") {
1321:                     const query = $("evacuationSearch").value;
1322:                     searchEvacuationCentres(query);
1323:                 }
1324:             });
1325: 
1326:             // Error panel button listeners
1327:             $("errorRetryBtn").addEventListener("click", () => {
1328:                 retryLastError();
1329:             });
1330: 
1331:             $("errorDismissBtn").addEventListener("click", () => {
1332:                 dismissError();
1333:             });
1334: 
1335:             $("showHomeBtn").addEventListener("click", () => {
1336:                 state.mode = "home";
1337:                 updateModeButtons();
1338:                 render();
1339:             });
1340: 
1341:             $("showDestBtn").addEventListener("click", () => {
1342:                 state.mode = "dest";
1343:                 updateModeButtons();
1344:                 render();
1345:             });
1346: 
1347:             $("showRouteBtn").addEventListener("click", () => {
1348:                 state.mode = "route";
1349:                 updateModeButtons();
1350:                 render();
1351:             });
1352: 
1353:             const modal = $("levelModal");
1354:             const modalTitle = $("levelModalTitle");
1355:             const modalBody = $("levelModalBody");
1356:             let lastFocusedElement = null;
1357:             const modalFocusHandlers = new Map();
1358: 
1359:             function openModal(el, focusEl) {
1360:                 lastFocusedElement = document.activeElement;
1361:                 el.classList.add("open");
1362:                 const handler = (event) => {
1363:                     if (event.key !== "Tab") return;
1364:                     const focusables = el.querySelectorAll(
1365:                         'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
1366:                     );
1367:                     if (!focusables.length) return;
1368:                     const first = focusables[0];
1369:                     const last = focusables[focusables.length - 1];
1370:                     if (event.shiftKey && document.activeElement === first) {
1371:                         event.preventDefault();
1372:                         last.focus();
1373:                     } else if (!event.shiftKey && document.activeElement === last) {
1374:                         event.preventDefault();
1375:                         first.focus();
1376:                     }
1377:                 };
1378:                 el.addEventListener("keydown", handler);
1379:                 modalFocusHandlers.set(el, handler);
1380:                 setTimeout(() => {
1381:                     if (focusEl && typeof focusEl.focus === "function") {
1382:                         focusEl.focus();
1383:                     }
1384:                 }, 0);
1385:             }
1386: 
1387:             function closeModal(el) {
1388:                 el.classList.remove("open");
1389:                 const handler = modalFocusHandlers.get(el);
1390:                 if (handler) {
1391:                     el.removeEventListener("keydown", handler);
1392:                     modalFocusHandlers.delete(el);
1393:                 }
1394:                 if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
1395:                     lastFocusedElement.focus();
1396:                 }
1397:                 lastFocusedElement = null;
1398:             }
1399: 
1400:             function openLevelModal(title, body) {
1401:                 modalTitle.textContent = title;
1402:                 modalBody.textContent = body;
1403:                 openModal(modal, $("closeLevelModal"));
1404:             }
1405: 
1406:             function closeLevelModal() {
1407:                 closeModal(modal);
1408:             }
1409: 
1410:             $("explainEmergency").addEventListener("click", () => {
1411:                 openLevelModal(
1412:                     "Emergency Warning",
1413:                     "You are in danger. Take action now. If you are in the path of the fire, leave immediately or seek shelter as advised by VicEmergency."
1414:                 );
1415:             });
1416: 
1417:             $("explainWatch").addEventListener("click", () => {
1418:                 openLevelModal(
1419:                     "Watch and Act",
1420:                     "Conditions are changing. You should prepare to leave or enact your fire plan. Stay alert and monitor official updates closely."
1421:                 );
1422:             });
1423: 
1424:             $("explainAdvice").addEventListener("click", () => {
1425:                 openLevelModal(
1426:                     "Advice",
1427:                     "An incident is happening but there is no immediate danger. Stay informed and be ready to act if the situation changes."
1428:                 );
1429:             });
1430: 
1431:             $("closeLevelModal").addEventListener("click", closeLevelModal);
1432:             modal.addEventListener("click", (event) => {
1433:                 if (event.target === modal) {
1434:                     closeLevelModal();
1435:                 }
1436:             });
1437:             // Incident Dictionary modal wiring
1438:             const dictModal = $("dictModal");
1439:             const dictModalTitle = $("dictModalTitle");
1440:             const dictModalBody = $("dictModalBody");
1441: 
1442:             function openDictModal(title, html) {
1443:                 dictModalTitle.textContent = title;
1444:                 dictModalBody.innerHTML = html;
1445:                 openModal(dictModal, $("closeDictModal"));
1446:             }
1447: 
1448:             function closeDictModal() {
1449:                 closeModal(dictModal);
1450:             }
1451: 
1452:             $("openDictModal").addEventListener("click", async () => {
1453:                 $("openDictModal").disabled = true;
1454:                 try {
1455:                     const res = await fetch("docs/INCIDENT_DICTIONARY.md");
1456:                     const text = res.ok ? await res.text() : "Could not load definitions.";
1457:                     const safe = escapeHtml(text).replaceAll('\n', '<br>');
1458:                     openDictModal("Incident Dictionary", `<div class="mono" style="white-space:pre-wrap">${safe}</div>`);
1459:                 } catch (e) {
1460:                     openDictModal("Incident Dictionary", "Could not load definitions.");
1461:                 } finally {
1462:                     $("openDictModal").disabled = false;
1463:                 }
1464:             });
1465: 
1466:             $("closeDictModal").addEventListener("click", closeDictModal);
1467: 
1468:             // Kids checklist modal view
1469:             $("openKidsChecklistModal").addEventListener("click", () => {
1470:                 const list = Array.from(document.querySelectorAll('#kidsChecklistItems li')).map(li => li.textContent.trim());
1471:                 const html = '<ul class="small">' + list.map(i=>`<li>${escapeHtml(i)}</li>`).join('') + '</ul>';
1472:                 openDictModal('Kids Checklist', html);
1473:             });
1474:             dictModal.addEventListener("click", (event) => {
1475:                 if (event.target === dictModal) closeDictModal();
1476:             });
1477:             document.addEventListener("keydown", (event) => {
1478:                 if (event.key === "Escape") {
1479:                     closeDictModal();
1480:                 }
1481:             });
1482:             document.addEventListener("keydown", (event) => {
1483:                 if (event.key === "Escape") {
1484:                     closeLevelModal();
1485:                     if (dayCardModal.classList.contains("open")) {
1486:                         closeDayCardModal();
1487:                     }
1488:                 }
1489:             });
1490: 
1491:             const dayCardModal = $("dayCardModal");
1492:             const dayCardTitle = $("dayCardTitle");
1493:             const dayCardDate = $("dayCardDate");
1494:             const dayCardItems = $("dayCardItems");
1495:             let activeDayCardId = null;
1496: 
1497:             function closeDayCardModal() {
1498:                 closeModal(dayCardModal);
1499:                 activeDayCardId = null;
1500:             }
1501: 
1502:             function openDayCardModal(card = null) {
1503:                 activeDayCardId = card?.id || null;
1504:                 if (card?.autoTitle) {
1505:                     dayCardTitle.value = relativeTitleForDate(card.date);
1506:                 } else {
1507:                     dayCardTitle.value = card?.title || "";
1508:                 }
1509:                 dayCardDate.value = card?.date || todayKey();
1510:                 dayCardItems.value = Array.isArray(card?.items) ? card.items.join("\n") : "";
1511:                 openModal(dayCardModal, dayCardTitle);
1512:             }
1513: 
1514:             $("cancelDayCard").addEventListener("click", closeDayCardModal);
1515:             dayCardModal.addEventListener("click", (event) => {
1516:                 if (event.target === dayCardModal) {
1517:                     closeDayCardModal();
1518:                 }
1519:             });
1520: 
1521:             $("saveDayCard").addEventListener("click", () => {
1522:                 const title = dayCardTitle.value.trim() || "Day Card";
1523:                 const date = dayCardDate.value || todayKey();
1524:                 const items = dayCardItems.value
1525:                     .split("\n")
1526:                     .map((line) => line.trim())
1527:                     .filter(Boolean);
1528: 
1529:                 if (activeDayCardId) {
1530:                     const card = state.dayCards.find((c) => c.id === activeDayCardId);
1531:                     if (card) {
1532:                         card.title = title;
1533:                         card.date = date;
1534:                         card.items = items;
1535:                         if (card.autoTitle) {
1536:                             card.autoTitle = title === relativeTitleForDate(date);
1537:                         }
1538:                     }
1539:                 } else {
1540:                     state.dayCards.push({
1541:                         id: `day-${Math.random().toString(16).slice(2)}`,
1542:                         title,
1543:                         date,
1544:                         items,
1545:                         hidden: false,
1546:                         autoTitle: false
1547:                     });
1548:                 }
1549:                 saveCached();
1550:                 renderDayCards();
1551:                 closeDayCardModal();
1552:             });
1553:         }
1554: 
1555:         function updateModeButtons() {
1556:             $("showHomeBtn").classList.toggle("primary", state.mode === "home");
1557:             $("showDestBtn").classList.toggle("primary", state.mode === "dest");
1558:             $("showRouteBtn").classList.toggle("primary", state.mode === "route");
1559:         }
1560: 
1561:         // ============================================================================
1562:         // BOOT
1563:         // ============================================================================
1564:         (function boot() {
1565:             if ("serviceWorker" in navigator && location.protocol !== "file:") {
1566:                 navigator.serviceWorker.register("/service-worker.js").catch(() => {});
1567:             }
1568:             loadCached();
1569:             state.home.address = $("homeAddr").value;
1570:             state.dest.address = $("destAddr").value;
1571: 
1572:             if (state.home.address) $("homeAddr").value = state.home.address;
1573:             if (state.dest.address) $("destAddr").value = state.dest.address;
1574:             $("todayOnly").checked = state.todayOnly;
1575:             updateGoogleRouteLink();
1576: 
1577:             if (!state.dayCards.length) {
1578:                 state.dayCards = defaultDayCards();
1579:                 saveCached();
1580:             }
1581:             ensureTodayCard();
1582:             renderDayCards();
1583:             updateWindSummary();
1584:             updateCheckin();
1585:             updateOfflineBanner();
1586:             window.addEventListener("online", updateOfflineBanner);
1587:             window.addEventListener("offline", updateOfflineBanner);
1588: 
1589:             // Initialize map FIRST before setting markers
1590:             initMap();
1591: 
1592:             if (state.home.lat && state.home.lon)
1593:                 setMarker("home", state.home.lat, state.home.lon, state.home.address);
1594:             if (state.dest.lat && state.dest.lon)
1595:                 setMarker("dest", state.dest.lat, state.dest.lon, state.dest.address);
1596: 
1597:             wire();
1598:             updateModeButtons();
1599: 
1600:             (async () => {
1601:                 try {
1602:                     if (!state.home.lat || !state.home.lon) {
1603:                         const r = await geocodeAddress($("homeAddr").value);
1604:                         state.home.lat = r.lat;
1605:                         state.home.lon = r.lon;
1606:                         state.home.address = $("homeAddr").value;
1607:                     }
1608:                 } catch (e) {
1609:                     state.home = { ...state.home, ...DEFAULTS.homeFallback };
1610:                 }
1611:                 try {
1612:                     if (!state.dest.lat || !state.dest.lon) {
1613:                         const r = await geocodeAddress($("destAddr").value);
1614:                         state.dest.lat = r.lat;
1615:                         state.dest.lon = r.lon;
1616:                         state.dest.address = $("destAddr").value;
1617:                     }
1618:                 } catch (e) {
1619:                     state.dest = { ...state.dest, ...DEFAULTS.destFallback };
1620:                 }
1621: 
1622:                 renderCoords();
1623:                 setMarker("home", state.home.lat, state.home.lon, state.home.address);
1624:                 setMarker("dest", state.dest.lat, state.dest.lon, state.dest.address);
1625: 
1626:                 // Load refresh time from localStorage and then fetch
1627:                 loadLastRefreshTime();
1628:                 await refreshAll();
1629:             })();
1630: 
1631:             // Auto refresh every 5 minutes
1632:             setInterval(() => refreshAll().catch(() => {}), 5 * 60 * 1000);
1633: 
1634:             // Update countdown timer
1635:             updateCountdown();
1636:             setInterval(updateCountdown, 60 * 1000); // Update every 60 seconds
1637: 
1638:             // Update data age display every 60 seconds
1639:             setInterval(updateDataAgeDisplay, 60 * 1000);
1640:         })();
1641: 
1642:         // Countdown Timer to Safe Departure (8:00am Saturday Jan 10)
1643:         function updateCountdown() {
1644:             const countdownEl = $('countdown-display');
1645:             if (!countdownEl) return;
1646:             
1647:             const now = new Date();
1648:             const targetTime = new Date(2026, 0, 10, 8, 0, 0); // Jan 10, 2026, 8:00am
1649:             const diffMs = targetTime.getTime() - now.getTime();
1650:             
1651:             if (diffMs <= 0) {
1652:                 // Departure time has passed
1653:                 countdownEl.textContent = 'Departure time reached!';
1654:                 countdownEl.className = 'passed';
1655:                 return;
1656:             }
1657:             
1658:             // Calculate hours and minutes remaining
1659:             const totalMinutes = Math.floor(diffMs / (1000 * 60));
1660:             const hours = Math.floor(totalMinutes / 60);
1661:             const minutes = totalMinutes % 60;
1662:             
1663:             const timeStr = `${hours}h ${minutes}m`;
1664:             countdownEl.textContent = `Time until safe departure (8:00am Sat): ${timeStr}`;
1665:             
1666:             // Change color if less than 2 hours remaining
1667:             if (hours < 2) {
1668:                 countdownEl.className = 'warn';
1669:             } else {
1670:                 countdownEl.className = '';
1671:             }
1672:         }
1673: 
1674:         // Refresh Control: Track last refresh time and data age
1675:         function loadLastRefreshTime() {
1676:             try {
1677:                 const stored = localStorage.getItem('JoshFireAwareness.lastRefresh');
1678:                 if (stored) {
1679:                     lastRefreshTime = new Date(stored);
1680:                     updateDataAgeDisplay();
1681:                 }
1682:             } catch (e) {}
1683:         }
1684: 
1685:         function updateDataAgeDisplay() {
1686:             const timeEl = $('last-check-time');
1687:             const badgeEl = $('data-age');
1688:             
1689:             if (!lastRefreshTime) {
1690:                 timeEl.textContent = 'Never';
1691:                 badgeEl.textContent = 'Not loaded';
1692:                 badgeEl.className = 'data-age-badge fresh';
1693:                 return;
1694:             }
1695:             
1696:             const now = new Date();
1697:             const diffMs = now.getTime() - lastRefreshTime.getTime();
1698:             const diffMins = Math.floor(diffMs / (1000 * 60));
1699:             
1700:             // Update time display
1701:             if (diffMins === 0) {
1702:                 timeEl.textContent = 'Just now';
1703:             } else if (diffMins < 60) {
1704:                 timeEl.textContent = `${diffMins}m ago`;
1705:             } else {
1706:                 const hours = Math.floor(diffMins / 60);
1707:                 timeEl.textContent = `${hours}h ago`;
1708:             }
1709:             
1710:             // Update badge color based on freshness
1711:             badgeEl.className = 'data-age-badge';
1712:             if (diffMins < 10) {
1713:                 badgeEl.textContent = 'Fresh';
1714:                 badgeEl.classList.add('fresh');
1715:             } else if (diffMins < 30) {
1716:                 badgeEl.textContent = 'Stale';
1717:                 badgeEl.classList.add('stale');
1718:             } else {
1719:                 badgeEl.textContent = 'Old';
1720:                 badgeEl.classList.add('old');
1721:             }
1722:         }
1723: 
1724:         function setFeedSourceDisplay(src) {
1725:             lastFeedSource = src;
1726:             try {
1727:                 const el = $('feed-source');
1728:                 if (el) el.textContent = src || '-';
1729:             } catch (e) {}
1730:         }
1731: 
1732:         function recordRefreshTime() {
1733:             lastRefreshTime = new Date();
1734:             try {
1735:                 localStorage.setItem('JoshFireAwareness.lastRefresh', lastRefreshTime.toISOString());
1736:             } catch (e) {}
1737:             updateDataAgeDisplay();
1738:         }
1739: 
1740:         async function manualRefresh() {
1741:             const btn = $('refresh-data');
1742:             if (isRefreshDisabled) return;
1743:             
1744:             // Disable button for 10 seconds
1745:             isRefreshDisabled = true;
1746:             btn.disabled = true;
1747:             btn.textContent = 'Checking...';
1748:             
1749:             try {
1750:                 await refreshAll();
1751:             } catch (e) {
1752:                 console.warn('Manual refresh failed:', e);
1753:             }
1754:             
1755:             // Re-enable button after 10 seconds
1756:             setTimeout(() => {
1757:                 isRefreshDisabled = false;
1758:                 btn.disabled = false;
1759:                 btn.textContent = 'Check Latest Info';
1760:             }, 10 * 1000);
1761:         }
1762: 
1763:         // Evacuation Centres Search
1764:         async function searchEvacuationCentres(query) {
1765:             const resultsEl = $('evacuationResults');
1766:             if (!resultsEl) return;
1767: 
1768:             if (!query.trim()) {
1769:                 resultsEl.innerHTML = '<div class="small">Enter location and click Search.</div>';
1770:                 return;
1771:             }
1772: 
1773:             resultsEl.innerHTML = '<div class="small">Searching...</div>';
1774: 
1775:             try {
1776:                 // Use Nominatim to geocode the query
1777:                 const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Victoria, Australia')}&format=json&limit=1`;
1778:                 const geocodeRes = await fetch(nominatimUrl, { headers: { 'Accept-Language': 'en' } });
1779:                 if (!geocodeRes.ok) throw new Error('Geocoding failed');
1780:                 const geoData = await geocodeRes.json();
1781: 
1782:                 if (!geoData.length) {
1783:                     resultsEl.innerHTML = '<div class="small" style="color: var(--muted);">Location not found. Try a suburb name or full address.</div>';
1784:                     return;
1785:                 }
1786: 
1787:                 const { lat, lon } = geoData[0];
1788: 
1789:                 // Query VicEmergency for evacuation centres near this location
1790:                 // Using a static list as official API requires registration
1791:                 // In production, integrate with VicEmergency API or local government DB
1792:                 const centres = [
1793:                     {
1794:                         name: 'Bendigo Exhibition Centre',
1795:                         address: '18-26 Mulhall Street, Bendigo VIC 3550',
1796:                         type: 'Major Centre',
1797:                         distance: null
1798:                     },
1799:                     {
1800:                         name: 'Ballarat Civic Hall',
1801:                         address: '27 Doveton Street, Ballarat VIC 3350',
1802:                         type: 'Major Centre',
1803:                         distance: null
1804:                     },
1805:                     {
1806:                         name: 'Castlemaine Town Hall',
1807:                         address: 'Market Street, Castlemaine VIC 3450',
1808:                         type: 'Community Centre',
1809:                         distance: null
1810:                     },
1811:                     {
1812:                         name: 'Kyneton Mechanics Institute',
1813:                         address: 'Piper Street, Kyneton VIC 3444',
1814:                         type: 'Community Centre',
1815:                         distance: null
1816:                     },
1817:                     {
1818:                         name: 'Creswick Community Centre',
1819:                         address: 'Lydiard Street North, Creswick VIC 3363',
1820:                         type: 'Community Centre',
1821:                         distance: null
1822:                     }
1823:                 ];
1824: 
1825:                 // Calculate distances
1826:                 for (const centre of centres) {
1827:                     const d = haversineKm(lat, lon, -37.3, 144.27); // Default to Bendigo for now; in production, geocode each centre
1828:                     centre.distance = d;
1829:                 }
1830: 
1831:                 // Sort by distance
1832:                 centres.sort((a, b) => (a.distance || 999) - (b.distance || 999));
1833: 
1834:                 if (!centres.length) {
1835:                     resultsEl.innerHTML = '<div class="small" style="color: var(--muted);">No evacuation centres found in database.</div>';
1836:                     return;
1837:                 }
1838: 
1839:                 // Render results
1840:                 const html = centres
1841:                     .map((c) => {
1842:                         const dist = c.distance ? `(${c.distance.toFixed(1)} km away)` : '';
1843:                         return `<div class="small" style="padding: 8px; border-bottom: 1px solid var(--border-color);">
1844:                             <strong>${escapeHtml(c.name)}</strong> - ${c.type}<br>
1845:                             ${escapeHtml(c.address)}<br>
1846:                             <span style="color: var(--muted);">📍 ${dist}</span>
1847:                         </div>`;
1848:                     })
1849:                     .join('');
1850:                 resultsEl.innerHTML = html;
1851:             } catch (err) {
1852:                 console.error('Evacuation centre search error:', err);
1853:                 resultsEl.innerHTML = `<div class="small" style="color: var(--bad);">Search failed. Try a different location.</div>`;
1854:             }
1855:         }
1856: 
1857:         // Service worker registration and online/offline indicator
1858:         if ('serviceWorker' in navigator) {
1859:             window.addEventListener('load', () => {
1860:                 navigator.serviceWorker.register('/service-worker.js').then((reg) => {
1861:                     console.log('ServiceWorker registered', reg);
1862:                 }).catch((err) => {
1863:                     console.warn('ServiceWorker registration failed', err);
1864:                 });
1865:             });
1866:         }
1867: 
1868:         // Error handling and display
1869:         let lastError = null;
1870:         let lastErrorRetryFn = null;
1871: 
1872:         function showError(message, retryFn = null) {
1873:             const panel = $('errorPanel');
1874:             const msgEl = panel?.querySelector('.error-message');
1875:             const retryBtn = $('errorRetryBtn');
1876:             const dismissBtn = $('errorDismissBtn');
1877:             
1878:             if (!panel || !msgEl) return;
1879: 
1880:             lastError = message;
1881:             lastErrorRetryFn = retryFn;
1882: 
1883:             msgEl.textContent = message;
1884:             if (retryBtn) retryBtn.style.display = retryFn ? 'block' : 'none';
1885: 
1886:             panel.style.display = 'block';
1887: 
1888:             // Auto-dismiss after 8 seconds if no retry
1889:             if (!retryFn) {
1890:                 setTimeout(() => {
1891:                     panel.style.display = 'none';
1892:                 }, 8000);
1893:             }
1894:         }
1895: 
1896:         function dismissError() {
1897:             const panel = $('errorPanel');
1898:             if (panel) panel.style.display = 'none';
1899:         }
1900: 
1901:         function retryLastError() {
1902:             if (lastErrorRetryFn) {
1903:                 dismissError();
1904:                 lastErrorRetryFn();
1905:             }
1906:         }
1907: 
1908:         function updateOnlineStatus() {
1909:             const el = $('offline-indicator');
1910:             if (!el) return;
1911:             if (navigator.onLine) {
1912:                 el.textContent = 'Online';
1913:                 el.style.color = 'var(--good)';
1914:             } else {
1915:                 el.textContent = 'Offline';
1916:                 el.style.color = 'var(--bad)';
1917:             }
1918:         }
1919:         window.addEventListener('online', updateOnlineStatus);
1920:         window.addEventListener('offline', updateOnlineStatus);
1921:         updateOnlineStatus();
1922:     
