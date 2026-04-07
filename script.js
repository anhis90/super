// --- Data ---
const products = [
  { code: '001', name: 'Leche Descremada 1L', price: 1200, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80' },
  { code: '002', name: 'Pan Lactal Blanco', price: 950, image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?auto=format&fit=crop&w=200&q=80' },
  { code: '003', name: 'Queso Cremoso x Kg', price: 4500, image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=200&q=80' },
  { code: '004', name: 'Gaseosa Cola 2.25L', price: 1500, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=200&q=80' },
  { code: '005', name: 'Yerba Mate 500g', price: 1800, image: 'https://images.unsplash.com/photo-1594848375528-91ed3495f5bd?auto=format&fit=crop&w=200&q=80' },
  { code: '006', name: 'Fideos Tallarines 500g', price: 800, image: 'https://images.unsplash.com/photo-1612800164805-4e78263309a6?auto=format&fit=crop&w=200&q=80' }
];

let cart = [];
let globalDiscount = 0;

let paymentRules = [
  { id: 'efectivo', name: 'Efectivo', discount: 10 },
  { id: 'debito', name: 'Tarjeta de Débito', discount: 0 },
  { id: 'credito', name: 'Tarjeta de Crédito', discount: 0 },
  { id: 'mercadopago', name: 'Mercado Pago (QR)', discount: 0 }
];

let promos = [
  { id: 1, text: 'Llevá 3, pagá 2 en Gaseosas' },
  { id: 2, text: '15% de descuento en Lácteos los Miércoles' }
];

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  updateDate();
  setInterval(updateDate, 1000);
  
  populateProductTable();
  renderPaymentMethods();
  renderDiscountRules();
  renderPromos();
  
  const codeInput = document.getElementById('product-code');
  const addBtn = document.getElementById('add-btn');

  codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addProductToCart(codeInput.value);
    }
  });

  addBtn.addEventListener('click', () => {
    addProductToCart(codeInput.value);
  });
});

function updateDate() {
  const dateDisplay = document.getElementById('date-display');
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
    
    codeInput.value = '';
    codeInput.focus();
  } else {
    alert('Producto no encontrado!');
    codeInput.select();
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
  cartContainer.innerHTML = '';
  
  let subtotal = 0;

  cart.forEach((item, index) => {
    const itemTotal = item.product.price * item.qty;
    subtotal += itemTotal;
    
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <div class="item-info">
        <span class="item-name">${item.product.name}</span>
        <span class="item-price">$${item.product.price.toFixed(2)} x ${item.qty} = $${itemTotal.toFixed(2)}</span>
      </div>
      <div class="item-actions">
        <span class="qty">${item.qty}</span>
        <button class="remove-btn" onclick="removeItem(${index})"><i class="ri-delete-bin-line"></i></button>
      </div>
    `;
    cartContainer.appendChild(cartItem);
  });

  updateTotals(subtotal);
}

function removeItem(index) {
  cart.splice(index, 1);
  renderCart();
}

function updateTotals(subtotal) {
  const pmSelect = document.getElementById('payment-method');
  let pmDiscount = 0;
  if(pmSelect) {
    const r = paymentRules.find(rule => rule.id === pmSelect.value);
    if(r) pmDiscount = r.discount;
  }
  
  const totalDiscountPercent = globalDiscount + pmDiscount;
  const discountAmount = subtotal * (totalDiscountPercent / 100);
  const total = subtotal - discountAmount;

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  
  const discountRow = document.getElementById('discount-row');
  if (totalDiscountPercent > 0) {
    discountRow.style.display = 'flex';
    document.getElementById('discount-percent').textContent = totalDiscountPercent;
    document.getElementById('discount-amount').textContent = `-$${discountAmount.toFixed(2)}`;
  } else {
    discountRow.style.display = 'none';
  }

  document.getElementById('total').textContent = `$${total.toFixed(2)}`;
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
    renderDiscountRules();
    renderPaymentMethods();
    renderCart();
    document.getElementById('desc-name').value = '';
    document.getElementById('desc-value').value = '';
  }
}

function removeDiscountRule(id) {
  paymentRules = paymentRules.filter(r => r.id !== id);
  renderDiscountRules();
  renderPaymentMethods();
  renderCart();
}

function applyDiscount() {
  const input = document.getElementById('global-discount');
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
  const text = document.getElementById('new-promo-text').value;
  if(text) {
    promos.push({ id: Date.now(), text });
    renderPromos();
    document.getElementById('new-promo-text').value = '';
  }
}

function removePromotion(id) {
  promos = promos.filter(p => p.id !== id);
  renderPromos();
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
    qrContainer.style.display = 'block';
  } else {
    qrContainer.style.display = 'none';
  }
  
  overlay.classList.add('active');
  pModal.classList.add('active');
}

function confirmPayment() {
  document.getElementById('payment-modal').classList.remove('active');
  
  let subtotal = 0;
  cart.forEach(item => {
    subtotal += item.product.price * item.qty;
  });
  
  const pmSelect = document.getElementById('payment-method');
  let pmDiscount = 0;
  if(pmSelect) {
    const r = paymentRules.find(rule => rule.id === pmSelect.value);
    if(r) pmDiscount = r.discount;
  }
  
  const totalDiscountPercent = globalDiscount + pmDiscount;
  const discountAmount = subtotal * (totalDiscountPercent / 100);
  const total = subtotal - discountAmount;
  
  const summaryBox = document.getElementById('receipt-summary');
  summaryBox.innerHTML = `
    <p><span>Artículos:</span> <span>${cart.reduce((a,b)=>a+b.qty, 0)}</span></p>
    <p><span>Subtotal:</span> <span>$${subtotal.toFixed(2)}</span></p>
    ${totalDiscountPercent > 0 ? `<p><span>Descuento:</span> <span>-$${discountAmount.toFixed(2)}</span></p>` : ''}
    <p class="total-p"><span>Total Pagado:</span> <span>$${total.toFixed(2)}</span></p>
  `;
  
  const modal = document.getElementById('checkout-modal');
  setTimeout(() => modal.classList.add('active'), 10);
}

function finishCheckout() {
  cart = [];
  globalDiscount = 0;
  renderCart();
  document.getElementById('product-preview').innerHTML = `
    <div class="empty-state">
      <i class="ri-barcode-box-line"></i>
      <p>Esperando producto...</p>
    </div>
  `;
  document.getElementById('product-code').value = '';
  document.getElementById('global-discount').value = '';
  closePopups();
  
  // update operations stat purely visual
  const opStat = document.querySelectorAll('.stat-card p')[1];
  if(opStat) opStat.textContent = parseInt(opStat.textContent) + 1;
}
