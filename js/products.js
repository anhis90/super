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

  // Devuelve el siguiente código disponible en formato 'NNN' (3 dígitos, con ceros a la izquierda)
  function getNextProductCode() {
    const products = loadProducts();
    if (!Array.isArray(products) || products.length === 0) return '001';
    let max = 0;
    products.forEach(p => {
      const raw = (p.code || '').toString().trim();
      // extraer números dentro del código (por si hay prefijos)
      const digits = raw.replace(/[^0-9]/g, '');
      const n = parseInt(digits || '0', 10);
      if (!isNaN(n) && n > max) max = n;
    });
    const next = max + 1;
    return String(next).padStart(3, '0');
  }

  // Poner el siguiente código en el input (si existe)
  function setNextCodeToInput() {
    const inp = document.getElementById('new-prod-code');
    if (!inp) return;
    try { inp.value = getNextProductCode(); } catch (e) { inp.value = '001'; }
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
      const img = document.createElement('img'); img.src = p.image || '';
      img.alt = p.name || '';
      img.style.height = '40px'; img.style.width = '40px'; img.style.objectFit = 'cover'; img.style.borderRadius = '6px';
      if (!p.image) img.style.display = 'none';
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
    // leer el código del input (ahora se autocompleta y es readonly)
    const code = document.getElementById('new-prod-code')?.value?.trim();
    const name = document.getElementById('new-prod-name')?.value?.trim();
    const priceRaw = document.getElementById('new-prod-price')?.value;
    const stockRaw = document.getElementById('new-prod-stock')?.value;
    const imgInput = document.getElementById('new-prod-img');

    // Código ya ha sido autocompletado en el input; validamos y si por alguna razón está vacío, generamos uno
    let finalCode = code || getNextProductCode();
    if (!finalCode || !name) { alert('Nombre es obligatorio'); return; }

    const price = parseFloat(priceRaw) || 0;
    const stock = parseInt(stockRaw) || 0;

    const imgData = await readImageAsDataURL(imgInput);
    // If no image provided, generate a product photo-like image via canvas (offline IA)
    // preferir imagen subida, luego imagen generada por el botón, luego auto-foto
    const finalImg = imgData || window._generatedProductImage || generateProductPhoto(name || finalCode);
    const products = loadProducts();
    // Evitar duplicados por código: si existe, actualizar
    const existingIndex = products.findIndex(p => p.code === code);
    const productObj = { id: Date.now(), code, name, price, stock, image: finalImg || '' };
    if (existingIndex >= 0) {
      // Si existe, mantenemos el ID original si lo tiene
      productObj.id = products[existingIndex].id || productObj.id;
      products[existingIndex] = productObj;
    } else {
      products.push(productObj);
    }

    saveProducts(products);
    renderProductTable();
    // Limpiar formulario excepto el código: preparar el siguiente código automáticamente
    document.getElementById('new-prod-name').value = '';
    document.getElementById('new-prod-price').value = '';
    document.getElementById('new-prod-stock').value = '';
    document.getElementById('new-prod-code').value = getNextProductCode();
    document.getElementById('new-prod-name').value = '';
    // limpiar imagen subida y preview
    if (imgInput) { imgInput.value = ''; }
    const preview = document.getElementById('new-prod-img-preview'); if (preview) { preview.src = ''; preview.style.display = 'none'; }
    window._generatedProductImage = null;

    // Notificar a otros módulos
    if (window.analyzeBusinessData) window.analyzeBusinessData();
  }

  // Genera una imagen inteligente basada en el nombre del producto
  function generateProductPhoto(label, size = 400) {
    const name = (label || '').toLowerCase();
    
    const library = [
      { keywords: ['yerba', 'mate', 'yerba mate'], url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400' },
      { keywords: ['leche', 'milk', 'lacteo'], url: 'https://images.unsplash.com/photo-1550583724-125581828cd1?w=400' },
      { keywords: ['azucar', 'sugar'], url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400' },
      { keywords: ['coca', 'cola', 'gaseosa', 'soda'], url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400' },
      { keywords: ['pan', 'factura', 'bakery'], url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400' },
      { keywords: ['queso', 'cheese'], url: 'https://images.unsplash.com/photo-1485921325814-af97df71f3ea?w=400' },
      { keywords: ['fideo', 'pasta', 'tallarin'], url: 'https://images.unsplash.com/photo-1551462147-37885acc3c41?w=400' },
      { keywords: ['carne', 'meat', 'beef'], url: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400' },
      { keywords: ['fruta', 'manzana', 'apple'], url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400' },
      { keywords: ['verdura', 'tomate', 'vegetable'], url: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c12e8c?w=400' },
      { keywords: ['higiene', 'jabon', 'shampoo'], url: 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?w=400' },
      { keywords: ['almacen', 'comida'], url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400' }
    ];

    const match = library.find(item => item.keywords.some(k => name.includes(k)));
    if (match) return match.url;

    // Fallback dinámico ultra-específico (Product Only)
    if (navigator.onLine && name.length >= 3) {
      // Usamos Pixabay o Unsplash con filtros de "comida" o "producto" para evitar gráficos/tablas
      return `https://source.unsplash.com/featured/400x400/?supermarket,product,${encodeURIComponent(name)}`;
    }

    // Fallback absoluto: Canvas estético
    return generateCanvasPlaceholder(label, size);
  }

  function generateCanvasPlaceholder(label, size) {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const seed = Math.abs(hashCode(label || 'p'));
    const colorA = pickColor(seed);
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, colorA); grad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.font = 'bold ' + Math.floor(size/5) + 'px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText((label || '?')[0].toUpperCase(), size/2, size/1.8);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function pickColor(n) {
    const palette = ['#FFB703','#FB8500','#219EBC','#023E8A','#8ECAE6','#FF006E','#606C38','#2A6F97'];
    return palette[n % palette.length];
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (r === undefined) r = 5; ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath(); if (fill) ctx.fill(); if (stroke) ctx.stroke(); }

  function addNoise(ctx, size, intensity) {
    const img = ctx.getImageData(0,0,size,size); const d = img.data; const amt = Math.floor(intensity*255);
    for (let i=0;i<d.length;i+=4){ const v = (Math.random()*2-1)*amt; d[i]+=v; d[i+1]+=v; d[i+2]+=v; }
    ctx.putImageData(img,0,0);
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
    products.forEach(p => { if (!p.image || p.image === '') { p.image = generatePlaceholderImage(p.name || p.code || 'P'); changed = true; } });
    if (changed) { saveProducts(products); renderProductTable(); }
  }

  // Genera y asigna fotos IA a todos los productos que no tengan imagen
  function assignProductPhotosAI() {
    const products = loadProducts();
    let changed = false;
    products.forEach((p, i) => { if (!p.image || p.image === '') { p.image = generateProductPhoto(p.name || p.code || ('P' + i)); changed = true; } });
    if (changed) { saveProducts(products); renderProductTable(); }
  }

  // Exponer utilidad de debug para inspeccionar productos y detectar truncado
  window.debugProducts = function() { const ps = loadProducts(); console.log('Products count:', ps.length); console.log(ps.map(p=>({code:p.code,name:p.name,hasImg:!!p.image}))); return ps; };
  window.generateProductPhotoAI = function() {
    // Genera foto para el preview usando el nombre actual en el formulario
    const name = document.getElementById('new-prod-name')?.value || document.getElementById('new-prod-code')?.value || 'Producto';
    const data = generateProductPhoto(name, 400);
    const preview = document.getElementById('new-prod-img-preview');
    if (preview) { preview.src = data; preview.style.display = 'inline-block'; }
    // también colocar en input file no es posible, pero la imagen será usada al guardar
    // guardamos temporalmente en window._generatedProductImage
    window._generatedProductImage = data;
    return data;
  };

  // Preview de imagen en el formulario con actualización en tiempo real
  function setupImagePreview() {
    const inp = document.getElementById('new-prod-img');
    const nameInp = document.getElementById('new-prod-name');
    const preview = document.getElementById('new-prod-img-preview');
    if (!preview) return;

    // Actualizar preview al subir archivo
    if (inp) {
      inp.addEventListener('change', () => {
        const file = inp.files?.[0];
        if (!file) { preview.style.display = 'none'; preview.src = ''; return; }
        const reader = new FileReader();
        reader.onload = () => { preview.src = reader.result; preview.style.display = 'inline-block'; };
        reader.readAsDataURL(file);
      });
    }

    // Actualizar preview IA en tiempo real mientras escribe el nombre
    if (nameInp) {
      let timeout = null;
      nameInp.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (nameInp.value.length >= 3) {
            window.generateProductPhotoAI();
          }
        }, 1200); // Aumentamos a 1.2s para ser más gentiles con la red
      });
    }
  }

  // Inicialización
  document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    renderProductTable();
    setupImagePreview();
    // Poner el próximo código disponible en el input al iniciar
    setNextCodeToInput();
  });

  // Exponer función global para el onclick en HTML
  // Usamos un nombre distinto (`addLocalProduct`) para evitar sobrescribir
  // funciones existentes que insertan directamente en la base de datos
  window.addLocalProduct = addNewProduct;

})();
