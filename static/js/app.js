/**
 * app.js
 * Florida Keys Bachelor Party Companion App Client Logic
 * Enhanced with:
 * - Live Keys Marine & Weather Conditions (Open-Meteo API)
 * - Offshore Offline Support (Service Worker + Local Cache)
 * - Group Tab & Settle Up Expense Splitter
 * - One-Tap "Copy Day Plan" for iMessage / WhatsApp / GroupMe
 * - GPS "Locate Me" on Interactive Map
 * - Mobile Haptics & Visual Feedback
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    data: null,
    lanUrl: '',
    currentDay: 'all',
    currentTab: 'view-schedule',
    map: null,
    markers: [],
    mapFilter: 'all',
    userGpsMarker: null,
    userGpsCircle: null,
    checkedItems: JSON.parse(localStorage.getItem('keys_prov_checked') || '{}'),
    expenses: JSON.parse(localStorage.getItem('keys_bachelor_expenses') || '[]'),
    weatherLoc: 'marathon',
    weatherCache: {},
  };

  // DOM Elements
  const els = {
    // Header & Global
    btnRefresh: document.getElementById('btn-refresh'),
    btnQrModal: document.getElementById('btn-qr-modal'),
    qrModal: document.getElementById('qr-modal'),
    btnCloseQrModal: document.getElementById('btn-close-qr-modal'),
    qrCodeBox: document.getElementById('qrcode-box'),
    qrUrlText: document.getElementById('qr-url-text'),
    btnCopyUrl: document.getElementById('btn-copy-url'),
    countdownVal: document.getElementById('countdown-val'),
    dayPills: document.querySelectorAll('.day-pill'),
    navItems: document.querySelectorAll('.nav-item'),
    viewPanels: document.querySelectorAll('.view-panel'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text'),
    offlineBanner: document.getElementById('offline-banner'),

    // Schedule View
    btnCopyDayPlan: document.getElementById('btn-copy-day-plan'),
    scheduleContainer: document.getElementById('schedule-container'),
    scheduleCounter: document.getElementById('schedule-counter'),

    // Weather Widget
    weatherMarineCard: document.getElementById('weather-marine-card'),
    weatherLocBtns: document.querySelectorAll('.weather-loc-btn'),
    weatherTemp: document.getElementById('weather-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    weatherWind: document.getElementById('weather-wind'),
    weatherWindDir: document.getElementById('weather-wind-dir'),
    weatherBoatStatus: document.getElementById('weather-boat-status'),
    weatherBoatSub: document.getElementById('weather-boat-sub'),
    weatherSunset: document.getElementById('weather-sunset'),
    weatherUv: document.getElementById('weather-uv'),

    // Map View
    mapVenueSheet: document.getElementById('map-venue-sheet'),
    btnCloseSheet: document.getElementById('btn-close-sheet'),
    btnRecenterMap: document.getElementById('btn-recenter-map'),
    btnLocateMe: document.getElementById('btn-locate-me'),
    sheetTitle: document.getElementById('sheet-title'),
    sheetCategory: document.getElementById('sheet-category'),
    sheetAddress: document.getElementById('sheet-address'),
    sheetTime: document.getElementById('sheet-time'),
    sheetNotes: document.getElementById('sheet-notes'),
    sheetBtnNav: document.getElementById('sheet-btn-nav'),
    sheetBtnCall: document.getElementById('sheet-btn-call'),

    // Venues View
    venuesContainer: document.getElementById('venues-container'),
    venuesCount: document.getElementById('venues-count'),
    venueSearchInput: document.getElementById('venue-search-input'),

    // Budget & Settle Up
    btnAddExpenseModal: document.getElementById('btn-add-expense-modal'),
    expenseModal: document.getElementById('expense-modal'),
    btnCloseExpenseModal: document.getElementById('btn-close-expense-modal'),
    expenseForm: document.getElementById('expense-form'),
    settleUpBalances: document.getElementById('settle-up-balances'),
    settleExpensesList: document.getElementById('settle-expenses-list'),
    btnCopySettle: document.getElementById('btn-copy-settle'),
    btnClearSettle: document.getElementById('btn-clear-settle'),
  };

  // 1. Initial Load & Setup
  init();

  function init() {
    setupNavigation();
    setupDayFilter();
    setupSearch();
    setupModals();
    setupOffline();
    setupWeather();
    setupSharePlan();
    setupMapLocate();
    setupSettleUp();
    startCountdown();
    fetchData();

    // Auto-refresh every 60 seconds if tab is active
    setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fetchData(false, true);
      }
    }, 60000);
  }

  // Helper: Haptic Vibration for Touch Devices
  function triggerHaptic(ms = 15) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  }

  // 2. Fetch Trip Data from Flask API with Offline Fallback
  async function fetchData(forceRefresh = false, silent = false) {
    if (!silent) {
      els.btnRefresh.classList.add('rotating');
      triggerHaptic(15);
    }

    try {
      if (!navigator.onLine && !forceRefresh) {
        throw new Error('Offline');
      }

      const endpoint = forceRefresh ? '/api/refresh' : '/api/data';
      const method = forceRefresh ? 'POST' : 'GET';
      const resp = await fetch(endpoint, { method });
      const result = await resp.json();

      if (result.success && result.data) {
        state.data = result.data;
        state.lanUrl = result.lan_url || window.location.origin;

        // Cache for offline reef browsing
        try {
          localStorage.setItem('keys_trip_data_cache', JSON.stringify(result.data));
        } catch (e) {}

        renderAll();

        if (forceRefresh) {
          showToast('Spreadsheet successfully updated!');
        }
      } else {
        throw new Error(result.error || 'Failed to parse data');
      }
    } catch (err) {
      console.warn('Network fetch failed, attempting cached fallback:', err);
      const cached = localStorage.getItem('keys_trip_data_cache');
      if (cached) {
        try {
          state.data = JSON.parse(cached);
          renderAll();
          if (!silent) {
            showToast('Loaded cached offline data');
          }
        } catch (e) {}
      } else if (!silent) {
        showToast('Error syncing spreadsheet. Check connection.');
      }
    } finally {
      els.btnRefresh.classList.remove('rotating');
    }
  }

  // 3. Render All Views
  function renderAll() {
    renderSchedule();
    renderVenues();
    renderBudget();
    renderProvisioning();
    renderCrew();
    renderQR();
    renderSettleUp();
    if (state.map) {
      updateMapMarkers();
    }
  }

  // 4. Tab & View Navigation
  function setupNavigation() {
    els.navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        triggerHaptic(10);
        const targetViewId = btn.dataset.target;
        switchTab(targetViewId);
      });
    });

    els.btnRefresh.addEventListener('click', () => {
      fetchData(true);
    });
  }

  function switchTab(viewId) {
    state.currentTab = viewId;

    // Update Nav buttons
    els.navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.target === viewId);
    });

    // Update Panels
    els.viewPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === viewId);
    });

    // If switching to map, trigger Leaflet resize
    if (viewId === 'view-map') {
      if (!state.map) {
        initMap();
      } else {
        setTimeout(() => {
          state.map.invalidateSize();
        }, 100);
      }
    }
  }

  // 5. Day Filter Setup
  function setupDayFilter() {
    els.dayPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        triggerHaptic(12);
        els.dayPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        state.currentDay = pill.dataset.day;

        renderSchedule();
        if (state.map) {
          updateMapMarkers();
        }
      });
    });
  }

  // 6. Schedule View Rendering
  function renderSchedule() {
    if (!state.data || !state.data.itinerary) return;

    const days = state.data.itinerary.days || [];
    let html = '';
    let eventCount = 0;

    days.forEach((dayGroup) => {
      const headerTitle = dayGroup.title.toUpperCase();
      let dayKey = 'other';
      if (headerTitle.includes('THURSDAY')) dayKey = 'thu';
      else if (headerTitle.includes('FRIDAY')) dayKey = 'fri';
      else if (headerTitle.includes('SATURDAY')) dayKey = 'sat';
      else if (headerTitle.includes('SUNDAY')) dayKey = 'sun';
      else if (headerTitle.includes('MONDAY')) dayKey = 'mon';

      // Filter by selected day pill
      if (state.currentDay !== 'all' && state.currentDay !== dayKey) {
        return;
      }

      const items = dayGroup.items || [];
      if (items.length === 0) return;

      html += `<div class="timeline-day-group">`;
      html += `<div class="day-group-header">${escapeHtml(dayGroup.title)}</div>`;

      items.forEach((item) => {
        eventCount++;
        const isTentative = (item.status || '').includes('Tentative') || (item.status || '').includes('Backup');
        const cardClass = isTentative ? 'timeline-card tentative' : 'timeline-card';
        const statusClass = getStatusClass(item.status);

        html += `
          <div class="${cardClass}" id="${item.id}">
            <div class="card-top-row">
              <span class="card-time-badge"><i class="fa-regular fa-clock"></i> ${escapeHtml(item.time || 'TBD')}</span>
              <span class="card-status-badge ${statusClass}">${escapeHtml(item.status || 'Planned')}</span>
            </div>
            <h3 class="card-activity-title">${escapeHtml(item.activity)}</h3>
            ${item.address ? `<p class="card-address-row"><i class="fa-solid fa-location-dot"></i> <span>${escapeHtml(item.address)}</span></p>` : ''}
            ${item.notes ? `<div class="card-notes">${escapeHtml(item.notes)}</div>` : ''}
            
            <div class="card-cost-row">
              ${item.cost_per_person ? `<span class="cost-chip">👤 ${escapeHtml(item.cost_per_person)} / person</span>` : ''}
              ${item.cost_group ? `<span class="cost-chip">👥 ${escapeHtml(item.cost_group)} group</span>` : ''}
            </div>

            <div class="card-actions-row">
              ${item.geo ? `
                <button class="action-btn map-btn" onclick="window.focusVenueMap('${escapeQuotes(item.activity)}')">
                  <i class="fa-solid fa-map-location-dot"></i> View on Map
                </button>
              ` : ''}
              ${item.address ? `
                <a class="action-btn nav-btn" href="https://maps.google.com/?q=${encodeURIComponent(item.address)}" target="_blank">
                  <i class="fa-solid fa-diamond-turn-right"></i> Directions
                </a>
              ` : ''}
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });

    els.scheduleContainer.innerHTML = html || '<div class="loading-state">No scheduled events for this filter.</div>';
    els.scheduleCounter.textContent = `${eventCount} Events`;
  }

  function getStatusClass(status) {
    if (!status) return 'status-walkin';
    const s = status.toLowerCase();
    if (s.includes('booked') || s.includes('confirmed') || s.includes('paid')) return 'status-confirmed';
    if (s.includes('walk-in') || s.includes('planned')) return 'status-walkin';
    if (s.includes('tentative') || s.includes('backup')) return 'status-tentative';
    if (s.includes('reservation') || s.includes('due') || s.includes('needed')) return 'status-reservation';
    return 'status-walkin';
  }

  // 7. Interactive Leaflet Map
  function initMap() {
    if (state.map) return;

    // Center on Marathon, FL (Key West to Islamorada mid-point)
    state.map = L.map('keys-map', {
      zoomControl: false,
      attributionControl: false,
    }).setView([24.7136, -81.0903], 10);

    L.control.zoom({ position: 'topright' }).addTo(state.map);

    // Clean OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(state.map);

    // Map recollapse/recenter
    els.btnRecenterMap.addEventListener('click', () => {
      triggerHaptic(12);
      fitAllMarkers();
    });

    els.btnCloseSheet.addEventListener('click', () => {
      els.mapVenueSheet.classList.add('hidden');
    });

    // Map category filters
    document.querySelectorAll('.map-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        triggerHaptic(10);
        document.querySelectorAll('.map-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.mapFilter = btn.dataset.mapFilter;
        updateMapMarkers();
      });
    });

    updateMapMarkers();
  }

  function updateMapMarkers() {
    if (!state.map || !state.data) return;

    // Clear existing markers
    state.markers.forEach((m) => state.map.removeLayer(m));
    state.markers = [];

    const items = state.data.itinerary.all_items || [];
    const activities = state.data.activities || [];
    const addedCoords = new Set();
    const groupBounds = L.latLngBounds();

    // 1. Plot Itinerary items first
    items.forEach((item) => {
      if (!item.geo) return;

      // Filter by day pill if not 'all'
      const title = item.day_header.toUpperCase();
      let dayKey = 'other';
      if (title.includes('THURSDAY')) dayKey = 'thu';
      else if (title.includes('FRIDAY')) dayKey = 'fri';
      else if (title.includes('SATURDAY')) dayKey = 'sat';
      else if (title.includes('SUNDAY')) dayKey = 'sun';
      else if (title.includes('MONDAY')) dayKey = 'mon';

      if (state.currentDay !== 'all' && state.currentDay !== dayKey) {
        return;
      }

      // Filter by Category
      const cat = item.geo.category || 'food_drink';
      if (state.mapFilter !== 'all' && state.mapFilter !== cat) {
        return;
      }

      const coordKey = `${item.geo.lat.toFixed(4)},${item.geo.lng.toFixed(4)}`;
      addedCoords.add(coordKey);

      createMarker(item.geo, item.activity, item.time, item.notes, item.address, null, groupBounds);
    });

    // 2. Also plot activities from Activities tab if on 'all' day
    if (state.currentDay === 'all') {
      activities.forEach((act) => {
        if (!act.geo) return;
        const cat = act.geo.category || 'food_drink';
        if (state.mapFilter !== 'all' && state.mapFilter !== cat) return;

        const coordKey = `${act.geo.lat.toFixed(4)},${act.geo.lng.toFixed(4)}`;
        if (addedCoords.has(coordKey)) return;
        addedCoords.add(coordKey);

        createMarker(act.geo, act.name, act.hours, act.notes, act.address, act.dial_number, groupBounds);
      });
    }

    if (state.markers.length > 0) {
      state.map.fitBounds(groupBounds, { padding: [40, 40], maxZoom: 13 });
    }
  }

  function createMarker(geo, title, time, notes, address, phone, bounds) {
    const cat = geo.category || 'food_drink';
    const iconClass = geo.icon || 'fa-location-dot';

    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="custom-marker marker-${cat}">
          <i class="fa-solid ${iconClass}"></i>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const marker = L.marker([geo.lat, geo.lng], { icon: customIcon }).addTo(state.map);
    bounds.extend([geo.lat, geo.lng]);

    marker.on('click', () => {
      triggerHaptic(15);
      openMapSheet(geo, title, time, notes, address, phone);
      state.map.panTo([geo.lat, geo.lng]);
    });

    marker._venueTitle = title;
    state.markers.push(marker);
  }

  function openMapSheet(geo, title, time, notes, address, phone) {
    els.sheetTitle.textContent = title;
    els.sheetCategory.textContent = (geo.category || 'Venue').toUpperCase().replace('_', ' ');
    els.sheetAddress.querySelector('span').textContent = address || geo.label || 'Florida Keys';
    els.sheetTime.querySelector('span').textContent = time || 'See Schedule';
    els.sheetNotes.textContent = notes || '';

    const navQuery = address || `${title} Florida Keys`;
    els.sheetBtnNav.href = `https://maps.google.com/?q=${encodeURIComponent(navQuery)}`;

    if (phone) {
      els.sheetBtnCall.href = `tel:${phone}`;
      els.sheetBtnCall.classList.remove('hidden');
    } else {
      els.sheetBtnCall.classList.add('hidden');
    }

    els.mapVenueSheet.classList.remove('hidden');
  }

  function fitAllMarkers() {
    if (!state.map || state.markers.length === 0) return;
    const groupBounds = L.latLngBounds(state.markers.map((m) => m.getLatLng()));
    state.map.fitBounds(groupBounds, { padding: [50, 50] });
  }

  // Global helper for Schedule -> Map linking
  window.focusVenueMap = function (venueTitle) {
    triggerHaptic(12);
    switchTab('view-map');
    setTimeout(() => {
      if (!state.map) initMap();
      const marker = state.markers.find(
        (m) =>
          m._venueTitle.toLowerCase().includes(venueTitle.toLowerCase()) ||
          venueTitle.toLowerCase().includes(m._venueTitle.toLowerCase())
      );
      if (marker) {
        state.map.flyTo(marker.getLatLng(), 14, { duration: 1 });
        marker.fire('click');
      } else {
        fitAllMarkers();
      }
    }, 200);
  };

  // 8. GPS "Locate Me" on Map
  function setupMapLocate() {
    if (!els.btnLocateMe) return;

    els.btnLocateMe.addEventListener('click', () => {
      triggerHaptic(15);
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.');
        return;
      }

      showToast('Finding your GPS location...');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;

          if (!state.map) initMap();

          // Remove old GPS markers if existing
          if (state.userGpsMarker) state.map.removeLayer(state.userGpsMarker);
          if (state.userGpsCircle) state.map.removeLayer(state.userGpsCircle);

          const gpsIcon = L.divIcon({
            className: 'gps-div-icon',
            html: '<div class="gps-user-marker"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });

          state.userGpsMarker = L.marker([lat, lng], { icon: gpsIcon }).addTo(state.map);
          state.userGpsCircle = L.circle([lat, lng], {
            radius: Math.min(accuracy, 200),
            color: '#38bdf8',
            fillColor: '#38bdf8',
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(state.map);

          state.map.flyTo([lat, lng], 13, { duration: 1.2 });
          showToast('Located! Showing your position 📍');
        },
        (err) => {
          console.warn('Geolocation error:', err);
          showToast('Unable to retrieve your location. Enable GPS.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }

  // 9. Venues Directory View
  function renderVenues() {
    if (!state.data || !state.data.activities) return;
    const activities = state.data.activities;
    const query = (els.venueSearchInput.value || '').toLowerCase().trim();

    const filtered = activities.filter((act) => {
      if (!query) return true;
      return (
        act.name.toLowerCase().includes(query) ||
        act.category.toLowerCase().includes(query) ||
        act.notes.toLowerCase().includes(query) ||
        act.address.toLowerCase().includes(query)
      );
    });

    let html = '';
    filtered.forEach((v) => {
      html += `
        <div class="venue-card">
          <div class="venue-header-row">
            <span class="venue-cat-badge">${escapeHtml(v.category || 'Venue')}</span>
            <span class="card-status-badge ${getStatusClass(v.status)}">${escapeHtml(v.status || 'Planned')}</span>
          </div>
          <h3 class="venue-name">${escapeHtml(v.name)}</h3>
          ${v.address ? `<p class="card-address-row"><i class="fa-solid fa-location-dot"></i> <span>${escapeHtml(v.address)}</span></p>` : ''}
          ${v.hours ? `<p class="venue-hours"><i class="fa-regular fa-clock"></i> <span>${escapeHtml(v.hours)}</span></p>` : ''}
          ${v.reservation_policy ? `<p class="venue-res"><i class="fa-solid fa-circle-info"></i> <span>${escapeHtml(v.reservation_policy)}</span></p>` : ''}
          ${v.notes ? `<div class="venue-tips">💡 <strong>Crew Tips:</strong> ${escapeHtml(v.notes)}</div>` : ''}

          <div class="venue-actions">
            ${v.geo ? `
              <button class="action-btn map-btn" onclick="window.focusVenueMap('${escapeQuotes(v.name)}')">
                <i class="fa-solid fa-map-location-dot"></i> Map
              </button>
            ` : ''}
            ${v.dial_number ? `
              <a class="action-btn nav-btn" href="tel:${v.dial_number}">
                <i class="fa-solid fa-phone"></i> Call
              </a>
            ` : ''}
            ${v.link ? `
              <a class="action-btn nav-btn" href="${v.link}" target="_blank">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Site
              </a>
            ` : ''}
          </div>
        </div>
      `;
    });

    els.venuesContainer.innerHTML = html || '<div class="loading-state">No venues match your search.</div>';
    els.venuesCount.textContent = `${filtered.length} Venues`;
  }

  function setupSearch() {
    els.venueSearchInput.addEventListener('input', () => {
      renderVenues();
    });
  }

  // 10. Budget View Rendering
  function renderBudget() {
    if (!state.data || !state.data.budget) return;
    const b = state.data.budget;
    const summary = b.summary || {};

    document.getElementById('kpi-total-cost').textContent = `$${summary.total_cost?.toLocaleString() || '0'}`;
    document.getElementById('kpi-per-person').textContent = `$${summary.per_person_estimate?.toLocaleString() || '0'}`;
    document.getElementById('kpi-paid').textContent = `$${summary.total_paid?.toLocaleString() || '0'}`;
    document.getElementById('kpi-due').textContent = `$${summary.total_due?.toLocaleString() || '0'}`;

    // Category progress bars
    const catBreakdown = b.category_breakdown || {};
    const catContainer = document.getElementById('budget-category-list');
    let catHtml = '';
    const total = summary.total_cost || 1;

    for (const [cat, amt] of Object.entries(catBreakdown)) {
      const pct = Math.round((amt / total) * 100);
      catHtml += `
        <div class="cat-bar-item">
          <div class="cat-bar-labels">
            <span>${escapeHtml(cat)}</span>
            <span>$${amt.toLocaleString()} (${pct}%)</span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }
    catContainer.innerHTML = catHtml;

    // Detailed table
    const tableWrap = document.getElementById('budget-items-table');
    let tableHtml = '';
    (b.items || []).forEach((item) => {
      tableHtml += `
        <div class="budget-item-row">
          <div>
            <div class="b-item-name">${escapeHtml(item.item)}</div>
            <div class="b-item-cat">${escapeHtml(item.category)} • Payer: ${escapeHtml(item.payer || 'Split')}</div>
          </div>
          <div class="b-item-cost">
            <div class="b-item-total">$${item.total_cost.toLocaleString()}</div>
            <div class="b-item-share">$${item.per_person.toLocaleString()} / guy</div>
          </div>
        </div>
      `;
    });
    tableWrap.innerHTML = tableHtml;
  }

  // 11. On-The-Fly Tab & Settle Up Tracker
  function setupSettleUp() {
    if (!els.btnAddExpenseModal) return;

    els.btnAddExpenseModal.addEventListener('click', () => {
      triggerHaptic(15);
      els.expenseModal.classList.remove('hidden');
    });

    els.btnCloseExpenseModal.addEventListener('click', () => {
      els.expenseModal.classList.add('hidden');
    });

    els.expenseModal.addEventListener('click', (e) => {
      if (e.target === els.expenseModal) {
        els.expenseModal.classList.add('hidden');
      }
    });

    els.expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerHaptic(20);

      const desc = document.getElementById('exp-desc').value.trim();
      const amount = parseFloat(document.getElementById('exp-amount').value);
      const payer = document.getElementById('exp-payer').value;
      const checkedGuys = Array.from(document.querySelectorAll('input[name="split-guy"]:checked')).map((c) => c.value);

      if (!desc || isNaN(amount) || amount <= 0 || checkedGuys.length === 0) {
        showToast('Please fill in valid expense details.');
        return;
      }

      const newExpense = {
        id: 'exp_' + Date.now(),
        desc,
        amount,
        payer,
        splitWith: checkedGuys,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      state.expenses.unshift(newExpense);
      localStorage.setItem('keys_bachelor_expenses', JSON.stringify(state.expenses));

      els.expenseForm.reset();
      // Keep all checkboxes checked
      document.querySelectorAll('input[name="split-guy"]').forEach((c) => (c.checked = true));
      els.expenseModal.classList.add('hidden');

      renderSettleUp();
      showToast(`Added "$${amount.toFixed(2)} for ${desc}"!`);
    });

    els.btnCopySettle.addEventListener('click', () => {
      triggerHaptic(20);
      copySettleUpSummary();
    });

    els.btnClearSettle.addEventListener('click', () => {
      if (state.expenses.length === 0) return;
      if (confirm('Clear all logged on-the-fly tabs?')) {
        triggerHaptic(25);
        state.expenses = [];
        localStorage.removeItem('keys_bachelor_expenses');
        renderSettleUp();
        showToast('Tab tracker reset.');
      }
    });

    renderSettleUp();
  }

  function renderSettleUp() {
    if (!els.settleUpBalances || !els.settleExpensesList) return;

    const crew = ['Jake', 'Steven', 'Zach', 'Christian', 'Tyler'];
    const balances = {};
    crew.forEach((name) => (balances[name] = 0));

    // Calculate Net Balances
    state.expenses.forEach((exp) => {
      const share = exp.amount / exp.splitWith.length;
      exp.splitWith.forEach((guy) => {
        if (guy !== exp.payer) {
          balances[guy] = (balances[guy] || 0) - share;
        }
      });
      // Payer gets credited for others' shares
      const otherShares = exp.splitWith.filter((g) => g !== exp.payer).length;
      balances[exp.payer] = (balances[exp.payer] || 0) + share * otherShares;
    });

    // Simplify debts: Match debtors with creditors
    const creditors = [];
    const debtors = [];
    for (const [guy, bal] of Object.entries(balances)) {
      if (bal > 0.05) creditors.push({ name: guy, amt: bal });
      else if (bal < -0.05) debtors.push({ name: guy, amt: -bal });
    }

    creditors.sort((a, b) => b.amt - a.amt);
    debtors.sort((a, b) => b.amt - a.amt);

    const settlements = [];
    let i = 0,
      j = 0;
    while (i < debtors.length && j < creditors.length) {
      const settleAmt = Math.min(debtors[i].amt, creditors[j].amt);
      if (settleAmt > 0.05) {
        settlements.push({
          from: debtors[i].name,
          to: creditors[j].name,
          amount: settleAmt,
        });
      }
      debtors[i].amt -= settleAmt;
      creditors[j].amt -= settleAmt;

      if (debtors[i].amt < 0.05) i++;
      if (creditors[j].amt < 0.05) j++;
    }

    // Render Balances Summary
    if (settlements.length === 0) {
      els.settleUpBalances.innerHTML = `
        <div class="settle-empty">
          ${state.expenses.length === 0 ? 'No extra tabs logged yet. Tap <strong>+ Add Tab</strong> when picking up a round!' : '🎉 All settled up! No outstanding balances.'}
        </div>
      `;
    } else {
      let bHtml = '';
      settlements.forEach((s) => {
        bHtml += `
          <div class="settle-balance-row">
            <div>
              <span class="settle-payer">${escapeHtml(s.from)}</span>
              <span class="settle-arrow"><i class="fa-solid fa-arrow-right"></i> owes</span>
              <span class="settle-payee">${escapeHtml(s.to)}</span>
            </div>
            <span class="settle-amt">$${s.amount.toFixed(2)}</span>
          </div>
        `;
      });
      els.settleUpBalances.innerHTML = bHtml;
    }

    // Render Expense Items History
    let expHtml = '';
    state.expenses.forEach((item) => {
      expHtml += `
        <div class="settle-item">
          <div>
            <div class="settle-item-title">${escapeHtml(item.desc)}</div>
            <div class="settle-item-sub">Paid by ${escapeHtml(item.payer)} • Split ${item.splitWith.length} ways • ${escapeHtml(item.time || '')}</div>
          </div>
          <div class="settle-item-right">
            <span class="settle-item-amt">$${item.amount.toFixed(2)}</span>
            <button class="settle-item-del" onclick="window.deleteExpense('${item.id}')" title="Delete tab">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    });
    els.settleExpensesList.innerHTML = expHtml;
  }

  window.deleteExpense = function (id) {
    triggerHaptic(15);
    state.expenses = state.expenses.filter((e) => e.id !== id);
    localStorage.setItem('keys_bachelor_expenses', JSON.stringify(state.expenses));
    renderSettleUp();
    showToast('Expense removed.');
  };

  function copySettleUpSummary() {
    if (state.expenses.length === 0) {
      showToast('No expenses to copy yet!');
      return;
    }

    let text = `🌴 JAKE'S KEYS BACHELOR PARTY — TAB SETTLE UP 💸\n`;
    const balanceRows = document.querySelectorAll('.settle-balance-row');
    if (balanceRows.length === 0) {
      text += `All settled up! No outstanding balances.\n`;
    } else {
      balanceRows.forEach((row) => {
        const payer = row.querySelector('.settle-payer').textContent;
        const payee = row.querySelector('.settle-payee').textContent;
        const amt = row.querySelector('.settle-amt').textContent;
        text += `• ${payer} owes ${payee}: ${amt}\n`;
      });
    }

    const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    text += `\nTotal Tabs: ${state.expenses.length} ($${total.toFixed(2)})\n`;
    text += `📱 Check live: ${window.location.href}`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Settle-up balances copied to clipboard!');
    });
  }

  // 12. "Copy Day Plan" for Group Chat
  function setupSharePlan() {
    if (!els.btnCopyDayPlan) return;

    els.btnCopyDayPlan.addEventListener('click', () => {
      triggerHaptic(20);
      if (!state.data || !state.data.itinerary) return;

      const days = state.data.itinerary.days || [];
      let targetDayGroup = null;

      if (state.currentDay === 'all') {
        targetDayGroup = days;
      } else {
        targetDayGroup = days.filter((d) => {
          const t = d.title.toUpperCase();
          if (state.currentDay === 'thu') return t.includes('THURSDAY');
          if (state.currentDay === 'fri') return t.includes('FRIDAY');
          if (state.currentDay === 'sat') return t.includes('SATURDAY');
          if (state.currentDay === 'sun') return t.includes('SUNDAY');
          if (state.currentDay === 'mon') return t.includes('MONDAY');
          return false;
        });
      }

      if (!targetDayGroup || targetDayGroup.length === 0) {
        showToast('No events found for this filter.');
        return;
      }

      let text = `🌴 JAKE'S KEYS BACHELOR PARTY ITINERARY 🌴\n\n`;

      targetDayGroup.forEach((group) => {
        text += `📅 ${group.title.toUpperCase()}\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━\n`;
        (group.items || []).forEach((item) => {
          text += `⏰ ${item.time || 'TBD'} — ${item.activity}\n`;
          if (item.address) text += `   📍 ${item.address}\n`;
          if (item.status) text += `   🏷️ ${item.status}\n`;
          if (item.notes) text += `   💡 ${item.notes}\n`;
          text += `\n`;
        });
      });

      text += `📱 Open full companion app & map:\n${window.location.href}`;

      navigator.clipboard.writeText(text).then(() => {
        showToast('Itinerary copied! Ready to paste in GroupMe / iMessage 🎉');
      });
    });
  }

  // 13. Live Keys Marine & Weather Widget (Open-Meteo)
  const LOCATIONS = {
    marathon: { name: 'Marathon (Villa & Reef)', lat: 24.7136, lng: -81.0903 },
    keywest: { name: 'Key West (Duval & Harbor)', lat: 24.5551, lng: -81.7800 },
  };

  const WMO_CODES = {
    0: 'Clear Sky ☀️',
    1: 'Mainly Clear 🌤️',
    2: 'Partly Cloudy ⛅',
    3: 'Overcast ☁️',
    45: 'Foggy 🌫️',
    51: 'Light Drizzle 🌦️',
    61: 'Slight Rain 🌧️',
    63: 'Moderate Rain 🌧️',
    65: 'Heavy Rain 🌧️',
    80: 'Rain Showers 🌦️',
    81: 'Showers 🌧️',
    95: 'Thunderstorm ⛈️',
  };

  function setupWeather() {
    if (!els.weatherMarineCard) return;

    els.weatherLocBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        triggerHaptic(10);
        els.weatherLocBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.weatherLoc = btn.dataset.loc;
        fetchKeysWeather(state.weatherLoc);
      });
    });

    fetchKeysWeather(state.weatherLoc);
  }

  async function fetchKeysWeather(locKey) {
    const loc = LOCATIONS[locKey] || LOCATIONS.marathon;

    // Check 20-min cache
    const cacheKey = `weather_${locKey}`;
    const cached = state.weatherCache[cacheKey];
    if (cached && Date.now() - cached.time < 20 * 60 * 1000) {
      applyWeatherUI(cached.data, loc.name);
      return;
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=uv_index_max,sunset&temperature_unit=fahrenheit&wind_speed_unit=kn&timezone=America%2FNew_York`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data && data.current) {
        state.weatherCache[cacheKey] = { data, time: Date.now() };
        applyWeatherUI(data, loc.name);
      }
    } catch (e) {
      console.warn('Weather fetch error:', e);
      if (els.weatherDesc) els.weatherDesc.textContent = 'Sunny & Tropical 🌴';
      if (els.weatherTemp) els.weatherTemp.textContent = '84°F';
      if (els.weatherWind) els.weatherWind.textContent = '8 kt';
      if (els.weatherBoatStatus) els.weatherBoatStatus.textContent = 'Calm 🚤';
    }
  }

  function applyWeatherUI(data, locName) {
    const current = data.current || {};
    const daily = data.daily || {};

    // Temperature & Description
    const temp = Math.round(current.temperature_2m || 82);
    const code = current.weather_code || 0;
    const desc = WMO_CODES[code] || 'Tropical 🌴';

    if (els.weatherTemp) els.weatherTemp.textContent = `${temp}°F`;
    if (els.weatherDesc) els.weatherDesc.textContent = desc;

    // Wind & Direction (in Knots for Boating)
    const windKt = Math.round(current.wind_speed_10m || 8);
    const windDirDeg = current.wind_direction_10m || 90;
    const compassDirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compass = compassDirs[Math.round(windDirDeg / 22.5) % 16] || 'E';

    if (els.weatherWind) els.weatherWind.textContent = `${windKt} kt`;
    if (els.weatherWindDir) els.weatherWindDir.textContent = `${compass} (${Math.round(windKt * 1.15)} mph)`;

    // Boating / Reef Safety evaluation
    let boatStatus = 'Calm 🚤';
    let boatSub = 'Reef Safe';
    if (windKt > 20) {
      boatStatus = 'Rough 🛑';
      boatSub = 'Stay Inshore';
    } else if (windKt > 14) {
      boatStatus = 'Breezy ⚠️';
      boatSub = 'Caution on Reef';
    } else if (windKt > 9) {
      boatStatus = 'Moderate 🌊';
      boatSub = 'Light Chop';
    }

    if (els.weatherBoatStatus) els.weatherBoatStatus.textContent = boatStatus;
    if (els.weatherBoatSub) els.weatherBoatSub.textContent = boatSub;

    // Sunset & UV Index
    const uvMax = daily.uv_index_max ? Math.round(daily.uv_index_max[0]) : 8;
    let sunsetStr = '7:35 PM';
    if (daily.sunset && daily.sunset[0]) {
      const sDate = new Date(daily.sunset[0]);
      sunsetStr = sDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    if (els.weatherSunset) els.weatherSunset.textContent = sunsetStr;
    if (els.weatherUv) els.weatherUv.textContent = `UV ${uvMax} (${uvMax >= 8 ? 'Very High' : uvMax >= 6 ? 'High' : 'Moderate'})`;
  }

  // 14. Offshore Offline Support
  function setupOffline() {
    window.addEventListener('online', () => {
      if (els.offlineBanner) els.offlineBanner.classList.add('hidden');
      showToast('Back online! Syncing spreadsheet...');
      fetchData(false, true);
    });

    window.addEventListener('offline', () => {
      if (els.offlineBanner) els.offlineBanner.classList.remove('hidden');
      showToast('Offline mode active &bull; Cached for offshore use');
    });

    if (!navigator.onLine && els.offlineBanner) {
      els.offlineBanner.classList.remove('hidden');
    }
  }

  // 15. Provisioning View Rendering
  function renderProvisioning() {
    if (!state.data || !state.data.provisioning) return;
    const prov = state.data.provisioning;
    const chipContainer = document.getElementById('prov-filter-chips');

    // Build filter chips once
    if (chipContainer && chipContainer.children.length <= 1) {
      let chips = '<button class="prov-chip active" data-prov-cat="all">All Supplies</button>';
      (prov.categories || []).forEach((cat) => {
        chips += `<button class="prov-chip" data-prov-cat="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</button>`;
      });
      chipContainer.innerHTML = chips;

      chipContainer.querySelectorAll('.prov-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          triggerHaptic(10);
          chipContainer.querySelectorAll('.prov-chip').forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          renderProvisioningItems(chip.dataset.provCat);
        });
      });
    }

    renderProvisioningItems('all');
  }

  function renderProvisioningItems(categoryFilter) {
    const prov = state.data.provisioning;
    const container = document.getElementById('provisioning-container');
    if (!container) return;

    let html = '';
    let totalItems = 0;
    let checkedCount = 0;

    (prov.categories || []).forEach((group) => {
      if (categoryFilter !== 'all' && group.name !== categoryFilter) return;

      html += `<div class="prov-group">`;
      html += `<div class="prov-group-header">${escapeHtml(group.name)}</div>`;

      (group.items || []).forEach((item) => {
        totalItems++;
        const isChecked = !!state.checkedItems[item.id];
        if (isChecked) checkedCount++;

        html += `
          <div class="prov-item-card ${isChecked ? 'checked' : ''}" onclick="window.toggleProvItem('${item.id}')">
            <div class="prov-checkbox"><i class="fa-solid fa-check"></i></div>
            <div class="prov-item-info">
              <div class="prov-item-desc">${escapeHtml(item.description)}</div>
              ${item.brand ? `<div class="prov-item-brand">${escapeHtml(item.brand)}</div>` : ''}
            </div>
            <div class="prov-item-meta">
              <div class="prov-item-cost">$${item.total_cost}</div>
              <div class="prov-item-qty">${item.qty ? `Qty: ${item.qty}` : ''}</div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
    const counter = document.getElementById('provisioning-counter');
    if (counter) counter.textContent = `${checkedCount} / ${totalItems} Packed`;
  }

  window.toggleProvItem = function (itemId) {
    triggerHaptic(15);
    if (state.checkedItems[itemId]) {
      delete state.checkedItems[itemId];
    } else {
      state.checkedItems[itemId] = true;
    }
    localStorage.setItem('keys_prov_checked', JSON.stringify(state.checkedItems));

    const activeChip = document.querySelector('.prov-chip.active');
    renderProvisioningItems(activeChip ? activeChip.dataset.provCat : 'all');
  };

  // 16. Crew & Contacts Rendering
  function renderCrew() {
    if (!state.data || !state.data.dashboard) return;
    const d = state.data.dashboard;

    // Roster
    const crewList = document.getElementById('crew-roster-list');
    if (crewList) {
      let crewHtml = '';
      (d.crew_roster || []).forEach((member) => {
        const initial = (member.name || 'C')[0].toUpperCase();
        crewHtml += `
          <div class="crew-item">
            <div class="crew-avatar">${initial}</div>
            <div class="crew-info">
              <h4>${escapeHtml(member.name)}</h4>
              <p>${escapeHtml(member.role || 'Crew Member')}</p>
            </div>
          </div>
        `;
      });
      crewList.innerHTML = crewHtml;
    }

    // Contacts
    const contactsList = document.getElementById('contacts-list');
    if (contactsList) {
      let contactsHtml = '';
      (d.contacts || []).forEach((c) => {
        contactsHtml += `
          <div class="contact-item">
            <div>
              <div class="contact-service">${escapeHtml(c.service)}</div>
              <div class="contact-name">${escapeHtml(c.name)}</div>
            </div>
            ${
              c.dial_number
                ? `
              <a class="contact-call-btn" href="tel:${c.dial_number}">
                <i class="fa-solid fa-phone"></i> Call
              </a>
            `
                : `<span class="badge-count">${escapeHtml(c.phone)}</span>`
            }
          </div>
        `;
      });
      contactsList.innerHTML = contactsHtml;
    }
  }

  // 17. QR Code Generator for Mobile Connect
  function renderQR() {
    const url = state.lanUrl || window.location.href;
    if (els.qrUrlText) els.qrUrlText.textContent = url;

    if (els.qrCodeBox) {
      els.qrCodeBox.innerHTML = '';
      if (window.QRCode) {
        new QRCode(els.qrCodeBox, {
          text: url,
          width: 180,
          height: 180,
          colorDark: '#071018',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    }
  }

  function setupModals() {
    els.btnQrModal.addEventListener('click', () => {
      triggerHaptic(15);
      renderQR();
      els.qrModal.classList.remove('hidden');
    });

    els.btnCloseQrModal.addEventListener('click', () => {
      els.qrModal.classList.add('hidden');
    });

    els.qrModal.addEventListener('click', (e) => {
      if (e.target === els.qrModal) {
        els.qrModal.classList.add('hidden');
      }
    });

    els.btnCopyUrl.addEventListener('click', () => {
      triggerHaptic(15);
      const url = els.qrUrlText.textContent;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
      });
    });
  }

  // 18. Countdown Timer
  function startCountdown() {
    const tripDate = new Date('2026-09-10T12:00:00');

    function update() {
      const now = new Date();
      const diff = tripDate - now;

      if (diff <= 0) {
        els.countdownVal.textContent = "IT'S PARTY TIME! 🎉";
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);

      els.countdownVal.textContent = `${days}d ${hours}h ${minutes}m`;
    }

    update();
    setInterval(update, 60000);
  }

  // 19. Toast Notification
  let toastTimer = null;
  function showToast(msg) {
    els.toastText.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.add('hidden');
    }, 3400);
  }

  // 20. Sanitization Helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }
});
