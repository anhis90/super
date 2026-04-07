// --- Data ---
let products = JSON.parse(localStorage.getItem('pos_products')) || [
  { code: '001', name: 'Leche Descremada 1L', price: 1200, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80' },
  { code: '002', name: 'Pan Lactal Blanco', price: 950, image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?auto=format&fit=crop&w=200&q=80' },
  { code: '003', name: 'Queso Cremoso x Kg', price: 4500, image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=200&q=80' },
  { code: '004', name: 'Gaseosa Cola 2.25L', price: 1500, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=200&q=80' },
  { code: '005', name: 'Yerba Mate 500g', price: 1800, image: 'https://images.unsplash.com/photo-1594848375528-91ed3495f5bd?auto=format&fit=crop&w=200&q=80' },
  { code: '006', name: 'Fideos Tallarines 500g', price: 800, image: 'https://images.unsplash.com/photo-1612800164805-4e78263309a6?auto=format&fit=crop&w=200&q=80' }
];

let cart = [];
let globalDiscount = 0;

let paymentRules = JSON.parse(localStorage.getItem('pos_payment_rules')) || [
  { id: 'efectivo', name: 'Efectivo', discount: 10 },
  { id: 'debito', name: 'Tarjeta de Débito', discount: 0 },
  { id: 'credito', name: 'Tarjeta de Crédito', discount: 0 },
  { id: 'mercadopago', name: 'Mercado Pago (QR)', discount: 0 }
];

let promos = JSON.parse(localStorage.getItem('pos_promos')) || [
  { id: 1, type: 'NxM', code: '004', take: 3, pay: 2, text: 'Promoción: 3x2 en Gaseosa Cola (Cod: 004)' }
];

let transactions = [];
let openingCash = parseFloat(localStorage.getItem('pos_opening_cash')) || 0;

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  updateDate();
  setInterval(updateDate, 1000);
  
  // load transactions
  transactions = JSON.parse(localStorage.getItem('pos_transactions')) || [];
  
  // Load theme
  if (localStorage.getItem('pos_theme') === 'dark') {
    document.body.classList.add('dark');
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="ri-sun-line"></i>';
    }
  }

  populateProductTable();
  renderPaymentMethods();
  renderDiscountRules();
  renderPromos();
  updateDashboardAndTransactions();
  
  const codeInput = document.getElementById('product-code');
  const addBtn = document.getElementById('add-btn');

  if (codeInput) {
    codeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addProductToCart(codeInput.value);
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addProductToCart(codeInput.value);
    });
  }
});

function updateDate() {
  const dateDisplay = document.getElementById('date-display');
  if (!dateDisplay) return;
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' };
  dateDisplay.textContent = now.toLocaleDateString('es-ES', options);
}

// --- Cart Logic ---
function addProductToCart(code) {
  const product = products.find(p => p.code === code);
  const codeInput = document.getElementById('product-code');
  
  if (product) {
    const existingItem = cart.find(item => item.product.code === code);
    if (existingItem) {
      existingItem.qty++;
    } else {
      cart.push({ product, qty: 1 });
    }
    
    showProductPreview(product);
    renderCart();
    
    if (codeInput) {
      codeInput.value = '';
      codeInput.focus();
    }
  } else {
    alert('Producto no encontrado!');
    if (codeInput) codeInput.select();
  }
}

function addNewProduct() {
  const code = document.getElementById('new-prod-code').value;
  const name = document.getElementById('new-prod-name').value;
  const price = parseFloat(document.getElementById('new-prod-price').value);

  if (code && name && !isNaN(price)) {
    if (products.find(p => p.code === code)) {
      alert('El código ya existe');
      return;
    }
    products.push({ code, name, price, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' });
    localStorage.setItem('pos_products', JSON.stringify(products));
    populateProductTable();
    document.getElementById('new-prod-code').value = '';
    document.getElementById('new-prod-name').value = '';
    document.getElementById('new-prod-price').value = '';
    alert('Producto agregado');
  } else {
    alert('Complete todos los campos válidamente');
  }
}

function showProductPreview(product) {
  const previewContainer = document.getElementById('product-preview');
  if (!previewContainer) return;
  previewContainer.innerHTML = `
    <div class="scanned-product">
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <div class="price">$${product.price.toFixed(2)}</div>
    </div>
  `;
}

function renderCart() {
  const cartContainer = document.getElementById('cart-items');
  if (!cartContainer) return;
  cartContainer.innerHTML = '';
  
  let subtotal = 0;
  let totalPromoDiscount = 0;

  cart.forEach((item, index) => {
    let itemTotal = item.product.price * item.qty;
    subtotal += itemTotal;
    
    let promoDiscThisItem = 0;
    const applicablePromo = promos.find(p => p.type === 'NxM' && p.code === item.product.code);
    if(applicablePromo && applicablePromo.take <= item.qty) {
      const freeGroups = Math.floor(item.qty / applicablePromo.take);
      const itemsFreePerGroup = applicablePromo.take - applicablePromo.pay;
      promoDiscThisItem = freeGroups * itemsFreePerGroup * item.product.price;
    }
    totalPromoDiscount += promoDiscThisItem;
    
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <div class="item-info">
        <span class="item-name">${item.product.name}</span>
        <span class="item-price">$${item.product.price.toFixed(2)} x ${item.qty} = $${itemTotal.toFixed(2)} 
        ${promoDiscThisItem > 0 ? `<br><small style="color:var(--success)">Ahorro promo: -$${promoDiscThisItem.toFixed(2)}</small>` : ''}</span>
      </div>
      <div class="item-actions">
        <span class="qty">${item.qty}</span>
        <button class="remove-btn" onclick="removeItem(${index})"><i class="ri-delete-bin-line"></i></button>
      </div>
    `;
    cartContainer.appendChild(cartItem);
  });

  updateTotals(subtotal, totalPromoDiscount);
}

function removeItem(index) {
  cart.splice(index, 1);
  renderCart();
}

function updateTotals(subtotal, totalPromoDiscount = 0) {
  const pmSelect = document.getElementById('payment-method');
  let pmDiscount = 0;
  if(pmSelect) {
    const r = paymentRules.find(rule => rule.id === pmSelect.value);
    if(r) pmDiscount = r.discount;
  }
  
  const totalDiscountPercent = globalDiscount + pmDiscount;
  let discountAmount = subtotal * (totalDiscountPercent / 100);
  
  discountAmount += totalPromoDiscount; // add item-level promos
  const total = subtotal - discountAmount;

  const subtotalEl = document.getElementById('subtotal');
  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  
  const discountRow = document.getElementById('discount-row');
  if (discountRow) {
    if (discountAmount > 0) {
      discountRow.style.display = 'flex';
      const discPercentEl = document.getElementById('discount-percent');
      const discAmountEl = document.getElementById('discount-amount');
      if (discPercentEl) discPercentEl.textContent = totalDiscountPercent > 0 ? totalDiscountPercent : 'Promos';
      if (discAmountEl) discAmountEl.textContent = `-$${discountAmount.toFixed(2)}`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  const totalEl = document.getElementById('total');
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

// --- Discounts ---
function renderPaymentMethods() {
  const select = document.getElementById('payment-method');
  if(select) {
    const currentVal = select.value;
    select.innerHTML = '';
    paymentRules.forEach(rule => {
      const opt = document.createElement('option');
      opt.value = rule.id;
      opt.textContent = rule.name + (rule.discount > 0 ? ` (-${rule.discount}%)` : '');
      select.appendChild(opt);
    });
    if(paymentRules.find(r=>r.id === currentVal)) select.value = currentVal;
    else if(paymentRules.length > 0) select.value = paymentRules[0].id;
  }
}

function renderDiscountRules() {
  const list = document.getElementById('discounts-list');
  if(!list) return;
  list.innerHTML = '';
  paymentRules.forEach((rule, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${rule.name} <strong>(${rule.discount}%)</strong></span>
      <button class="remove-btn" onclick="removeDiscountRule('${rule.id}')"><i class="ri-delete-bin-line"></i></button>
    `;
    list.appendChild(li);
  });
}

function addDiscountRule() {
  const name = document.getElementById('desc-name').value;
  const val = parseFloat(document.getElementById('desc-value').value);
  if(name && !isNaN(val)) {
    const id = name.toLowerCase().replace(/\s+/g, '');
    paymentRules.push({ id, name, discount: val });
    localStorage.setItem('pos_payment_rules', JSON.stringify(paymentRules));
    renderDiscountRules();
    renderPaymentMethods();
    renderCart();
    document.getElementById('desc-name').value = '';
    document.getElementById('desc-value').value = '';
  }
}

function removeDiscountRule(id) {
  paymentRules = paymentRules.filter(r => r.id !== id);
  localStorage.setItem('pos_payment_rules', JSON.stringify(paymentRules));
  renderDiscountRules();
  renderPaymentMethods();
  renderCart();
}

function applyDiscount() {
  const input = document.getElementById('global-discount');
  if (!input) return;
  const val = parseFloat(input.value);
  if (!isNaN(val) && val >= 0 && val <= 100) {
    globalDiscount = val;
    renderCart(); // re-calculate totals
    closePopups();
  } else {
    alert('Ingrese un porcentaje válido entre 0 y 100');
  }
}

// --- Promotions ---
function renderPromos() {
  const list = document.getElementById('promo-list');
  if(!list) return;
  list.innerHTML = '';
  promos.forEach(promo => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${promo.text}</span>
      <button class="remove-btn" onclick="removePromotion(${promo.id})"><i class="ri-delete-bin-line"></i></button>
    `;
    list.appendChild(li);
  });
}

function addPromotion() {
  const code = document.getElementById('promo-code').value;
  const take = parseInt(document.getElementById('promo-take').value);
  const pay = parseInt(document.getElementById('promo-pay').value);
  
  if (code && !isNaN(take) && !isNaN(pay) && take > pay) {
    const p = products.find(prod => prod.code === code);
    if (!p) {
      alert('El código del producto no existe en la base de datos.');
      return;
    }
    const text = `Promoción: ${take}x${pay} en ${p.name} (Cod: ${code})`;
    promos.push({ id: Date.now(), type: 'NxM', code, take, pay, text });
    localStorage.setItem('pos_promos', JSON.stringify(promos));
    renderPromos();
    renderCart(); // recalculate promos
    
    document.getElementById('promo-code').value = '';
    document.getElementById('promo-take').value = '';
    document.getElementById('promo-pay').value = '';
  } else {
    alert('Ingrese un código válido y valores correctos (Llevá > Pagá)');
  }
}

function removePromotion(id) {
  promos = promos.filter(p => p.id !== id);
  localStorage.setItem('pos_promos', JSON.stringify(promos));
  renderPromos();
  renderCart();
}

// --- Popups Handling ---
function openPopup(id) {
  closePopups(); // close any open first
  const popup = document.getElementById(`popup-${id}`);
  const overlay = document.getElementById('overlay');
  if (popup && overlay) {
    overlay.classList.add('active');
    setTimeout(() => popup.classList.add('active'), 10);
  }
}

function closePopups() {
  document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.checkout-modal').forEach(m => m.classList.remove('active'));
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.remove('active');
  const checkoutOverlay = document.getElementById('checkout-overlay');
  if (checkoutOverlay) checkoutOverlay.classList.remove('active');
}

function populateProductTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.code}</td>
      <td><img src="${p.image}" alt="${p.name}"></td>
      <td>${p.name}</td>
      <td>$${p.price.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Checkout ---
function openPaymentModal() {
  if (cart.length === 0) {
    alert('El carrito está vacío');
    return;
  }
  
  const pModal = document.getElementById('payment-modal');
  const overlay = document.getElementById('checkout-overlay');
  
  const pmSelect = document.getElementById('payment-method');
  const qrContainer = document.getElementById('qr-container');
  
  if(pmSelect && pmSelect.value === 'mercadopago') {
    if (qrContainer) qrContainer.style.display = 'block';
  } else {
    if (qrContainer) qrContainer.style.display = 'none';
  }
  
  if (overlay) overlay.classList.add('active');
  if (pModal) pModal.classList.add('active');
}

function confirmPayment() {
  const pModal = document.getElementById('payment-modal');
  if (pModal) pModal.classList.remove('active');
  
  let subtotal = 0;
  let totalPromoDiscount = 0;
  
  cart.forEach(item => {
    let itemTotal = item.product.price * item.qty;
    subtotal += itemTotal;
    
    let promoDiscThisItem = 0;
    const applicablePromo = promos.find(p => p.type === 'NxM' && p.code === item.product.code);
    if(applicablePromo && applicablePromo.take <= item.qty) {
      const freeGroups = Math.floor(item.qty / applicablePromo.take);
      const itemsFreePerGroup = applicablePromo.take - applicablePromo.pay;
      promoDiscThisItem = freeGroups * itemsFreePerGroup * item.product.price;
    }
    totalPromoDiscount += promoDiscThisItem;
  });
  
  const pmSelect = document.getElementById('payment-method');
  let pmDiscount = 0;
  let paymentMethodName = 'No especificado';
  if(pmSelect) {
    const r = paymentRules.find(rule => rule.id === pmSelect.value);
    if(r) {
      pmDiscount = r.discount;
      paymentMethodName = r.name;
    }
  }
  
  const totalDiscountPercent = globalDiscount + pmDiscount;
  let discountAmount = subtotal * (totalDiscountPercent / 100);
  discountAmount += totalPromoDiscount;
  const total = subtotal - discountAmount;
  
  // Save transaction
  const txCode = 'TK-' + Math.floor(1000 + Math.random() * 9000);
  const tx = {
    code: txCode,
    date: new Date().toLocaleString(),
    itemsCount: cart.reduce((a,b)=>a+b.qty, 0),
    total: total,
    paymentMethod: paymentMethodName
  };
  transactions.push(tx);
  localStorage.setItem('pos_transactions', JSON.stringify(transactions));
  updateDashboardAndTransactions();
  
  const summaryBox = document.getElementById('receipt-summary');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <p><span>Código:</span> <span>${tx.code}</span></p>
      <p><span>Artículos:</span> <span>${tx.itemsCount}</span></p>
      <p><span>Subtotal:</span> <span>$${subtotal.toFixed(2)}</span></p>
      ${totalDiscountPercent > 0 || totalPromoDiscount > 0 ? `<p><span>Descuento:</span> <span>-$${discountAmount.toFixed(2)}</span></p>` : ''}
      <p class="total-p"><span>Total Pagado:</span> <span>$${total.toFixed(2)}</span></p>
    `;
  }
  
  const modal = document.getElementById('checkout-modal');
  if (modal) setTimeout(() => modal.classList.add('active'), 10);
}

function finishCheckout() {
  cart = [];
  globalDiscount = 0;
  renderCart();
  const preview = document.getElementById('product-preview');
  if (preview) {
    preview.innerHTML = `
      <div class="empty-state">
        <i class="ri-barcode-box-line"></i>
        <p>Esperando producto...</p>
      </div>
    `;
  }
  const codeInput = document.getElementById('product-code');
  const globalDiscInput = document.getElementById('global-discount');
  if (codeInput) codeInput.value = '';
  if (globalDiscInput) globalDiscInput.value = '';
  closePopups();
}

// --- History and Dashboard ---
function updateDashboardAndTransactions() {
  const opStat = document.getElementById('dashboard-operaciones');
  const salesStat = document.getElementById('dashboard-ventas-dia');
  const factTotal = document.getElementById('facturacion-total');
  const montoCambioDisplay = document.getElementById('dashboard-monto-cambio');
  const tbody = document.getElementById('transactions-table-body');
  
  if(opStat) opStat.textContent = transactions.length;
  if(montoCambioDisplay) montoCambioDisplay.textContent = `$${openingCash.toFixed(2)}`;
  
  const totalMoney = transactions.reduce((sum, tx) => sum + tx.total, 0);
  if(salesStat) salesStat.textContent = `$${totalMoney.toFixed(2)}`;
  if(factTotal) factTotal.textContent = `$${totalMoney.toFixed(2)}`;
  
  if(tbody) {
    tbody.innerHTML = '';
    // Show newest first
    const reversed = [...transactions].reverse();
    reversed.forEach(tx => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${tx.code}</td>
        <td>${tx.date}</td>
        <td>${tx.paymentMethod}</td>
        <td>$${tx.total.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function clearTransactions() {
  if(confirm("¿Está seguro de querer borrar todo el historial?")) {
    transactions = [];
    localStorage.removeItem('pos_transactions');
    updateDashboardAndTransactions();
  }
}

function setOpeningCash() {
  const input = document.getElementById('opening-cash-input');
  if (!input) return;
  const val = parseFloat(input.value);
  if (!isNaN(val)) {
    openingCash = val;
    localStorage.setItem('pos_opening_cash', openingCash);
    updateDashboardAndTransactions();
    input.value = '';
    alert('Monto de cambio establecido correctamente.');
  } else {
    alert('Por favor, ingrese un monto válido.');
  }
}

function toggleDarkMode() {
  const body = document.body;
  const toggleBtn = document.getElementById('theme-toggle');
  
  body.classList.toggle('dark');
  
  if (body.classList.contains('dark')) {
    localStorage.setItem('pos_theme', 'dark');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="ri-sun-line"></i>';
    }
  } else {
    localStorage.setItem('pos_theme', 'light');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="ri-moon-line"></i>';
    }
  }
}
