// Global helpers
function getStatusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "available":
      return "bg-success";
    case "pending":
      return "bg-warning text-dark";
    case "sold":
      return "bg-danger";
    default:
      return "bg-secondary";
  }
}
function normalizeTelHref(phone) {
  if (!phone) return "";
  return "tel:" + String(phone).replace(/[^+\d]/g, "");
}
function safeText(value) {
  return value == null ? "" : String(value);
}
function formatPriceETB(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US") + " Birr";
}
function t(key, fallback) {
  return window.__t ? window.__t(key, fallback) : fallback || key;
}

// Toast + loading helpers
let __loadingCount = 0;
function showToast(message) {
  try {
    const id = "global-toast-container";
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement("div");
      container.id = id;
      container.className = "toast-container position-fixed bottom-0 end-0 p-3";
      document.body.appendChild(container);
    }
    const toastEl = document.createElement("div");
    toastEl.className = "toast align-items-center text-bg-dark border-0";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.setAttribute("aria-atomic", "true");
    toastEl.innerHTML =
      '<div class="d-flex">' +
      '<div class="toast-body">' +
      safeText(message) +
      "</div>" +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
      "</div>";
    container.appendChild(toastEl);
    if (window.bootstrap && bootstrap.Toast) {
      const t = new bootstrap.Toast(toastEl, { delay: 2500 });
      t.show();
    } else {
      alert(message);
    }
  } catch {
    alert(message);
  }
}
function showLoading() {
  __loadingCount++;
  let overlay = document.getElementById("global-loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "global-loading-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.4)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "20000";
    overlay.innerHTML =
      '<div class="spinner-border text-light" role="status"><span class="visually-hidden">Loading...</span></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = "flex";
}
function hideLoading() {
  __loadingCount = Math.max(0, __loadingCount - 1);
  if (__loadingCount === 0) {
    const overlay = document.getElementById("global-loading-overlay");
    if (overlay) overlay.style.display = "none";
  }
}

// ===== FRONT PAGE LISTINGS =====
let allHouses = [];
let lastHousesSnapshot = "";
let activeTypeFilter = "";
let adminFilterText = "";

function createHouseCard(house) {
  const images =
    house.images && house.images.length
      ? house.images
      : house.image
        ? [house.image]
        : ["noimage.png"];
  const hasMultipleImages = images.length > 1;
  const status = (house.status || "available").toLowerCase();

  let imageContent;
  if (hasMultipleImages) {
    const carouselId = `carousel-${house.id}`;
    const indicators = images
      .map(
        (_, index) =>
          `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" ${index === 0 ? 'class="active" aria-current="true"' : ""
          } aria-label="Slide ${index + 1}"></button>`
      )
      .join("");
    const slides = images
      .map(
        (img, index) =>
          `<div class="carousel-item ${index === 0 ? "active" : ""}">
        <img src="/uploads/${img}" class="d-block w-100 card-img-top" alt="House image ${index + 1
          }" style="height:200px;object-fit:cover;">
      </div>`
      )
      .join("");
    imageContent = `
      <div id="${carouselId}" class="carousel slide" data-bs-ride="carousel">
        <div class="carousel-indicators">
          ${indicators}
        </div>
        <div class="carousel-inner">
          ${slides}
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev" onclick="event.stopPropagation();">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Previous</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next" onclick="event.stopPropagation();">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>
        <div class="position-absolute top-0 end-0 m-2">
          <span class="badge bg-dark bg-opacity-75">${images.length} photos</span>
        </div>
      </div>`;
  } else {
    imageContent = `<img src="/uploads/${images[0]}" class="card-img-top" alt="House image" style="height:200px;object-fit:cover;">`;
  }

  // Determine current language from window.__i18n or localStorage or default 'en'
  const currentLang = (window.__i18n && window.__i18n.lang) || localStorage.getItem('lang') || 'en';

  // Parse localized fields
  let titleObj = {};
  let descObj = {};
  try { titleObj = JSON.parse(house.title_json || '{}'); } catch (e) { }
  try { descObj = JSON.parse(house.description_json || '{}'); } catch (e) { }

  // Fallback chain: current lang -> en -> raw field
  const title = titleObj[currentLang] || titleObj['en'] || house.title || '';
  const description = descObj[currentLang] || descObj['en'] || house.description || '';

  // Localized status and type
  const typeKey = `type.${(house.type || 'house').toLowerCase()}`;
  const typeLabel = t(typeKey, (house.type || 'House'));

  const statusRaw = (house.status || 'available').toLowerCase();
  let statusBadgeHtml = '';
  // "sold property with small and red background for available samll and green background for pending properties small and orange background"
  if (statusRaw === 'sold') {
    statusBadgeHtml = `<span class="badge bg-danger ms-1" style="font-size: 0.7rem;">Sold</span>`;
  } else if (statusRaw === 'pending') {
    statusBadgeHtml = `<span class="badge bg-warning text-dark ms-1" style="font-size: 0.7rem;">Pending</span>`;
  } else {
    // Available - green
    statusBadgeHtml = `<span class="badge bg-success ms-1" style="font-size: 0.7rem;">Available</span>`;
  }

  return `<div class="col-md-6 col-lg-4">
    <a class="card house-card h-100 position-relative text-decoration-none text-reset" data-id="${house.id}" href="property.html?id=${house.id}">
      <div class="position-absolute top-0 start-0 m-2 z-2">
         <span class="badge bg-primary fs-6 shadow-sm">${typeLabel}</span>
      </div>
      <button class="btn-fav" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite(${house.id})" title="Save to favorites">&#10084;</button>
      ${imageContent}
      <div class="card-body">
        <div class="mb-1 d-flex align-items-center">
             <h6 class="card-title mb-0 fw-bold text-uppercase text-primary" style="font-size: 0.9rem; letter-spacing: 0.05em;">${typeLabel}</h6>
             ${statusBadgeHtml}
        </div>
        <h5 class="fw-bold mb-2" style="font-size: 1.1rem;">${safeText(title)}</h5>
        <p class="card-text text-muted small">${safeText(description).substring(0, 60)}...</p>
        <div class="fw-bold text-primary mb-2">${formatPriceETB(house.price)}</div>
        ${house.square_meter ? `<div class="mb-1"><span class="badge bg-secondary">${house.square_meter} m²</span></div>` : ""}
        <div class="mb-2"><span class="badge bg-info">${safeText(house.location || "N/A")}</span></div>
      </div>
    </a>
  </div>`;
}

// Add language change listener
document.addEventListener('i18n:loaded', function () {
  // Re-render houses with new language
  if (allHouses.length > 0) {
    renderHouses(allHouses);
  }
});

function loadHouses(silent = false) {
  if (!silent) showLoading();
  fetch("/api/houses")
    .then((res) => res.json())
    .then((houses) => {
      const snapshot = JSON.stringify(houses);
      if (snapshot !== lastHousesSnapshot) {
        lastHousesSnapshot = snapshot;
        allHouses = houses;
        renderHouses(houses);
      }
      if (!silent) hideLoading();
    })
    .catch(() => {
      if (!silent) hideLoading();
    });
}

function renderHouses(houses) {
  const normalized = houses.map((h) => ({
    ...h,
    type: (h.type || "house").toLowerCase(),
  }));
  // Filter to only show available and sold properties on main site
  let filtered = normalized.filter((h) => {
    const s = (h.status || "available").toLowerCase();
    return s === "available" || s === "sold";
  });
  if (activeTypeFilter) {
    if (activeTypeFilter === "properties") {
      filtered = filtered.filter((h) =>
        ["car", "materials", "other", "property", "properties"].includes(h.type)
      );
    } else {
      filtered = filtered.filter((h) => h.type === activeTypeFilter);
    }
  }
  const availableHouses = normalized.filter((h) => (h.status || "available").toLowerCase() === "available");
  const counts = {
    all: availableHouses.length,
    house: availableHouses.filter((h) => h.type === "house").length,
    apartment: availableHouses.filter((h) => h.type === "apartment").length,
    land: availableHouses.filter((h) => h.type === "land").length,
    properties: availableHouses.filter((h) =>
      ["car", "materials", "other", "property", "properties"].includes(h.type)
    ).length,
  };
  const setCount = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setCount("count-all", counts.all);
  setCount("count-house", counts.house);
  setCount("count-apartment", counts.apartment);
  setCount("count-land", counts.land);
  setCount("count-properties", counts.properties);

  const list = document.getElementById("houses-list");
  if (list) {
    const lang =
      (window.__i18n && window.__i18n.lang) ||
      localStorage.getItem("lang") ||
      "en";
    const localize = (h) => {
      const tjson = h.title_json || {};
      const djson = h.description_json || {};
      return {
        ...h,
        title: tjson[lang] || tjson.en || h.title,
        description: djson[lang] || djson.en || h.description,
      };
    };
    const render = filtered.map(localize).map(createHouseCard).join("");
    list.innerHTML = filtered.length
      ? render
      : '<p class="text-muted">No listings.</p>';
  }
}

function applyFilters() {
  const searchEl = document.getElementById("searchInput");
  const minPriceEl = document.getElementById("minPrice");
  const maxPriceEl = document.getElementById("maxPrice");
  if (!searchEl || !minPriceEl || !maxPriceEl) return;
  const search = searchEl.value.toLowerCase();
  const minPrice = parseFloat(minPriceEl.value) || 0;
  const maxPrice = parseFloat(maxPriceEl.value) || Infinity;
  const filtered = allHouses.filter((house) => {
    const type = (house.type || "").toLowerCase();
    const matchesSearch =
      (house.title || "").toLowerCase().includes(search) ||
      (house.description || "").toLowerCase().includes(search) ||
      (house.location && house.location.toLowerCase().includes(search)) ||
      type.includes(search);
    const matchesPrice = house.price >= minPrice && house.price <= maxPrice;
    return matchesSearch && matchesPrice;
  });
  renderHouses(filtered);
}

// Favorites
function toggleFavorite(id) {
  let favs = JSON.parse(localStorage.getItem("houseFavs") || "[]");
  if (favs.includes(id)) {
    favs = favs.filter((f) => f !== id);
    showToast("Removed from favorites");
  } else {
    favs.push(id);
    showToast("Added to favorites!");
  }
  localStorage.setItem("houseFavs", JSON.stringify(favs));
}

// House details modal (index page)
window.showHouseDetails = async function (id) {
  let house;
  try {
    const res = await fetch("/api/houses?ts=" + Date.now());
    const latest = await res.json();
    allHouses = latest;
    house = allHouses.find((h) => h.id == id);
  } catch (e) {
    console.error("Failed to refresh house data:", e);
    house = allHouses.find((h) => h.id == id);
  }
  if (!house) return;

  const lang =
    (window.__i18n && window.__i18n.lang) ||
    localStorage.getItem("lang") ||
    "en";
  const localizeHouse = (h) => {
    const tjson = h.title_json || {};
    const djson = h.description_json || {};
    return {
      ...h,
      title: tjson[lang] || tjson.en || h.title,
      description: djson[lang] || djson.en || h.description,
    };
  };
  house = localizeHouse(house);
  window.currentModalHouseId = id;

  const modalBody = document.getElementById("modalBody");
  if (!modalBody) return;

  const images =
    house.images && house.images.length
      ? house.images
      : house.image
        ? [house.image]
        : ["noimage.png"];
  const hasMultipleImages = images.length > 1;
  let galleryContent;
  if (hasMultipleImages) {
    const carouselId = `modal-carousel-${house.id}`;
    const indicators = images
      .map(
        (_, index) =>
          `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" ${index === 0 ? 'class="active" aria-current="true"' : ""
          } aria-label="Slide ${index + 1}"></button>`
      )
      .join("");
    const slides = images
      .map(
        (img, index) =>
          `<div class="carousel-item ${index === 0 ? "active" : ""}">
        <img src="/uploads/${img}" class="d-block w-100 rounded" alt="House image ${index + 1
          }" style="height:300px;object-fit:cover;">
      </div>`
      )
      .join("");
    galleryContent = `
      <div id="${carouselId}" class="carousel slide" data-bs-ride="carousel">
        <div class="carousel-indicators">
          ${indicators}
        </div>
        <div class="carousel-inner">
          ${slides}
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Previous</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>
      </div>`;
  } else {
    galleryContent = `<img src="/uploads/${images[0]}" class="img-fluid rounded mb-3" alt="House image" style="width:100%;max-height:320px;object-fit:cover;">`;
  }

  modalBody.innerHTML = `
    <div class="row g-4">
      <div class="col-lg-7">
        ${galleryContent}
      </div>
      <div class="col-lg-5">
        <h3 class="mb-2">${safeText(house.title)}</h3>
        <div class="text-primary h4 mb-3">${formatPriceETB(house.price)}</div>
        <p class="mb-2 text-muted"><i class="fa-solid fa-location-dot me-2"></i>${safeText(
    house.location || house.city || "N/A"
  )}</p>
        <ul class="list-unstyled mb-3">
          <li><strong>Type:</strong> ${safeText(house.type || "House")}</li>
          <li><strong>Bedrooms:</strong> ${house.bedrooms != null ? house.bedrooms : "N/A"
    }</li>
          <li><strong>Status:</strong> ${safeText(
      house.status || "available"
    )}</li>
        </ul>
        <h6 class="text-uppercase text-muted">Description</h6>
        <p>${safeText(house.description)}</p>
      </div>
    </div>`;

  const modalEl = document.getElementById("houseModal");
  if (modalEl && window.bootstrap && bootstrap.Modal) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
};

// ===== ADMIN PANEL (simplified) =====
function createAdminHouseCard(house) {
  const images =
    house.images && house.images.length
      ? house.images
      : house.image
        ? [house.image]
        : ["noimage.png"];
  const img = images[0];
  return `<div class="col-md-6 col-lg-4">
    <div class="card h-100" data-house-id="${house.id}">
      <img src="/uploads/${img}" class="card-img-top" alt="House image" style="height:200px;object-fit:cover;">
      <div class="card-body">
        <h5 class="card-title">${safeText(house.title)}</h5>
        <p class="card-text">${safeText(house.description).substring(
    0,
    60
  )}...</p>
        <div class="fw-bold text-primary mb-2">${formatPriceETB(
    house.price
  )}</div>
        ${house.square_meter
      ? `<div class="mb-1"><span class="badge bg-secondary">${house.square_meter} m²</span></div>`
      : ""
    }
        <div><span class="badge bg-info">${safeText(
      house.location || "N/A"
    )}</span></div>
        <div class="d-flex gap-2 mt-2">
          <button class="btn btn-outline-primary btn-sm flex-fill edit-house-btn" data-id="${house.id}">Edit</button>
          <button class="btn btn-danger btn-sm flex-fill delete-house-btn" data-id="${house.id}">Delete</button>
        </div>
      </div>
    </div>
  </div>`;
}

function updateAdminStatistics(houses) {
  const total = houses.length;
  const available = houses.filter(
    (h) => (h.status || "available").toLowerCase() === "available"
  ).length;
  const pending = houses.filter(
    (h) => (h.status || "available").toLowerCase() === "pending"
  ).length;
  const rented = houses.filter(
    (h) => (h.status || "available").toLowerCase() === "sold"
  ).length;

  document.getElementById("total-listings").textContent = total;
  document.getElementById("available-listings").textContent = available;
  document.getElementById("pending-listings").textContent = pending;
  document.getElementById("rented-listings").textContent = rented;
}

function applyAdminFilters(houses) {
  const searchText = (
    document.getElementById("admin-search")?.value || ""
  ).toLowerCase();
  const typeFilter = document.getElementById("admin-type-filter")?.value || "";
  const statusFilter =
    document.getElementById("admin-status-filter")?.value || "";

  return houses.filter((house) => {
    const matchesSearch =
      !searchText ||
      (house.title || "").toLowerCase().includes(searchText) ||
      (house.description || "").toLowerCase().includes(searchText) ||
      (house.location || "").toLowerCase().includes(searchText) ||
      (house.city || "").toLowerCase().includes(searchText) ||
      (house.price || "").toString().includes(searchText);

    const matchesType = !typeFilter || (house.type || "") === typeFilter;
    const matchesStatus =
      !statusFilter ||
      (house.status || "available").toLowerCase() === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });
}

async function loadAdminHouses(silent = false) {
  if (!silent) showLoading();
  try {
    const res = await fetch("/api/houses?ts=" + Date.now());
    const houses = await res.json();
    const adminList = document.getElementById("admin-houses-list");
    allHouses = houses;

    // Update statistics
    updateAdminStatistics(houses);

    if (adminList) {
      const filtered = applyAdminFilters(houses);
      adminList.innerHTML = filtered.length
        ? filtered.map(createAdminHouseCard).join("")
        : '<p class="text-center">No properties found.</p>';
    }
  } catch (e) {
    console.error("Error loading admin houses:", e);
    showToast("Failed to load admin houses.");
  } finally {
    if (!silent) hideLoading();
  }
}

window.showEditModal = function (id) {
  console.log("showEditModal called with id:", id);
  const house = allHouses.find((h) => h.id == id);
  if (!house) {
    console.log("House not found");
    return;
  }
  const modalEl = document.getElementById("editHouseModal");
  if (!modalEl) {
    console.log("Modal not found");
    return;
  }
  const an = document.getElementById("edit-admin-name");
  const ae = document.getElementById("edit-admin-email");
  const ap = document.getElementById("edit-admin-phone");
  const admin = house.admin || {};
  if (an) an.value = admin.name || "";
  if (ae) ae.value = admin.email || "";
  if (ap) ap.value = admin.phone || "";
  const titleJson = (() => {
    try {
      return typeof house.title_json === 'string' ? JSON.parse(house.title_json) : (house.title_json || {});
    } catch (e) {
      console.error('Error parsing title_json', e);
      return {};
    }
  })();
  const descJson = (() => {
    try {
      return typeof house.description_json === 'string' ? JSON.parse(house.description_json) : (house.description_json || {});
    } catch (e) {
      console.error('Error parsing description_json', e);
      return {};
    }
  })();
  document.getElementById("edit-title").value = house.title || "";
  document.querySelector('input[name="title_en"]').value = titleJson.en || "";
  document.querySelector('input[name="title_am"]').value = titleJson.am || "";
  document.querySelector('input[name="title_ti"]').value = titleJson.ti || "";
  document.getElementById("edit-description").value = house.description || "";
  document.querySelector('textarea[name="description_en"]').value = descJson.en || "";
  document.querySelector('textarea[name="description_am"]').value = descJson.am || "";
  document.querySelector('textarea[name="description_ti"]').value = descJson.ti || "";
  document.getElementById("edit-price").value = house.price || 0;
  document.getElementById("edit-square-meter").value = house.square_meter || "";
  document.getElementById("edit-city").value = house.city || "Adigrat";
  document.getElementById("edit-type").value = house.type || "house";
  document.getElementById("edit-status").value = house.status || "available";
  document.getElementById("edit-location").value = house.location || "";
  const eb = document.getElementById("edit-bedrooms");
  if (eb) eb.value = house.bedrooms || "";
  const amenities = (() => {
    try {
      return typeof house.amenities_json === 'string' ? JSON.parse(house.amenities_json) : (house.amenities_json || {});
    } catch (e) {
      console.error('Error parsing amenities_json', e);
      return {};
    }
  })();
  document.getElementById("edit-amenity-water").checked = amenities.water || false;
  document.getElementById("edit-amenity-electricity").checked = amenities.electricity || false;
  document.getElementById("edit-amenity-internet").checked = amenities.internet || false;
  document.getElementById("edit-amenity-parking").checked = amenities.parking || false;
  document.getElementById("edit-amenity-lift").checked = amenities.lift || false;
  // Update image preview
  const imgEl = document.getElementById("edit-preview-img");
  if (imgEl && house.images && house.images.length) {
    imgEl.src = "/uploads/" + house.images[0];
  }
  modalEl.dataset.houseId = String(id);
  if (window.bootstrap && bootstrap.Modal) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  } else {
    // Fallback if Bootstrap not loaded
    modalEl.style.display = "block";
    modalEl.classList.add("show");
    document.body.classList.add("modal-open");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop fade show";
    document.body.appendChild(backdrop);
    // Add close listeners
    const closeButtons = modalEl.querySelectorAll('[data-bs-dismiss="modal"]');
    const hideModal = () => {
      modalEl.style.display = "none";
      modalEl.classList.remove("show");
      document.body.classList.remove("modal-open");
      if (backdrop) backdrop.remove();
    };
    closeButtons.forEach(btn => btn.addEventListener("click", hideModal));
    backdrop.addEventListener("click", hideModal);
  }
};

async function deleteHouse(id) {
  if (!confirm("Are you sure you want to delete this house?")) return;
  try {
    const res = await fetch(`/api/houses/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast("Failed to delete house.");
      return;
    }
    showToast("House deleted!");
    loadHouses(true);
    loadAdminHouses(true);
  } catch (e) {
    console.error("Error deleting house:", e);
    showToast("Error deleting house.");
  }
}

// Add event listeners for admin buttons
if (document.getElementById('admin-houses-list')) {
  document.getElementById('admin-houses-list').addEventListener('click', function (e) {
    if (e.target.classList.contains('edit-house-btn')) {
      const id = e.target.dataset.id;
      showEditModal(id);
    } else if (e.target.classList.contains('delete-house-btn')) {
      const id = e.target.dataset.id;
      deleteHouse(id);
    }
  });
}

// Broker requests list in admin panel
async function loadBrokerRequests() {
  const container = document.getElementById("admin-broker-requests");
  if (!container) return;
  container.innerHTML = '<div class="col-12 text-muted">Loading...</div>';
  try {
    const res = await fetch("/api/admin/broker-requests?ts=" + Date.now(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      container.innerHTML =
        '<div class="col-12 text-danger">Failed to load broker requests.</div>';
      return;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      container.innerHTML =
        '<div class="col-12 text-muted">No broker requests yet.</div>';
      return;
    }
    const cards = rows
      .map((r) => {
        const statusBadge =
          r.status === "approved"
            ? '<span class="badge bg-success">Approved</span>'
            : r.status === "rejected"
              ? '<span class="badge bg-danger">Rejected</span>'
              : '<span class="badge bg-warning text-dark">Pending</span>';
        const typeLabel = r.type || "house";
        const imgs = r.images || [];
        const imgHtml = imgs.length
          ? `<img src="/uploads/${imgs[0]}" class="img-fluid rounded mb-2" style="max-height:160px;object-fit:cover;" alt="Listing image">`
          : "";
        return `<div class="col-md-6">
        <div class="card h-100" style="cursor: pointer;" onclick="showBrokerRequestDetails(${r.id
          })">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <h6 class="mb-0">${safeText(r.title)}</h6>
              ${statusBadge}
            </div>
            <div class="small text-muted mb-1">${typeLabel} • ${safeText(
            r.location || ""
          )}</div>
            <div class="fw-bold text-primary mb-2">${formatPriceETB(
            r.price
          )}</div>
            ${r.square_meter
            ? `<div class="mb-1"><span class="badge bg-secondary">${r.square_meter} m²</span></div>`
            : ""
          }
            ${imgHtml}
            <p class="small mb-2">${safeText(
            (r.description || "").substring(0, 140)
          )}...</p>
            <div class="small mb-2">
              <strong>Broker:</strong> ${safeText(r.broker_name || "")}<br>
              <strong>Email:</strong> ${safeText(r.broker_email || "")}<br>
              <strong>Phone:</strong> ${safeText(r.broker_phone || "")}
            </div>
            <div class="small text-muted mb-2">${r.admin_note ? "Admin: " + safeText(r.admin_note) : ""
          }</div>
          </div>
        </div>
      </div>`;
      })
      .join("");
    container.innerHTML = cards;
  } catch (e) {
    console.error("Error loading broker requests:", e);
    container.innerHTML =
      '<div class="col-12 text-danger">Failed to load broker requests.</div>';
  }
}

async function showBrokerRequestDetails(id) {
  try {
    const res = await fetch("/api/admin/broker-requests?ts=" + Date.now());
    const rows = await res.json();
    const request = rows.find((r) => r.id == id);
    if (!request) return;

    const statusBadge =
      request.status === "approved"
        ? '<span class="badge bg-success">Approved</span>'
        : request.status === "rejected"
          ? '<span class="badge bg-danger">Rejected</span>'
          : '<span class="badge bg-warning text-dark">Pending</span>';

    const imgs = request.images || [];
    const carouselHtml = imgs.length
      ? `
      <div id="request-carousel" class="carousel slide mb-3" data-bs-ride="carousel">
        <div class="carousel-indicators">
          ${imgs
        .map(
          (_, i) =>
            `<button type="button" data-bs-target="#request-carousel" data-bs-slide-to="${i}" ${i === 0 ? 'class="active"' : ""
            }></button>`
        )
        .join("")}
        </div>
        <div class="carousel-inner">
          ${imgs
        .map(
          (img, i) => `
            <div class="carousel-item ${i === 0 ? "active" : ""}">
              <img src="/uploads/${img}" class="d-block w-100" style="max-height:400px;object-fit:cover;" alt="Request image ${i + 1
            }">
            </div>
          `
        )
        .join("")}
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#request-carousel" data-bs-slide="prev">
          <span class="carousel-control-prev-icon"></span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#request-carousel" data-bs-slide="next">
          <span class="carousel-control-next-icon"></span>
        </button>
      </div>
    `
      : '<p class="text-muted">No images uploaded.</p>';

    const detailsHtml = `
      <div class="row">
        <div class="col-md-8">
          <h5>${safeText(request.title)}</h5>
          <p><strong>Type:</strong> ${safeText(request.type || "house")}</p>
          <p><strong>Price:</strong> ${formatPriceETB(request.price)}</p>
          <p><strong>Location:</strong> ${safeText(request.location || "")}</p>
          <p><strong>City:</strong> ${safeText(request.city || "")}</p>
          <p><strong>Description:</strong> ${safeText(
      request.description || ""
    )}</p>
          ${request.square_meter
        ? `<p><strong>Square Meter:</strong> ${request.square_meter}</p>`
        : ""
      }
          ${request.bedrooms
        ? `<p><strong>Bedrooms:</strong> ${request.bedrooms}</p>`
        : ""
      }
          <p><strong>Status:</strong> ${statusBadge}</p>
          ${request.admin_note
        ? `<p><strong>Admin Note:</strong> ${safeText(
          request.admin_note
        )}</p>`
        : ""
      }
        </div>
        <div class="col-md-4">
          <h6>Broker Info</h6>
          <p><strong>Name:</strong> ${safeText(request.contact_name || "")}</p>
          <p><strong>Email:</strong> ${safeText(
        request.contact_email || ""
      )}</p>
          <p><strong>Phone:</strong> ${safeText(
        request.contact_phone || ""
      )}</p>
        </div>
      </div>
      ${carouselHtml}
    `;

    document.getElementById("broker-request-details").innerHTML = detailsHtml;
    document.getElementById("modal-approve-btn").onclick = () =>
      adminApproveBrokerRequest(id);
    document.getElementById("modal-reject-btn").onclick = () =>
      adminRejectBrokerRequest(id);

    // Hide approve button if already approved
    const approveBtn = document.getElementById("modal-approve-btn");
    if (approveBtn) {
      if (request.status === 'approved') {
        approveBtn.style.display = 'none';
      } else {
        approveBtn.style.display = 'inline-block';
      }
    }

    const modal = new bootstrap.Modal(
      document.getElementById("brokerRequestModal")
    );
    modal.show();
  } catch (e) {
    console.error("Error loading request details:", e);
  }
}

async function adminDecisionBrokerRequest(id, action) {
  const note =
    action === "reject"
      ? prompt("Optional note to broker (reason):") || ""
      : "";
  try {
    const res = await fetch(`/api/admin/broker-requests/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to update request.");
      return;
    }
    if (action === "approve") {
      showToast("Broker request approved and published.");
      loadHouses(true);
      loadAdminHouses(true);
    } else {
      showToast("Broker request rejected.");
    }

    // Auto-close modal
    const modalEl = document.getElementById("brokerRequestModal");
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    loadBrokerRequests();
  } catch (e) {
    console.error("Decision error:", e);
    alert("Failed to update request.");
  }
}

window.adminApproveBrokerRequest = function (id) {
  adminDecisionBrokerRequest(id, "approve");
};
window.adminRejectBrokerRequest = function (id) {
  adminDecisionBrokerRequest(id, "reject");
};

// Admin section toggling
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".admin-section").forEach((section) => {
    section.style.display = "none";
  });
  // Show requested section
  const selectedSection = document.getElementById(`${sectionId}-section`);
  if (selectedSection) selectedSection.style.display = "block";

  // Update header title
  const headerTitle = document.querySelector(".admin-header h2");
  if (headerTitle) {
    if (sectionId === "brokers") headerTitle.textContent = "Broker Requests";
    else headerTitle.textContent = "Current Listings";
  }

  // Update active state on sidebar
  document
    .querySelectorAll(".admin-sidebar .nav-link")
    .forEach((link) => link.classList.remove("active"));
  const activeLink = document.getElementById(`sidebar-${sectionId}-link`);
  if (activeLink) activeLink.classList.add("active");
}

// Initial bindings

document.addEventListener("DOMContentLoaded", function () {
  // Listings page
  if (document.getElementById("houses-list")) {
    loadHouses();
    // Poll for updates every 10 seconds
    setInterval(() => loadHouses(true), 10000);
    const applyFiltersBtn = document.getElementById("applyFilters");
    if (applyFiltersBtn) applyFiltersBtn.onclick = applyFilters;
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("keyup", function (e) {
        if (e.key === "Enter") applyFilters();
      });
    }
    const typeFilterGroup = document.getElementById("typeFilterGroup");
    if (typeFilterGroup) {
      typeFilterGroup.addEventListener("click", function (e) {
        const btn = e.target.closest("button[data-type]");
        if (!btn) return;
        activeTypeFilter = btn.getAttribute("data-type") || "";
        [...typeFilterGroup.querySelectorAll("button")].forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");
        renderHouses(allHouses);
      });
    }
  }

  // Admin houses
  if (document.getElementById("admin-houses-list")) {
    loadAdminHouses();
    // Poll for updates every 10 seconds
    setInterval(() => loadAdminHouses(true), 10000);

    // Admin search and filters
    const adminSearch = document.getElementById("admin-search");
    const adminTypeFilter = document.getElementById("admin-type-filter");
    const adminStatusFilter = document.getElementById("admin-status-filter");

    function updateAdminList() {
      const filtered = applyAdminFilters(allHouses);
      const adminList = document.getElementById("admin-houses-list");
      if (adminList) {
        adminList.innerHTML = filtered.length
          ? filtered.map(createAdminHouseCard).join("")
          : '<p class="text-center">No properties found.</p>';
      }
    }

    if (adminSearch) {
      adminSearch.addEventListener("input", updateAdminList);
    }
    if (adminTypeFilter) {
      adminTypeFilter.addEventListener("change", updateAdminList);
    }
    if (adminStatusFilter) {
      adminStatusFilter.addEventListener("change", updateAdminList);
    }
  }

  // Admin broker requests (initial load, in case tab is opened first)
  if (document.getElementById("admin-broker-requests")) {
    loadBrokerRequests();
    // Poll for updates every 10 seconds
    setInterval(() => loadBrokerRequests(), 10000);
  }

  // Admin sidebar links
  const houseLink = document.getElementById("sidebar-houses-link");
  if (houseLink) {
    houseLink.onclick = function (e) {
      e.preventDefault();
      showSection("houses");
    };
  }
  const brokersLink = document.getElementById("sidebar-brokers-link");
  if (brokersLink) {
    brokersLink.onclick = function (e) {
      e.preventDefault();
      showSection("brokers");
      loadBrokerRequests();
    };
  }

  // Admin add-house form submit
  const addHouseForm = document.getElementById("add-house-form");
  if (addHouseForm) {
    addHouseForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(addHouseForm);
      try {
        showLoading();
        const response = await fetch("/api/houses", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          showToast("Error: " + (data.error || "Failed to add house"));
          return;
        }
        showToast("House added successfully!");
        addHouseForm.reset();
        loadHouses(true);
        loadAdminHouses(true);
      } catch (err) {
        console.error("Error adding house:", err);
        showToast("Failed to add house. Please try again.");
      } finally {
        hideLoading();
      }
    });
  }

  // Edit house form submit
  const editForm = document.getElementById("edit-house-form");
  if (editForm) {
    editForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const modalEl = document.getElementById("editHouseModal");
      const id = modalEl && modalEl.dataset.houseId;
      if (!id) return;
      const formData = new FormData(editForm);
      try {
        showLoading();
        const response = await fetch(`/api/houses/${id}`, {
          method: "PUT",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          showToast("Error: " + (data.error || "Failed to update house"));
          if (window.bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
          } else {
            modalEl.style.display = "none";
            modalEl.classList.remove("show");
            document.body.classList.remove("modal-open");
            const backdrop = document.querySelector(".modal-backdrop");
            if (backdrop) backdrop.remove();
          }
          return;
        }
        showToast("House updated successfully!");
        if (window.bootstrap && bootstrap.Modal) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        } else {
          modalEl.style.display = "none";
          modalEl.classList.remove("show");
          document.body.classList.remove("modal-open");
          const backdrop = document.querySelector(".modal-backdrop");
          if (backdrop) backdrop.remove();
        }
        loadHouses(true);
        loadAdminHouses(true);
      } catch (err) {
        console.error("Error updating house:", err);
        showToast("Failed to update house. Please try again.");
      } finally {
        hideLoading();
      }
    });
  }
});
