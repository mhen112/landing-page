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
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = orderForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'กำลังส่งข้อมูล...';
      }

      const payload = {
        customerName: document.getElementById('customerName')?.value.trim() || '',
        contact: document.getElementById('contact')?.value.trim() || '',
        items: document.getElementById('items')?.value.trim() || '',
        total: document.getElementById('total')?.value.trim() || '',
        note: document.getElementById('note')?.value.trim() || ''
      };

      // ข้อความแจ้งเตือน Telegram
      const telegramMessage = [
        '🛒 <b>มีรายการสั่งซื้อใหม่จากลูกค้า!</b>',
        `- ชื่อลูกค้า: ${payload.customerName}`,
        `- ติดต่อ: ${payload.contact}`,
        `- สินค้า: ${payload.items}`,
        `- ราคารวม: ${payload.total} บาท`,
        `- หมายเหตุ: ${payload.note || '-'}`
      ].join('\n');

      try {
        // ยิงหา Telegram และ Google Sheets พร้อมกัน แล้วรอให้เสร็จก่อนเปลี่ยนหน้า
        await Promise.allSettled([
          fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: telegramMessage })
          }),
          fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
          })
        ]);

        window.location.href = 'thankyou.html';
      } catch (error) {
        console.error('Submit Error:', error);
        window.location.href = 'thankyou.html';
      }
    });
  }
}
