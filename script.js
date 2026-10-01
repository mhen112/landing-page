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

    if (error) console.error('Error fetching products:', error)
    else setProducts(data || [])
  }

  // ส่งข้อความผ่าน API Route ฝั่ง Server (ข้าม AdBlocker)
  const sendTelegramNotification = async (messageText) => {
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })
      const result = await res.json()
      if (!res.ok) console.error('Telegram Server Error:', result)
    } catch (error) {
      console.error('Network Error:', error)
    }
  }

  const handleSell = async (e) => {
    e.preventDefault()
    if (!selectedProductId || quantity <= 0) return

    setLoading(true)
    setMessage('')

    try {
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', selectedProductId)
        .single()

      if (fetchError || !product) throw new Error('ไม่พบข้อมูลสินค้า')
      if (product.stock < quantity) throw new Error(`สต๊อกสินค้าไม่พอ (คงเหลือ ${product.stock} ชิ้น)`)

      const updatedStock = product.stock - Number(quantity)
      const totalPrice = product.price * Number(quantity)

      // ตัดสต๊อก
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: updatedStock })
        .eq('id', selectedProductId)

      if (updateError) throw updateError

      // บันทึกการขาย
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

      // ส่งแจ้งเตือน Telegram
      const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })

      const orderMessage = [
        '🛍️ <b>มีรายการขายใหม่!</b>',
        `- สินค้า: ${product.name}`,
        `- จำนวน: ${quantity} ชิ้น`,
        `- ราคารวม: ${totalPrice.toLocaleString()} บาท`,
        `- สต๊อกคงเหลือปัจจุบัน: ${updatedStock} ชิ้น`,
        `- เวลา: ${currentTime}`,
      ].join('\n')

      await sendTelegramNotification(orderMessage)

      if (updatedStock <= 5) {
        const lowStockMessage = [
          '🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>',
          `- สินค้า: ${product.name}`,
          `- คงเหลือเพียง: ${updatedStock} ชิ้น`,
          '⚠️ กรุณาเติมสต๊อกสินค้าด่วน!',
        ].join('\n')

        await sendTelegramNotification(lowStockMessage)
      }

      setMessage('✅ บันทึกการขายสำเร็จ!')
      setQuantity(1)
      setSelectedProductId('')
      fetchProducts()
    } catch (err) {
      console.error(err)
      setMessage(`❌ เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>ขายสินค้า (POS)</h2>
      {message && (
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginBottom: '15px' }}>
          {message}
        </div>
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
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'กำลังบันทึก...' : 'บันทึกการขาย'}
        </button>
      </form>
    </div>
  )
}
