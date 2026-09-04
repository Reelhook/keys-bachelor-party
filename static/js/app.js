/**
 * app.js
 * Florida Keys Bachelor Party Companion App Client Logic
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
    checkedItems: JSON.parse(localStorage.getItem('keys_prov_checked') || '{}'),
  };

  // DOM Elements
  const els = {
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
    scheduleContainer: document.getElementById('schedule-container'),
    scheduleCounter: document.getElementById('schedule-counter'),
    venuesContainer: document.getElementById('venues-container'),
    venuesCount: document.getElementById('venues-count'),
    venueSearchInput: document.getElementById('venue-search-input'),
    mapVenueSheet: document.getElementById('map-venue-sheet'),
    btnCloseSheet: document.getElementById('btn-close-sheet'),
    btnRecenterMap: document.getElementById('btn-recenter-map'),
    sheetTitle: document.getElementById('sheet-title'),
    sheetCategory: document.getElementById('sheet-category'),
    sheetAddress: document.getElementById('sheet-address'),
    sheetTime: document.getElementById('sheet-time'),
    sheetNotes: document.getElementById('sheet-notes'),
    sheetBtnNav: document.getElementById('sheet-btn-nav'),
    sheetBtnCall: document.getElementById('sheet-btn-call'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text'),
  };

  // 1. Initial Load & Event Listeners
  init();

  function init() {
    setupNavigation();
    setupDayFilter();
    setupSearch();
    setupModals();
    startCountdown();
    fetchData();

    // Auto-refresh every 60 seconds if tab is active
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData(false, true);
      }
    }, 60000);
  }

  // 2. Fetch Trip Data from Flask API
  async function fetchData(forceRefresh = false, silent = false) {
    if (!silent) {
      els.btnRefresh.classList.add('rotating');
    }

    try {
      const endpoint = forceRefresh ? '/api/refresh' : '/api/data';
      const method = forceRefresh ? 'POST' : 'GET';
      const resp = await fetch(endpoint, { method });
      const result = await resp.json();

      if (result.success && result.data) {
        state.data = result.data;
        state.lanUrl = result.lan_url || window.location.origin;

        renderAll();

        if (forceRefresh) {
          showToast('Spreadsheet successfully updated!');
        }
      } else {
        throw new Error(result.error || 'Failed to parse data');
      }
    } catch (err) {
      console.error('Error fetching trip data:', err);
      if (!silent) {
        showToast('Error syncing spreadsheet. Check connection.');
      }
    } finally {
      els.btnRefresh.classList.remove('rotating');
    }
  }

  // 3. Render Views
  function renderAll() {
    renderSchedule();
    renderVenues();
    renderBudget();
    renderProvisioning();
    renderCrew();
    renderQR();
    if (state.map) {
      updateMapMarkers();
    }
  }

  // 4. Tab & View Navigation
  function setupNavigation() {
    els.navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
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
        const isTentative = item.status.includes('Tentative') || item.status.includes('Backup');
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

    // Clean OpenStreetMap tiles (no API key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(state.map);

    // Map recollapse/recenter
    els.btnRecenterMap.addEventListener('click', () => {
      fitAllMarkers();
    });

    els.btnCloseSheet.addEventListener('click', () => {
      els.mapVenueSheet.classList.add('hidden');
    });

    // Map category filters
    document.querySelectorAll('.map-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
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
    switchTab('view-map');
    setTimeout(() => {
      if (!state.map) initMap();
      const marker = state.markers.find((m) => m._venueTitle.toLowerCase().includes(venueTitle.toLowerCase()) || venueTitle.toLowerCase().includes(m._venueTitle.toLowerCase()));
      if (marker) {
        state.map.flyTo(marker.getLatLng(), 14, { duration: 1 });
        marker.fire('click');
      } else {
        fitAllMarkers();
      }
    }, 200);
  };

  // 8. Venues Directory View
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

  // 9. Budget View Rendering
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

  // 10. Provisioning View Rendering
  function renderProvisioning() {
    if (!state.data || !state.data.provisioning) return;
    const prov = state.data.provisioning;
    const container = document.getElementById('provisioning-container');
    const chipContainer = document.getElementById('prov-filter-chips');

    // Build filter chips once
    if (chipContainer.children.length <= 1) {
      let chips = '<button class="prov-chip active" data-prov-cat="all">All Supplies</button>';
      (prov.categories || []).forEach((cat) => {
        chips += `<button class="prov-chip" data-prov-cat="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</button>`;
      });
      chipContainer.innerHTML = chips;

      chipContainer.querySelectorAll('.prov-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
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
    document.getElementById('provisioning-counter').textContent = `${checkedCount} / ${totalItems} Packed`;
  }

  window.toggleProvItem = function (itemId) {
    if (state.checkedItems[itemId]) {
      delete state.checkedItems[itemId];
    } else {
      state.checkedItems[itemId] = true;
    }
    localStorage.setItem('keys_prov_checked', JSON.stringify(state.checkedItems));

    const activeChip = document.querySelector('.prov-chip.active');
    renderProvisioningItems(activeChip ? activeChip.dataset.provCat : 'all');
  };

  // 11. Crew & Contacts Rendering
  function renderCrew() {
    if (!state.data || !state.data.dashboard) return;
    const d = state.data.dashboard;

    // Roster
    const crewList = document.getElementById('crew-roster-list');
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

    // Contacts
    const contactsList = document.getElementById('contacts-list');
    let contactsHtml = '';
    (d.contacts || []).forEach((c) => {
      contactsHtml += `
        <div class="contact-item">
          <div>
            <div class="contact-service">${escapeHtml(c.service)}</div>
            <div class="contact-name">${escapeHtml(c.name)}</div>
          </div>
          ${c.dial_number ? `
            <a class="contact-call-btn" href="tel:${c.dial_number}">
              <i class="fa-solid fa-phone"></i> Call
            </a>
          ` : `<span class="badge-count">${escapeHtml(c.phone)}</span>`}
        </div>
      `;
    });
    contactsList.innerHTML = contactsHtml;
  }

  // 12. QR Code Generator for Mobile Connect
  function renderQR() {
    const url = state.lanUrl || window.location.href;
    els.qrUrlText.textContent = url;

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

  function setupModals() {
    els.btnQrModal.addEventListener('click', () => {
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
      const url = els.qrUrlText.textContent;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
      });
    });
  }

  // 13. Countdown Timer
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

  // 14. Toast Notification
  let toastTimer = null;
  function showToast(msg) {
    els.toastText.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.add('hidden');
    }, 3200);
  }

  // 15. Sanitization Helpers
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
