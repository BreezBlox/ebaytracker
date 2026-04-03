const STORAGE_KEY = "ebay-sales-tracker-data-v1";
const DEMO_CSV = `,,,,,,,,,
CREATED,qty,Ship To Name,Item title,Item subtotal,shipping,Order earnings,aliexpress total,Refunds,PROFIT
4/1/2026,1,Sample Buyer 01,Nintendo FC To NES 60 Pin To 72 Pin Famicom Adapter Converter For NES Console,39.99,0,33.62,12.05,--,21.57
3/31/2026,1,Sample Buyer 02,Nintendo GameCube Line Doubler High Definition Digital AV to HDMI Adapter TV NEW,44.99,2.99,39.64,38.58,--,1.06
3/31/2026,1,Sample Buyer 03,Nintendo Gamecube Wii SD Card Adapter Console GC2SD Game Card Reader BitFunX,11.99,0,9.56,4.73,--,4.83
3/31/2026,1,Sample Buyer 04,Nintendo GameCube Line Doubler High Definition Digital AV to HDMI Adapter TV NEW,54.99,2.99,47.78,43.72,--,4.06
3/30/2026,1,Sample Buyer 05,Nintendo NES to FC 72 Pin to 60 Pin NES Adapter Converter For Famicon Console,44.99,0,37,28.24,--,8.76
3/30/2026,1,Sample Buyer 06,Nintendo Gamecube Wii SD Card Adapter Console GC2SD Game Card Reader BitFunX,11.99,0,9.59,4.77,--,4.82`;

const state = {
  records: [],
  filtered: [],
};

const elements = {
  csvFile: document.querySelector("#csvFile"),
  loadSampleButton: document.querySelector("#loadSampleButton"),
  clearDataButton: document.querySelector("#clearDataButton"),
  dateFilter: document.querySelector("#dateFilter"),
  searchInput: document.querySelector("#searchInput"),
  statusMessage: document.querySelector("#statusMessage"),
  ordersValue: document.querySelector("#ordersValue"),
  grossValue: document.querySelector("#grossValue"),
  earningsValue: document.querySelector("#earningsValue"),
  cogsValue: document.querySelector("#cogsValue"),
  refundsValue: document.querySelector("#refundsValue"),
  profitValue: document.querySelector("#profitValue"),
  marginValue: document.querySelector("#marginValue"),
  itemsTableBody: document.querySelector("#itemsTableBody"),
  ordersTableBody: document.querySelector("#ordersTableBody"),
  monthlyChart: document.querySelector("#monthlyChart"),
};

function init() {
  bindEvents();
  hydrateFromStorage();
  render();
}

function bindEvents() {
  elements.csvFile.addEventListener("change", handleFileSelect);
  elements.loadSampleButton.addEventListener("click", () => {
    loadCsvText(DEMO_CSV, "Bundled demo data loaded.");
  });
  elements.clearDataButton.addEventListener("click", clearSavedData);
  elements.dateFilter.addEventListener("change", render);
  elements.searchInput.addEventListener("input", render);
}

function handleFileSelect(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    loadCsvText(text, `Loaded ${file.name}`);
  };
  reader.onerror = () => {
    setStatus("Could not read that file. Try exporting the CSV again.", true);
  };
  reader.readAsText(file);
}

function loadCsvText(text, successMessage) {
  try {
    const records = normalizeCsv(text);
    if (!records.length) {
      throw new Error("No sales rows found.");
    }

    state.records = records.sort((left, right) => right.createdAt - left.createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
    setStatus(`${successMessage} ${records.length} orders available.`, false);
    render();
  } catch (error) {
    setStatus(error.message || "That CSV could not be parsed.", true);
  }
}

function clearSavedData() {
  state.records = [];
  elements.csvFile.value = "";
  localStorage.removeItem(STORAGE_KEY);
  setStatus("Saved browser data cleared.", false);
  render();
}

function hydrateFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.records = parsed
      .map((record) => ({
        ...record,
        createdAt: new Date(record.createdAt),
      }))
      .filter((record) => !Number.isNaN(record.createdAt.getTime()))
      .sort((left, right) => right.createdAt - left.createdAt);

    if (state.records.length) {
      setStatus(`Restored ${state.records.length} saved orders from this browser.`, false);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeCsv(text) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.trim().toUpperCase() === "CREATED"));
  if (headerIndex === -1) {
    throw new Error("Could not find the CSV header row.");
  }

  const headers = rows[headerIndex].map((cell) => cell.trim());
  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim()));

  return dataRows
    .map((row) => buildRecord(headers, row))
    .filter(Boolean);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        value += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function buildRecord(headers, row) {
  const source = Object.fromEntries(
    headers.map((header, index) => [header, (row[index] || "").trim()]),
  );

  if (!source.CREATED) {
    return null;
  }

  const createdAt = parseDate(source.CREATED);
  if (!createdAt) {
    return null;
  }

  const quantity = parseNumber(source.qty, 1);
  const itemSubtotal = parseNumber(source["Item subtotal"]);
  const shipping = parseNumber(source.shipping);
  const gross = itemSubtotal + shipping;
  const earnings = parseNumber(source["Order earnings"]);
  const cogs = parseNumber(source["aliexpress total"]);
  const refunds = parseNumber(source.Refunds);
  const profit = parseNumber(source.PROFIT, earnings - cogs - refunds);

  return {
    created: source.CREATED,
    createdAt,
    quantity,
    buyer: source["Ship To Name"] || "Unknown buyer",
    itemTitle: source["Item title"] || "Untitled item",
    itemSubtotal,
    shipping,
    gross,
    earnings,
    cogs,
    refunds,
    profit,
  };
}

function parseDate(value) {
  const [month, day, year] = value.split("/").map((piece) => Number.parseInt(piece, 10));
  if (!month || !day || !year) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumber(value, fallback = 0) {
  if (value == null) {
    return fallback;
  }

  const cleaned = String(value).replace(/[$,%\s]/g, "");
  if (!cleaned || cleaned === "--") {
    return fallback;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFilteredRecords() {
  const searchValue = elements.searchInput.value.trim().toLowerCase();
  const dateFilter = elements.dateFilter.value;

  let records = [...state.records];

  if (dateFilter !== "all") {
    const windowDays = Number.parseInt(dateFilter, 10);
    const latestDate = records.length ? records[0].createdAt : new Date();
    const cutoff = new Date(latestDate);
    cutoff.setDate(cutoff.getDate() - windowDays);
    records = records.filter((record) => record.createdAt >= cutoff);
  }

  if (searchValue) {
    records = records.filter((record) => record.itemTitle.toLowerCase().includes(searchValue));
  }

  return records;
}

function render() {
  state.filtered = getFilteredRecords();
  renderSummary(state.filtered);
  renderItemsTable(state.filtered);
  renderOrdersTable(state.filtered);
  renderMonthlyChart(state.filtered);
}

function renderSummary(records) {
  const totals = records.reduce(
    (summary, record) => {
      summary.orders += 1;
      summary.gross += record.gross;
      summary.earnings += record.earnings;
      summary.cogs += record.cogs;
      summary.refunds += record.refunds;
      summary.profit += record.profit;
      return summary;
    },
    { orders: 0, gross: 0, earnings: 0, cogs: 0, refunds: 0, profit: 0 },
  );

  const margin = totals.gross ? (totals.profit / totals.gross) * 100 : 0;

  elements.ordersValue.textContent = formatNumber(totals.orders);
  elements.grossValue.textContent = formatCurrency(totals.gross);
  elements.earningsValue.textContent = formatCurrency(totals.earnings);
  elements.cogsValue.textContent = formatCurrency(totals.cogs);
  elements.refundsValue.textContent = formatCurrency(totals.refunds);
  elements.profitValue.textContent = formatCurrency(totals.profit);
  elements.marginValue.textContent = `${margin.toFixed(1)}%`;
}

function renderItemsTable(records) {
  if (!records.length) {
    elements.itemsTableBody.innerHTML = '<tr><td colspan="5" class="empty-row">No matching item data.</td></tr>';
    return;
  }

  const grouped = Array.from(
    records.reduce((map, record) => {
      const existing = map.get(record.itemTitle) || {
        itemTitle: record.itemTitle,
        quantity: 0,
        gross: 0,
        profit: 0,
      };

      existing.quantity += record.quantity;
      existing.gross += record.gross;
      existing.profit += record.profit;
      map.set(record.itemTitle, existing);
      return map;
    }, new Map()).values(),
  )
    .sort((left, right) => right.profit - left.profit)
    .slice(0, 12);

  elements.itemsTableBody.innerHTML = grouped
    .map((item) => {
      const margin = item.gross ? (item.profit / item.gross) * 100 : 0;
      return `
        <tr class="mobile-card-row">
          <td data-label="Item">
            <div class="item-title">${escapeHtml(item.itemTitle)}</div>
          </td>
          <td data-label="Qty">${formatNumber(item.quantity)}</td>
          <td data-label="Gross">${formatCurrency(item.gross)}</td>
          <td data-label="Profit">${formatCurrency(item.profit)}</td>
          <td data-label="Margin">${margin.toFixed(1)}%</td>
        </tr>
      `;
    })
    .join("");
}

function renderOrdersTable(records) {
  if (!records.length) {
    elements.ordersTableBody.innerHTML = '<tr><td colspan="7" class="empty-row">No matching orders.</td></tr>';
    return;
  }

  elements.ordersTableBody.innerHTML = records
    .slice(0, 50)
    .map((record) => `
      <tr class="mobile-card-row">
        <td data-label="Date">${formatDate(record.createdAt)}</td>
        <td data-label="Buyer">
          <div class="buyer-name">${escapeHtml(record.buyer)}</div>
        </td>
        <td data-label="Item">
          <div class="item-title">${escapeHtml(record.itemTitle)}</div>
          <div class="item-subtle">Qty ${formatNumber(record.quantity)}</div>
        </td>
        <td data-label="Gross">${formatCurrency(record.gross)}</td>
        <td data-label="Earnings">${formatCurrency(record.earnings)}</td>
        <td data-label="COGS">${formatCurrency(record.cogs)}</td>
        <td data-label="Profit">${formatCurrency(record.profit)}</td>
      </tr>
    `)
    .join("");
}

function renderMonthlyChart(records) {
  if (!records.length) {
    elements.monthlyChart.className = "monthly-chart empty-state";
    elements.monthlyChart.textContent = "Load a CSV to see month-by-month results.";
    return;
  }

  const monthly = Array.from(
    records.reduce((map, record) => {
      const monthKey = `${record.createdAt.getFullYear()}-${String(record.createdAt.getMonth() + 1).padStart(2, "0")}`;
      const existing = map.get(monthKey) || {
        key: monthKey,
        label: record.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        gross: 0,
        profit: 0,
        orders: 0,
      };

      existing.gross += record.gross;
      existing.profit += record.profit;
      existing.orders += 1;
      map.set(monthKey, existing);
      return map;
    }, new Map()).values(),
  ).sort((left, right) => left.key.localeCompare(right.key));

  const maxGross = Math.max(...monthly.map((entry) => entry.gross), 1);
  const maxProfit = Math.max(...monthly.map((entry) => Math.abs(entry.profit)), 1);

  elements.monthlyChart.className = "monthly-chart";
  elements.monthlyChart.innerHTML = monthly
    .map((entry) => `
      <div class="month-row">
        <div class="month-header">
          <div>
            <strong>${escapeHtml(entry.label)}</strong>
            <div class="month-meta">${formatNumber(entry.orders)} orders</div>
          </div>
          <div class="month-meta">
            Gross ${formatCurrency(entry.gross)} | Profit ${formatCurrency(entry.profit)}
          </div>
        </div>
        <div class="bar-track">
          <div class="bar bar-gross" style="width: ${(entry.gross / maxGross) * 100}%"></div>
          <div class="bar bar-profit" style="width: ${(Math.abs(entry.profit) / maxProfit) * 100}%"></div>
        </div>
      </div>
    `)
    .join("");
}

function setStatus(message, isError) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#9d2d22" : "";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

init();
