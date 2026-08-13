const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let accounts = [];

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tx-date").valueAsDate = new Date();
  
  const now = new Date();
  document.getElementById("current-month").innerText = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  loadAccounts();
  loadDashboardData();
});

// Load Accounts into dropdowns
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
}

// Load Dashboard, Balances, & Budgets
async function loadDashboardData() {
  const { data: txs, error } = await db.from("transactions").select("*, from:from_account_id(*), to:to_account_id(*)").order("date", { ascending: false });
  if (error) return console.error(error);

  renderTransactions(txs);
  calculateBudgetAndBalances(txs);
}

function calculateBudgetAndBalances(txs) {
  const balances = {};
  accounts.forEach(a => balances[a.id] = 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  txs.forEach(tx => {
    const amount = parseFloat(tx.amount);
    
    // Balance Tracking
    if (balances[tx.from_account_id] !== undefined) balances[tx.from_account_id] -= amount;
    if (balances[tx.to_account_id] !== undefined) balances[tx.to_account_id] += amount;
  });

  // Calculate Net Worth totals
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

  // Render Monthly Budget Progress
  renderBudgets(txs, currentMonth, currentYear);
}

function renderBudgets(txs, month, year) {
  const budgetContainer = document.getElementById("budget-list");
  budgetContainer.innerHTML = "";

  // Filter accounts with monthly budgets set
  const budgetedAccounts = accounts.filter(a => parseFloat(a.budget_monthly) > 0);

  budgetedAccounts.forEach(acc => {
    // Sum relevant transactions for current month
    const monthlySpent = txs.reduce((sum, tx) => {
      const txDate = new Date(tx.date);
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

function renderTransactions(txs) {
  const list = document.getElementById("transaction-list");
  list.innerHTML = "";

  if (txs.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-slate-500 text-sm">No transactions logged yet.</div>`;
    return;
  }

  txs.slice(0, 10).forEach(tx => {
    const item = document.createElement("div");
    item.className = "p-3.5 flex justify-between items-center text-sm";
    item.innerHTML = `
      <div>
        <p class="font-semibold text-slate-200">${tx.from ? tx.from.name : 'Unknown'} → ${tx.to ? tx.to.name : 'Unknown'}</p>
        <p class="text-xs text-slate-400">${tx.date}</p>
      </div>
      <span class="font-bold text-emerald-400">${formatCurrency(tx.amount)}</span>
    `;
    list.appendChild(item);
  });
}

// Form Submission
async function handleSaveTransaction(e) {
  e.preventDefault();

  const from_account_id = document.getElementById("from-account").value;
  const to_account_id = document.getElementById("to-account").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("tx-date").value;

  const { error } = await db.from("transactions").insert([{ from_account_id, to_account_id, amount, date }]);

  if (error) {
    alert("Error saving transaction: " + error.message);
  } else {
    closeModal();
    document.getElementById("tx-form").reset();
    document.getElementById("tx-date").valueAsDate = new Date();
    loadDashboardData();
  }
}

function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }

function formatCurrency(num) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}