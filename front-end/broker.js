// Broker dashboard logic with fixed password (290593)
(function () {
  const authForm = document.getElementById("broker-auth-form");
  const listingForm = document.getElementById("broker-listing-form");
  const statusEl = document.getElementById("broker-status");
  const approvalBadge = document.getElementById("broker-approval-badge");
  const approvalHelp = document.getElementById("broker-approval-help");
  const requestsList = document.getElementById("broker-requests-list");
  const listingCard = document.getElementById("broker-listing-card");
  const requestsCard = document.getElementById("broker-requests-card");
  const typeSelect = document.getElementById("broker-type-select");
  const apartmentOptions = document.getElementById("broker-apartment-options");
  const bedroomsGroup = document.getElementById("broker-bedrooms-group");

  let brokerToken = ""; // Do not persist token across page loads

  // Show/hide apartment options based on type
  if (typeSelect) {
    typeSelect.addEventListener("change", function () {
      const isApartment = this.value === "apartment";
      const isLand = this.value === "land";

      if (apartmentOptions) {
        apartmentOptions.style.display = isApartment ? "block" : "none";
      }
      if (bedroomsGroup) {
        bedroomsGroup.style.display = isLand ? "none" : "block";
      }
    });
  }

  function setStatus(text, good) {
    if (!statusEl) return;
    statusEl.textContent = "Status: " + text;
    statusEl.classList.toggle("text-success", !!good);
    statusEl.classList.toggle("text-danger", !good);
  }

  function setApprovalState(state) {
    const loginSection = document.getElementById("broker-login-section");
    const contentSection = document.getElementById("broker-content-section");

    if (!approvalBadge || !approvalHelp) return;
    if (state === "approved") {
      approvalBadge.textContent = "Approved";
      approvalBadge.className = "badge bg-success";
      approvalHelp.classList.remove("alert-info", "alert-warning");
      approvalHelp.classList.add("alert-success");
      approvalHelp.textContent =
        "You are logged in as broker. You can submit listings.";

      // Hide login, show content
      if (loginSection) loginSection.style.display = "none";
      if (contentSection) {
        contentSection.classList.remove("col-lg-9");
        contentSection.classList.add("col-lg-12");
      }
      if (listingCard) listingCard.style.display = "";
      if (requestsCard) requestsCard.style.display = "";

      listingForm &&
        listingForm
          .querySelectorAll("input,textarea,select,button")
          .forEach((el) => (el.disabled = false));
    } else {
      approvalBadge.textContent = "Not verified";
      approvalBadge.className = "badge bg-secondary";
      approvalHelp.classList.remove("alert-success");
      approvalHelp.classList.add("alert-info");
      approvalHelp.textContent = "Enter username and password to login.";

      // Show login, hide content forms but keep section structure
      if (loginSection) loginSection.style.display = "block";
      if (contentSection) {
        contentSection.classList.remove("col-lg-12");
        contentSection.classList.add("col-lg-9");
      }
      if (listingCard) listingCard.style.display = "none";
      if (requestsCard) requestsCard.style.display = "none";

      listingForm &&
        listingForm
          .querySelectorAll("input,textarea,select,button")
          .forEach((el) => {
            if (el.type !== "button") el.disabled = true;
          });
    }
  }

  async function loadRequests() {
    if (!requestsList || !brokerToken) return;
    try {
      const res = await fetch("/api/broker-requests/mine", {
        headers: { "x-broker-token": brokerToken },
      });
      if (!res.ok) throw new Error("not ok");
      const rows = await res.json();
      // Update count
      const countEl = document.getElementById("broker-listings-count");
      if (countEl) {
        countEl.textContent =
          rows.length + " listing" + (rows.length !== 1 ? "s" : "");
      }
      if (!rows.length) {
        requestsList.innerHTML =
          '<div class="col-12 text-muted">No requests yet.</div>';
        return;
      }
      const html = rows
        .map((r) => {
          let statusBadge;
          if (r.status === "approved") {
            statusBadge = '<span class="badge bg-success">Approved</span>';
          } else if (r.status === "rejected") {
            statusBadge = '<span class="badge bg-danger">Rejected</span>';
          } else {
            statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
          }

          let actionsHtml = '';
          if (r.status === 'approved' && r.created_house_id) {
            actionsHtml = `
                <div class="mt-2 text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="window.editBrokerHouse(${r.created_house_id}, ${JSON.stringify(r).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.deleteBrokerHouse(${r.created_house_id})">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>`;
          }

          return `<div class="col-md-6">
          <div class="border rounded p-2 h-100">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong>${r.title}</strong>
              ${statusBadge}
            </div>
            <div class="small text-muted mb-1">${r.type || "N/A"} • ${r.city || ""
            } ${r.location || "N/A"}</div>
            <div class="small text-primary fw-semibold mb-1">${(
              Number(r.price) || 0
            ).toLocaleString("en-US")} Birr</div>
            <div class="small text-muted">${r.admin_note ? "Admin: " + r.admin_note : ""
            }</div>
            ${actionsHtml}
          </div>
        </div>`;
        })
        .join("");
      requestsList.innerHTML = html;
    } catch {
      requestsList.innerHTML =
        '<div class="col-12 text-danger">Failed to load your requests.</div>';
    }
  }

  // Edit / Delete Logic
  window.editBrokerHouse = function (houseId, requestData) {
    if (!houseId) return;
    // Populate modal
    const form = document.getElementById('broker-edit-form');
    if (!form) return;

    form.elements['house_id'].value = houseId;
    form.elements['title'].value = requestData.title || '';
    form.elements['type'].value = (requestData.type || 'house').toLowerCase();
    form.elements['description'].value = requestData.description || '';
    form.elements['price'].value = requestData.price || '';
    form.elements['square_meter'].value = requestData.square_meter || '';
    form.elements['bedrooms'].value = requestData.bedrooms || '';
    form.elements['city'].value = requestData.city || '';
    form.elements['floor'].value = requestData.floor || '';

    // Localized fields
    form.elements['title_am'].value = requestData.title_am || '';
    form.elements['title_ti'].value = requestData.title_ti || '';
    form.elements['description_am'].value = requestData.description_am || '';
    form.elements['description_ti'].value = requestData.description_ti || '';

    // Amenities parsing
    let amenities = {};
    try { amenities = JSON.parse(requestData.amenities_json || '{}'); } catch (e) { }

    form.elements['amenity_water'].checked = !!amenities.water;
    form.elements['amenity_electricity'].checked = !!amenities.electricity;
    form.elements['amenity_internet'].checked = !!amenities.internet;
    form.elements['amenity_parking'].checked = !!amenities.parking;
    form.elements['amenity_lift'].checked = !!amenities.lift;

    // Type change trigger
    const typeSelect = document.getElementById('broker-edit-type-select');
    const aptOptions = document.getElementById('broker-edit-apartment-options');
    const bedGroup = document.getElementById('broker-edit-bedrooms-group');

    const updateVisibility = () => {
      const val = typeSelect.value;
      if (aptOptions) aptOptions.style.display = val === 'apartment' ? 'block' : 'none';
      if (bedGroup) bedGroup.style.display = val === 'land' ? 'none' : 'block';
    };

    if (typeSelect) {
      typeSelect.onchange = updateVisibility;
      updateVisibility();
    }

    new bootstrap.Modal(document.getElementById('brokerEditModal')).show();
  };

  window.deleteBrokerHouse = async function (houseId) {
    if (!confirm('Are you sure you want to delete this property? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/broker/houses/${houseId}`, {
        method: 'DELETE',
        headers: { 'x-broker-token': brokerToken }
      });
      if (!res.ok) throw new Error('Failed');
      alert('Property deleted.');
      loadRequests();
    } catch (e) {
      alert('Failed to delete property.');
      console.error(e);
    }
  };

  const editForm = document.getElementById('broker-edit-form');
  if (editForm) {
    editForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const formData = new FormData(editForm);
      const houseId = formData.get('house_id');
      // Convert FormData to JSON since we don't handle file uploads here (yet?) and it's PUT
      const data = Object.fromEntries(formData.entries());

      // Boolean amenities
      const amenities = {
        water: formData.get('amenity_water') === 'on',
        electricity: formData.get('amenity_electricity') === 'on',
        internet: formData.get('amenity_internet') === 'on',
        parking: formData.get('amenity_parking') === 'on',
        lift: formData.get('amenity_lift') === 'on'
      };
      data.amenities_json = JSON.stringify(amenities);

      try {
        const res = await fetch(`/api/broker/houses/${houseId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-broker-token': brokerToken
          },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed');
        alert('Property updated successfully.');
        bootstrap.Modal.getInstance(document.getElementById('brokerEditModal')).hide();
        loadRequests();
      } catch (e) {
        console.error(e);
        alert('Failed to update property.');
      }
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(authForm);
      const username = (formData.get("username") || "").toString().trim();
      const password = (formData.get("password") || "").toString().trim();
      if (!username || password !== "290593") {
        setStatus("Invalid username or password.", false);
        return;
      }
      try {
        const res = await fetch("/api/brokers/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        brokerToken = data.token;
        setStatus("Logged in as " + (data.name || username), true);
        setApprovalState("approved");
        loadRequests();
      } catch (err) {
        console.error("Broker verify error:", err);
        setStatus("Login failed. Please try again.", false);
      }
    });
  }

  if (listingForm) {
    listingForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!brokerToken) {
        alert("Login as broker first.");
        return;
      }
      const formData = new FormData(listingForm);

      // Disable submit button during submission
      const submitBtn = listingForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin me-2"></i>Sending...';
      }

      try {
        const res = await fetch("/api/broker-requests", {
          method: "POST",
          headers: { "x-broker-token": brokerToken },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        alert(
          "Request sent to admin successfully! Your listing will appear on the site once approved."
        );
        listingForm.reset();
        // Reset apartment options visibility
        if (apartmentOptions) apartmentOptions.style.display = "none";
        loadRequests();
      } catch (e) {
        console.error("Broker request error:", e);
        alert("Failed to send request: " + e.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML =
            '<i class="fa-solid fa-paper-plane me-2"></i>Send to Admin for Approval';
        }
      }
    });
  }

  // Initial state
  setApprovalState(brokerToken ? "approved" : "none");
  if (brokerToken) loadRequests();

  // Auto-refresh
  setInterval(() => {
    if (brokerToken) loadRequests();
  }, 3000);
})();
