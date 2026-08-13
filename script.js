const SUPABASE_URL = "https://zsnklqhmzeshrofdypqa.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_PLPNcUMJyqJXhwbHJjpzXQ_J4Oygaga";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let accounts = [];
let allTransactions = [];
let selectedDate = new Date();

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tx-date").valueAsDate = new Date();
  updateMonthDisplay();
  loadAccounts();
  loadDashboardData();
});

// Month Filter Navigation
function updateMonthDisplay() {
  document.getElementById("current-month-display").innerText = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function changeMonth(delta) {
  selectedDate.setMonth(selectedDate.getMonth() + delta);
  updateMonthDisplay();
  calculateBudgetAndBalances(allTransactions);
}

// Load Accounts into dropdowns & view
async function loadAccounts() {
  const { data, error } = await db.from("accounts").select("*").order("name");
  if (error) return console.error(error);
  
  accounts = data;
  const fromSelect = document.getElementById("from-account");
  const toSelect = document.getElementById("to-account");

  fromSelect.innerHTML = "";
  toSelect.innerHTML = "";

  accounts.forEach(acc => {
    const opt1 = new Option(`${acc.name} (${acc.type})`, acc.id);
    const opt2 = new Option(`${acc.name} (${acc.type})`, acc.id);
    fromSelect.add(opt1);
    toSelect.add(opt2);
  });

  renderAccountManageList();
}

function renderAccountManageList() {
  const container = document.getElementById("account-manage-list");
  container.innerHTML = "";

  accounts.forEach(acc => {
    const item = document.createElement("div");
    item.className = "py-3 flex justify-between items-center text-sm";
    item.innerHTML = `
      <div class="flex-1 pr-2">
        <div class="font-semibold text-slate-200">${acc.name}</div>
        <div class="text-xs text-slate-400 uppercase tracking-wider">${acc.type} • Budget: ${formatCurrency(acc.budget_monthly || 0)}</div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="promptEditBudget('${acc.id}', '${acc.name}', ${acc.budget_monthly || 0})" class="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded text-slate-300">Edit</button>
        <button onclick="handleDeleteAccount('${acc.id}')" class="text-xs bg-rose-900/50 hover:bg-rose-800 text-rose-300 px-2.5 py-1 rounded">Delete</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// Load Dashboard Data
async function loadDashboardData() {
  const { data: txs, error } = await db.from("transactions").select("*, from:from_account_id(*), to:to_account_id(*)").order("date", { ascending: false });
  if (error) return console.error(error);

  allTransactions = txs;
  renderTransactions(allTransactions);
  calculateBudgetAndBalances(allTransactions);
}

function calculateBudgetAndBalances(txs) {
  const balances = {};
  accounts.forEach(a => balances[a.id] = 0);

  const selMonth = selectedDate.getMonth();
  const selYear = selectedDate.getFullYear();

  txs.forEach(tx => {
    const amount = parseFloat(tx.amount);
    if (balances[tx.from_account_id] !== undefined) balances[tx.from_account_id] -= amount;
    if (balances[tx.to_account_id] !== undefined) balances[tx.to_account_id] += amount;
  });

  let totalAssets = 0;
  let totalLiabilities = 0;

  accounts.forEach(acc => {
    const bal = balances[acc.id] || 0;
    if (acc.type === 'asset') totalAssets += bal;
    if (acc.type === 'liability') totalLiabilities += Math.abs(bal);
  });

  document.getElementById("net-worth").innerText = formatCurrency(totalAssets - totalLiabilities);
  document.getElementById("total-assets").innerText = formatCurrency(totalAssets);
  document.getElementById("total-liabilities").innerText = formatCurrency(totalLiabilities);

  renderBudgets(txs, selMonth, selYear);
}

function renderBudgets(txs, month, year) {
  const budgetContainer = document.getElementById("budget-list");
  budgetContainer.innerHTML = "";

  const budgetedAccounts = accounts.filter(a => parseFloat(a.budget_monthly) > 0);

  if (budgetedAccounts.length === 0) {
    budgetContainer.innerHTML = `<div class="p-4 text-center text-slate-500 text-sm bg-slate-800 rounded-xl border border-slate-700">No monthly budgets set yet. Tap "⚙️ Accounts" to add one!</div>`;
    return;
  }

  budgetedAccounts.forEach(acc => {
    const monthlySpent = txs.reduce((sum, tx) => {
      const txDate = new Date(tx.date + 'T00:00:00');
      if (txDate.getMonth() === month && txDate.getFullYear() === year) {
        if (acc.type === 'expense' && tx.to_account_id === acc.id) return sum + parseFloat(tx.amount);
        if (acc.type === 'income' && tx.from_account_id === acc.id) return sum + parseFloat(tx.amount);
      }
      return sum;
    }, 0);

    const target = parseFloat(acc.budget_monthly);
    const percent = Math.min(Math.round((monthlySpent / target) * 100), 100);
    const isOver = monthlySpent > target;

    const card = document.createElement("div");
    card.className = "bg-slate-800 p-4 rounded-xl border border-slate-700/70";
    card.innerHTML = `
      <div class="flex justify-between text-sm mb-1 font-medium">
        <span>${acc.name}</span>
        <span class="${isOver ? 'text-rose-400 font-bold' : 'text-slate-300'}">
          ${formatCurrency(monthlySpent)} / ${formatCurrency(target)}
        </span>
      </div>
      <div class="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
        <div class="h-full ${isOver ? 'bg-rose-500' : 'bg-emerald-400'} transition-all duration-500" style="width: ${percent}%"></div>
      </div>
    `;
    budgetContainer.appendChild(card);
  });
}

// Render Recent Activity List & Search
function renderTransactions(txs) {
  const list = document.getElementById("transaction-list");
  list.innerHTML = "";

  if (txs.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-slate-500 text-sm">No transactions found.</div>`;
    return;
  }

  txs.forEach(tx => {
    const item = document.createElement("div");
    item.className = "p-3.5 flex justify-between items-center text-sm hover:bg-slate-700/30 cursor-pointer active:bg-slate-700/50 transition";
    item.onclick = () => openEditTxModal(tx);
    item.innerHTML = `
      <div>
        <p class="font-semibold text-slate-200">${tx.from ? tx.from.name : 'Unknown'} → ${tx.to ? tx.to.name : 'Unknown'}</p>
        <p class="text-xs text-slate-400">${tx.date} ${tx.notes ? `• <span class="italic text-slate-300">${tx.notes}</span>` : ''}</p>
      </div>
      <span class="font-bold text-emerald-400">${formatCurrency(tx.amount)}</span>
    `;
    list.appendChild(item);
  });
}

function handleSearch() {
  const query = document.getElementById("search-input").value.toLowerCase();
  const filtered = allTransactions.filter(tx => {
    const fromName = tx.from ? tx.from.name.toLowerCase() : "";
    const toName = tx.to ? tx.to.name.toLowerCase() : "";
    const notes = tx.notes ? tx.notes.toLowerCase() : "";
    return fromName.includes(query) || toName.includes(query) || notes.includes(query);
  });
  renderTransactions(filtered);
}

// Quick Preset Actions
function quickPreset(type) {
  openTxModal();
  const fromSelect = document.getElementById("from-account");
  const toSelect = document.getElementById("to-account");

  if (type === 'paycheck') {
    const incomeAcc = accounts.find(a => a.type === 'income');
    const assetAcc = accounts.find(a => a.type === 'asset');
    if (incomeAcc) fromSelect.value = incomeAcc.id;
    if (assetAcc) toSelect.value = assetAcc.id;
    document.getElementById("tx-notes").value = "Paycheck";
  } else if (type === 'coffee') {
    const assetAcc = accounts.find(a => a.type === 'asset') || accounts.find(a => a.type === 'liability');
    const coffeeAcc = accounts.find(a => a.name.toLowerCase().includes('coffee')) || accounts.find(a => a.type === 'expense');
    if (assetAcc) fromSelect.value = assetAcc.id;
    if (coffeeAcc) toSelect.value = coffeeAcc.id;
    document.getElementById("amount").value = "5.00";
    document.getElementById("tx-notes").value = "Coffee run";
  } else if (type === 'groceries' || type === 'gas') {
    const assetAcc = accounts.find(a => a.type === 'asset') || accounts.find(a => a.type === 'liability');
    const expAcc = accounts.find(a => a.name.toLowerCase().includes(type)) || accounts.find(a => a.type === 'expense');
    if (assetAcc) fromSelect.value = assetAcc.id;
    if (expAcc) toSelect.value = expAcc.id;
  }
}

// Transaction Modal Logic (Save, Edit, Delete)
async function handleSaveTransaction(e) {
  e.preventDefault();

  const id = document.getElementById("tx-id").value;
  const from_account_id = document.getElementById("from-account").value;
  const to_account_id = document.getElementById("to-account").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("tx-date").value;
  const notes = document.getElementById("tx-notes").value.trim();

  const payload = { from_account_id, to_account_id, amount, date, notes };

  let error;
  if (id) {
    ({ error } = await db.from("transactions").update(payload).eq("id", id));
  } else {
    ({ error } = await db.from("transactions").insert([payload]));
  }

  if (error) {
    alert("Error saving transaction: " + error.message);
  } else {
    closeTxModal();
    loadDashboardData();
  }
}

function openEditTxModal(tx) {
  document.getElementById("tx-modal-title").innerText = "Edit Transaction";
  document.getElementById("tx-id").value = tx.id;
  document.getElementById("from-account").value = tx.from_account_id;
  document.getElementById("to-account").value = tx.to_account_id;
  document.getElementById("amount").value = tx.amount;
  document.getElementById("tx-date").value = tx.date;
  document.getElementById("tx-notes").value = tx.notes || "";
  document.getElementById("delete-tx-btn").classList.remove("hidden");
  openTxModal();
}

async function handleDeleteTransaction() {
  const id = document.getElementById("tx-id").value;
  if (!id) return;

  if (confirm("Delete this transaction?")) {
    const { error } = await db.from("transactions").delete().eq("id", id);
    if (error) {
      alert("Error deleting transaction: " + error.message);
    } else {
      closeTxModal();
      loadDashboardData();
    }
  }
}

function openTxModal() { 
  document.getElementById("tx-modal").classList.remove("hidden"); 
}

function closeTxModal() { 
  document.getElementById("tx-modal").classList.add("hidden"); 
  document.getElementById("tx-form").reset();
  document.getElementById("tx-id").value = "";
  document.getElementById("tx-modal-title").innerText = "New Transaction";
  document.getElementById("delete-tx-btn").classList.add("hidden");
  document.getElementById("tx-date").valueAsDate = new Date();
}

// Account Management Logic
async function handleSaveAccount(e) {
  e.preventDefault();
  const name = document.getElementById("acc-name").value.trim();
  const type = document.getElementById("acc-type").value;
  const budget_monthly = parseFloat(document.getElementById("acc-budget").value) || 0;

  const { error } = await db.from("accounts").insert([{ name, type, budget_monthly }]);

  if (error) {
    alert("Error adding account: " + error.message);
  } else {
    document.getElementById("acc-form").reset();
    await loadAccounts();
    loadDashboardData();
  }
}

async function promptEditBudget(id, name, currentBudget) {
  const newBudget = prompt(`Set new monthly budget for "${name}":`, currentBudget);
  if (newBudget !== null) {
    const parsed = parseFloat(newBudget);
    if (isNaN(parsed)) return alert("Please enter a valid number");

    const { error } = await db.from("accounts").update({ budget_monthly: parsed }).eq("id", id);
    if (error) {
      alert("Error updating budget: " + error.message);
    } else {
      await loadAccounts();
      loadDashboardData();
    }
  }
}

async function handleDeleteAccount(id) {
  if (confirm("Are you sure? All transactions associated with this account will also be deleted.")) {
    const { error } = await db.from("accounts").delete().eq("id", id);
    if (error) {
      alert("Error deleting account: " + error.message);
    } else {
      await loadAccounts();
      loadDashboardData();
    }
  }
}

function openAccountModal() { document.getElementById("account-modal").classList.remove("hidden"); }
function closeAccountModal() { document.getElementById("account-modal").classList.add("hidden"); }

// Smart GnuCash CSV Export Function
function exportCSV() {
  if (!allTransactions || allTransactions.length === 0) {
    return alert("No transactions available to export.");
  }

  // Standard GnuCash CSV Importer Header Columns
  const headers = ["Date", "Description", "Account", "Transfer Account", "Amount", "Notes"];

  const rows = allTransactions.map(tx => {
    // 1. Format date to MM/DD/YYYY (required by GnuCash)
    const d = new Date(tx.date + 'T00:00:00');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const formattedDate = `${month}/${day}/${year}`;

    // 2. Fetch full account names and source account type
    const fromName = tx.from ? tx.from.name : "Unknown Account";
    const toName = tx.to ? tx.to.name : "Unknown Account";
    const fromType = tx.from ? tx.from.type : "";

    // 3. Helper to escape double quotes for CSV safety
    const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    // 4. Description logic
    const description = tx.notes ? tx.notes : `${fromName} -> ${toName}`;

    // 5. Smart Sign Adjustment:
    // Liability (Credit Card) spending needs to be negative so GnuCash increases liability balance.
    // Asset, Income, and Expense accounts remain positive.
    const rawAmount = Math.abs(Number(tx.amount));
    const adjustedAmount = (fromType === 'liability') ? -rawAmount : rawAmount;

    return [
      escape(formattedDate),
      escape(description),
      escape(fromName),
      escape(toName),
      escape(adjustedAmount.toFixed(2)),
      escape(tx.notes || '')
    ].join(',');
  });

  // Combine header and rows with standard CSV line breaks
  const csvContent = [headers.join(','), ...rows].join('\r\n');

  // Trigger browser download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `centible_gnucash_export_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatCurrency(num) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}
