/* ==========================================================================
   Tang Butcher - Main JavaScript (Shared script for all pages)
   ========================================================================== */

// --- Configuration Constants ---
// กรุณานำ URL จาก Google Apps Script และ Google Sheets CSV มาใส่ในตัวแปรด้านล่างนี้
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzPrcFFHdqpOqPz2jq66foKbNFJpjHwpQ6B6zk16i-8kzkXT0-xGOXdI-40hH2SZd4_OQ/exec'; 
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRbEvLt7Zn_YqWNhDi1Ge76jksnhtCSsWmfbIDjIGjfCZkTDzIj_HE-QmifIbNQsBeIU6pAcwfQG9yv/pub?output=csv';

// Mood to Type mapping (รองรับ parameter ?mood=xxx)
const MOOD_MAP = {
  'fresh': 'chicken',
  'relax': 'pork',
  'focus': 'beef',
  'romance': 'duck' // หรือ 'cheese'
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. หน้า product.html
  if (document.getElementById('product-list')) {
    initProductPage();
  }

  // 2. หน้า order.html
  if (document.getElementById('orderForm')) {
    initOrderPage();
  }

  // 3. หน้า admin.html
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

  // โหลดข้อมูลจาก products.json
  fetch('products.json')
    .then(response => {
      if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลสินค้าได้');
      return response.json();
    })
    .then(products => {
      allProducts = products;
      
      // ตรวจสอบ URL parameter (?mood=xxx หรือ ?type=xxx)
      const urlParams = new URLSearchParams(window.location.search);
      const moodParam = urlParams.get('mood')?.toLowerCase();
      const typeParam = urlParams.get('type')?.toLowerCase();

      let initialType = 'all';

      if (typeParam) {
        initialType = typeParam;
      } else if (moodParam) {
        // แปลงค่า mood เป็น type หรือถ้าตรงกับ type อยู่แล้วก็ใช้ค่านั้น
        initialType = MOOD_MAP[moodParam] || moodParam;
      }

      // แสดงสินค้าตามเงื่อนไขเริ่มต้น
      filterAndRenderProducts(initialType, allProducts, productList);
      setActiveFilterButton(initialType);

      // ตั้งค่า Event Listener ให้ปุ่มกรองสินค้า
      if (filterBar) {
        filterBar.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-type]');
          if (!btn) return;

          const selectedType = btn.getAttribute('data-type');
          
          // อัปเดตการแสดงผลปุ่มที่ถูกเลือก
          filterBar.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          filterAndRenderProducts(selectedType, allProducts, productList);
        });
      }
    })
    .catch(error => {
      console.error(error);
      productList.innerHTML = `<p class="error-msg" style="text-align: center; color: var(--text-muted);">เกิดข้อผิดพลาดในการโหลดรายการสินค้า</p>`;
    });
}

// ฟังก์ชันกรองและสร้างการ์ดสินค้า
function filterAndRenderProducts(type, products, container) {
  const filtered = (type === 'all' || !type) 
    ? products 
    : products.filter(p => p.type === type);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="text-align: center; grid-column: 1/-1; color: var(--text-muted); padding: 3rem 0;">ไม่พบสินค้าในหมวดหมู่ที่เลือก</p>`;
    return;
  }

  container.innerHTML = filtered.map(product => {
    const fullProductName = `${product.name} ${product.size}`;
    const orderUrl = `order.html?item=${encodeURIComponent(fullProductName)}&price=${encodeURIComponent(product.price)}`;

    return `
      <article class="product-card" data-type="${product.type}">
        <div class="product-image-wrapper">
          <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Tang+Butcher'">
        </div>
        <div class="product-info">
          <div class="product-meta">
            <span class="type-dot"></span>
            <span>${product.size}</span>
          </div>
          <div class="product-header">
            <h3 class="product-title">${product.name}</h3>
            <span class="product-price">฿${product.price}</span>
          </div>
          <p class="product-desc">${product.description}</p>
          <a href="${orderUrl}" class="btn btn-accent" style="margin-top: auto; text-align: center;">สั่งซื้อ</a>
        </div>
      </article>
    `;
  }).join('');
}

// ฟังก์ชันไฮไลต์ปุ่มกรองตามประเภท
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

  // ดึงค่า item และ price จาก URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const itemParam = urlParams.get('item');
  const priceParam = urlParams.get('price');

  // เติมค่าลงฟอร์มทันทีที่โหลดหน้า (เติมทั้งสองช่อง)
  if (itemsInput && itemParam) {
    itemsInput.value = itemParam;
  }
  if (totalInput && priceParam) {
    totalInput.value = priceParam;
  }

  // ส่งข้อมูลเมื่อกดยืนยันสั่งซื้อ
  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const payload = {
        customerName: document.getElementById('customerName').value.trim(),
        contact: document.getElementById('contact').value.trim(),
        items: document.getElementById('items').value.trim(),
        total: document.getElementById('total').value.trim(),
        note: document.getElementById('note').value.trim()
      };

      // ส่งข้อมูลด้วย pattern ที่กำหนดเป๊ะๆ
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

      // แยก Header และ Data
      const dataRows = parsedRows.slice(1);

      // เรียงจากรายการล่าสุดขึ้นก่อน (ย้อนแถวอาศัยการ Append จากล่างขึ้นบนของ Apps Script)
      dataRows.reverse();

      // แสดงผลลงตาราง
      tableBody.innerHTML = dataRows.map(row => {
        // กำหนดความปลอดภัยป้องกัน undefined
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

// Custom CSV Parser (ไม่ใช้ External Library)
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
        i++; // ข้ามเครื่องหมาย quote ถัดไป
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
        // ข้ามตัวอักษร Carriage Return
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

  // จัดการฟิลด์สุดท้ายของไฟล์
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Utility ฟังก์ชันช่วยล้างอักขระพิเศษ ป้องกัน XSS
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
