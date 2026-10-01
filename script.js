/* ==========================================================================
   Tang Butcher - Main JavaScript (script.js)
   ========================================================================== */

// --- Configuration Constants ---
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE'; 
const CSV_URL = 'YOUR_GOOGLE_SHEETS_CSV_URL_HERE';

// Mood to Type mapping
const MOOD_MAP = {
  'fresh': 'chicken',
  'relax': 'pork',
  'focus': 'beef',
  'romance': 'duck'
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) {
    initProductPage();
  }
  if (document.getElementById('orderForm')) {
    initOrderPage();
  }
  if (document.getElementById('ordersTable')) {
    initAdminPage();
  }
});

/* ==========================================================================
   1. PRODUCT PAGE LOGIC (product.html)
   ========================================================================== */
function initProductPage() {
  const productList = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');
  let allProducts = [];

  fetch('products.json')
    .then(response => {
      if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลสินค้าได้');
      return response.json();
    })
    .then(products => {
      allProducts = products;

      const urlParams = new URLSearchParams(window.location.search);
      const moodParam = urlParams.get('mood')?.toLowerCase();
      const typeParam = urlParams.get('type')?.toLowerCase();

      let initialType = 'all';
      if (typeParam) {
        initialType = typeParam;
      } else if (moodParam) {
        initialType = MOOD_MAP[moodParam] || moodParam;
      }

      filterAndRenderProducts(initialType, allProducts, productList);
      setActiveFilterButton(initialType);

      if (filterBar) {
        filterBar.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-type]');
          if (!btn) return;

          const selectedType = btn.getAttribute('data-type');
          filterBar.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          filterAndRenderProducts(selectedType, allProducts, productList);
        });
      }
    })
    .catch(error => {
      console.error(error);
      if (productList) {
        productList.innerHTML = `<p class="error-msg" style="text-align: center; color: var(--text-muted);">เกิดข้อผิดพลาดในการโหลดรายการสินค้า</p>`;
      }
    });
}

function filterAndRenderProducts(type, products, container) {
  if (!container) return;
  const filtered = (type === 'all' || !type) 
    ? products 
    : products.filter(p => p.type === type);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="text-align: center; grid-column: 1/-1; color: var(--text-muted); padding: 3rem 0;">ไม่พบสินค้าในหมวดหมู่ที่เลือก</p>`;
    return;
  }

  container.innerHTML = filtered.map(product => {
    const fullProductName = `${product.name} ${product.size || ''}`;
    const orderUrl = `order.html?item=${encodeURIComponent(fullProductName)}&price=${encodeURIComponent(product.price)}`;

    return `
      <article class="product-card" data-type="${product.type}">
        <div class="product-image-wrapper">
          <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Tang+Butcher'">
        </div>
        <div class="product-info">
          <div class="product-meta">
            <span class="type-dot"></span>
            <span>${product.size || ''}</span>
          </div>
          <div class="product-header">
            <h3 class="product-title">${product.name}</h3>
            <span class="product-price">฿${product.price}</span>
          </div>
          <p class="product-desc">${product.description || ''}</p>
          <a href="${orderUrl}" class="btn btn-accent" style="margin-top: auto; text-align: center;">สั่งซื้อ</a>
        </div>
      </article>
    `;
  }).join('');
}

function setActiveFilterButton(type) {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  filterBar.querySelectorAll('[data-type]').forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/* ==========================================================================
   2. ORDER PAGE LOGIC (order.html)
   ========================================================================== */
function initOrderPage() {
  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');
  const orderForm = document.getElementById('orderForm');

  const urlParams = new URLSearchParams(window.location.search);
  const itemParam = urlParams.get('item');
  const priceParam = urlParams.get('price');

  if (itemsInput && itemParam) itemsInput.value = itemParam;
  if (totalInput && priceParam) totalInput.value = priceParam;

  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const payload = {
        customerName: document.getElementById('customerName')?.value.trim() || '',
        contact: document.getElementById('contact')?.value.trim() || '',
        items: document.getElementById('items')?.value.trim() || '',
        total: document.getElementById('total')?.value.trim() || '',
        note: document.getElementById('note')?.value.trim() || ''
      };

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
    });
  }
}

/* ==========================================================================
   3. ADMIN PAGE LOGIC (admin.html)
   ========================================================================== */
function initAdminPage() {
  const tableBody = document.querySelector('#ordersTable tbody');
  if (!tableBody) return;

  fetch(CSV_URL)
    .then(response => {
      if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูล CSV ได้');
      return response.text();
    })
    .then(csvText => {
      const parsedRows = parseCSV(csvText);

      if (parsedRows.length <= 1) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">ไม่พบข้อมูลรายการสั่งซื้อ</td></tr>`;
        return;
      }

      const dataRows = parsedRows.slice(1);
      dataRows.reverse();

      tableBody.innerHTML = dataRows.map(row => {
        const timestamp = row[0] || '-';
        const name = row[1] || '-';
        const contact = row[2] || '-';
        const items = row[3] || '-';
        const total = row[4] || '-';
        const note = row[5] || '-';

        return `
          <tr>
            <td>${escapeHTML(timestamp)}</td>
            <td>${escapeHTML(name)}</td>
            <td>${escapeHTML(contact)}</td>
            <td>${escapeHTML(items)}</td>
            <td>${escapeHTML(total)}</td>
            <td>${escapeHTML(note)}</td>
          </tr>
        `;
      }).join('');
    })
    .catch(error => {
      console.error(error);
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red; padding: 2rem;">เกิดข้อผิดพลาดในการดึงข้อมูลรายการสั่งซื้อ</td></tr>`;
    });
}

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // Skip carriage return
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
