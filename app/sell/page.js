// app/api/telegram/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message } = await request.json();

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      console.error('Missing Telegram Config Environment Variables');
      return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    // ครั้งที่ 1: ลองส่งแบบ HTML Formatting
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();

    // ครั้งที่ 2 (Fallback): ถ้า Telegram ฟ้องว่า HTML มีปัญหา ให้ลบ HTML Tag ออกแล้วยิงใหม่ทันที
    if (!data.ok) {
      console.warn('Telegram HTML parse failed, retrying without HTML:', data.description);
      
      const plainTextMessage = message.replace(/<[^>]*>/g, ''); // ถอดแท็ก HTML ออก
      
      const retryRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: plainTextMessage,
        }),
      });

      const retryData = await retryRes.json();
      return NextResponse.json(retryData);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Telegram API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
