# JoshFireAwareness - App Improvements Roadmap

**Date Created:** Friday 9 Jan 2026  
**Status:** Planning Phase  
**Owner:** Josh Parris

---

## 🎯 PRIORITY 1: IMPLEMENT NOW (10 min work)

These directly reduce anxiety and improve real-time usefulness.

### ✅ 1. Live Refresh Button + Timestamp
- [ ] Add "🔄 Refresh Now" button to footer
- [ ] Display last-updated timestamp (HH:MM format)
- [ ] Update only when button clicked (no auto-fetch yet - keep simple)
- [ ] Show data freshness warning if >30 mins old
- **Effort:** 5 min | **Impact:** HIGH (builds trust in data)

### ✅ 2. Wind Direction Card + Compass
- [ ] Create new card: "💨 Wind Right Now"
- [ ] Add emoji compass showing NW → SW direction
- [ ] Display current wind speed (km/h)
- [ ] Add warning: "Wind change expected: ~6-7pm tonight"
- [ ] Explain shift to SW = fire moves away from Bendigo
- **Effort:** 5 min | **Impact:** MEDIUM-HIGH (visual clarity)

### ✅ 3. Countdown Timer to Safe Departure
- [ ] Add timer in header: "⏱️ Time until safe departure: __:__"
- [ ] Target: 8:00am Saturday (8 hours 30 mins from now)
- [ ] Update every 60 seconds
- [ ] Change to green when safe to leave
- **Effort:** 5 min | **Impact:** HIGH (removes "when can I go" anxiety)

### ✅ 4. Incident Level Explainer Buttons
- [ ] Add 3 buttons: "? Emergency Warning" | "? Watch & Act" | "? Advice"
- [ ] Create modal/popup with clear definitions
- [ ] Keep language simple (Australian English, no jargon)
- [ ] Close button on modal
- **Effort:** 5 min | **Impact:** MEDIUM (reduces mental load)

**TOTAL EFFORT:** ~20 min | **DO THIS TONIGHT** if you have energy

---

## 🎯 PRIORITY 2: IMPLEMENT SATURDAY (if time)

These improve the dashboard but aren't critical for tonight.

### 2A. Live Fire Status Feed
- [ ] Fetch VicEmergency incidents JSON
- [ ] Show: Incident name, distance, alert level, last updated
- [ ] Red badge if data >30 mins old
- [ ] Sort by distance to Epsom (closest first)
- [ ] Add: "Fetched from VicEmergency at HH:MM"
- **Effort:** 30 min | **Impact:** MEDIUM (replaces static text)
- **Note:** May require CORS proxy or GitHub Pages workaround

### 2B. Kids-Specific Departure Checklist
- [ ] New card: "👧 Travel with Sylvie & Elias"
- [ ] Add: nappies, wipes, snacks, water, comfort items
- [ ] Time-based: "Leave by 8am", "Stop by 8:45am", "Arrive ~9:45am"
- [ ] Include: "Check Kristy has [X]"
- **Effort:** 10 min | **Impact:** MEDIUM (reduces mental load on day)

### 2C. Route Simulator (Time Estimate)
- [ ] Bendigo → Ballarat route with live traffic check
- [ ] Show: Distance (95km), typical time (1h 15m), current estimate
- [ ] Link to Google Maps for live routing
- [ ] Display fuel stop suggestions
- **Effort:** 20 min | **Impact:** LOW-MEDIUM (Google Maps does this)

### 2D. Offline Mode (Service Worker)
- [ ] Cache all static content
- [ ] Allow reading app without internet
- [ ] Show "Offline Mode" banner
- **Effort:** 45 min | **Impact:** LOW (unlikely to lose power/internet)

---

## 🎯 PRIORITY 3: NICE-TO-HAVE (Next week)

These are polished features for future use, not urgent now.

### 3A. Toggle Between Locations
- [ ] Dropdown: Select Epsom / Bendigo / Ballarat
- [ ] Dynamically update all distances/threats
- [ ] Store selected location in local storage
- **Effort:** 20 min | **Impact:** MEDIUM

### 3B. "I'm Safe" Check-In Button
- [ ] Button: "📲 Send 'I'm Safe' to Kristy"
- [ ] Pre-fills SMS template: "Josh here - we're safe. Location: [X]"
- [ ] Opens SMS composer on phone
- **Effort:** 10 min | **Impact:** LOW (Kristy can call if needed)

### 3C. Live Smoke Visibility Reports
- [ ] Fetch crowdsourced smoke observations
- [ ] Show: "Smoke reported from [location] at [time]"
- [ ] Direction/distance to Epsom
- **Effort:** 2 hrs | **Impact:** LOW (complex, VicEmergency covers this)

### 3D. Dark/Light Mode Toggle
- [ ] Add theme switcher (moon/sun icon)
- [ ] Store preference in local storage
- **Effort:** 15 min | **Impact:** LOW (already dark)

### 3E. Fuel/Service Stop Planner
- [ ] Show stops on Bendigo → Ballarat route
- [ ] Nearest petrol, café, pharmacy
- [ ] Link to Google Maps
- **Effort:** 20 min | **Impact:** LOW (already on phone via Maps)

---

## 📋 Implementation Checklist

### TONIGHT (Fri 9 Jan, if energy permits)
- [ ] Priority 1.1: Refresh button + timestamp
- [ ] Priority 1.2: Wind direction card
- [ ] Priority 1.3: Countdown timer
- [ ] Priority 1.4: Incident explainers
- [ ] Test on mobile
- [ ] Deploy to GitHub/Vercel

### SATURDAY MORNING (before 8am departure)
- [ ] Quick test of app on phone while having coffee
- [ ] Note any bugs to fix later
- [ ] Take screenshot of wind/fire status for reference

### SATURDAY EVENING (after safe arrival in Ballarat)
- [ ] Debrief: What actually happened vs what the app predicted
- [ ] Priority 2A-2D: Consider next phase improvements

### FUTURE (Jan/Feb 2026)
- [ ] Priority 3A-3E: Polish features for ongoing use
- [ ] Build out as "family emergency dashboard" template

---

## 🔧 Technical Notes

### Data Sources (don't scrape, use APIs where available)
- **VicEmergency:** https://api.emergency.vic.gov.au (check availability)
- **BOM Observations:** https://www.bom.gov.au/fwo/metadata/json/wind.json (test)
- **ABC Local Radio:** Stream links available publicly

### Browser Compatibility
- Target: Modern mobile browsers (iOS Safari, Chrome)
- Fallback: If JavaScript fails, app still shows static content

### Performance
- Keep file size <500KB (currently ~15KB)
- No heavy libraries (vanilla JS preferred)
- Load time <2s on 4G

---

## ✍️ Design Principles (Keep in Mind)

1. **Anxiety reduction:** Make updates visible, timers clear, status obvious
2. **No false urgency:** Don't use red/flashing unless actually Emergency Warning
3. **Trust-building:** Always show data freshness, cite sources
4. **Simplicity:** If it's not essential tonight, it can wait
5. **Mobile-first:** You'll use this on phone while stressed
6. **Aussie tone:** Natural language, no corporate jargon

---

## 📞 Decision Rules

**When to add a feature:**
- Does it reduce anxiety or improve decision-making for tonight/tomorrow?
- Can it be built in <30 min?
- Does it trust the data (VicEmergency/BOM)?

**When to skip:**
- Nice-to-have but not essential to survival
- Requires complex APIs or external services
- Adds confusion or cognitive load

---

## 🔄 Next Steps

1. **Tonight:** Build Priority 1 (20 min) → test → sleep well
2. **Tomorrow morning:** Quick sanity check before 8am departure
3. **Tomorrow evening:** Debrief + log what actually happened
4. **Jan 2026:** Decide if this becomes your ongoing "family emergency app"

---

**Built with ❤️ for Josh Parris**  
*Stay safe. Trust the data. Leave early if in doubt.*
