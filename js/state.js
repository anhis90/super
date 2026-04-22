/**
 * js/state.js
 * Estado global de la aplicación.
 */

import { APP_CONFIG } from './config.js';

export const state = {
  currentUser: null,
  currentSucursal: null,
  
  products: [],
  suppliers: [],
  purchases: [],
  promos: [],
  transactions: [],
  paymentRules: [],
  cart: [],
  
  ivaConfig: APP_CONFIG.IVA_DEFAULT,
  openingCash: 0
};
