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

  // โหลดรายการสินค้าจาก Supabase
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

  // -------------------------------------------------------------
  // ฟังก์ชันยิงข้อความไปยัง Telegram ผ่าน API Route (/api/telegram)
  // -------------------------------------------------------------
  const sendTelegramMessage = async (messageText) => {
    try {
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })
    } catch (error) {
      // ดักจับ error ไม่ให้การยิง Telegram พังกระบวนการขาย
      console.error('ไม่สามารถส่งข้อความไปยัง Telegram ได้:', error)
    }
  }

  // ฟังก์ชันจัดการการขายสินค้า
  const handleSell = async (e) => {
    e.preventDefault()
    if (!selectedProductId || quantity <= 0) return

    setLoading(true)
    setMessage('')

    try {
      // 1. ดึงข้อมูลสินค้าล่าสุดเพื่อตรวจสอบสต๊อก
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', selectedProductId)
        .single()

      if (fetchError || !product) {
        throw new Error('ไม่พบข้อมูลสินค้า')
      }

      if (product.stock < quantity) {
        throw new Error(`สต๊อกไม่พอ (คงเหลือ ${product.stock} ชิ้น)`)
      }

      const updatedStock = product.stock - quantity
      const totalPrice = product.price * quantity

      // 2. ตัดสต๊อกสินค้าในตาราง products
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: updatedStock })
        .eq('id', selectedProductId)

      if (updateError) throw updateError

      // 3. บันทึกประวัติการขายในตาราง sales
      const { error: salesError } = await supabase
        .from('sales')
        .insert([
          {
            product_id: product.id,
            product_name: product.name,
            quantity: quantity,
            total_price: totalPrice,
            created_at: new Date().toISOString()
          }
        ])

      if (salesError) throw salesError

      // -------------------------------------------------------------
      // 4. ส่งการแจ้งเตือนเข้า Telegram
      // -------------------------------------------------------------
      const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })

      // งานที่ 1: แจ้งเตือน Order เข้า
      const orderMessage = [
        '<b>🛍️ มีรายการขายใหม่!</b>',
        `• สินค้า: <b>${product.name}</b>`,
        `• จำนวน: ${quantity} ชิ้น`,
        `• ราคารวม: ${totalPrice.toLocaleString()} บาท`,
        `• สต๊อกคงเหลือปัจจุบัน: ${updatedStock} ชิ้น`,
        `• เวลา: ${now}`
      ].join('\n')

      await sendTelegramMessage(orderMessage)

      // งานที่ 2: แจ้งเตือน Stock เหลือน้อย (<= 5 ชิ้น)
      if (updatedStock <= 5) {
        const lowStockMessage = [
          '<b>🚨 [เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>',
          `• สินค้า: <b>${product.name}</b>`,
          `• คงเหลือเพียง: <b>${updatedStock}</b> ชิ้น`,
          '⚠️ กรุณาเติมสต๊อกสินค้าด่วน!'
        ].join('\n')

        await sendTelegramMessage(lowStockMessage)
      }

      // รีเฟรชรายการสินค้าและเคลียร์ฟอร์ม
      await fetchProducts()
      setSelectedProductId('')
      setQuantity(1)
      setMessage('✅ บันทึกการขายสำเร็จ!')
    } catch (err) {
      console.error(err)
      setMessage(`❌ เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1>ระบบขายสินค้า (POS)</h1>

      {message && (
        <div style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSell} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>เลือกสินค้า:</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">--เลือกสินค้า--</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {p.price} บาท (คงเหลือ {p.stock} ชิ้น)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>จำนวน:</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'กำลังบันทึก...' : 'กดขายสินค้า'}
        </button>
      </form>
    </div>
  )
}
