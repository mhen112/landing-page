'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// สร้าง Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ดึงค่า Telegram Configuration จาก Env
const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

/**
 * ฟังก์ชันยิง API ส่งข้อความไปยัง Telegram Channel
 */
async function sendTelegramMessage(messageText) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('⚠️ Telegram Config ไม่ถูกต้อง กรุณาเช็ค Environment Variables');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('❌ Telegram API Error:', data.description);
    }
  } catch (error) {
    console.error('❌ ไม่สามารถส่งข้อความไปยัง Telegram ได้:', error);
  }
}

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // ดึงข้อมูลสินค้าจาก Supabase
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setFetching(true);
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      console.error('เกิดข้อผิดพลาดในการโหลดสินค้า:', error.message);
    } else {
      setProducts(data || []);
      if (data && data.length > 0) {
        setSelectedProductId(data[0].id);
      }
    }
    setFetching(false);
  };

  // ฟังก์ชันจัดการการขายสินค้าและตัดสต๊อก
  const handleSell = async (e) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) {
      alert('กรุณาเลือกสินค้าและระบุจำนวนที่ถูกต้อง');
      return;
    }

    setLoading(true);

    try {
      // 1. ดึงข้อมูลสินค้ารายการที่เลือก
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', selectedProductId)
        .single();

      if (fetchError || !product) {
        throw new Error('ไม่พบข้อมูลสินค้า');
      }

      // ตรวจสอบสต๊อกคงเหลือ
      if (product.stock < quantity) {
        alert(`สต๊อกสินค้าไม่พอ! (คงเหลือ ${product.stock} ชิ้น)`);
        setLoading(false);
        return;
      }

      // 2. คำนวณสต๊อกใหม่หลังตัดขาย
      const newStock = product.stock - quantity;
      const totalPrice = product.price * quantity;

      // 3. อัปเดตสต๊อกลงใน Supabase
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id);

      if (updateError) {
        throw new Error('เกิดข้อผิดพลาดในการอัปเดตสต๊อก: ' + updateError.message);
      }

      // 4. เวลาปัจจุบันสำหรับแจ้งเตือน
      const currentTime = new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
      });

      // --- งานที่ 1: แจ้งเตือน Order เข้า (New Order Alert) ---
      const newOrderMessage = `🛍️ <b>มีรายการขายใหม่!</b>
- สินค้า: ${product.name}
- จำนวน: ${quantity} ชิ้น
- ราคารวม: ${totalPrice.toLocaleString()} บาท
- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น
- เวลา: ${currentTime}`;

      await sendTelegramMessage(newOrderMessage);

      // --- งานที่ 2: แจ้งเตือน Stock เหลือน้อย (Low Stock Alert <= 5) ---
      if (newStock <= 5) {
        const lowStockMessage = `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>
- สินค้า: ${product.name}
- คงเหลือเพียง: ${newStock} ชิ้น
⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

        await sendTelegramMessage(lowStockMessage);
      }

      alert('ทำรายการขายและตัดสต๊อกสำเร็จ!');
      setQuantity(1);
      fetchProducts(); // โหลดข้อมูลสต๊อกใหม่
    } catch (err) {
      console.error(err);
      alert(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId));

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <h2>🛒 ระบบขายสินค้า (POS)</h2>

      {fetching ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <form onSubmit={handleSell} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>เลือกสินค้า:</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (คงเหลือ: {p.stock} ชิ้น - ฿{p.price})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>จำนวนที่ขาย:</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>

          {selectedProduct && (
            <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
              <p style={{ margin: '4px 0' }}>💰 ราคาต่อชิ้น: <b>฿{selectedProduct.price}</b></p>
              <p style={{ margin: '4px 0' }}>💵 ราคารวม: <b>฿{(selectedProduct.price * quantity).toLocaleString()}</b></p>
              <p style={{ margin: '4px 0' }}>📦 สต๊อกคงเหลือปัจจุบัน: <b>{selectedProduct.stock} ชิ้น</b></p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              fontSize: '18px',
              backgroundColor: loading ? '#ccc' : '#10B981',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {loading ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการขาย'}
          </button>
        </form>
      )}
    </div>
  );
}
