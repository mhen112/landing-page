// app/sell/page.js
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SellPage() {
  const [products, setProducts] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.error('Error fetching products:', error)
    } else {
      setProducts(data || [])
    }
  }

  // ฟังก์ชันส่งข้อความไปยัง Telegram API
  const sendTelegramNotification = async (messageText) => {
    const botToken = bot8989595298:AAGChc38obda98T3oC0WQ-EL0ir_spVTbow
    const chatId = @tangbucher

    if (!botToken || !chatId) {
      console.warn('ไม่พบค่า NEXT_PUBLIC_TELEGRAM_BOT_TOKEN หรือ NEXT_PUBLIC_TELEGRAM_CHAT_ID ใน Environment Variables')
      return
    }

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML',
        }),
      })
    } catch (error) {
      // ดักจับ error ไม่ให้กระทบกระบวนการขายหลักในหน้าเว็บ
      console.error('เกิดข้อผิดพลาดในการส่งข้อความ Telegram:', error)
    }
  }

  const handleSell = async (e) => {
    e.preventDefault()
    if (!selectedProductId || quantity <= 0) return

    setLoading(true)
    setMessage('')

    try {
      // 1. ตรวจสอบข้อมูลสินค้าและสต๊อกปัจจุบัน
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', selectedProductId)
        .single()

      if (fetchError || !product) {
        throw new Error('ไม่พบข้อมูลสินค้า')
      }

      if (product.stock < quantity) {
        throw new Error(`สต๊อกสินค้าไม่พอ (คงเหลือ ${product.stock} ชิ้น)`)
      }

      const updatedStock = product.stock - Number(quantity)
      const totalPrice = product.price * Number(quantity)

      // 2. ตัดสต๊อกสินค้าในตาราง products
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: updatedStock })
        .eq('id', selectedProductId)

      if (updateError) throw updateError

      // 3. บันทึกข้อมูลการขายในตาราง sales
      const { error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            product_id: product.id,
            product_name: product.name,
            quantity: Number(quantity),
            total_price: totalPrice,
            created_at: new Date().toISOString(),
          },
        ])

      if (saleError) throw saleError

      // 4. ระบบแจ้งเตือนผ่าน Telegram (เพิ่มใหม่)
      const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })

      // งานที่ 1: แจ้งเตือน Order เข้า
      const orderMessage = [
        '🛍️ <b>มีรายการขายใหม่!</b>',
        `- สินค้า: ${product.name}`,
        `- จำนวน: ${quantity} ชิ้น`,
        `- ราคารวม: ${totalPrice.toLocaleString()} บาท`,
        `- สต๊อกคงเหลือปัจจุบัน: ${updatedStock} ชิ้น`,
        `- เวลา: ${currentTime}`,
      ].join('\n')

      await sendTelegramNotification(orderMessage)

      // งานที่ 2: แจ้งเตือน Stock เหลือน้อย (<= 5 ชิ้น)
      if (updatedStock <= 5) {
        const lowStockMessage = [
          '🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>',
          `- สินค้า: ${product.name}`,
          `- คงเหลือเพียง: ${updatedStock} ชิ้น`,
          '⚠️ กรุณาเติมสต๊อกสินค้าด่วน!',
        ].join('\n')

        await sendTelegramNotification(lowStockMessage)
      }

      // รีเซ็ตฟอร์มและโหลดข้อมูลสินค้าใหม่
      setMessage('ขายสินค้าสำเร็จ!')
      setQuantity(1)
      setSelectedProductId('')
      fetchProducts()
    } catch (err) {
      console.error(err)
      setMessage(`เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>ขายสินค้า (POS)</h2>
      {message && (
        <p style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          {message}
        </p>
      )}
      <form onSubmit={handleSell}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>เลือกสินค้า:</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="">-- เลือกสินค้า --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {p.price} บาท (คงเหลือ {p.stock} ชิ้น)
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>จำนวน:</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'กำลังบันทึก...' : 'บันทึกการขาย'}
        </button>
      </form>
    </div>
  )
}
