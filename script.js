// --- Configuration & State ---
let products = [];
let currentUser = null;
let currentSucursal = null;
let ivaConfig = 21;
let suppliers = [];
let purchases = [];
let paymentRules = [
  { id: 'efectivo', name: 'Efectivo', discount: 10 },
  { id: 'debito', name: 'Tarjeta de Débito', discount: 0 },
  { id: 'credito', name: 'Tarjeta de Crédito', discount: 0 },
  { id: 'mercadopago', name: 'Mercado Pago (QR)', discount: 0 }
];
let promos = [];
let transactions = [];
let openingCash = 0;
let cart = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setInterval(updateDate, 1000);
});

async function initApp() {
    updateDate();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = { email: session.user.email, role: session.user.user_metadata.role || 'cajero', id: session.user.id };
        await loadInitialData();
        showMain();
    } else {
        showLogin();
    }
    
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

async function loadInitialData() {
    // Sucursal
    const { data: sucursales } = await supabase.from('sucursales').select('*').limit(1);
    currentSucursal = sucursales[0];

    // Productos
    const { data: prodData } = await supabase.from('productos').select('*');
    products = prodData || [];

    // Proveedores
    const { data: provData } = await supabase.from('proveedores').select('*');
    suppliers = provData || [];

    // Compras
    const { data: compData } = await supabase.from('compras').select('*, proveedores(name), detalle_compras(*)');
    purchases = compData?.map(c => ({
        date: new Date(c.date).toLocaleDateString(),
        prov: c.proveedores?.name,
        prod: 'Varios', // Simplificado para visualización
        qty: c.detalle_compras?.reduce((sum, d) => sum + d.qty, 0),
        cost: c.total
    })) || [];

    // Ventas (Transactions)
    const { data: salesData } = await supabase.from('ventas').select('*, detalle_ventas(qty, price, productos(name))');
    transactions = salesData?.map(s => ({
        code: s.code,
        date: new Date(s.date).toLocaleString(),
        method: s.method,
        total: s.total,
        items: s.detalle_ventas?.map(d => ({ name: d.productos?.name, qty: d.qty, price: d.price }))
    })) || [];
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

async function handleLogin() {
    const email = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.includes('@') ? email : `${email}@pos.com`, // Fallback for simple usernames
        password: pass
    });

    if (error) {
        alert('Error: ' + error.message);
    } else {
        currentUser = { email: data.user.email, role: data.user.user_metadata.role || 'cajero', id: data.user.id };
        await loadInitialData();
        showMain();
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
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
    if (!cart.length) { alert('El carrito está vacío'); return; }
    const details = document.getElementById('payment-details');
    const total = document.getElementById('total').textContent;
    details.innerHTML = `<strong>Total a cobrar: ${total}</strong><br>Medio: ${document.getElementById('payment-method').value}`;
    document.getElementById('payment-modal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function confirmPayment() {
    if (!cart.length) return;
    const tkCode = 'TK-' + Date.now().toString().slice(-6);
    const totalRaw = document.getElementById('total').textContent;
    const total = parseFloat(totalRaw.replace(/[^0-9.-]+/g, ""));
    const method = document.getElementById('payment-method').value;

    const { data: venta, error: vError } = await supabase.from('ventas').insert([{
        code: tkCode,
        total: total,
        method: method,
        user_id: currentUser.id,
        sucursal_id: currentSucursal.id
    }]).select();

    if (vError) { alert('Error al registrar venta: ' + vError.message); return; }

    const ventaId = venta[0].id;
    const detalles = cart.map(item => ({
        venta_id: ventaId,
        product_id: item.id,
        qty: item.qty,
        price: item.price
    }));

    const { error: dError } = await supabase.from('detalle_ventas').insert(detalles);
    if (dError) { alert('Error en detalle de venta: ' + dError.message); return; }

    // Update Stock
    for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (product) {
            const newStock = product.stock - item.qty;
            await supabase.from('productos').update({ stock: newStock }).eq('id', item.id);
        }
    }

    const tx = {
        code: tkCode,
        date: new Date().toLocaleString(),
        method: method,
        total: total,
        items: [...cart]
    };

    transactions.unshift(tx);
    cart = [];
    localStorage.removeItem('pos_cart'); // Clean up old cart if any
    
    await loadInitialData(); // Refresh state
    showReceipt(tx);
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
    document.getElementById('overlay').classList.add('active');
}

function finishCheckout() {
    renderAll(); 
    closePopups();
}

// --- Admin Modules ---
async function addNewProduct() {
    const code = document.getElementById('new-prod-code').value;
    const name = document.getElementById('new-prod-name').value;
    const price = parseFloat(document.getElementById('new-prod-price').value);
    const stock = parseInt(document.getElementById('new-prod-stock').value) || 0;

    if (code && name && !isNaN(price)) {
        const { error } = await supabase.from('productos').insert([{
            code, name, price, stock, 
            image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80',
            sucursal_id: currentSucursal.id
        }]);

        if (error) {
            alert('Error: ' + error.message);
        } else {
            await loadInitialData();
            renderAll();
            alert('Producto añadido');
            document.querySelectorAll('#popup-lista input').forEach(i => i.value = '');
        }
    }
}

async function addSupplier() {
    const name = document.getElementById('prov-name').value;
    const contact = document.getElementById('prov-contact').value;
    if (name) {
        const { error } = await supabase.from('proveedores').insert([{
            name, contact, sucursal_id: currentSucursal.id
        }]);
        if (error) alert(error.message); else {
            await loadInitialData();
            renderSuppliers();
            document.getElementById('prov-name').value = '';
            document.getElementById('prov-contact').value = '';
        }
    }
}

async function registerPurchase() {
    const provId = document.getElementById('compra-prov').value;
    const code = document.getElementById('compra-code').value;
    const qty = parseInt(document.getElementById('compra-qty').value);
    const cost = parseFloat(document.getElementById('compra-cost').value);

    const prod = products.find(p => p.code === code);
    if (prod && provId && qty > 0) {
        const { data: compra, error: cError } = await supabase.from('compras').insert([{
            supplier_id: provId,
            total: cost * qty,
            sucursal_id: currentSucursal.id
        }]).select();

        if (cError) { alert(cError.message); return; }

        await supabase.from('detalle_compras').insert([{
            compra_id: compra[0].id,
            product_id: prod.id,
            qty, cost
        }]);

        const newStock = prod.stock + qty;
        await supabase.from('productos').update({ stock: newStock }).eq('id', prod.id);

        await loadInitialData();
        renderAll();
        alert('Stock actualizado y compra registrada');
        document.querySelectorAll('#popup-compras input').forEach(i => i.value = '');
    } else {
        alert('Datos de compra inválidos o producto no encontrado');
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
    renderPromos();
    renderCart();
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
            <td class="admin-only">
                <button class="action-btn" style="padding: 5px 10px; font-size: 12px;" onclick="adjustStock('${p.code}')" title="Ajustar Stock"><i class="ri-edit-line"></i></button>
                <button class="btn-icon-red" onclick="deleteProduct('${p.code}')" title="Eliminar"><i class="ri-close-circle-fill"></i></button>
            </td>
        </tr>
    `).join('');
    updateUIByRole();
}

function renderSuppliers() {
    const tbody = document.getElementById('suppliers-table-body');
    tbody.innerHTML = suppliers.map(s => `<tr><td>${s.name}</td><td>${s.contact}</td><td class="admin-only"><button class="btn-icon-red" title="Eliminar"><i class="ri-close-circle-fill"></i></button></td></tr>`).join('');
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
    
    // Caja Opening & Current Cash
    const cashSales = transactions.filter(t => t.method === 'Efectivo').reduce((s,t)=>s+t.total,0);
    const totalCash = openingCash + cashSales;
    
    const cajaOpeningEl = document.getElementById('caja-monto-apertura');
    if (cajaOpeningEl) cajaOpeningEl.textContent = `$${openingCash.toFixed(2)}`;
    
    const cajaTotalEl = document.getElementById('caja-monto-total');
    if (cajaTotalEl) cajaTotalEl.textContent = `$${totalCash.toFixed(2)}`;
    
    // Reports
    const reportIncomeTotalEl = document.getElementById('report-income-total');
    if (reportIncomeTotalEl) reportIncomeTotalEl.textContent = `$${transactions.reduce((s,t)=>s+t.total,0).toFixed(2)}`;
    
    // Top Products
    const salesMap = {};
    transactions.forEach(t => t.items.forEach(i => salesMap[i.name] = (salesMap[i.name] || 0) + i.qty));
    const top = Object.entries(salesMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    document.getElementById('top-products-list').innerHTML = top.map(p => `<li>${p[0]} <strong>(${p[1]} vend.)</strong></li>`).join('');
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = [...transactions].reverse().map(t => `
        <tr><td>${t.code}</td><td>${t.date}</td><td>${t.method}</td><td>$${t.total.toFixed(2)}</td><td class="admin-only"><button class="btn-icon-red" title="Anular"><i class="ri-close-circle-fill"></i></button></td></tr>
    `).join('');
}

function populateSelects() {
    const provSelect = document.getElementById('compra-prov');
    if (provSelect) {
        provSelect.innerHTML = '<option value="">Seleccionar Proveedor</option>' + 
            suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    
    const pmSelect = document.getElementById('payment-method');
    if (pmSelect) {
        pmSelect.innerHTML = paymentRules.map(r => `<option value="${r.id}">${r.name} (${r.discount}%)</option>`).join('');
    }
}

// --- Utils ---
// Removed localStorage saveData

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
    document.querySelectorAll('.popup, .overlay').forEach(el => el.classList.remove('active'));
}

function playScanSound() {
    // console.log("BEEP!"); 
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('pos_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

async function deleteProduct(code) {
    if (confirm('Eliminar producto?')) {
        const prod = products.find(p => p.code === code);
        if (prod) {
            const { error } = await supabase.from('productos').delete().eq('id', prod.id);
            if (error) alert(error.message); else await loadInitialData();
            renderProductTable();
        }
    }
}

async function adjustStock(code) {
    const p = products.find(prod => prod.code === code);
    const newVal = prompt(`Ajustar stock para ${p.name}:`, p.stock);
    if (newVal !== null) {
        const stock = parseInt(newVal) || 0;
        const { error } = await supabase.from('productos').update({ stock }).eq('id', p.id);
        if (error) alert(error.message); else await loadInitialData();
        renderAll();
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

async function registerCajaOp() {
    const tipo = document.getElementById('caja-tipo').value;
    const monto = parseFloat(document.getElementById('caja-monto').value);
    const motivo = document.getElementById('caja-motivo').value;
    if (monto > 0) {
        const { error } = await supabase.from('caja_movimientos').insert([{
            type: tipo,
            amount: monto,
            reason: motivo,
            user_id: currentUser.id,
            sucursal_id: currentSucursal.id
        }]);

        if (error) {
            alert(error.message);
        } else {
            alert(`Operación de ${tipo} por $${monto} registrada`);
            document.getElementById('caja-monto').value = '';
            document.getElementById('caja-motivo').value = '';
            await loadInitialData();
            renderStats();
        }
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
    list.innerHTML = paymentRules.map(r => `<li><span>${r.name} (${r.discount}%)</span> <button class="btn-icon-red" onclick="removeDiscountRule('${r.id}')" title="Eliminar"><i class="ri-close-circle-fill"></i></button></li>`).join('');
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
    list.innerHTML = promos.map(p => `<li><span>Llevá ${p.take}, Pagá ${p.pay} (Código: ${p.code})</span> <button class="btn-icon-red" onclick="removePromo(${p.id})" title="Eliminar"><i class="ri-close-circle-fill"></i></button></li>`).join('');
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
