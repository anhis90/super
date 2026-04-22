/**
 * js/api.js
 * Capa de acceso a datos (Supabase).
 */

import supabase from './supabase.js';
import { state } from './state.js';
import { APP_CONFIG } from './config.js';

export const api = {
  async loadInitialData() {
    try {
      // 1. Sucursal activa (primera encontrada)
      const { data: sucs, error: sucErr } = await supabase.from('sucursales').select('*').limit(1);
      if (sucErr) throw sucErr;
      
      state.currentSucursal = sucs[0] || null;
      if (!state.currentSucursal) return false;

      const sid = state.currentSucursal.id;

      // Cargas paralelas para mayor velocidad
      const [
        { data: products },
        { data: suppliers },
        { data: configs },
        { data: payMethods },
        { data: promos },
        { data: sales }
      ] = await Promise.all([
        supabase.from('productos').select('*').eq('sucursal_id', sid),
        supabase.from('proveedores').select('*').eq('sucursal_id', sid),
        supabase.from('configuracion').select('*').eq('sucursal_id', sid),
        supabase.from('metodos_pago').select('*').eq('sucursal_id', sid),
        supabase.from('promociones').select('*').eq('sucursal_id', sid),
        supabase.from('ventas').select('*, detalle_ventas(*, productos(name, code))').eq('sucursal_id', sid).order('date', { ascending: false })
      ]);

      state.products = products || [];
      state.suppliers = suppliers || [];
      state.paymentRules = payMethods || [];
      state.promos = promos || [];
      
      const ivaRow = configs?.find(c => c.key === 'iva');
      const cashRow = configs?.find(c => c.key === 'opening_cash');
      state.ivaConfig = parseFloat(ivaRow?.value || APP_CONFIG.IVA_DEFAULT);
      state.openingCash = parseFloat(cashRow?.value || 0);

      state.transactions = (sales || []).map(s => ({
        id: s.id,
        code: s.code,
        date: new Date(s.date).toLocaleString('es-AR'),
        method: s.method,
        total: s.total,
        items: s.detalle_ventas.map(d => ({
          productName: d.productos?.name || 'Producto',
          productCode: d.productos?.code || '',
          qty: d.qty,
          price: d.price
        }))
      }));

      return true;
    } catch (e) {
      console.error('[API] Error cargando datos:', e);
      return false;
    }
  },

  async createSucursal(name, address) {
    const { data, error } = await supabase.from('sucursales').insert([{ name, address }]).select();
    if (error) throw error;
    return data[0];
  },

  async addProduct(product) {
    const { error } = await supabase.from('productos').insert([{
      ...product,
      sucursal_id: state.currentSucursal.id
    }]);
    return error;
  },

  async deleteProduct(id) {
    const { error } = await supabase.from('productos').delete().eq('id', id);
    return error;
  },

  async updateStock(id, newStock) {
    const { error } = await supabase.from('productos').update({ stock: newStock }).eq('id', id);
    return error;
  },

  async createSale(saleData, items) {
    const { data: sale, error: saleErr } = await supabase.from('ventas').insert([{
      ...saleData,
      sucursal_id: state.currentSucursal.id
    }]).select();
    
    if (saleErr) throw saleErr;

    const details = items.map(item => ({
      venta_id: sale[0].id,
      product_id: item.id,
      qty: item.qty,
      price: item.price
    }));

    const { error: detErr } = await supabase.from('detalle_ventas').insert(details);
    if (detErr) throw detErr;

    return sale[0];
  },

  async setOpeningCash(value) {
    const { error } = await supabase.from('configuracion').upsert(
      { key: 'opening_cash', value: value.toString(), sucursal_id: state.currentSucursal.id },
      { onConflict: 'key,sucursal_id' }
    );
    return error;
  },

  async updateIva(value) {
    const { error } = await supabase.from('configuracion').upsert(
      { key: 'iva', value: value.toString(), sucursal_id: state.currentSucursal.id },
      { onConflict: 'key,sucursal_id' }
    );
    return error;
  },

  async addPaymentMethod(name, discount) {
    const { error } = await supabase.from('metodos_pago').insert([{
      name,
      discount,
      sucursal_id: state.currentSucursal.id
    }]);
    return error;
  },

  async deletePaymentMethod(id) {
    const { error } = await supabase.from('metodos_pago').delete().eq('id', id);
    return error;
  },

  async addPromotion(code, take, pay) {
    const { error } = await supabase.from('promociones').insert([{
      code,
      take,
      pay,
      sucursal_id: state.currentSucursal.id
    }]);
    return error;
  },

  async deletePromotion(id) {
    const { error } = await supabase.from('promociones').delete().eq('id', id);
    return error;
  }
};
