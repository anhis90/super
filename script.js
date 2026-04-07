// --- Configuration & State ---
let products = JSON.parse(localStorage.getItem('pos_products')) || [
  { code: '001', name: 'Leche Descremada 1L', price: 1200, stock: 50, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80' },
  { code: '002', name: 'Pan Lactal Blanco', price: 950, stock: 30, image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?auto=format&fit=crop&w=200&q=80' },
  { code: '003', name: 'Queso Cremoso x Kg', price: 4500, stock: 15, image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=200&q=80' },
  { code: '004', name: 'Gaseosa Cola 2.25L', price: 1500, stock: 100, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=200&q=80' }
];

let cart = [];
let currentUser = JSON.parse(localStorage.getItem('pos_user')) || null;
let ivaConfig = parseFloat(localStorage.getItem('pos_iva')) || 21;
let suppliers = JSON.parse(localStorage.getItem('pos_suppliers')) || [];
let purchases = JSON.parse(localStorage.getItem('pos_purchases')) || [];
let paymentRules = JSON.parse(localStorage.getItem('pos_payment_rules')) || [
  { id: 'efectivo', name: 'Efectivo', discount: 10 },
  { id: 'debito', name: 'Tarjeta de Débito', discount: 0 },
  { id: 'credito', name: 'Tarjeta de Crédito', discount: 0 },
  { id: 'mercadopago', name: 'Mercado Pago (QR)', discount: 0 }
];
let promos = JSON.parse(localStorage.getItem('pos_promos')) || [];
let transactions = JSON.parse(localStorage.getItem('pos_transactions')) || [];
let openingCash = parseFloat(localStorage.getItem('pos_opening_cash')) || 0;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setInterval(updateDate, 1000);
});

function initApp() {
    updateDate();
    if (!currentUser) showLogin(); else showMain();
    
    // Theme
    if (localStorage.getItem('pos_theme') === 'dark') document.body.classList.add('dark');
    
    // Input Listeners
    const codeInput = document.getElementById('product-code');
    if (codeInput) {
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addProductToCart(codeInput.value);
        });
    }
}

function updateDate() {
    const el = document.getElementById('date-display');
    if (el) el.textContent = new Date().toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// --- Auth ---
function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

function showMain() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('user-role-badge').textContent = currentUser.role;
    updateUIByRole();
    renderAll();
}

function handleLogin() {
    const user = document.getElementById('login-user').value.toLowerCase();
    const pass = document.getElementById('login-pass').value;

    if ((user === 'admin' || user === 'cajero') && pass === '1234') {
        currentUser = { name: user, role: user };
        localStorage.setItem('pos_user', JSON.stringify(currentUser));
        showMain();
    } else {
        alert('Credenciales inválidas (admin/1234 o cajero/1234)');
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('pos_user');
    showLogin();
}

function updateUIByRole() {
    const adminElems = document.querySelectorAll('.admin-only');
    adminElems.forEach(el => el.style.display = currentUser.role === 'admin' ? 'block' : 'none');
}

// --- Cart & Stock ---
function searchProducts(query) {
    const results = document.getElementById('search-results');
    if (!query) { results.style.display = 'none'; return; }
    
    const matches = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.code.includes(query));
    results.innerHTML = matches.map(p => `<div class="search-item" onclick="addProductToCart('${p.code}')">${p.name} - $${p.price} (Stock: ${p.stock})</div>`).join('');
    results.style.display = 'block';
}

function addProductToCart(code) {
    document.getElementById('search-results').style.display = 'none';
    const product = products.find(p => p.code === code);
    if (!product) { alert('Producto no encontrado'); return; }
    
    if (product.stock <= 0) { alert('Sin stock disponible!'); return; }
    
    const cartIdx = cart.findIndex(item => item.code === code);
    if (cartIdx > -1) {
        if (cart[cartIdx].qty + 1 > product.stock) { alert('No hay suficiente stock'); return; }
        cart[cartIdx].qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    
    playScanSound();
    showPreview(product);
    renderCart();
    document.getElementById('product-code').value = '';
    document.getElementById('product-code').focus();
}

function showPreview(p) {
    const container = document.getElementById('product-preview');
    container.innerHTML = `
        <div class="scanned-product">
            <img src="${p.image}" alt="">
            <h3>${p.name}</h3>
            <p class="price">$${p.price.toFixed(2)}</p>
            <p style="color: ${p.stock < 5 ? 'var(--danger)' : 'inherit'}">Stock: ${p.stock}</p>
        </div>
    `;
}

function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let subtotal = 0;

    cart.forEach((item, idx) => {
        subtotal += item.price * item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-price">$${item.price} x ${item.qty}</span>
            </div>
            <div class="item-actions">
                <button onclick="changeQty(${idx}, 1)">+</button>
                <span class="qty">${item.qty}</span>
                <button onclick="changeQty(${idx}, -1)">-</button>
            </div>
        `;
        container.appendChild(div);
    });

    calculateTotals(subtotal);
}

function changeQty(idx, delta) {
    const item = cart[idx];
    const product = products.find(p => p.code === item.code);
    if (delta > 0 && item.qty + delta > product.stock) { alert('Sin stock suficiente'); return; }
    item.qty += delta;
    if (item.qty <= 0) cart.splice(idx, 1);
    renderCart();
}

function calculateTotals(subtotal) {
    let promoDiscount = 0;
    cart.forEach(item => {
        const promo = promos.find(p => p.code === item.code);
        if (promo && item.qty >= promo.take) {
            const groups = Math.floor(item.qty / promo.take);
            const freePerGroup = promo.take - promo.pay;
            promoDiscount += groups * freePerGroup * item.price;
        }
    });

    const pm = document.getElementById('payment-method').value;
    const rule = paymentRules.find(r => r.id === pm) || { discount: 0 };
    const discAmount = (subtotal - promoDiscount) * (rule.discount / 100) + promoDiscount;
    const taxAmount = (subtotal - discAmount) * (ivaConfig / 100);
    const total = subtotal - discAmount + taxAmount;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('iva-amount').textContent = `$${taxAmount.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    
    if (discAmount > 0) {
        document.getElementById('discount-row').style.display = 'flex';
        document.getElementById('discount-percent').textContent = rule.discount;
        document.getElementById('discount-amount').textContent = `-$${discAmount.toFixed(2)}`;
    } else {
        document.getElementById('discount-row').style.display = 'none';
    }
}

// --- Payment & Checkout ---
function openPaymentModal() {
    if (!cart.length) return;
    const details = document.getElementById('payment-details');
    const total = document.getElementById('total').textContent;
    details.innerHTML = `<strong>Total a cobrar: ${total}</strong><br>Medio: ${document.getElementById('payment-method').value}`;
    document.getElementById('payment-modal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function confirmPayment() {
    const tkCode = 'TK-' + Date.now().toString().slice(-6);
    const total = parseFloat(document.getElementById('total').textContent.replace('$',''));
    
    // Decrement Stock
    cart.forEach(item => {
        const p = products.find(prod => prod.code === item.code);
        if (p) p.stock -= item.qty;
    });
    
    const tx = {
        code: tkCode,
        date: new Date().toLocaleString(),
        method: document.getElementById('payment-method').value,
        total: total,
        items: [...cart]
    };
    
    transactions.push(tx);
    saveData();
    showReceipt(tx);
    finishCheckout();
}

function showReceipt(tx) {
    const rec = document.getElementById('receipt-summary');
    rec.innerHTML = `
        <h3>TICKET PRO - ${tx.code}</h3>
        <p>${tx.date}</p><hr>
        ${tx.items.map(i => `<div>${i.name} x${i.qty} - $${(i.price*i.qty).toFixed(2)}</div>`).join('')}
        <hr>
        <div class="total-p">TOTAL: $${tx.total.toFixed(2)}</div>
        <p>IVA Incluy. (${ivaConfig}%)</p>
    `;
    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('checkout-overlay').classList.add('active');
}

function finishCheckout() {
    cart = [];
    renderCart();
    renderAll(); // Updates tables and stats
    document.getElementById('payment-modal').classList.remove('active');
}

// --- Admin Modules ---
function addNewProduct() {
    const code = document.getElementById('new-prod-code').value;
    const name = document.getElementById('new-prod-name').value;
    const price = parseFloat(document.getElementById('new-prod-price').value);
    const stock = parseInt(document.getElementById('new-prod-stock').value) || 0;

    if (code && name && !isNaN(price)) {
        products.push({ code, name, price, stock, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' });
        saveData();
        renderAll();
        alert('Producto añadido');
    }
}

function addSupplier() {
    const name = document.getElementById('prov-name').value;
    const contact = document.getElementById('prov-contact').value;
    if (name) {
        suppliers.push({ name, contact });
        saveData();
        renderSuppliers();
    }
}

function registerPurchase() {
    const prov = document.getElementById('compra-prov').value;
    const code = document.getElementById('compra-code').value;
    const qty = parseInt(document.getElementById('compra-qty').value);
    const cost = parseFloat(document.getElementById('compra-cost').value);

    const prod = products.find(p => p.code === code);
    if (prod && prov && qty > 0) {
        prod.stock += qty;
        purchases.push({ date: new Date().toLocaleDateString(), prov, prod: prod.name, qty, cost });
        saveData();
        renderAll();
        alert('Stock actualizado');
    } else {
        alert('Datos de compra inválidos');
    }
}

// --- Rendering ---
function renderAll() {
    renderProductTable();
    renderSuppliers();
    renderPurchases();
    renderStats();
    renderTransactions();
    populateSelects();
    renderDiscountRules();
}

function renderProductTable() {
    const tbody = document.getElementById('product-table-body');
    tbody.innerHTML = products.map(p => `
        <tr>
            <td>${p.code}</td>
            <td><img src="${p.image}" width="30"></td>
            <td>${p.name}</td>
            <td>$${p.price}</td>
            <td class="${p.stock < 5 ? 'stock-low' : ''}">${p.stock}</td>
            <td class="admin-only"><button onclick="deleteProduct('${p.code}')" style="color:red">X</button></td>
        </tr>
    `).join('');
    updateUIByRole();
}

function renderSuppliers() {
    const tbody = document.getElementById('suppliers-table-body');
    tbody.innerHTML = suppliers.map(s => `<tr><td>${s.name}</td><td>${s.contact}</td><td class="admin-only"><button>X</button></td></tr>`).join('');
}

function renderPurchases() {
    const tbody = document.getElementById('purchases-table-body');
    tbody.innerHTML = purchases.map(p => `<tr><td>${p.date}</td><td>${p.prov}</td><td>${p.prod}</td><td>${p.qty}</td><td>$${p.cost}</td></tr>`).join('');
}

function renderStats() {
    const today = new Date().toLocaleDateString();
    const todaySales = transactions.filter(t => t.date.includes(today));
    const totalToday = todaySales.reduce((s, t) => s + t.total, 0);
    const lowStock = products.filter(p => p.stock < 5).length;

    document.getElementById('dashboard-ventas-dia').textContent = `$${totalToday.toFixed(2)}`;
    document.getElementById('dashboard-operaciones').textContent = todaySales.length;
    document.getElementById('dashboard-low-stock').textContent = lowStock;
    document.getElementById('dashboard-low-stock').style.color = lowStock > 0 ? 'var(--danger)' : 'var(--success)';
    
    // Reports
    document.getElementById('report-income-total').textContent = `$${transactions.reduce((s,t)=>s+t.total,0).toFixed(2)}`;
    
    // Top Products
    const salesMap = {};
    transactions.forEach(t => t.items.forEach(i => salesMap[i.name] = (salesMap[i.name] || 0) + i.qty));
    const top = Object.entries(salesMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    document.getElementById('top-products-list').innerHTML = top.map(p => `<li>${p[0]} <strong>(${p[1]} vend.)</strong></li>`).join('');
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = [...transactions].reverse().map(t => `
        <tr><td>${t.code}</td><td>${t.date}</td><td>${t.method}</td><td>$${t.total.toFixed(2)}</td><td class="admin-only"><button>X</button></td></tr>
    `).join('');
}

function populateSelects() {
    const provSelect = document.getElementById('compra-prov');
    provSelect.innerHTML = '<option value="">Seleccionar Proveedor</option>' + suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    
    const pmSelect = document.getElementById('payment-method');
    pmSelect.innerHTML = paymentRules.map(r => `<option value="${r.id}">${r.name} (${r.discount}%)</option>`).join('');
}

// --- Utils ---
function saveData() {
    localStorage.setItem('pos_products', JSON.stringify(products));
    localStorage.setItem('pos_suppliers', JSON.stringify(suppliers));
    localStorage.setItem('pos_purchases', JSON.stringify(purchases));
    localStorage.setItem('pos_transactions', JSON.stringify(transactions));
}

function exportData(type) {
    const data = type === 'products' ? products : transactions;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos_${type}_${Date.now()}.json`;
    a.click();
}

function openPopup(id) {
    document.getElementById(`popup-${id}`).classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function closePopups() {
    document.querySelectorAll('.popup, .checkout-modal, .overlay').forEach(el => el.classList.remove('active'));
    document.getElementById('checkout-overlay').classList.remove('active');
}

function playScanSound() {
    // console.log("BEEP!"); 
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('pos_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

function deleteProduct(code) {
    if (confirm('Eliminar producto?')) {
        products = products.filter(p => p.code !== code);
        saveData(); renderProductTable();
    }
}

function setOpeningCash() {
    const val = parseFloat(document.getElementById('opening-cash-input-caja').value);
    if (!isNaN(val)) {
        openingCash = val;
        localStorage.setItem('pos_opening_cash', openingCash);
        renderStats();
        alert('Monto establecido');
    }
}

function registerCajaOp() {
    const tipo = document.getElementById('caja-tipo').value;
    const monto = parseFloat(document.getElementById('caja-monto').value);
    const motivo = document.getElementById('caja-motivo').value;
    if (monto > 0) {
        alert(`Operación de ${tipo} por $${monto} registrada (Motivo: ${motivo})`);
        document.getElementById('caja-monto').value = '';
        document.getElementById('caja-motivo').value = '';
    }
}

function updateIVAConfig(val) {
    ivaConfig = parseFloat(val);
    localStorage.setItem('pos_iva', ivaConfig);
    renderCart();
}

function addDiscountRule() {
    const name = document.getElementById('desc-name').value;
    const val = parseFloat(document.getElementById('desc-value').value);
    if (name && !isNaN(val)) {
        paymentRules.push({ id: name.toLowerCase().replace(/ /g,''), name, discount: val });
        localStorage.setItem('pos_payment_rules', JSON.stringify(paymentRules));
        renderAll();
    }
}

function renderDiscountRules() {
    const list = document.getElementById('discounts-list');
    if (!list) return;
    list.innerHTML = paymentRules.map(r => `<li>${r.name} (${r.discount}%) <button onclick="removeDiscountRule('${r.id}')">X</button></li>`).join('');
}

function removeDiscountRule(id) {
    paymentRules = paymentRules.filter(r => r.id !== id);
    localStorage.setItem('pos_payment_rules', JSON.stringify(paymentRules));
    renderAll();
}

function addPromotion() {
    const code = document.getElementById('promo-code').value;
    const take = parseInt(document.getElementById('promo-take').value);
    const pay = parseInt(document.getElementById('promo-pay').value);
    if (code && take > pay) {
        promos.push({ id: Date.now(), code, take, pay });
        localStorage.setItem('pos_promos', JSON.stringify(promos));
        renderPromos();
    }
}

function renderPromos() {
    const list = document.getElementById('promo-list');
    if (!list) return;
    list.innerHTML = promos.map(p => `<li>Llevá ${p.take}, Pagá ${p.pay} (Código: ${p.code}) <button onclick="removePromo(${p.id})">X</button></li>`).join('');
}

function removePromo(id) {
    promos = promos.filter(p => p.id !== id);
    localStorage.setItem('pos_promos', JSON.stringify(promos));
    renderPromos();
}

function clearTransactions() {
    if (confirm('¿Borrar todo el historial?')) {
        transactions = [];
        localStorage.setItem('pos_transactions', JSON.stringify(transactions));
        renderAll();
    }
}
