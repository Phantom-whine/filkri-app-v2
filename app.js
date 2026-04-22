const App = (function() {
  const STORAGE_KEYS = {
    TOKEN: 'fk_token_v1',
    USER: 'fk_user_v1',
    PRODUCTS: 'fk_products_v1',
    SALES: 'fk_sales_v1',
    SUPPLIERS: 'fk_suppliers_v1',
    MOVEMENTS: 'fk_movements_v1',
    SETTINGS: 'fk_settings_v1'
  };

  // Registered users with roles
  const USERS = [
    { email: 'admin@fikristore.com', password: 'admin123', name: 'Mr. Collins', role: 'admin' },
    { email: 'staff@fikristore.com',  password: 'staff123',  name: 'Staff User',  role: 'staff'  }
  ];

  function initStorage() {
    Object.keys(STORAGE_KEYS).forEach(key => {
      if (!localStorage.getItem(STORAGE_KEYS[key])) {
        if (key === 'SETTINGS') {
          localStorage.setItem(STORAGE_KEYS[key], JSON.stringify({ nextSaleId: 1000, nextMovementId: 1, shopName: 'My Shop' }));
        } else {
          localStorage.setItem(STORAGE_KEYS[key], JSON.stringify([]));
        }
      }
    });
    // Ensure shopName exists in existing settings
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
    if (!s.shopName) { s.shopName = 'My Shop'; localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s)); }
  }

  function checkOnline() {
    if (!navigator.onLine) {
      alert('⚠️ No Internet Connection\n\nThis app requires an active internet connection to function. Please connect to Wi-Fi or mobile data and restart the app.');
      return false;
    }
    return true;
  }

  window.addEventListener('offline', () => {
    alert('⚠️ Connection Lost\n\nYou went offline. The app requires internet to work properly.');
  });

  window.addEventListener('online', () => {
    App.toast('Back online', 'wifi');
  });

  function generateToken(user) {
    const header = btoa(JSON.stringify({alg: 'none', typ: 'JWT'}));
    const payload = btoa(JSON.stringify({
      sub: user.email,
      name: user.name,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    }));
    return `${header}.${payload}.signature`;
  }

  function parseToken(token) {
    try {
      const parts = token.split('.');
      return JSON.parse(atob(parts[1]));
    } catch (e) { return null; }
  }

  return {
    init() {
      initStorage();
      checkOnline();
    },

    isAuth() {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) return false;
      const payload = parseToken(token);
      if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        return false;
      }
      return true;
    },

    isAdmin() {
      const user = this.getUser();
      return user && user.role === 'admin';
    },

    login(email, password) {
      const found = USERS.find(u => u.email === email && u.password === password);
      if (found) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, generateToken(found));
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ email: found.email, name: found.name, role: found.role }));
        return true;
      }
      return false;
    },

    logout() {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      window.location.href = 'login.html';
    },

    getUser() {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    },

    getProducts() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]'); },
    getSales() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES) || '[]'); },
    getSuppliers() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPPLIERS) || '[]'); },
    getMovements() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.MOVEMENTS) || '[]'); },
    getSettings() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}'); },

    saveProducts(data) { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data)); },
    saveSales(data) { localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(data)); },
    saveSuppliers(data) { localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(data)); },
    saveMovements(data) { localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(data)); },
    saveSettings(data) { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data)); },

    // Shop Name
    getShopName() {
      return this.getSettings().shopName || 'My Shop';
    },
    saveShopName(name) {
      const s = this.getSettings();
      s.shopName = name.trim() || 'My Shop';
      this.saveSettings(s);
    },

    totalRevenue() {
      return this.getSales().filter(s => s.status !== 'Cancelled').reduce((a, b) => a + b.revenue, 0);
    },
    totalProfit() {
      return this.getSales().filter(s => s.status !== 'Cancelled').reduce((a, b) => a + b.profit, 0);
    },
    totalLogistics() {
      return this.getSales().filter(s => s.status !== 'Cancelled').reduce((a, b) => a + (b.logistics || 0), 0);
    },
    inventoryValue() {
      return this.getProducts().reduce((a, b) => a + (b.stock * b.costPrice), 0);
    },
    totalStock() {
      return this.getProducts().reduce((a, b) => a + b.stock, 0);
    },
    itemsSold() {
      return this.getSales().filter(s => s.status === 'Completed').reduce((a, b) => a + b.qty, 0);
    },
    totalCOGS() {
      return this.getSales().filter(s => s.status !== 'Cancelled').reduce((a, s) => {
        const p = this.getProductById(s.productId);
        return a + (s.qty * (s.costPrice !== undefined ? s.costPrice : (p?.costPrice || 0)));
      }, 0);
    },
    purchaseCost() {
      return this.getMovements().filter(m => m.type === 'in').reduce((a, m) => {
        const p = this.getProductById(m.productId);
        return a + (m.qty * (p?.costPrice || 0));
      }, 0);
    },
    getProductById(id) {
      return this.getProducts().find(p => p.id === id) || null;
    },
    getProductSoldUnits(id) {
      return this.getSales().filter(s => s.productId === id && s.status !== 'Cancelled').reduce((a, b) => a + b.qty, 0);
    },
    getProductRevenue(id) {
      return this.getSales().filter(s => s.productId === id && s.status !== 'Cancelled').reduce((a, b) => a + b.revenue, 0);
    },

    randColor() {
      const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6', '#8b5cf6'];
      return colors[Math.floor(Math.random() * colors.length)];
    },

    fmtDate(d = new Date()) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    },

    nextSaleId() {
      const s = this.getSettings();
      const id = s.nextSaleId || 1000;
      s.nextSaleId = id + 1;
      this.saveSettings(s);
      return id;
    },

    nextMovementId() {
      const s = this.getSettings();
      const id = s.nextMovementId || 1;
      s.nextMovementId = id + 1;
      this.saveSettings(s);
      return id;
    },

    toast(msg, icon = 'check') {
      const existing = document.querySelector('.app-toast');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.className = 'app-toast fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[60] text-sm font-medium transition-all duration-300';
      const iconColor = icon === 'check' ? 'text-green-400' : icon === 'xmark' ? 'text-red-400' : 'text-orange-400';
      el.innerHTML = `<i class="fa-solid fa-${icon} ${iconColor}"></i><span>${msg}</span>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; });
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, 10px)';
        setTimeout(() => el.remove(), 300);
      }, 2500);
    },

    // ── Export CSV (Median.co / WebView compatible) ──────────────────
    // Uses base64 data URI instead of createObjectURL so it works in
    // Android/iOS WebViews exposed via Median.co.
    exportCSV(filename, headers, rows) {
      const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');

      // Try Median native bridge first (if running inside Median app)
      if (window.median && window.median.share && window.median.share.downloadUrl) {
        // Encode as data URI and let Median handle it
        const b64 = btoa(unescape(encodeURIComponent(csvContent)));
        window.median.share.downloadUrl({ url: 'data:text/csv;base64,' + b64, filename });
        this.toast('Exported!', 'check');
        return;
      }

      // Standard browsers: use <a download> with data URI
      try {
        const b64 = btoa(unescape(encodeURIComponent(csvContent)));
        const a = document.createElement('a');
        a.href = 'data:text/csv;base64,' + b64;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.toast('Exported!', 'check');
      } catch (err) {
        // Last fallback: open in new tab
        const w = window.open('', '_blank');
        if (w) {
          w.document.write('<pre>' + csvContent + '</pre>');
          w.document.title = filename;
        }
        this.toast('Opened in new tab', 'file-csv');
      }
    },

    // ── Printable Receipt ────────────────────────────────────────────
    downloadReceipt(saleId) {
      const sale = this.getSales().find(s => s.id === saleId);
      if (!sale) { this.toast('Sale not found', 'xmark'); return; }
      const product = this.getProductById(sale.productId);
      const shopName = this.getShopName();
      const user = this.getUser();

      const unitPrice = sale.unitPrice || (sale.revenue / sale.qty);
      const cogs = (sale.costPrice || 0) * sale.qty;
      const logistics = sale.logistics || 0;
      const profit = sale.profit;
      const margin = sale.revenue > 0 ? Math.round((profit / sale.revenue) * 100) : 0;

      const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Receipt #${sale.id} — ${shopName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Outfit', sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 24px 16px; }
  .receipt { background: #fff; border-radius: 20px; box-shadow: 0 4px 40px rgba(0,0,0,0.10); width: 100%; max-width: 400px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 28px 24px 20px; color: #fff; text-align: center; }
  .header .icon { width: 52px; height: 52px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; }
  .header h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { font-size: 12px; opacity: 0.85; margin-top: 4px; }
  .status-band { text-align: center; padding: 10px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .status-completed { background: #dcfce7; color: #15803d; }
  .status-pending { background: #fef3c7; color: #b45309; }
  .status-cancelled { background: #f1f5f9; color: #64748b; }
  .body { padding: 20px 24px; }
  .meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1.5px dashed #e2e8f0; }
  .meta-item { text-align: center; }
  .meta-item .label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; }
  .meta-item .value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 3px; font-family: 'DM Mono', monospace; }
  .product-block { background: #f8fafc; border-radius: 12px; padding: 14px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
  .product-avatar { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 800; flex-shrink: 0; }
  .product-avatar img { width: 42px; height: 42px; border-radius: 10px; object-fit: cover; }
  .product-info h2 { font-size: 14px; font-weight: 700; color: #1e293b; }
  .product-info p { font-size: 10px; color: #64748b; margin-top: 2px; }
  .line-items { margin-bottom: 20px; }
  .line { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 12px; }
  .line .lbl { color: #64748b; font-weight: 500; }
  .line .val { font-family: 'DM Mono', monospace; font-weight: 700; color: #1e293b; }
  .line .val.red { color: #ef4444; }
  .line .val.green { color: #16a34a; }
  .divider { border: none; border-top: 1.5px dashed #e2e8f0; margin: 8px 0; }
  .total-block { background: linear-gradient(135deg, #fff7ed, #ffedd5); border: 1.5px solid #fed7aa; border-radius: 12px; padding: 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .total-block .lbl { font-size: 11px; font-weight: 700; color: #c2410c; }
  .total-block .val { font-size: 20px; font-weight: 800; color: #ea580c; font-family: 'DM Mono', monospace; }
  .profit-block { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .profit-block .lbl { font-size: 11px; font-weight: 700; color: #15803d; }
  .profit-block .val { font-size: 15px; font-weight: 800; color: #16a34a; font-family: 'DM Mono', monospace; }
  .footer { text-align: center; padding: 16px 24px 20px; border-top: 1.5px dashed #e2e8f0; }
  .footer p { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  .footer .thanks { font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .barcode { margin: 12px auto 0; font-family: 'DM Mono', monospace; font-size: 11px; color: #cbd5e1; letter-spacing: 3px; }
  @media print {
    body { background: #fff; padding: 0; }
    .receipt { box-shadow: none; border-radius: 0; max-width: 100%; }
    .no-print { display: none !important; }
  }
  .btn-row { display: flex; gap: 10px; padding: 0 24px 20px; }
  .btn { flex: 1; padding: 11px; border-radius: 12px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.15s; }
  .btn:active { opacity: 0.8; }
  .btn-print { background: #f97316; color: #fff; }
  .btn-close { background: #f1f5f9; color: #475569; }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div class="icon">🏪</div>
    <h1>${shopName}</h1>
    <p>Sales Receipt</p>
  </div>
  <div class="status-band status-${sale.status.toLowerCase()}">${sale.status}</div>
  <div class="body">
    <div class="meta">
      <div class="meta-item">
        <div class="label">Order ID</div>
        <div class="value">#${sale.id}</div>
      </div>
      <div class="meta-item">
        <div class="label">Date</div>
        <div class="value">${sale.date}</div>
      </div>
      <div class="meta-item">
        <div class="label">Served By</div>
        <div class="value">${user.name || '—'}</div>
      </div>
    </div>

    <div class="product-block">
      ${product?.image
        ? `<img src="${product.image}" alt="${product.name}" class="product-avatar">`
        : `<div class="product-avatar" style="background:${product?.avatarBg || '#94a3b8'}">${product ? product.name.charAt(0) : 'P'}</div>`
      }
      <div class="product-info">
        <h2>${product?.name || 'Deleted Product'}</h2>
        <p>${product?.sku || '—'} · ${product?.category || '—'}</p>
      </div>
    </div>

    <div class="line-items">
      <div class="line"><span class="lbl">Unit Sale Price</span><span class="val">₦${unitPrice.toLocaleString()}</span></div>
      <div class="line"><span class="lbl">Unit Cost Price</span><span class="val">₦${(sale.costPrice || 0).toLocaleString()}</span></div>
      <div class="line"><span class="lbl">Quantity</span><span class="val">× ${sale.qty} units</span></div>
      <hr class="divider">
      <div class="line"><span class="lbl">Subtotal</span><span class="val">₦${sale.revenue.toLocaleString()}</span></div>
      <div class="line"><span class="lbl">Cost of Goods</span><span class="val red">−₦${cogs.toLocaleString()}</span></div>
      ${logistics > 0 ? `<div class="line"><span class="lbl">Logistics</span><span class="val red">−₦${logistics.toLocaleString()}</span></div>` : ''}
      <div class="line"><span class="lbl">Margin</span><span class="val ${margin >= 0 ? 'green' : 'red'}">${margin}%</span></div>
    </div>

    <div class="total-block">
      <span class="lbl">TOTAL REVENUE</span>
      <span class="val">₦${sale.revenue.toLocaleString()}</span>
    </div>

    <div class="profit-block">
      <span class="lbl">NET PROFIT</span>
      <span class="val">${profit >= 0 ? '+' : '−'}₦${Math.abs(profit).toLocaleString()}</span>
    </div>
  </div>

  <div class="btn-row no-print">
    <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
    <button class="btn btn-close" onclick="window.close()">✕ Close</button>
  </div>

  <div class="footer">
    <p class="thanks">Thank you for your business!</p>
    <p>Generated by ${shopName} · ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}</p>
    <p class="barcode">||||||||||||||||||||||||</p>
  </div>
</div>
</body>
</html>`;

      // Try Median native bridge
      if (window.median && window.median.window && window.median.window.open) {
        const b64 = btoa(unescape(encodeURIComponent(receiptHtml)));
        window.median.window.open({ url: 'data:text/html;base64,' + b64 });
        return;
      }
      // Standard: open in new tab / window
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(receiptHtml);
        w.document.close();
      } else {
        // Fallback: navigate to data URI (some mobile browsers)
        const b64 = btoa(unescape(encodeURIComponent(receiptHtml)));
        window.location.href = 'data:text/html;base64,' + b64;
      }
    }
  };
})();