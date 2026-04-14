/*
  js/products.js

  Maneja la creación, persistencia y renderizado de productos.
  - Al agregar un producto, se guarda en `localStorage` (clave: 'products').
  - Soporta imagen mediante input file; guarda la imagen como Data URL (funciona offline).
  - Actualiza `window.products` para compatibilidad con otros módulos (ej: `js/ai.js`).

  Funciones principales:
  - addNewProduct(): lee formulario, guarda producto y re-renderiza la tabla.
  - loadProducts(): carga desde localStorage a memoria.
  - renderProductTable(): dibuja filas en `#product-table-body`.

  Nota: adaptar almacenamiento a Supabase en el futuro si se desea persistencia remota.
*/

(function () {
  'use strict';

  const STORAGE_KEY = 'products';

  function tryParseJSON(v) { try { return JSON.parse(v); } catch (e) { return null; } }

  function loadProducts() {
    const fromWindow = window.products;
    if (Array.isArray(fromWindow)) return fromWindow;
    const ls = tryParseJSON(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(ls)) { window.products = ls; return ls; }
    window.products = [];
    return window.products;
  }

  function saveProducts(arr) {
    window.products = arr;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch (e) { console.warn('No se pudo guardar products en localStorage', e); }
  }

  function renderProductTable() {
    const tbody = document.getElementById('product-table-body');
    if (!tbody) return;
    const products = loadProducts();
    tbody.innerHTML = '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      const tdCode = document.createElement('td'); tdCode.innerText = p.code || '';
      const tdImg = document.createElement('td');
      const img = document.createElement('img'); img.src = p.img || '';
      img.alt = p.name || '';
      img.style.height = '40px'; img.style.width = '40px'; img.style.objectFit = 'cover'; img.style.borderRadius = '6px';
      if (!p.img) img.style.display = 'none';
      tdImg.appendChild(img);
      const tdName = document.createElement('td'); tdName.innerText = p.name || '';
      const tdPrice = document.createElement('td'); tdPrice.innerText = (typeof p.price === 'number') ? ('$' + p.price.toFixed(2)) : p.price || '$0.00';
      const tdStock = document.createElement('td'); tdStock.innerText = String(p.stock || 0);
      const tdActions = document.createElement('td'); tdActions.className = 'admin-only';
      const delBtn = document.createElement('button'); delBtn.className = 'action-btn'; delBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
      delBtn.onclick = () => { deleteProduct(p.code); };
      tdActions.appendChild(delBtn);

      tr.appendChild(tdCode); tr.appendChild(tdImg); tr.appendChild(tdName); tr.appendChild(tdPrice); tr.appendChild(tdStock); tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  function deleteProduct(code) {
    let products = loadProducts();
    products = products.filter(p => p.code !== code);
    saveProducts(products);
    renderProductTable();
    if (window.analyzeBusinessData) window.analyzeBusinessData();
  }

  // Leer la imagen del input y devolver promesa con dataURL
  function readImageAsDataURL(inputEl) {
    return new Promise((resolve) => {
      const file = inputEl?.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  // Función expuesta en el HTML
  async function addNewProduct() {
    const code = document.getElementById('new-prod-code')?.value?.trim();
    const name = document.getElementById('new-prod-name')?.value?.trim();
    const priceRaw = document.getElementById('new-prod-price')?.value;
    const stockRaw = document.getElementById('new-prod-stock')?.value;
    const imgInput = document.getElementById('new-prod-img');

    if (!code || !name) {
      alert('Código y nombre son obligatorios');
      return;
    }

    const price = parseFloat(priceRaw) || 0;
    const stock = parseInt(stockRaw) || 0;

    const imgData = await readImageAsDataURL(imgInput);
    // If no image provided, generate a simple placeholder (SVG data URL)
    const finalImg = imgData || generatePlaceholderImage(name || code);
    const products = loadProducts();
    // Evitar duplicados por código: si existe, actualizar
    const existingIndex = products.findIndex(p => p.code === code);
    const productObj = { code, name, price, stock, img: finalImg || '' };
    if (existingIndex >= 0) products[existingIndex] = productObj; else products.push(productObj);

    saveProducts(products);
    renderProductTable();
    // Limpiar formulario
    document.getElementById('new-prod-code').value = '';
    document.getElementById('new-prod-name').value = '';
    document.getElementById('new-prod-price').value = '';
    document.getElementById('new-prod-stock').value = '';
    if (imgInput) { imgInput.value = ''; }
    const preview = document.getElementById('new-prod-img-preview'); if (preview) { preview.src = ''; preview.style.display = 'none'; }

    // Notificar a otros módulos
    if (window.analyzeBusinessData) window.analyzeBusinessData();
  }

  // Genera una imagen placeholder SVG como data URL para usar cuando no hay foto
  function generatePlaceholderImage(label, size = 160) {
    const bgColors = ['#FFB703','#FB8500','#219EBC','#023E8A','#8ECAE6','#FF006E'];
    const color = bgColors[Math.abs(hashCode(label)) % bgColors.length] || '#888';
    const initials = (label || '').split(' ').slice(0,2).map(s=>s[0]?.toUpperCase()||'').join('').slice(0,2) || 'P';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>`+
      `<rect width='100%' height='100%' fill='${color}' rx='12'/>`+
      `<text x='50%' y='55%' font-size='${Math.floor(size/2.8)}' text-anchor='middle' fill='white' font-family='Arial,Helvetica,sans-serif' font-weight='700'>${escapeXml(initials)}</text>`+
      `</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function escapeXml(s) { return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&apos;"}[c]; }); }
  function hashCode(str) { let h=0; for(let i=0;i<str.length;i++){ h = ((h<<5)-h)+str.charCodeAt(i); h |= 0;} return h; }

  // Asigna placeholders a todos los productos que no tengan imagen
  function assignPlaceholdersToAll() {
    const products = loadProducts();
    let changed = false;
    products.forEach(p => { if (!p.img || p.img === '') { p.img = generatePlaceholderImage(p.name || p.code || 'P'); changed = true; } });
    if (changed) { saveProducts(products); renderProductTable(); }
  }

  // Exponer utilidad de debug para inspeccionar productos y detectar truncado
  window.debugProducts = function() { const ps = loadProducts(); console.log('Products count:', ps.length); console.log(ps.map(p=>({code:p.code,name:p.name,hasImg:!!p.img}))); return ps; };

  // Preview de imagen en el formulario
  function setupImagePreview() {
    const inp = document.getElementById('new-prod-img');
    const preview = document.getElementById('new-prod-img-preview');
    if (!inp || !preview) return;
    inp.addEventListener('change', () => {
      const file = inp.files?.[0];
      if (!file) { preview.style.display = 'none'; preview.src = ''; return; }
      const reader = new FileReader();
      reader.onload = () => { preview.src = reader.result; preview.style.display = 'inline-block'; };
      reader.readAsDataURL(file);
    });
  }

  // Inicialización
  document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    renderProductTable();
    setupImagePreview();
  });

  // Exponer función global para el onclick en HTML
  // Usamos un nombre distinto (`addLocalProduct`) para evitar sobrescribir
  // funciones existentes que insertan directamente en la base de datos
  window.addLocalProduct = addNewProduct;

})();
