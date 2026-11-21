const resources = {
  households: {
    label: "Households",
    singular: "Household",
    icon: "⌂",
    description: "Manage household registrations and service plans.",
    endpoint: "/api/households",
    columns: ["_id", "HouseholdName", "division", "parish", "phone", "plan"],
    fields: [
      { name: "HouseholdName", label: "Household name", required: true },
      { name: "phone", label: "Phone number", required: true },
      { name: "division", label: "Division", required: true },
      { name: "parish", label: "Parish", required: true },
      { name: "address", label: "Address", required: true, full: true },
      { name: "plan", label: "Collection plan", required: true },
      { name: "registered_on", label: "Registration date", type: "date" }
    ]
  },
  collectors: {
    label: "Collectors",
    singular: "Collector",
    icon: "♧",
    description: "Keep collector contact details and assigned divisions up to date.",
    endpoint: "/api/collectors",
    columns: ["_id", "name", "phone", "vehicle", "division_assigned", "active"],
    fields: [
      { name: "name", label: "Full name", required: true },
      { name: "phone", label: "Phone number", required: true },
      { name: "vehicle", label: "Vehicle", required: true },
      { name: "division_assigned", label: "Assigned division", required: true },
      { name: "active", label: "Currently active", type: "checkbox" }
    ]
  },
  dumpsites: {
    label: "Dumpsites",
    singular: "Dumpsite",
    icon: "♧",
    description: "Maintain approved disposal locations and accepted waste types.",
    endpoint: "/api/dumpsites",
    columns: ["_id", "name", "type", "division", "capacity_tonnes", "accepts"],
    fields: [
      { name: "name", label: "Dumpsite name", required: true },
      { name: "type", label: "Site type", required: true },
      { name: "division", label: "Division", required: true },
      { name: "capacity_tonnes", label: "Capacity (tonnes)", required: true },
      { name: "accepts", label: "Accepted waste types", required: true, type: "textarea", full: true }
    ]
  },
  pickups: {
    label: "Pickups",
    singular: "Pickup",
    icon: "♻",
    description: "Track household collections, waste weights, and service fees.",
    endpoint: "/api/pickups",
    columns: ["request_id", "household_id", "collector_id", "dumpsite_id", "pickup_date", "waste_type", "weight_kg", "status", "fee_ugx"],
    fields: [
      { name: "household_id", label: "Household ID", required: true },
      { name: "collector_id", label: "Collector ID", required: true },
      { name: "dumpsite_id", label: "Dumpsite ID", required: true },
      { name: "pickup_date", label: "Pickup date", required: true, type: "date" },
      { name: "waste_type", label: "Waste type", required: true },
      { name: "weight_kg", label: "Weight (kg)", required: true, type: "number", min: 0, step: "any" },
      { name: "status", label: "Status", required: true },
      { name: "fee_ugx", label: "Fee (UGX)", required: true, type: "number", min: 0, step: "any" }
    ]
  },
  complaints: {
    label: "Complaints",
    singular: "Complaint",
    icon: "✉",
    description: "Review and update community service complaints.",
    endpoint: "/api/complaints",
    columns: ["_id", "household_id", "collector_id", "issue", "complaint_date", "status"],
    fields: [
      { name: "household_id", label: "Household ID", required: true },
      { name: "collector_id", label: "Collector ID" },
      { name: "issue", label: "Issue", required: true, type: "textarea", full: true },
      { name: "complaint_date", label: "Complaint date", required: true, type: "date" },
      { name: "status", label: "Status", required: true }
    ]
  }
};

const navigation = document.getElementById("navigation");
const overviewPage = document.getElementById("overview-page");
const collectionPage = document.getElementById("collection-page");
const portalPage = document.getElementById("portal-page");
const portalContent = document.getElementById("portal-content");
const notice = document.getElementById("notice");
const recordDialog = document.getElementById("record-dialog");
const recordForm = document.getElementById("record-form");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const sidebar = document.getElementById("sidebar");
const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
const mobileNavBackdrop = document.getElementById("mobile-nav-backdrop");
let activeResource = null;
let activeNavigation = "overview";
let currentUser = null;
let records = [];
let editingId = null;
let referenceData = { serviceAreas: {}, wastePricesUgx: {} };
let referenceDataPromise = null;

const displayName = (field, resource = resources[activeResource]) => {
  const configured = resource?.fields.find((item) => item.name === field);
  if (configured) return configured.label;
  return field === "_id" ? "Record ID" : field.replaceAll("_", " ");
};

const setNotice = (message, type = "error") => {
  notice.textContent = message;
  notice.classList.toggle("success", type === "success");
  notice.hidden = !message;
};

const setApiStatus = (connected) => {
  const status = document.getElementById("api-status");
  status.classList.toggle("is-offline", !connected);
  document.getElementById("api-status-text").textContent =
    connected ? "API connected" : "API disconnected";
};

const request = async (url, options) => {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers
      }
    });
  } catch {
    setApiStatus(false);
    throw new Error("Cannot reach the CleanCity API. Check that the backend server is running.");
  }

  setApiStatus(true);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The API returned an invalid response (${response.status}).`);
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Request failed (${response.status}).`);
  }
  return payload;
};

const roleNavigation = {
  administrator: [
    { key: "dashboard", label: "Dashboard", icon: "◫" },
    { key: "list-users", label: "List users", icon: "♧" },
    { key: "search-users", label: "Search users", icon: "⌕" },
    { key: "register-collector", label: "Register a collector", icon: "＋" },
    { key: "delete-user", label: "Delete a user", icon: "−" },
    { key: "reset-user-password", label: "Reset a password", icon: "↻" },
    { key: "all-requests", label: "View all requests", icon: "▤" },
    { key: "assign-request", label: "Assign a request", icon: "↗" },
    { key: "reschedule-request", label: "Reschedule a request", icon: "◷" },
    { key: "update-request", label: "Update or cancel a request", icon: "✎" },
    { key: "all-payments", label: "View all payments", icon: "$" },
    { key: "record-payment", label: "Record a payment", icon: "＋" },
    { key: "all-complaints", label: "View all complaints", icon: "✉" },
    { key: "resolve-complaint", label: "Resolve a complaint", icon: "✓" },
    { key: "summary-report", label: "Summary report", icon: "▥" },
    { key: "save-data", label: "Save data now", icon: "↓" },
    { key: "change-password", label: "Change password", icon: "⌑" }
  ],
  household: [
    { key: "request-pickup", label: "Request waste collection", icon: "♻" },
    { key: "my-requests", label: "View my requests", icon: "▤" },
    { key: "cancel-request", label: "Cancel a request", icon: "−" },
    { key: "pay-request", label: "Pay for a request", icon: "$" },
    { key: "my-payments", label: "View my payments", icon: "▧" },
    { key: "file-complaint", label: "File a complaint", icon: "✉" },
    { key: "my-complaints", label: "View my complaints", icon: "☷" },
    { key: "update-address", label: "Update my address", icon: "⌖" },
    { key: "change-password", label: "Change password", icon: "⌑" }
  ],
  collector: [
    { key: "assigned-requests", label: "Assigned requests & locations", icon: "▤" },
    { key: "mark-collected", label: "Mark a request collected", icon: "✓" },
    { key: "availability", label: "Toggle my availability", icon: "◉" },
    { key: "collector-profile", label: "View my profile", icon: "♧" },
    { key: "change-password", label: "Change password", icon: "⌑" }
  ]
};

const renderRoleNavigation = () => {
  navigation.replaceChildren();
  const items = currentUser.mustChangePassword
    ? [{ key: "change-password", label: "Change temporary password", icon: "⌑" }]
    : roleNavigation[currentUser.role] || [];
  items.forEach((item, index) => {
    if (currentUser.role === "administrator" && [0, 6, 10, 14].includes(index)) {
      const sectionNames = { 0: "WORKSPACE", 6: "SERVICE OPERATIONS", 10: "FINANCE", 14: "INSIGHTS" };
      const heading = document.createElement("div");
      heading.className = "nav-label";
      heading.textContent = sectionNames[index];
      navigation.append(heading);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-item";
    button.dataset.action = item.key;
    button.dataset.navId = item.key;
    const icon = document.createElement("span");
    icon.className = "nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon;
    button.append(icon, document.createTextNode(item.label));
    navigation.append(button);
  });
};

const setAuthMode = (mode) => {
  const isRegister = mode === "register";
  document.getElementById("login-form").hidden = isRegister;
  document.getElementById("register-form").hidden = !isRegister;
  document.getElementById("login-tab").classList.toggle("active", !isRegister);
  document.getElementById("register-tab").classList.toggle("active", isRegister);
  document.getElementById("login-tab").setAttribute("aria-selected", String(!isRegister));
  document.getElementById("register-tab").setAttribute("aria-selected", String(isRegister));
  document.getElementById("auth-title").textContent = isRegister ? "Join CleanCity" : "Welcome back";
  document.getElementById("auth-subtitle").textContent = isRegister
    ? "Register a household to request reliable waste collection."
    : "Sign in to manage your CleanCity services.";
  document.getElementById("auth-error").hidden = true;
};

const setRegistrationMode = () => {
  const existing = document.getElementById("registration-mode").value === "existing";
  const idField = document.getElementById("existing-id-field");
  const nameField = document.getElementById("household-name-field");
  const newFields = document.getElementById("new-household-fields");
  idField.hidden = !existing;
  idField.querySelector("input").required = existing;
  nameField.hidden = existing;
  nameField.querySelector("input").required = !existing;
  newFields.hidden = existing;
  newFields.querySelectorAll('input:not([type="hidden"]), select').forEach((input) => {
    input.required = !existing;
  });
  document.getElementById("registration-help").textContent = existing
    ? "Enter the household ID and the phone number already registered with CleanCity."
    : "Use at least 10 characters. Your new household ID will be shown after registration.";
  document.querySelector("#register-form .auth-submit").textContent =
    existing ? "Activate household login" : "Register household";
};

const loadReferenceData = () => {
  if (!referenceDataPromise) {
    referenceDataPromise = request("/api/reference").then((result) => {
      referenceData = result.data;
      populateRegistrationDivisions();
      return referenceData;
    });
  }
  return referenceDataPromise;
};

const populateParishOptions = (parishSelect, division, selectedParish = "") => {
  parishSelect.replaceChildren(new Option("Select a parish", ""));
  (referenceData.serviceAreas[division] || []).forEach((parish) => {
    parishSelect.add(new Option(parish, parish));
  });
  parishSelect.disabled = !division || !(referenceData.serviceAreas[division] || []).length;
  parishSelect.value = selectedParish;
};

const fillParishes = (division, selectedParish = "") => {
  populateParishOptions(
    document.getElementById("registration-parish"),
    division,
    selectedParish
  );
};

const populateRegistrationDivisions = () => {
  const divisionSelect = document.getElementById("registration-division");
  divisionSelect.replaceChildren(new Option("Select a division", ""));
  Object.keys(referenceData.serviceAreas).sort().forEach((division) => {
    divisionSelect.add(new Option(division, division));
  });
  fillParishes(divisionSelect.value);
};

const requestCurrentLocation = (form, button, status) => {
  if (!navigator.geolocation) {
    status.textContent = "This browser does not support GPS location.";
    return;
  }
  button.disabled = true;
  status.textContent = "Waiting for location permission…";
  navigator.geolocation.getCurrentPosition((position) => {
    form.elements.latitude.value = String(position.coords.latitude);
    form.elements.longitude.value = String(position.coords.longitude);
    status.textContent = `Location saved (${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}).`;
    button.disabled = false;
  }, (error) => {
    const messages = {
      1: "Location permission was denied. You can continue without GPS.",
      2: "Your location is unavailable. Try again or continue without GPS.",
      3: "Location request timed out. Try again or continue without GPS."
    };
    status.textContent = messages[error.code] || "Unable to get your location.";
    button.disabled = false;
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
};

const attachGpsCapture = (form, initialLocation = {}) => {
  const wrapper = makeElement("div", "auth-location");
  wrapper.classList.add("full-width");
  const button = makeElement("button", "button button-secondary", "Use my current location");
  button.type = "button";
  const status = makeElement("span", "auth-help", "GPS is optional. Your browser will ask permission.");
  const latitude = document.createElement("input");
  latitude.type = "hidden";
  latitude.name = "latitude";
  latitude.value = initialLocation.latitude ?? "";
  const longitude = document.createElement("input");
  longitude.type = "hidden";
  longitude.name = "longitude";
  longitude.value = initialLocation.longitude ?? "";
  if (latitude.value && longitude.value) {
    status.textContent = `Saved location (${Number(latitude.value).toFixed(5)}, ${Number(longitude.value).toFixed(5)}).`;
  }
  button.addEventListener("click", () => requestCurrentLocation(form, button, status));
  wrapper.append(button, status, latitude, longitude);
  form.insertBefore(wrapper, form.querySelector(".portal-form-actions"));
  return { button, status, latitude, longitude };
};

const showAuthentication = (message = "") => {
  currentUser = null;
  authScreen.hidden = false;
  appShell.hidden = true;
  setAuthMode("login");
  const error = document.getElementById("auth-error");
  if (message) {
    error.textContent = message;
    error.hidden = false;
  }
};

const enterPortal = (account, message = "") => {
  currentUser = account;
  authScreen.hidden = true;
  appShell.hidden = false;
  document.getElementById("account-name").textContent = account.name;
  document.getElementById("account-avatar").textContent =
    account.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  document.getElementById("account-avatar").title =
    `${account.name} — ${account.role}`;
  renderRoleNavigation();
  setNotice("");

  if (account.mustChangePassword) {
    openPortalAction("change-password");
  } else if (account.role === "administrator") {
    showOverview("dashboard");
  } else {
    openPortalAction(`${account.role}-home`);
  }
  if (message) setNotice(message, "success");
};

const authenticate = async (identifier, password) => {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password })
  });
  enterPortal(result.data);
};

const submitLogin = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    await authenticate(data.get("identifier"), data.get("password"));
    form.reset();
  } catch (error) {
    const message = document.getElementById("auth-error");
    message.textContent = error.message;
    message.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
};

const submitRegistration = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const mode = data.get("registrationMode");
  const button = form.querySelector('button[type="submit"]');
  const id = mode === "existing" ? String(data.get("householdId") || "").trim() : "";
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  const payload = {
    email,
    password,
    phone: String(data.get("phone") || "").trim(),
    latitude: String(data.get("latitude") || ""),
    longitude: String(data.get("longitude") || "")
  };
  let endpoint = "/api/auth/register/household";
  if (mode === "existing") {
    endpoint = "/api/auth/register/claim-household";
    payload.householdId = id;
  } else {
    ["name", "address", "division", "parish", "plan"].forEach((field) => {
      payload[field] = String(data.get(field) || "").trim();
    });
  }

  button.disabled = true;
  button.textContent = "Registering…";
  try {
    await loadReferenceData();
    await request(endpoint, { method: "POST", body: JSON.stringify(payload) });
    await authenticate(mode === "existing" ? id : email, password);
    form.reset();
    setRegistrationMode();
    if (mode !== "existing") {
      setNotice(`Household registered. Your sign-in ID is ${currentUser.loginId}.`, "success");
    }
  } catch (error) {
    const message = document.getElementById("auth-error");
    message.textContent = error.message;
    message.hidden = false;
  } finally {
    button.disabled = false;
    setRegistrationMode();
  }
};

const signOut = async () => {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch (error) {
    if (!/sign in|inactive/i.test(error.message)) setNotice(error.message);
  } finally {
    showAuthentication();
  }
};

const makeElement = (tag, className = "", text = "") => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = String(text);
  return element;
};

const actionHeader = (key, title, description) => {
  activeAction = key;
  activeResource = null;
  overviewPage.hidden = true;
  collectionPage.hidden = true;
  portalPage.hidden = false;
  setActiveNavigation(key);
  document.getElementById("breadcrumb").textContent = title;
  document.getElementById("portal-eyebrow").textContent =
    `${currentUser.role.replaceAll("_", " ")} PORTAL`;
  document.getElementById("portal-title").textContent = title;
  document.getElementById("portal-description").textContent = description;
  portalContent.replaceChildren();
  document.getElementById("portal-primary-action").hidden = true;
  setNotice("");
  setMobileMenuOpen(false);
};

let activeAction = "";

const renderPortalTable = (title, rows, columns, actions = [], description = "") => {
  portalContent.querySelectorAll("[data-portal-table]").forEach((table) => {
    if (table.dataset.portalTable === title) table.remove();
  });
  const card = makeElement("section", "portal-card");
  card.dataset.portalTable = title;
  const heading = makeElement("div", "portal-card-heading");
  const copy = document.createElement("div");
  copy.append(makeElement("h2", "", title));
  if (description) copy.append(makeElement("p", "", description));
  heading.append(copy);
  card.append(heading);

  if (!rows.length) {
    card.append(makeElement("div", "portal-empty", "No records to display."));
    portalContent.append(card);
    return;
  }

  const wrap = makeElement("div", "table-wrap");
  const table = makeElement("table", "portal-table");
  const thead = document.createElement("thead");
  const header = document.createElement("tr");
  columns.forEach((column) => {
    const cell = makeElement("th", "", column.label);
    cell.scope = "col";
    header.append(cell);
  });
  if (actions.length) {
    const cell = makeElement("th", "", "Actions");
    cell.scope = "col";
    header.append(cell);
  }
  thead.append(header);
  table.append(thead);

  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("td");
      const value = typeof column.value === "function" ? column.value(row) : row[column.value];
      cell.textContent = column.format
        ? column.format(value, row)
        : formatValue(typeof column.value === "string" ? column.value : "", value);
      if (column.primary) cell.className = "primary-cell";
      if (column.status) {
        const pill = makeElement("span", "status-pill", cell.textContent);
        cell.replaceChildren(pill);
      }
      tr.append(cell);
    });
    if (actions.length) {
      const cell = makeElement("td", "row-actions");
      actions.forEach((action) => {
        if (action.when && !action.when(row)) return;
        const button = makeElement("button", `text-action${action.danger ? " delete" : ""}`, action.label);
        button.type = "button";
        button.addEventListener("click", () => action.run(row));
        cell.append(button);
      });
      tr.append(cell);
    }
    body.append(tr);
  });
  table.append(body);
  wrap.append(table);
  card.append(wrap);
  portalContent.append(card);
};

const renderPortalForm = (title, description, fields, onSubmit, submitLabel = "Save") => {
  const card = makeElement("section", "portal-card");
  const heading = makeElement("div", "portal-card-heading");
  const copy = document.createElement("div");
  copy.append(makeElement("h2", "", title));
  if (description) copy.append(makeElement("p", "", description));
  heading.append(copy);
  const form = makeElement("form", "portal-form");
  fields.forEach((field) => {
    const wrapper = makeElement("div", `field${field.full ? " full-width" : ""}`);
    if (field.type === "checkbox") wrapper.classList.add("checkbox-field");
    const label = makeElement("label", "", field.label);
    const input = document.createElement(field.type === "textarea" ? "textarea" : "input");
    input.name = field.name;
    input.id = `portal-${field.name}`;
    input.required = Boolean(field.required);
    if (field.type === "select") {
      const select = document.createElement("select");
      select.name = field.name;
      select.id = input.id;
      select.required = Boolean(field.required);
      const placeholder = makeElement("option", "", field.placeholder || "Select an option");
      placeholder.value = "";
      select.append(placeholder);
      (field.options || []).forEach((option) => {
        const opt = makeElement("option", "", option.label);
        opt.value = option.value;
        select.append(opt);
      });
      if (field.value !== undefined) select.value = field.value;
      select.disabled = Boolean(field.disabled);
      label.htmlFor = select.id;
      wrapper.append(label, select);
    } else {
      if (field.type && field.type !== "textarea") input.type = field.type;
      if (field.min !== undefined) input.min = String(field.min);
      if (field.step) input.step = field.step;
      if (field.maxLength) input.maxLength = field.maxLength;
      if (field.minLength) input.minLength = field.minLength;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.value !== undefined) input.value = field.value;
      label.htmlFor = input.id;
      wrapper.append(label, input);
    }
    form.append(wrapper);
  });
  const actions = makeElement("div", "portal-form-actions");
  const submit = makeElement("button", "button button-primary", submitLabel);
  submit.type = "submit";
  actions.append(submit);
  form.append(actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    submit.textContent = "Please wait…";
    try {
      await onSubmit(data, form);
    } catch (error) {
      setNotice(error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });
  card.append(heading, form);
  portalContent.append(card);
  return form;
};

const renderCollectionCards = () => {
  const container = document.getElementById("collection-cards");
  Object.entries(resources).forEach(([key, resource]) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "collection-card";
    card.dataset.resource = key;

    const icon = document.createElement("span");
    icon.className = "collection-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = resource.icon;

    const copy = document.createElement("span");
    const title = document.createElement("h3");
    title.textContent = resource.label;
    const description = document.createElement("p");
    description.textContent = resource.description;
    copy.append(title, description);

    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    card.append(icon, copy, arrow);
    container.append(card);
  });
};

const setActiveNavigation = (navId) => {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.navId === navId);
  });
};

const setMobileMenuOpen = (open) => {
  sidebar.classList.toggle("mobile-open", open);
  mobileNavBackdrop.hidden = !open;
  mobileMenuToggle.setAttribute("aria-expanded", String(open));
  mobileMenuToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
  if (window.matchMedia("(max-width: 720px)").matches) {
    if (open) {
      sidebar.querySelector(".nav-item.active")?.focus();
    } else {
      mobileMenuToggle.focus();
    }
  }
};

const svgElement = (name, attributes = {}, text = "") => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, value));
  if (text) element.textContent = text;
  return element;
};

const renderZoneChart = (pickups, households) => {
  const container = document.getElementById("zone-chart");
  const householdZones = new Map(households.map((household) => [household._id, household.division]));
  const totals = new Map();
  pickups.forEach((pickup) => {
    const weight = Number(pickup.weight_kg);
    if (!Number.isFinite(weight) || weight < 0) return;
    const zone = householdZones.get(pickup.household_id) || "Unassigned";
    totals.set(zone, (totals.get(zone) || 0) + weight);
  });
  const entries = [...totals.entries()].sort((first, second) => second[1] - first[1]);
  container.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "Pickup weights will appear here once they are recorded.";
    container.append(empty);
    return;
  }

  const width = 560;
  const height = 235;
  const left = 44;
  const right = 12;
  const top = 14;
  const bottom = 43;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const maxValue = Math.max(...entries.map(([, value]) => value), 1);
  const axisMaximum = Math.ceil(maxValue / 100) * 100 || 100;
  const svg = svgElement("svg", {
    class: "zone-chart-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Total pickup weight in kilograms by household division"
  });

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (axisMaximum / 4) * tick;
    const y = top + plotHeight - (tick / 4) * plotHeight;
    svg.append(
      svgElement("line", { x1: left, y1: y, x2: width - right, y2: y, class: "chart-gridline" }),
      svgElement("text", { x: left - 8, y: y + 3, "text-anchor": "end", class: "chart-axis-label" },
        Number(value.toFixed(1)).toLocaleString())
    );
  }

  const slot = plotWidth / entries.length;
  entries.forEach(([zone, value], index) => {
    const barHeight = (value / axisMaximum) * plotHeight;
    const barWidth = Math.min(42, slot * 0.54);
    const x = left + slot * index + (slot - barWidth) / 2;
    const y = top + plotHeight - barHeight;
    const label = zone.length > 11 ? `${zone.slice(0, 10)}…` : zone;
    svg.append(
      svgElement("rect", { x, y, width: barWidth, height: Math.max(barHeight, 1), rx: 4, class: "chart-bar" }),
      svgElement("text", { x: x + barWidth / 2, y: height - 19, "text-anchor": "middle", class: "chart-zone-label" }, label)
    );
  });
  container.append(svg);
};

const renderWasteDistribution = (pickups) => {
  const chart = document.getElementById("waste-chart");
  const legend = document.getElementById("waste-legend");
  const totals = new Map();
  pickups.forEach((pickup) => {
    const weight = Number(pickup.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) return;
    const type = String(pickup.waste_type || "Unspecified");
    totals.set(type, (totals.get(type) || 0) + weight);
  });

  const entries = [...totals.entries()].sort((first, second) => second[1] - first[1]);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const colors = ["#25834f", "#38b97b", "#74c579", "#e7b83f", "#eb7046", "#598fa7"];
  const center = chart.querySelector(".donut-center");
  chart.replaceChildren(center);
  legend.replaceChildren();
  document.getElementById("waste-total").textContent =
    total.toLocaleString(undefined, { maximumFractionDigits: 1 });

  if (total === 0) {
    chart.style.background = "#edf2ef";
    const empty = document.createElement("p");
    empty.className = "legend-empty";
    empty.textContent = "No pickup weights to display";
    legend.append(empty);
    return;
  }

  let current = 0;
  const segments = entries.map(([type, weight], index) => {
    const start = current;
    current += (weight / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${current}%`;
  });
  chart.style.background = `conic-gradient(${segments.join(", ")})`;

  entries.slice(0, colors.length).forEach(([type, weight], index) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = colors[index];
    const label = document.createElement("span");
    label.className = "legend-name";
    label.textContent = type;
    const amount = document.createElement("strong");
    amount.textContent = `${((weight / total) * 100).toFixed(0)}%`;
    item.append(swatch, label, amount);
    legend.append(item);
  });
  if (entries.length > colors.length) {
    const otherWeight = entries.slice(colors.length).reduce((sum, [, weight]) => sum + weight, 0);
    const other = document.createElement("div");
    other.className = "legend-item legend-other";
    other.textContent = `+ ${entries.length - colors.length} other types (${((otherWeight / total) * 100).toFixed(0)}%)`;
    legend.append(other);
  }
};

const renderRecentPickups = (pickups, households) => {
  const body = document.getElementById("recent-pickups");
  const empty = document.getElementById("recent-empty");
  const householdNames = new Map(households.map((household) => [
    household._id,
    household.HouseholdName || household._id
  ]));
  const recent = [...pickups]
    .sort((first, second) => new Date(second.pickup_date) - new Date(first.pickup_date))
    .slice(0, 5);
  body.replaceChildren();
  empty.hidden = recent.length > 0;

  recent.forEach((pickup) => {
    const row = document.createElement("tr");
    const values = [
      pickup.waste_type || "Unspecified",
      householdNames.get(pickup.household_id) || pickup.household_id || "—",
      formatValue("pickup_date", pickup.pickup_date),
      `${Number(pickup.weight_kg || 0).toLocaleString()} kg`
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 0) cell.className = "recent-primary";
      row.append(cell);
    });
    const status = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "status-pill";
    pill.textContent = pickup.status || "—";
    status.append(pill);
    row.append(status);
    body.append(row);
  });
};

const renderAdminDashboardUpgrade = async () => {
  const upgrade = document.getElementById("admin-dashboard-upgrade");
  const subtitle = document.getElementById("overview-subtitle");
  if (!upgrade) return;
  if (currentUser?.role !== "administrator") {
    upgrade.hidden = true;
    upgrade.replaceChildren();
    if (subtitle) subtitle.textContent = "Monitor collection activity and manage your waste services.";
    return;
  }

  const report = (await request("/api/admin/report")).data;
  if (subtitle) subtitle.textContent = "Monitor collection activity and quickly access key CleanCity service information.";
  upgrade.hidden = false;
  upgrade.replaceChildren();

  const welcome = makeElement("section", "household-welcome");
  welcome.append(
    makeElement("h2", "", `Welcome, ${currentUser.name}`),
    makeElement("p", "", "Here is your administrator dashboard overview and quick access to key service areas.")
  );

  const grid = makeElement("div", "portal-summary-grid household-summary-grid");
  const registeredUsers = (report.users.household || 0) + (report.users.collector || 0);
  const activeRequests = (report.requests.requested || 0) + (report.requests.pending || 0) + (report.requests.assigned || 0);
  const openComplaints = Object.entries(report.complaints || {})
    .filter(([status]) => !/resolved|closed/i.test(status))
    .reduce((sum, [, count]) => sum + count, 0);
  [
    { label: "Registered users", hint: "Households and staff", value: registeredUsers.toLocaleString(), action: "list-users" },
    { label: "Active requests", hint: "Pending or assigned", value: activeRequests.toLocaleString(), action: "all-requests" },
    { label: "Payments received", hint: "Paid collection fees", value: money(report.payments?.totalUgx || 0), action: "all-payments" },
    { label: "Open complaints", hint: "Waiting for resolution", value: openComplaints.toLocaleString(), action: "all-complaints" }
  ].forEach(({ label, hint, value, action }) => {
    const card = makeElement("button", "portal-summary portal-summary-action");
    card.type = "button";
    card.append(makeElement("span", "", label), makeElement("strong", "", String(value)), makeElement("small", "", hint));
    card.addEventListener("click", () => openPortalAction(action));
    grid.append(card);
  });

  upgrade.append(welcome, grid);
};

const showOverview = async (navId = "overview") => {
  activeResource = null;
  activeNavigation = navId;
  setActiveNavigation(navId);
  overviewPage.hidden = false;
  collectionPage.hidden = true;
  portalPage.hidden = true;
  document.getElementById("breadcrumb").textContent = "Overview";
  setNotice("");

  try {
    const tasks = [
      Promise.all(
        Object.entries(resources).map(async ([key, resource]) => [
          key,
          (await request(resource.endpoint)).data
        ])
      )
    ];
    if (currentUser?.role === "administrator") tasks.push(renderAdminDashboardUpgrade());
    else {
      const upgrade = document.getElementById("admin-dashboard-upgrade");
      const subtitle = document.getElementById("overview-subtitle");
      if (upgrade) {
        upgrade.hidden = true;
        upgrade.replaceChildren();
      }
      if (subtitle) subtitle.textContent = "Monitor collection activity and manage your waste services.";
    }

    const [responses] = await Promise.all(tasks);
    const data = Object.fromEntries(responses);
    const totalWeight = data.pickups.reduce((sum, pickup) => {
      const weight = Number(pickup.weight_kg);
      return sum + (Number.isFinite(weight) && weight > 0 ? weight : 0);
    }, 0);
    document.getElementById("count-weight").textContent =
      totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 });
    document.getElementById("count-pickups").textContent = data.pickups.length.toLocaleString();
    document.getElementById("count-collectors").textContent =
      data.collectors.filter((collector) => collector.active !== false).length.toLocaleString();
    document.getElementById("count-dumpsites").textContent = data.dumpsites.length.toLocaleString();
    renderZoneChart(data.pickups, data.households);
    renderWasteDistribution(data.pickups);
    renderRecentPickups(data.pickups, data.households);
    if (navId === "reports") {
      document.querySelector(".analytics-grid").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    ["count-weight", "count-pickups", "count-collectors", "count-dumpsites"].forEach((id) => {
      document.getElementById(id).textContent = "—";
    });
    const upgrade = document.getElementById("admin-dashboard-upgrade");
    if (upgrade) {
      upgrade.hidden = true;
      upgrade.replaceChildren();
    }
    setNotice(error.message);
  }
};

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (field.endsWith("_date") || field === "registered_on" || field === "registered") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  if (field === "active") return value ? "Active" : "Inactive";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const renderTable = (query = "") => {
  const resource = resources[activeResource];
  const head = document.getElementById("table-head");
  const body = document.getElementById("table-body");
  const emptyState = document.getElementById("empty-state");
  head.replaceChildren();
  body.replaceChildren();

  const headerRow = document.createElement("tr");
  resource.columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = displayName(column, resource);
    headerRow.append(cell);
  });
  const actionsHeader = document.createElement("th");
  actionsHeader.scope = "col";
  actionsHeader.textContent = "Actions";
  headerRow.append(actionsHeader);
  head.append(headerRow);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = records.filter((record) =>
    resource.columns.some((column) =>
      formatValue(column, record[column]).toLowerCase().includes(normalizedQuery)
    )
  );
  document.getElementById("record-count").textContent =
    `${filtered.length} ${filtered.length === 1 ? "record" : "records"}` +
    (filtered.length !== records.length ? ` (of ${records.length})` : "");
  emptyState.hidden = filtered.length !== 0;
  document.querySelector(".table-wrap").hidden = filtered.length === 0;

  filtered.forEach((record) => {
    const row = document.createElement("tr");
    resource.columns.forEach((column, index) => {
      const cell = document.createElement("td");
      cell.textContent = formatValue(column, record[column]);
      if (column === "_id") cell.className = "id-cell";
      else if (index === 1) cell.className = "primary-cell";
      if (["status", "active"].includes(column)) {
        const pill = document.createElement("span");
        pill.className = "status-pill";
        pill.textContent = formatValue(column, record[column]);
        cell.replaceChildren(pill);
      }
      row.append(cell);
    });

    const actions = document.createElement("td");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "text-action";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openEditor(record));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-action delete";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteRecord(record));
    actions.append(edit, remove);
    row.append(actions);
    body.append(row);
  });
};

const showCollection = async (key, navId = key) => {
  if (!resources[key]) return;
  activeResource = key;
  activeNavigation = navId;
  setActiveNavigation(navId);
  overviewPage.hidden = true;
  collectionPage.hidden = false;
  portalPage.hidden = true;
  const resource = resources[key];
  document.getElementById("breadcrumb").textContent = resource.label;
  document.getElementById("collection-eyebrow").textContent = `${resource.label.toUpperCase()} COLLECTION`;
  document.getElementById("collection-title").textContent = resource.label;
  document.getElementById("collection-description").textContent = resource.description;
  document.getElementById("table-title").textContent = `All ${resource.label.toLowerCase()}`;
  document.getElementById("record-count").textContent = "Loading records…";
  document.getElementById("search").value = "";
  document.querySelector(".table-wrap").hidden = false;
  document.getElementById("empty-state").hidden = true;
  document.getElementById("table-body").replaceChildren();
  setNotice("");

  try {
    records = (await request(resource.endpoint)).data;
    renderTable();
  } catch (error) {
    records = [];
    renderTable();
    setNotice(error.message);
  }
};

const inputValue = (field, value) => {
  if (field.type === "checkbox") return Boolean(value);
  if (field.type === "date" && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  if (field.name === "accepts" && typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return value ?? "";
};

const openEditor = (record = null) => {
  const resource = resources[activeResource];
  editingId = record?._id ?? null;
  document.getElementById("form-error").hidden = true;
  document.getElementById("dialog-eyebrow").textContent = editingId ? "UPDATE RECORD" : "NEW RECORD";
  document.getElementById("dialog-title").textContent =
    `${editingId ? "Edit" : "Add"} ${resource.singular.toLowerCase()}`;
  document.getElementById("save-record").textContent = editingId ? "Save changes" : "Save record";

  const fields = document.getElementById("form-fields");
  fields.replaceChildren();
  resource.fields.forEach((field) => {
    const wrapper = document.createElement("div");
    wrapper.className = `field${field.full ? " full-width" : ""}`;
    if (field.type === "checkbox") {
      wrapper.className += " checkbox-field";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = field.name;
      input.id = `field-${field.name}`;
      input.checked = editingId ? Boolean(record[field.name]) : true;
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = field.label;
      wrapper.append(input, label);
    } else {
      const label = document.createElement("label");
      label.htmlFor = `field-${field.name}`;
      label.textContent = field.label;
      const input = document.createElement(field.type === "textarea" ? "textarea" : "input");
      input.id = `field-${field.name}`;
      input.name = field.name;
      input.required = Boolean(field.required);
      if (field.type !== "textarea") input.type = field.type || "text";
      if (field.min !== undefined) input.min = String(field.min);
      if (field.step) input.step = field.step;
      input.value = inputValue(field, record?.[field.name]);
      wrapper.append(label, input);
    }
    fields.append(wrapper);
  });

  recordDialog.showModal();
};

const convertFormValue = (field, value) => {
  if (field.type === "number") return value === "" ? "" : Number(value);
  if (field.name === "accepts" && value.trim()) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const saveRecord = async (event) => {
  event.preventDefault();
  const resource = resources[activeResource];
  const formData = new FormData(recordForm);
  const payload = Object.fromEntries(
    resource.fields.map((field) => {
      const value = field.type === "checkbox" ? formData.has(field.name) : formData.get(field.name);
      return [field.name, convertFormValue(field, value ?? "")];
    })
  );

  const saveButton = document.getElementById("save-record");
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  try {
    await request(
      `${resource.endpoint}${editingId ? `/${encodeURIComponent(editingId)}` : ""}`,
      {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );
    recordDialog.close();
    await showCollection(activeResource, activeNavigation);
    setNotice(`${resource.singular} ${editingId ? "updated" : "created"} successfully.`, "success");
  } catch (error) {
    const formError = document.getElementById("form-error");
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId ? "Save changes" : "Save record";
  }
};

const deleteRecord = async (record) => {
  const resource = resources[activeResource];
  if (!window.confirm(`Delete this ${resource.singular.toLowerCase()} record? This cannot be undone.`)) {
    return;
  }
  try {
    await request(`${resource.endpoint}/${encodeURIComponent(record._id)}`, { method: "DELETE" });
    await showCollection(activeResource, activeNavigation);
    setNotice(`${resource.singular} deleted successfully.`, "success");
  } catch (error) {
    setNotice(error.message);
  }
};

const money = (amount) => `${Number(amount || 0).toLocaleString()} UGX`;
const dateInputValue = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const loadAdminUsers = async (query = "") => {
  const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}` : "/api/admin/users";
  const users = (await request(url)).data;
  const deactivate = async (user) => {
    if (user.active === false || !window.confirm(`Deactivate ${user.name}'s sign-in account?`)) return;
    await request(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
    setNotice("User login deactivated; associated service records were retained.", "success");
    await loadAdminUsers(query);
  };
  renderPortalTable(query ? "Search results" : "Registered users", users, [
    { label: "Name", value: "name", primary: true },
    { label: "Role", value: "role" },
    { label: "User ID", value: "loginId" },
    { label: "Email", value: "email" },
    { label: "Status", value: "active", format: (value) => value === false ? "Inactive" : "Active", status: true }
  ], [{
    label: "Deactivate",
    danger: true,
    when: (user) => user.active !== false && user.id !== currentUser.id,
    run: (user) => deactivate(user).catch((error) => setNotice(error.message))
  }]);
};

const renderAdminPasswordReset = async () => {
  const users = (await request("/api/admin/users")).data;
  const resettableUsers = users.filter((user) => user.active !== false && user.id !== currentUser.id);
  renderPortalForm("Reset a user's password", "Verify the person against their registered ID and phone in person or by a trusted call before issuing a temporary password.", [
    {
      name: "accountId",
      label: "User account",
      required: true,
      type: "select",
      options: resettableUsers.map((user) => ({
        value: user.id,
        label: `${user.name} · ${user.loginId} · ${user.role}`
      }))
    },
    {
      name: "identityVerified",
      label: "I verified this user's identity and registered contact details",
      type: "checkbox",
      required: true,
      full: true
    }
  ], async ({ accountId, identityVerified }) => {
    const result = await request(`/api/admin/users/${encodeURIComponent(accountId)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ identityVerified: identityVerified === "on" })
    });
    const account = result.data.account;
    setNotice(
      `Temporary password for ${account.name} (${account.loginId}): ${result.data.temporaryPassword}. Give it only to the verified user; they must change it after signing in.`,
      "success"
    );
  }, "Generate temporary password");
};

const loadAdminRequests = async () => {
  const requests = (await request("/api/admin/requests")).data;
  renderPortalTable("All collection requests", requests, [
    { label: "Request ID", value: "request_id" },
    { label: "Household", value: (row) => row.household?.HouseholdName || row.household_id, primary: true },
    { label: "Location", value: (row) => row.household ? `${row.household.address}, ${row.household.parish}` : "—" },
    { label: "Contact", value: (row) => row.household?.phone || "—" },
    { label: "Waste", value: "waste_type" },
    { label: "Pickup date", value: "pickup_date", format: (value) => formatValue("pickup_date", value) },
    { label: "Collector", value: (row) => row.collector?.name || "Unassigned" },
    { label: "Status", value: "status", status: true },
    { label: "Fee", value: "fee_ugx", format: money }
  ], [
    { label: "Assign", run: (row) => openPortalAction("assign-request", row._id) },
    { label: "Reschedule", run: (row) => openPortalAction("reschedule-request", row._id) }
  ], `${requests.length} requests`);
};

const loadAdminComplaints = async () => {
  const complaints = (await request("/api/admin/complaints")).data;
  renderPortalTable("All complaints", complaints, [
    { label: "Complaint ID", value: "_id" },
    { label: "Household ID", value: "household_id" },
    { label: "Issue", value: "issue", primary: true },
    { label: "Filed", value: "complaint_date", format: (value) => formatValue("complaint_date", value) },
    { label: "Status", value: "status", status: true }
  ], [{
    label: "Resolve",
    when: (row) => !/resolved|closed/i.test(row.status),
    run: (row) => request(`/api/admin/complaints/${encodeURIComponent(row._id)}/resolve`, { method: "POST" })
      .then(async () => {
        setNotice("Complaint resolved.", "success");
        await loadAdminComplaints();
      })
      .catch((error) => setNotice(error.message))
  }]);
};

const renderUsersSearch = () => {
  renderPortalForm("Search registered users", "Search by name, role, email, or user ID.", [
    { name: "query", label: "Search term", required: true }
  ], async ({ query }) => {
    await loadAdminUsers(query.trim());
  }, "Search users");
};

const renderCollectorRegistration = () => {
  renderPortalForm("Register a collector", "Create a new collector profile and login, or link a login to an existing collector ID.", [
    { name: "collectorId", label: "Existing collector ID (optional)" },
    { name: "name", label: "Collector name", required: true },
    { name: "phone", label: "Phone number", required: true, type: "tel" },
    { name: "vehicle", label: "Vehicle", required: true },
    { name: "division_assigned", label: "Assigned division", required: true },
    { name: "email", label: "Sign-in email", required: true, type: "email" },
    { name: "password", label: "Temporary password (min 10 characters)", required: true, type: "password", minLength: 10, maxLength: 128 }
  ], async (data) => {
    await request("/api/admin/collectors", { method: "POST", body: JSON.stringify(data) });
    setNotice("Collector registered. Share their ID, email, and temporary password securely.", "success");
    await loadAdminUsers();
  }, "Register collector");
};

const renderRequestSelection = async (requestId, action) => {
  const requests = (await request("/api/admin/requests")).data;
  if (action === "assign-request") {
    const accounts = (await request("/api/admin/users")).data;
    const collectors = accounts.filter((account) => account.role === "collector" && account.active !== false);
    return renderPortalForm("Assign a request", "Assign an active collector to a household request.", [
      {
        name: "request_id",
        label: "Collection request",
        required: true,
        type: "select",
        value: requestId || "",
        options: requests.map((item) => ({
          value: item._id,
          label: `${item.request_id || item._id} · ${item.household?.HouseholdName || item.household_id} · ${item.status}`
        }))
      },
      {
        name: "collector_id",
        label: "Collector",
        required: true,
        type: "select",
        options: collectors.map((item) => ({ value: item.linkedId, label: `${item.name} · ${item.loginId}` }))
      }
    ], async ({ request_id, collector_id }) => {
      await request(`/api/admin/requests/${encodeURIComponent(request_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ collector_id })
      });
      setNotice("Request assigned successfully.", "success");
      await loadAdminRequests();
    }, "Assign request");
  }

  const selected = requests.find((item) => item._id === requestId);
  if (action === "reschedule-request") {
    return renderPortalForm("Reschedule a request", "Choose the request and its new collection date.", [
      {
        name: "request_id",
        label: "Collection request",
        required: true,
        type: "select",
        value: requestId || "",
        options: requests.map((item) => ({
          value: item._id,
          label: `${item.request_id || item._id} · ${item.household?.HouseholdName || item.household_id}`
        }))
      },
      { name: "pickup_date", label: "New pickup date", required: true, type: "date", value: selected ? dateInputValue(selected.pickup_date) : "" }
    ], async ({ request_id, pickup_date }) => {
      await request(`/api/admin/requests/${encodeURIComponent(request_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ pickup_date })
      });
      setNotice("Request rescheduled.", "success");
      await loadAdminRequests();
    }, "Reschedule request");
  }

  return renderPortalForm("Update or cancel a request", "Update the request status, fee, waste type, or recorded weight.", [
    {
      name: "request_id",
      label: "Collection request",
      required: true,
      type: "select",
      value: requestId || "",
      options: requests.map((item) => ({
        value: item._id,
        label: `${item.request_id || item._id} · ${item.household?.HouseholdName || item.household_id}`
      }))
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      value: selected?.status || "",
      options: ["requested", "assigned", "scheduled", "collected", "completed", "missed", "cancelled"]
        .map((status) => ({ value: status, label: status }))
    },
    { name: "fee_ugx", label: "Fee (UGX)", type: "number", min: 0, step: "any", value: selected?.fee_ugx ?? "" },
    { name: "weight_kg", label: "Collected weight (kg)", type: "number", min: 0, step: "any", value: selected?.weight_kg ?? "" },
    { name: "waste_type", label: "Waste type", value: selected?.waste_type || "" }
  ], async (data) => {
    const changes = Object.fromEntries(
      Object.entries(data).filter(([key, value]) => key !== "request_id" && value !== "")
    );
    if (Object.hasOwn(changes, "fee_ugx")) changes.fee_ugx = Number(changes.fee_ugx);
    if (Object.hasOwn(changes, "weight_kg")) changes.weight_kg = Number(changes.weight_kg);
    if (!Object.keys(changes).length) throw new Error("Choose at least one request field to update");
    await request(`/api/admin/requests/${encodeURIComponent(data.request_id)}`, {
      method: "PATCH",
      body: JSON.stringify(changes)
    });
    setNotice(changes.status === "cancelled" ? "Request cancelled." : "Request updated.", "success");
    await loadAdminRequests();
  }, "Save request");
};

const renderAdminPayments = async () => {
  const payments = (await request("/api/admin/payments")).data;
  renderPortalTable("All payments", payments, [
    { label: "Payment ID", value: (row) => row.payment_id || row._id },
    { label: "Request ID", value: "request_id" },
    { label: "Household ID", value: "household_id" },
    { label: "Amount", value: "amount_ugx", format: money },
    { label: "Method", value: "method" },
    { label: "Date", value: "payment_date", format: (value) => formatValue("payment_date", value) },
    { label: "Status", value: "status", status: true }
  ]);
};

const renderRecordPayment = async () => {
  const requests = (await request("/api/admin/requests")).data;
  renderPortalForm("Record a payment", "Payments are checked against the collection request's outstanding balance.", [
    {
      name: "pickup_id",
      label: "Collection request",
      required: true,
      type: "select",
      options: requests.filter((item) => item.fee_ugx > 0 && !/cancelled/i.test(item.status))
        .map((item) => ({
          value: item._id,
          label: `${item.request_id || item._id} · ${item.household?.HouseholdName || item.household_id} · fee ${money(item.fee_ugx)}`
        }))
    },
    { name: "amount_ugx", label: "Amount (UGX)", required: true, type: "number", min: 1, step: "any" },
    { name: "method", label: "Payment method", required: true, type: "select", options: ["Cash", "Mobile Money", "Bank"].map((item) => ({ value: item, label: item })) },
    { name: "reference", label: "Payment reference (optional)" }
  ], async (data) => {
    data.amount_ugx = Number(data.amount_ugx);
    await request("/api/admin/payments", { method: "POST", body: JSON.stringify(data) });
    setNotice("Payment recorded.", "success");
    await renderAdminPayments();
  }, "Record payment");
};

const renderAdminReport = async () => {
  const report = (await request("/api/admin/report")).data;
  const grid = makeElement("div", "portal-summary-grid");
  const items = [
    ["Active households", report.users.household || 0],
    ["Active collectors", report.users.collector || 0],
    ["Administrators", report.users.administrator || 0],
    ["Collection requests", Object.values(report.requests).reduce((sum, count) => sum + count, 0)],
    ["Waste collected", `${Number(report.collectedWeightKg).toLocaleString()} kg`],
    ["Payments received", money(report.payments.totalUgx)],
    ["Payments recorded", report.payments.count],
    ["Open complaints", Object.entries(report.complaints).filter(([status]) => !/resolved|closed/i.test(status)).reduce((sum, [, count]) => sum + count, 0)]
  ];
  items.forEach(([label, value]) => {
    const item = makeElement("article", "portal-summary");
    item.append(makeElement("span", "", label), makeElement("strong", "", value));
    grid.append(item);
  });
  portalContent.append(grid);
  renderPortalTable("Request status", Object.entries(report.requests).map(([status, count]) => ({ status, count })), [
    { label: "Status", value: "status", status: true },
    { label: "Requests", value: "count" }
  ]);
  renderPortalTable("Complaint status", Object.entries(report.complaints).map(([status, count]) => ({ status, count })), [
    { label: "Status", value: "status", status: true },
    { label: "Complaints", value: "count" }
  ]);
};

const householdRequestColumns = [
  { label: "Request ID", value: "request_id" },
  { label: "Waste type", value: "waste_type", primary: true },
  { label: "Pickup date", value: "pickup_date", format: (value) => formatValue("pickup_date", value) },
  { label: "Status", value: "status", status: true },
  { label: "Fee", value: "fee_ugx", format: money },
  { label: "Weight", value: "weight_kg", format: (value) => `${Number(value || 0).toLocaleString()} kg` }
];

const loadHouseholdRequests = async (showActions = true) => {
  const requests = (await request("/api/portal/household/requests")).data;
  const payments = (await request("/api/portal/household/payments")).data;
  const paidByRequest = new Map();
  payments.forEach((payment) => {
    if (payment.status !== "void") {
      paidByRequest.set(payment.pickup_id, (paidByRequest.get(payment.pickup_id) || 0) + payment.amount_ugx);
    }
  });
  const rowActions = showActions ? [
    {
      label: "Pay",
      when: (row) => row.fee_ugx > (paidByRequest.get(row._id) || 0) && !/cancelled/i.test(row.status),
      run: (row) => openPortalAction("pay-request", row.request_id)
    },
    {
      label: "Cancel",
      danger: true,
      when: (row) => !/collected|completed|cancelled/i.test(row.status),
      run: async (row) => {
        if (!window.confirm("Cancel this collection request?")) return;
        await request(`/api/portal/household/requests/${encodeURIComponent(row._id)}/cancel`, { method: "POST" });
        setNotice("Collection request cancelled.", "success");
        await loadHouseholdRequests();
      }
    }
  ] : [];
  renderPortalTable("My collection requests", requests, householdRequestColumns, rowActions);
  return requests;
};

const renderHouseholdPay = async (requestId) => {
  const requests = await loadHouseholdRequests(false);
  const payments = (await request("/api/portal/household/payments")).data;
  const paidByRequest = new Map();
  payments.forEach((payment) => {
    if (payment.status !== "void") {
      paidByRequest.set(payment.pickup_id, (paidByRequest.get(payment.pickup_id) || 0) + payment.amount_ugx);
    }
  });
  const eligible = requests.filter((item) =>
    item.fee_ugx > (paidByRequest.get(item._id) || 0) && !/cancelled/i.test(item.status)
  );
  const eligibleById = new Map(eligible.map((item) => [
    String(item.request_id || "").toUpperCase(),
    item
  ]));
  const form = renderPortalForm("Pay for a collection request", "Enter the request ID shown on your pickup, such as REQ001.", [
    { name: "request_id", label: "Request ID", required: true, type: "text", value: requestId || "", placeholder: "REQ001", maxLength: 32 },
    { name: "method", label: "Payment method", required: true, type: "select", options: ["Cash", "Mobile Money", "Bank"].map((item) => ({ value: item, label: item })) },
    { name: "reference", label: "Payment reference (optional)" }
  ], async ({ request_id, method, reference }) => {
    const normalizedId = request_id.trim().toUpperCase();
    const selected = eligibleById.get(normalizedId);
    if (!selected) {
      throw new Error("That request ID does not have an outstanding balance on your account.");
    }
    await request(`/api/portal/household/requests/${encodeURIComponent(normalizedId)}/pay`, {
      method: "POST",
      body: JSON.stringify({ method, reference })
    });
    await openPortalAction("my-payments");
    setNotice(`Payment recorded successfully for ${normalizedId}.`, "success");
  }, "Pay outstanding amount");
  const amountPreview = makeElement("p", "payment-preview", "Enter a request ID to see the balance.");
  const updatePreview = () => {
    const selected = eligibleById.get(form.elements.request_id.value.trim().toUpperCase());
    amountPreview.textContent = selected
      ? `${selected.waste_type} collection fee: ${money(selected.fee_ugx - (paidByRequest.get(selected._id) || 0))}`
      : "Enter a valid request ID with an outstanding balance.";
    amountPreview.classList.toggle("is-invalid", !selected && Boolean(form.elements.request_id.value.trim()));
  };
  form.querySelector(".portal-form-actions").before(amountPreview);
  form.elements.request_id.addEventListener("input", updatePreview);
  updatePreview();
  if (!eligible.length) {
    portalContent.append(makeElement("p", "portal-empty", "There are no requests with an outstanding fee. Contact the administrator if a request fee has not been added."));
  }
};

const loadHouseholdPayments = async () => {
  const payments = (await request("/api/portal/household/payments")).data;
  renderPortalTable("My payments", payments, [
    { label: "Payment ID", value: (row) => row.payment_id || row._id },
    { label: "Request ID", value: (row) => row.request_id || row.pickup_id },
    { label: "Amount", value: "amount_ugx", format: money },
    { label: "Method", value: "method" },
    { label: "Paid on", value: "payment_date", format: (value) => formatValue("payment_date", value) },
    { label: "Status", value: "status", status: true }
  ]);
};

const renderHouseholdComplaints = async () => {
  const complaints = (await request("/api/portal/household/complaints")).data;
  renderPortalTable("My complaints", complaints, [
    { label: "Complaint ID", value: "_id" },
    { label: "Issue", value: "issue", primary: true },
    { label: "Filed", value: "complaint_date", format: (value) => formatValue("complaint_date", value) },
    { label: "Status", value: "status", status: true }
  ]);
};

const renderAssignedRequests = async () => {
  const requests = (await request("/api/portal/collector/requests")).data;
  renderPortalTable("My assigned requests", requests, [
    { label: "Request ID", value: "request_id" },
    { label: "Household", value: (row) => row.household?.HouseholdName || row.household_id, primary: true },
    { label: "Address", value: (row) => row.household ? `${row.household.address}, ${row.household.parish}, ${row.household.division}` : "—" },
    { label: "Contact", value: (row) => row.household?.phone || "—" },
    { label: "Pickup date", value: "pickup_date", format: (value) => formatValue("pickup_date", value) },
    { label: "Waste", value: "waste_type" },
    { label: "Status", value: "status", status: true }
  ], [{
    label: "Collected",
    when: (row) => !/collected|completed|cancelled/i.test(row.status),
    run: (row) => openPortalAction("mark-collected", row._id)
  }]);
};

const renderCollectorProfile = async () => {
  const profile = (await request("/api/portal/collector/profile")).data;
  const card = makeElement("section", "portal-card");
  const heading = makeElement("div", "portal-card-heading");
  heading.append(makeElement("div", ""));
  heading.firstChild.append(
    makeElement("h2", "", "My collector profile"),
    makeElement("p", "", `Collector ID: ${profile.collector_id || profile._id}`)
  );
  const availability = makeElement("span", "status-pill", profile.active ? "Available" : "Unavailable");
  heading.append(availability);
  const details = makeElement("div", "profile-grid");
  [
    ["Name", profile.name],
    ["Email", profile.email],
    ["Phone", profile.phone],
    ["Vehicle", profile.vehicle],
    ["Assigned division", profile.division_assigned],
    ["Availability", profile.active ? "Available for assignments" : "Unavailable"]
  ].forEach(([label, value]) => {
    const item = makeElement("div", "profile-item");
    item.append(makeElement("span", "", label), makeElement("strong", "", value || "—"));
    details.append(item);
  });
  card.append(heading, details);
  portalContent.append(card);
};

const renderHouseholdHome = async () => {
  const [profile, requests, payments] = await Promise.all([
    request("/api/portal/household/profile").then((result) => result.data),
    request("/api/portal/household/requests").then((result) => result.data),
    request("/api/portal/household/payments").then((result) => result.data)
  ]);
  const paidByRequest = new Map();
  payments.forEach((payment) => {
    if (payment.status !== "void") {
      paidByRequest.set(payment.pickup_id, (paidByRequest.get(payment.pickup_id) || 0) + payment.amount_ugx);
    }
  });
  const outstanding = requests.reduce((sum, item) =>
    sum + (/cancelled/i.test(item.status) ? 0 : Math.max(0, item.fee_ugx - (paidByRequest.get(item._id) || 0))), 0);
  const cards = makeElement("div", "portal-summary-grid household-summary-grid");
  const welcome = makeElement("section", "household-welcome");
  welcome.append(
    makeElement("h2", "", `Welcome, ${profile.HouseholdName}`),
    makeElement("p", "", "Here is your CleanCity household dashboard and activity overview.")
  );
  portalContent.append(welcome);
  [
    ["Total requests", requests.length],
    ["In progress", requests.filter((item) => /requested|assigned|scheduled/i.test(item.status)).length],
    ["Collected", requests.filter((item) => /collected|completed/i.test(item.status)).length],
    ["Outstanding", money(outstanding)]
  ].forEach(([label, value]) => {
    const card = makeElement("article", "portal-summary");
    card.append(makeElement("span", "", label), makeElement("strong", "", value));
    cards.append(card);
  });
  portalContent.append(cards);
  const profileCard = makeElement("section", "portal-card");
  const heading = makeElement("div", "portal-card-heading");
  heading.append(makeElement("div", ""));
  heading.firstChild.append(makeElement("h2", "", "Household details"), makeElement("p", "", `Household ID: ${profile._id}`));
  profileCard.append(heading);
  const details = makeElement("div", "profile-grid");
  [["Address", profile.address], ["Parish", profile.parish], ["Division", profile.division], ["Phone", profile.phone], ["Plan", profile.plan], ["Email", currentUser.email]]
    .forEach(([label, value]) => {
      const item = makeElement("div", "profile-item");
      item.append(makeElement("span", "", label), makeElement("strong", "", value || "—"));
      details.append(item);
    });
  profileCard.append(details);
  const locationCard = makeElement("section", "portal-card household-location-card");
  const locationHeading = makeElement("div", "portal-card-heading");
  const locationCopy = document.createElement("div");
  locationCopy.append(
    makeElement("h2", "", "Service location"),
    makeElement("p", "", "Your division, parish, address, and optional GPS coordinates help collectors find you.")
  );
  locationHeading.append(locationCopy);
  locationCard.append(locationHeading);
  const locationDetails = makeElement("div", "profile-grid");
  const coordinatesSet = profile.latitude !== undefined && profile.latitude !== null &&
    profile.longitude !== undefined && profile.longitude !== null &&
    Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude));
  const locationText = coordinatesSet
    ? `${Number(profile.latitude).toFixed(5)}, ${Number(profile.longitude).toFixed(5)}`
    : "GPS location not set";
  const gpsItem = makeElement("div", "profile-item");
  gpsItem.append(makeElement("span", "", "GPS coordinates"));
  gpsItem.append(makeElement("strong", "", locationText));
  locationDetails.append(gpsItem);
  const gpsActions = makeElement("div", "location-actions");
  const gpsButton = makeElement("button", "button button-secondary", "Update GPS location");
  gpsButton.type = "button";
  const gpsStatus = makeElement("span", "auth-help", "GPS is optional and requires browser permission.");
  gpsButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      gpsStatus.textContent = "This browser does not support GPS location.";
      return;
    }
    gpsButton.disabled = true;
    gpsStatus.textContent = "Waiting for location permission…";
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await request("/api/portal/household/address", {
          method: "PATCH",
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        });
        await openPortalAction("household-home");
        setNotice("GPS location updated.", "success");
      } catch (error) {
        setNotice(error.message);
      } finally {
        gpsButton.disabled = false;
      }
    }, (error) => {
      gpsStatus.textContent = error.code === 1
        ? "Location permission was denied."
        : "Unable to get your location. Try again or continue without GPS.";
      gpsButton.disabled = false;
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
  gpsActions.append(gpsButton, gpsStatus);
  locationCard.append(locationDetails, gpsActions);
  portalContent.append(profileCard);
  portalContent.append(locationCard);
};

const renderCollectorHome = async () => {
  const [profile, requests] = await Promise.all([
    request("/api/portal/collector/profile").then((result) => result.data),
    request("/api/portal/collector/requests").then((result) => result.data)
  ]);
  const welcome = makeElement("section", "household-welcome");
  welcome.append(
    makeElement("h2", "", `Welcome, ${profile.name}`),
    makeElement("p", "", `Collector ID: ${profile.collector_id || profile._id}. Here is your assigned collection work and availability.`)
  );
  portalContent.append(welcome);
  const cards = makeElement("div", "portal-summary-grid");
  [
    ["Assigned requests", requests.length],
    ["Completed collections", requests.filter((item) => /collected|completed/i.test(item.status)).length],
    ["Availability", profile.active ? "Available" : "Unavailable"]
  ].forEach(([label, value]) => {
    const card = makeElement("article", "portal-summary");
    card.append(makeElement("span", "", label), makeElement("strong", "", value));
    cards.append(card);
  });
  portalContent.append(cards);
  await renderAssignedRequests();
};

const renderAdminHome = async () => {
  const report = (await request("/api/admin/report")).data;
  const welcome = makeElement("section", "household-welcome");
  welcome.append(
    makeElement("h2", "", `Welcome, ${currentUser.name}`),
    makeElement("p", "", "Use the dashboard below to quickly access key CleanCity service information.")
  );
  portalContent.append(welcome);

  const grid = makeElement("div", "portal-summary-grid household-summary-grid");
  const registeredUsers = (report.users.household || 0) + (report.users.collector || 0);
  const activeRequests = (report.requests.requested || 0) + (report.requests.pending || 0) + (report.requests.assigned || 0);
  const openComplaints = Object.entries(report.complaints || {})
    .filter(([status]) => !/resolved|closed/i.test(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const items = [
    { label: "Registered users", hint: "Households and staff", value: registeredUsers.toLocaleString(), action: "list-users" },
    { label: "Active requests", hint: "Pending or assigned", value: activeRequests.toLocaleString(), action: "all-requests" },
    { label: "Payments received", hint: "Paid collection fees", value: money(report.payments?.totalUgx || 0), action: "all-payments" },
    { label: "Open complaints", hint: "Waiting for resolution", value: openComplaints.toLocaleString(), action: "all-complaints" }
  ];
  items.forEach(({ label, hint, value, action }) => {
    const card = makeElement("button", "portal-summary portal-summary-action");
    card.type = "button";
    card.append(makeElement("span", "", label), makeElement("strong", "", String(value)), makeElement("small", "", hint));
    card.addEventListener("click", () => openPortalAction(action));
    grid.append(card);
  });
  portalContent.append(grid);
};

const openPortalAction = async (action, recordId = "") => {
  const labels = {
    "admin-home": ["Administrator dashboard", "Registered users, active requests, payments, and open complaints at a glance."],
    "household-home": ["Household dashboard", "Your collection requests, payments, and household details."],
    "collector-home": ["Collector dashboard", "Your assigned collection work and availability."],
    "list-users": ["List users", "Households, collectors, and administrators with CleanCity accounts."],
    "search-users": ["Search users", "Find registered users by name, ID, email, or role."],
    "register-collector": ["Register a collector", "Create a collector login or activate an existing collector ID."],
    "delete-user": ["Deactivate a user", "Disable an account login while retaining its service records."],
    "reset-user-password": ["Reset a password", "Verify the user in person or through a trusted channel, then issue a temporary password."],
    "all-requests": ["All collection requests", "Assign collectors, reschedule visits, and track request status."],
    "assign-request": ["Assign a request", "Choose an active collector for a collection request."],
    "reschedule-request": ["Reschedule a request", "Change a household's planned collection date."],
    "update-request": ["Update or cancel a request", "Manage request status, collection details, and fees."],
    "all-payments": ["All payments", "Review payments recorded for collection requests."],
    "record-payment": ["Record a payment", "Record a household payment against its outstanding request balance."],
    "all-complaints": ["All complaints", "Review issues raised by households and resolve them."],
    "resolve-complaint": ["Resolve a complaint", "Choose a complaint and mark it resolved."],
    "summary-report": ["Summary report", "Current user, collection, payment, and complaint totals."],
    "save-data": ["Save data now", "MongoDB persists each successful change automatically."],
    "request-pickup": ["Request waste collection", "Choose a waste type and preferred pickup date."],
    "my-requests": ["My collection requests", "Track, pay for, or cancel your collection requests."],
    "cancel-request": ["Cancel a request", "Cancel a request that has not already been collected."],
    "pay-request": ["Pay for a request", "Make a payment against an outstanding collection fee."],
    "my-payments": ["My payments", "Review payments recorded for your requests."],
    "file-complaint": ["File a complaint", "Let CleanCity know about an issue with your waste service."],
    "my-complaints": ["My complaints", "Track the resolution status of your complaints."],
    "update-address": ["Update my address", "Keep your household service location up to date."],
    "change-password": ["Change password", "Update your password or replace a temporary password."],
    "assigned-requests": ["Assigned requests & locations", "View household addresses and contact details for your assigned work."],
    "mark-collected": ["Mark a request collected", "Record a completed collection and its weight."],
    availability: ["Toggle my availability", "Set whether you can receive new collection assignments."],
    "collector-profile": ["My collector profile", "View your registered contact, vehicle, and service division."]
  };
  if (currentUser.mustChangePassword && action !== "change-password") {
    action = "change-password";
  }
  const [title, description] = labels[action] || ["CleanCity portal", ""];
  actionHeader(action, title, description);
  try {
    switch (action) {
      case "admin-home": return await showOverview("dashboard");
      case "household-home": return await renderHouseholdHome();
      case "collector-home": return await renderCollectorHome();
      case "list-users": return await loadAdminUsers();
      case "search-users":
        renderUsersSearch();
        return await loadAdminUsers();
      case "register-collector": return renderCollectorRegistration();
      case "reset-user-password": return await renderAdminPasswordReset();
      case "delete-user": return await loadAdminUsers();
      case "all-requests": return await loadAdminRequests();
      case "assign-request":
      case "reschedule-request":
      case "update-request": return await renderRequestSelection(recordId, action);
      case "all-payments": return await renderAdminPayments();
      case "record-payment": return await renderRecordPayment();
      case "all-complaints": return await loadAdminComplaints();
      case "resolve-complaint": return await loadAdminComplaints();
      case "summary-report": return await renderAdminReport();
      case "save-data": {
        const result = await request("/api/admin/save", { method: "POST" });
        const card = makeElement("section", "portal-card");
        card.append(makeElement("div", "portal-empty", result.message));
        portalContent.append(card);
        return;
      }
      case "change-password":
        return renderPortalForm("Change your password", currentUser.mustChangePassword
          ? "Your temporary password must be replaced before using the portal."
          : "Use your current password to set a new password of at least 10 characters.", [
          { name: "currentPassword", label: "Current password", required: true, type: "password" },
          { name: "newPassword", label: "New password", required: true, type: "password", minLength: 10, maxLength: 128 },
          { name: "confirmPassword", label: "Confirm new password", required: true, type: "password", minLength: 10, maxLength: 128 }
        ], async (data) => {
          if (data.newPassword !== data.confirmPassword) {
            throw new Error("The new passwords do not match.");
          }
          await request("/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify(data)
          });
          currentUser = { ...currentUser, mustChangePassword: false };
          renderRoleNavigation();
          if (currentUser.role === "administrator") {
            await showOverview("dashboard");
          } else {
            await openPortalAction(`${currentUser.role}-home`);
          }
          setNotice("Password updated successfully.", "success");
        }, "Update password");
      case "request-pickup":
        {
          await loadReferenceData();
          const form = renderPortalForm("Request a pickup", "Choose a waste type to see the fixed collection fee before submitting.", [
          { name: "waste_type", label: "Waste type", required: true, type: "select", options: Object.keys(referenceData.wastePricesUgx).map((item) => ({ value: item, label: item === "e-waste" ? "E-waste" : item[0].toUpperCase() + item.slice(1) })) },
          { name: "pickup_date", label: "Preferred pickup date", required: true, type: "date", value: dateInputValue(new Date()) }
        ], async (data) => {
          const result = await request("/api/portal/household/requests", { method: "POST", body: JSON.stringify(data) });
          setNotice(`Pickup request ${result.data.request_id} submitted. Fee: ${money(result.data.fee_ugx)}.`, "success");
          await loadHouseholdRequests();
        }, "Submit request");
          const preview = makeElement("p", "payment-preview", "Select a waste type to see its fee.");
          const updatePreview = () => {
            const price = referenceData.wastePricesUgx[form.elements.waste_type.value];
            preview.textContent = price === undefined ? "Select a waste type to see its fee." : `Fixed collection fee: ${money(price)}`;
          };
          form.querySelector(".portal-form-actions").before(preview);
          form.elements.waste_type.addEventListener("change", updatePreview);
          updatePreview();
          return form;
        }
      case "my-requests": return await loadHouseholdRequests();
      case "cancel-request": return await loadHouseholdRequests();
      case "pay-request": return await renderHouseholdPay(recordId);
      case "my-payments": return await loadHouseholdPayments();
      case "file-complaint":
        return renderPortalForm("Submit a complaint", "Describe the collection or service issue you experienced.", [
          { name: "issue", label: "Complaint details", required: true, type: "textarea", full: true }
        ], async (data) => {
          await request("/api/portal/household/complaints", { method: "POST", body: JSON.stringify(data) });
          setNotice("Complaint submitted.", "success");
          await renderHouseholdComplaints();
        }, "Submit complaint");
      case "my-complaints": return await renderHouseholdComplaints();
      case "update-address": {
        await loadReferenceData();
        const profile = (await request("/api/portal/household/profile")).data;
        const form = renderPortalForm("Update service address", "Update your collection address, division, or parish.", [
          { name: "address", label: "Street / home address", required: true, value: profile.address },
          { name: "division", label: "Division", required: true, type: "select", value: profile.division, options: Object.keys(referenceData.serviceAreas).sort().map((item) => ({ value: item, label: item })) },
          { name: "parish", label: "Parish", required: true, type: "select", value: profile.parish, options: (referenceData.serviceAreas[profile.division] || []).map((item) => ({ value: item, label: item })) }
        ], async (data) => {
          await request("/api/portal/household/address", { method: "PATCH", body: JSON.stringify(data) });
          await openPortalAction("household-home");
          setNotice("Household address updated.", "success");
        }, "Update address");
        form.elements.division.addEventListener("change", () => {
          populateParishOptions(form.elements.parish, form.elements.division.value);
        });
        attachGpsCapture(form, profile);
        return form;
      }
      case "assigned-requests": return await renderAssignedRequests();
      case "mark-collected": {
        const requests = (await request("/api/portal/collector/requests")).data;
        const assigned = requests.filter((item) => !/collected|completed|cancelled/i.test(item.status));
        return renderPortalForm("Mark collection completed", "Choose an assigned request and record the collected weight.", [
          {
            name: "request_id",
            label: "Assigned request",
            required: true,
            type: "select",
            value: recordId,
            options: assigned.map((item) => ({
              value: item._id,
              label: `${item.request_id || item._id} · ${item.household?.HouseholdName || item.household_id} · ${item.waste_type}`
            }))
          },
          { name: "weight_kg", label: "Collected weight (kg)", required: true, type: "number", min: 0, step: "any" }
        ], async ({ request_id, weight_kg }) => {
          await request(`/api/portal/collector/requests/${encodeURIComponent(request_id)}/collected`, {
            method: "POST",
            body: JSON.stringify({ weight_kg: Number(weight_kg) })
          });
          setNotice("Collection marked as collected.", "success");
          await renderAssignedRequests();
        }, "Mark collected");
      }
      case "availability": {
        const profile = (await request("/api/portal/collector/profile")).data;
        const card = makeElement("section", "portal-card");
        card.append(makeElement("div", "portal-empty", `You are currently ${profile.active ? "available" : "unavailable"} for new assignments.`));
        const button = makeElement("button", "button button-primary", profile.active ? "Set unavailable" : "Set available");
        button.type = "button";
        button.addEventListener("click", async () => {
          try {
            const result = await request("/api/portal/collector/availability", { method: "POST" });
            setNotice(`Availability updated: ${result.data.active ? "available" : "unavailable"}.`, "success");
            await openPortalAction("availability");
          } catch (error) {
            setNotice(error.message);
          }
        });
        const actions = makeElement("div", "portal-form-actions");
        actions.append(button);
        card.append(actions);
        portalContent.append(card);
        return;
      }
      case "collector-profile": return await renderCollectorProfile();
      default: throw new Error("This menu action is not available for your account");
    }
  } catch (error) {
    setNotice(error.message);
  }
};

navigation.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action], [data-resource]");
  if (!button) return;
  setMobileMenuOpen(false);
  if (button.dataset.action === "dashboard") showOverview("dashboard");
  else if (button.dataset.action) openPortalAction(button.dataset.action);
  else if (button.dataset.resource === "overview") showOverview(button.dataset.navId);
  else showCollection(button.dataset.resource, button.dataset.navId);
});
mobileMenuToggle.addEventListener("click", () => {
  setMobileMenuOpen(!sidebar.classList.contains("mobile-open"));
});
mobileNavBackdrop.addEventListener("click", () => setMobileMenuOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMobileMenuOpen(false);
});

document.getElementById("collection-cards").addEventListener("click", (event) => {
  const card = event.target.closest("[data-resource]");
  if (card) showCollection(card.dataset.resource);
});
document.getElementById("overview-add").addEventListener("click", () => {
  showCollection("households").then(() => openEditor());
});
document.getElementById("view-pickups").addEventListener("click", () => showCollection("pickups"));
document.getElementById("add-record").addEventListener("click", () => openEditor());
document.getElementById("empty-add").addEventListener("click", () => openEditor());
document.getElementById("search").addEventListener("input", (event) => renderTable(event.target.value));
recordForm.addEventListener("submit", saveRecord);
document.getElementById("close-dialog").addEventListener("click", () => recordDialog.close());
document.getElementById("cancel-dialog").addEventListener("click", () => recordDialog.close());
document.getElementById("login-tab").addEventListener("click", () => setAuthMode("login"));
document.getElementById("register-tab").addEventListener("click", () => setAuthMode("register"));
document.getElementById("registration-mode").addEventListener("change", setRegistrationMode);
document.getElementById("registration-division").addEventListener("change", (event) => {
  fillParishes(event.currentTarget.value);
});
document.getElementById("registration-gps-button").addEventListener("click", (event) => {
  const form = document.getElementById("register-form");
  requestCurrentLocation(form, event.currentTarget, document.getElementById("registration-gps-status"));
});
document.getElementById("login-form").addEventListener("submit", submitLogin);
document.getElementById("register-form").addEventListener("submit", submitRegistration);
document.getElementById("logout-button").addEventListener("click", signOut);

renderCollectionCards();
setRegistrationMode();
loadReferenceData()
  .catch((error) => {
    const message = document.getElementById("auth-error");
    message.textContent = `Unable to load service areas and pricing: ${error.message}`;
    message.hidden = false;
  });
request("/api/auth/me")
  .then((result) => enterPortal(result.data))
  .catch(() => showAuthentication());
