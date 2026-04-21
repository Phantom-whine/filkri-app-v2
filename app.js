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

  function initStorage() {
    Object.keys(STORAGE_KEYS).forEach(key => {
      if (!localStorage.getItem(STORAGE_KEYS[key])) {
        if (key === 'SETTINGS') {
          localStorage.setItem(STORAGE_KEYS[key], JSON.stringify({nextSaleId: 1000, nextMovementId: 1}));
        } else {
          localStorage.setItem(STORAGE_KEYS[key], JSON.stringify([]));
        }
      }
    });
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

  function generateToken(email) {
    const header = btoa(JSON.stringify({alg: 'none', typ: 'JWT'}));
    const payload = btoa(JSON.stringify({
      sub: email,
      name: 'Fikri',
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

    login(email, password) {
      if (email === 'admin@fikristore.com' && password === 'password') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, generateToken(email));
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({email, name: 'Fikri'}));
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

    exportCSV(filename, headers, rows) {
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csv], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      this.toast('Exported!', 'check');
    }
  };
})();