// nav.js — sidebar sublist preview and popup
(function(){
  function parseSubmenu(val){
    if(!val) return [];
    return val.split('|').map(function(part){
      var p = part.split(':');
      return { label: p[0].trim(), target: (p[1]||p[0]).trim() };
    });
  }

  function createPreviewEl(items){
    var wrapper = document.createElement('div');
    wrapper.className = 'nav-subpreview';
    // show up to 3 lines
    var lines = items.slice(0,3).map(function(it){ return it.label; });
    wrapper.innerHTML = lines.map(function(l){ return '<div class="line">'+escapeHtml(l)+'</div>'; }).join('');
    return wrapper;
  }

  function escapeHtml(s){ return (s+'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c];}); }

  function showPopupFor(button, items){
    var popup = document.getElementById('nav-submenu-popup');
    if(!popup){ popup = document.createElement('div'); popup.id = 'nav-submenu-popup'; document.body.appendChild(popup); }
    popup.innerHTML = '';
    popup.classList.remove('visible');

    var card = document.createElement('div'); card.className='nav-popup-card';
    var title = document.createElement('div'); title.className='nav-popup-title'; title.textContent = button.textContent.trim();
    var list = document.createElement('div'); list.className='nav-popup-list';
    items.forEach(function(it){
      var row = document.createElement('button'); row.className='nav-popup-item'; row.type='button'; row.textContent = it.label;
      row.addEventListener('click', function(e){
        // attempt to open the target popup if exists
        try{ if(window.openPopup) window.openPopup(it.target); }catch(err){}
        closePopup();
      });
      list.appendChild(row);
    });
    card.appendChild(title); card.appendChild(list);
    popup.appendChild(card);

    // position near the button (to the right of sidebar)
    var rect = button.getBoundingClientRect();
    var sidebar = button.closest('.sidebar');
    var sideRect = sidebar ? sidebar.getBoundingClientRect() : { right: 0 };
    popup.style.left = (sideRect.right + 12) + 'px';
    // align top with button center but keep inside viewport
    var top = Math.max(12, rect.top - 8);
    popup.style.top = top + 'px';

    // show
    requestAnimationFrame(function(){ popup.classList.add('visible'); });

    // external close handlers
    setTimeout(function(){ // defer to avoid immediate close from same click
      document.addEventListener('click', outsideClick);
      document.addEventListener('keydown', onKey);
    },50);

    function outsideClick(e){ if(!popup.contains(e.target) && !button.contains(e.target)) closePopup(); }
    function onKey(e){ if(e.key==='Escape') closePopup(); }
    function closePopup(){ popup.classList.remove('visible'); document.removeEventListener('click', outsideClick); document.removeEventListener('keydown', onKey); }
  }

  function init(){
    var buttons = document.querySelectorAll('.nav-links li button[data-submenu]');
    buttons.forEach(function(btn){
      var items = parseSubmenu(btn.getAttribute('data-submenu'));
      if(!items.length) return;
      // add preview block
      var preview = createPreviewEl(items);
      // append preview into button content area
      // ensure button uses position:relative
      btn.style.position='relative';
      preview.style.position='absolute';
      preview.style.right='12px';
      preview.style.top='8px';
      preview.classList.add('nav-subpreview-inline');
      btn.appendChild(preview);
      // click handler to open popup
      btn.addEventListener('click', function(e){
        // if click on the small preview, still open popup
        showPopupFor(btn, items);
      });
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
