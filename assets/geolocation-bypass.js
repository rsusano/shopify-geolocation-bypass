// @ts-nocheck
/**
 * Geolocation Bypass Script
 * Forces specific currency and prevents geolocation detection for landing pages
 * 
 * This script runs on custom landing page templates to:
 * 1. Force a specific currency (USD or GBP)
 * 2. Block geolocation popups
 * 3. Prevent auto-currency switching
 * 4. Disable location-based redirects
 */

(function() {
  'use strict';

  console.log('[Geo Bypass] Script loaded and executing...');

  // Check if this is a bypass-enabled template
  const templateSuffix = window.SHOPIFY_TEMPLATE_SUFFIX || '';
  const templateName = window.SHOPIFY_TEMPLATE_NAME || '';
  
  console.log('[Geo Bypass] Template check:', { templateSuffix, templateName });
  
  if (!templateSuffix || (!templateSuffix.includes('landing-us') && !templateSuffix.includes('landing-uk'))) {
    console.log('[Geo Bypass] Not a landing page template, skipping bypass');
    return; // Exit if not a landing page
  }

  // Determine forced currency based on template
  let forcedCurrency = 'USD';
  if (templateSuffix.includes('landing-uk')) {
    forcedCurrency = 'GBP';
  } else if (templateSuffix.includes('landing-us')) {
    forcedCurrency = 'USD';
  }

  console.log(`[Geo Bypass] Active on product.${templateSuffix} - Forcing currency: ${forcedCurrency}`);

  // ========================================
  // 1.5. FORCE CURRENCY VIA COOKIE & RELOAD
  // ========================================
  
  // Set Shopify currency cookie
  document.cookie = `cart_currency=${forcedCurrency}; path=/; max-age=31536000`;
  document.cookie = `currency=${forcedCurrency}; path=/; max-age=31536000`;
  
  // Check if we need to reload with correct currency
  const currentCurrency = document.documentElement.getAttribute('data-currency') || 
                         document.querySelector('[data-currency]')?.getAttribute('data-currency') ||
                         (typeof Shopify !== 'undefined' && Shopify.currency ? Shopify.currency.active : null);
  
  if (currentCurrency && currentCurrency !== forcedCurrency) {
    console.log(`[Geo Bypass] Currency mismatch detected (${currentCurrency} != ${forcedCurrency}), forcing reload...`);
    
    // Try to submit currency form to change currency
    const currencyForm = document.querySelector('form[action*="/localization"]');
    if (currencyForm) {
      const currencyInput = currencyForm.querySelector('input[name="currency_code"]') || 
                           currencyForm.querySelector('select[name="currency_code"]');
      if (currencyInput) {
        currencyInput.value = forcedCurrency;
        currencyForm.submit();
        return; // Stop execution, page will reload
      }
    }
    
    // Fallback: Add currency parameter to URL and reload
    const url = new URL(window.location.href);
    if (url.searchParams.get('currency') !== forcedCurrency) {
      url.searchParams.set('currency', forcedCurrency);
      console.log(`[Geo Bypass] Reloading with currency parameter: ${url.href}`);
      window.location.href = url.href;
      return; // Stop execution, page will reload
    }
  }

  // ========================================
  // 1. DISABLE GEOLOCATION DETECTION
  // ========================================
  
  // Set global flags to disable geo features
  window.DISABLE_GEOLOCATION = true;
  window.DISABLE_GEO_REDIRECT = true;
  window.DISABLE_GEO_POPUP = true;
  window.GEOLOCATION_BYPASS_ACTIVE = true;

  // Block common geolocation API calls
  if (navigator.geolocation) {
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
    const originalWatchPosition = navigator.geolocation.watchPosition;
    
    navigator.geolocation.getCurrentPosition = function() {
      console.log('[Geo Bypass] Blocked geolocation.getCurrentPosition()');
      return;
    };
    
    navigator.geolocation.watchPosition = function() {
      console.log('[Geo Bypass] Blocked geolocation.watchPosition()');
      return;
    };
  }

  // ========================================
  // 2. FORCE CURRENCY
  // ========================================
  
  // Set forced currency in multiple storage locations
  window.FORCED_CURRENCY = forcedCurrency;
  localStorage.setItem('shopify_currency', forcedCurrency);
  localStorage.setItem('cart_currency', forcedCurrency);
  sessionStorage.setItem('currency_code', forcedCurrency);
  
  // Set cookie for server-side recognition
  document.cookie = `currency=${forcedCurrency}; path=/; max-age=86400`;
  document.cookie = `forced_currency=${forcedCurrency}; path=/; max-age=86400`;

  // ========================================
  // 3. INTERCEPT CURRENCY CHANGES
  // ========================================
  
  // Block Shopify.currency object changes
  if (typeof Shopify !== 'undefined' && Shopify.currency) {
    Object.defineProperty(Shopify.currency, 'active', {
      get: function() {
        return forcedCurrency;
      },
      set: function(value) {
        console.log(`[Geo Bypass] Blocked currency change attempt: ${value} -> keeping ${forcedCurrency}`);
        return forcedCurrency;
      }
    });
  }

  // Intercept currency switcher form submissions
  document.addEventListener('submit', function(e) {
    if (e.target.matches('[action*="currency"]') || e.target.matches('[name*="currency"]')) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Geo Bypass] Blocked currency switcher form submission');
      return false;
    }
  }, true);

  // Intercept currency selector changes
  document.addEventListener('change', function(e) {
    if (e.target.matches('[name*="currency"]') || e.target.matches('[data-currency-selector]')) {
      e.preventDefault();
      e.stopPropagation();
      e.target.value = forcedCurrency;
      console.log('[Geo Bypass] Blocked currency selector change');
      return false;
    }
  }, true);

  // ========================================
  // 4. BLOCK POPUPS & MODALS
  // ========================================
  
  // Hide any geolocation popups
  function hideGeoPopups() {
    const geoPopupSelectors = [
      '[data-geo-popup]',
      '[data-geolocation-popup]',
      '.geo-popup',
      '.geolocation-popup',
      '.location-popup',
      '.currency-popup',
      '[id*="geo-popup"]',
      '[id*="geolocation"]',
      '[id*="location-modal"]'
    ];
    
    geoPopupSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
        el.setAttribute('hidden', 'true');
        console.log(`[Geo Bypass] Hidden popup: ${selector}`);
      });
    });
  }

  // Run on load and with observer
  hideGeoPopups();
  
  // Watch for dynamically added popups
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        hideGeoPopups();
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // ========================================
  // 5. BLOCK REDIRECTS
  // ========================================
  
  // Intercept window.location changes (with error handling)
  try {
    let isRedirecting = false;
    const originalWindowLocation = window.location.href;
    
    Object.defineProperty(window, 'location', {
      get: function() {
        return window.location;
      },
      set: function(value) {
        // Allow navigation to cart/checkout
        if (value.includes('/cart') || value.includes('/checkout')) {
          window.location.href = value;
          return;
        }
        
        // Block other redirects
      if (!isRedirecting) {
        console.log(`[Geo Bypass] Blocked redirect attempt to: ${value}`);
        return originalWindowLocation;
      }
    }
  });
  } catch (e) {
    console.log('[Geo Bypass] Could not override window.location (browser security restriction)');
  }

  // ========================================
  // 6. FORCE CURRENCY ON SHOPIFY ELEMENTS (AGGRESSIVE)
  // ========================================
  
  // Force currency immediately and continuously
  function forceCurrencyAggressively() {
    // Force Shopify.currency if it exists
    if (typeof Shopify !== 'undefined' && Shopify.currency) {
      if (Shopify.currency.active !== forcedCurrency) {
        console.log(`[Geo Bypass] Blocked currency change: ${Shopify.currency.active} -> keeping ${forcedCurrency}`);
        Shopify.currency.active = forcedCurrency;
        Shopify.currency.rate = 1;
      }
    }
    
    // Block Markets currency changes
    if (typeof window.Shopify !== 'undefined') {
      // Override Markets currency setter
      if (window.Shopify.designMode === undefined) {
        Object.defineProperty(window.Shopify, 'currency', {
          get: function() {
            return { active: forcedCurrency, rate: 1 };
          },
          set: function(value) {
            console.log('[Geo Bypass] Blocked Markets currency change attempt');
            return { active: forcedCurrency, rate: 1 };
          }
        });
      }
    }
    
    console.log('[Geo Bypass] Forced currency on Shopify object');
  }
  
  // Run immediately
  forceCurrencyAggressively();
  
  // Run every 500ms to catch Markets changes
  setInterval(forceCurrencyAggressively, 500);
  
  // Run on page visibility change
  document.addEventListener('visibilitychange', forceCurrencyAggressively);

  // ========================================
  // 7. VISUAL INDICATOR (DEVELOPMENT ONLY)
  // ========================================
  
  // Add visual indicator in development
  if (window.location.hostname.includes('myshopify.com')) {
    const indicator = document.createElement('div');
    indicator.innerHTML = `🚫 Geo Bypass Active | Currency: ${forcedCurrency} | Template: product.${templateSuffix} <span style="margin-left:10px;cursor:pointer;" onclick="this.parentElement.remove()">✕</span>`;
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: bold;
      z-index: 999999;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(indicator);
    
    // Banner stays permanent (can be closed by clicking X)
  }

  console.log('[Geo Bypass] ✅ Complete - Geolocation and currency switching disabled');
})();
