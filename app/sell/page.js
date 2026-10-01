'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SellPage() {
  const supabase = createClientComponentClient();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 1. ดึงรายการสินค้าจาก Supabase
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setProducts(data);
    }
  };

  // --------------------------------------------------------------------------
  // Helper Function: สำหรับส่งข้อความเข้า Telegram API
  // --------------------------------------------------------------------------
  const sendTelegramNotification = async (messageText) => {
    const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn('Telegram Bot Token หรือ Chat ID ไม่ได้ตั้งค่าใน Environment Variables');
      return;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram API Error:', errorData);
      }
    } catch (err) {
      // ครอบ try-catch เพื่อป้องกันไม่ให้ Telegram Error ทำให้ระบบขายขัดข้อง
      console.error('Failed to send Telegram notification:', err);
    }
  };

  // --------------------------------------------------------------------------
  // Main Logic: ฟังก์ชันจัดการการขายและตัดสต๊อก
  // --------------------------------------------------------------------------
  const handleSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const numQuantity = parseInt(quantity, 10);
      if (!selectedProductId || isNaN(numQuantity) || numQuantity <= 0) {
        alert('กรุณาเลือกสินค้าและระบุจำนวนที่ถูกต้อง');
        setLoading(false);
        return;
      }

      // 1. ดึงข้อมูลสินค้าปัจจุบันจาก Supabase
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', selectedProductId)
        .single();

      if (fetchError || !product) {
        throw new Error('ไม่พบข้อมูลสินค้า');
      }

      // ตรวจสอบสต๊อกว่าพอขายหรือไม่
      if (product.stock_quantity < numQuantity) {
        alert(`สินค้าไม่พอขาย! คงเหลือเพียง ${product.stock_quantity} ชิ้น`);
        setLoading(false);
        return;
      }

      // 2. คำนวณสต๊อกและราคารวม
      const newStock = product.stock_quantity - numQuantity;
      const totalPrice = (product.price * numQuantity).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // 3. อัปเดตตัดสต๊อกลง Supabase
      const { error: updateError } = await supabase
        .from('products')
        .eq('id', product.id)
        .update({ stock_quantity: newStock });

      if (updateError) {
        throw updateError;
      }

      // 4. บันทึกประวัติการขาย (Optional - ถ้ามีตาราง sales)
      await supabase.from('sales').insert([
        {
          product_id: product.id,
          quantity: numQuantity,
          total_price: product.price * numQuantity,
          created_at: new Date().toISOString(),
        },
      ]);

      setMessage('บันทึกการขายและตัดสต๊อกเรียบร้อยแล้ว!');

      // ----------------------------------------------------------------------
      // 5. แจ้งเตือนเข้า Telegram Channel
      // ----------------------------------------------------------------------
      const currentTime = new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'medium',
      });

      // งานที่ 1: แจ้งเตือน Order เข้า (New Order Alert)
      const orderMessage = [
        '🛍️ <b>มีรายการขายใหม่!</b>',
        `- สินค้า: ${product.name}`,
        `- จำนวน: ${numQuantity} ชิ้น`,
        `- ราคารวม: ${totalPrice} บาท`,
        `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น`,
        `- เวลา: ${currentTime}`,
      ].join('\n');

      // ยิงแจ้งเตือนรายการขายใหม่
      await sendTelegramNotification(orderMessage);

      // งานที่ 2: แจ้งเตือน Stock เหลือน้อย (Low Stock Alert <= 5)
      if (newStock <= 5) {
        const lowStockMessage = [
          '🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>',
          `- สินค้า: ${product.name}`,
          `- คงเหลือเพียง: ${newStock} ชิ้น`,
          '⚠️ กรุณาเติมสต๊อกสินค้าด่วน!',
        ].join('\n');

        // ยิงแจ้งเตือนสต๊อกเหลือน้อยแยกอีก 1 ข้อความ
        await sendTelegramNotification(lowStockMessage);
      }

      // รีเซ็ตฟอร์มและโหลดรายการสินค้าใหม่
      setQuantity(1);
      setSelectedProductId('');
      await fetchProducts();

    } catch (err) {
      console.error('Sale Process Error:', err);
      alert('เกิดข้อผิดพลาดในการตัดสต๊อก: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1.5rem', fontFamily: 'sans-serif' }}>
      <h2>🛒 ระบบขายสินค้า POS</h2>

      {message && <p style={{ color: 'green', fontWeight: 'bold' }}>{message}</p>}

      <form onSubmit={handleSale} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>เลือกสินค้า:</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">-- เลือกรายการสินค้า --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - ฿{p.price} (คงเหลือ: {p.stock_quantity})
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '6px' }}>
            <p style={{ margin: 0 }}><strong>ราคาต่อชิ้น:</strong> ฿{selectedProduct.price}</p>
            <p style={{ margin: '0.5rem 0 0 0' }}><strong>สต๊อกปัจจุบัน:</strong> {selectedProduct.stock_quantity} ชิ้น</p>
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>จำนวนที่ขาย:</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        {selectedProduct && (
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            ราคารวมทั้งสิ้น: ฿{(selectedProduct.price * (parseInt(quantity) || 0)).toLocaleString('th-TH')}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'กำลังบันทึกและตัดสต๊อก...' : 'บันทึกการขาย (ตัดสต๊อก)'}
        </button>
      </form>
    </div>
  );
}
