// sucursal-guard.js — runtime wrappers to avoid uncaught TypeError when currentSucursal is null
(function(){
  function getSafeSucursal(){
    if(typeof currentSucursal !== 'undefined' && currentSucursal && currentSucursal.id) return currentSucursal;
    try{ const s = localStorage.getItem('pos_sucursal'); if(s) return JSON.parse(s); }catch(e){}
    return null;
  }

  function ensureOrPrompt(caller){
    const s = getSafeSucursal();
    if(s) return s;
    console.warn('Operation blocked: no sucursal active', caller);
    if(typeof reportMissingSucursal === 'function') reportMissingSucursal(caller);
    try{ if(typeof openPopup === 'function') openPopup('sucursal'); }catch(e){}
    return null;
  }

  // Wrap setOpeningCash if exists
  if(window.setOpeningCash && typeof window.setOpeningCash === 'function'){
    const orig = window.setOpeningCash;
    window.setOpeningCash = async function wrappedSetOpeningCash(){
      const s = ensureOrPrompt('setOpeningCash');
      if(!s) return;
      return orig.apply(this, arguments);
    }
  }

})();
