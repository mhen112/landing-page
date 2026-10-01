// --- ตั้งค่า Telegram Bot ---
const TELEGRAM_BOT_TOKEN = '8738377643:AAGMu6RYmcc0J_ArLGsR7ovmo9HdHkdTEJI'; // เช่น '7123456789:AAFg...'
const TELEGRAM_CHAT_ID = '-1004316117671';     // เช่น '123456789' หรือ '-100xxxxxxxxx'

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // 1. กรณีทดสอบส่ง Telegram จากระบบ
    if (data.action === 'test_telegram') {
      const testMsg = "🔔 <b>[Tang Butcher System Test]</b>\nการเชื่อมต่อ Telegram Notification สำเร็จเรียบร้อยพร้อมใช้งาน!";
      sendTelegramMessage(testMsg);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'ส่งข้อความทดสอบสำเร็จ' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. บันทึกข้อมูลลง Google Sheets
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    
    sheet.appendRow([
      timestamp,
      data.customerName || 'ลูกค้าหน้าร้าน',
      data.contact || '-',
      data.items || '-',
      data.total || '0',
      data.note || '-'
    ]);

    // 3. ส่งการแจ้งเตือนเข้า Telegram (ปรับเป็น HTML เพื่อป้องกันข้อความค้าง/ส่งไม่เข้า)
    const sourceBadge = data.source === 'POS' ? '🏪 <b>[รายการขายหน้าร้าน POS]</b>' : '🛒 <b>[ออเดอร์ออนไลน์]</b>';
    const message = `${sourceBadge}\n` +
      `📅 <b>เวลา:</b> ${timestamp}\n` +
      `👤 <b>ลูกค้า:</b> ${data.customerName || 'ลูกค้าหน้าร้าน'}\n` +
      `📞 <b>ติดต่อ:</b> ${data.contact || '-'}\n` +
      `🥩 <b>รายการ:</b>\n${data.items || '-'}\n` +
      `💰 <b>ยอดชำระ:</b> ฿${data.total || '0'}\n` +
      `📝 <b>หมายเหตุ:</b> ${data.note || '-'}`;

    sendTelegramMessage(message);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชันส่งข้อความเข้า Telegram API
function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'ใส่_BOT_TOKEN_ตรงนี้') {
    Logger.log('⚠️ ยังไม่ได้ใส่ TELEGRAM_BOT_TOKEN');
    return;
  }
  
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: 'HTML' // เปลี่ยนเป็น HTML ป้องกัน Error เวลาสินค้ามีวงเล็บหรือสัญลักษณ์พิเศษ
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}
