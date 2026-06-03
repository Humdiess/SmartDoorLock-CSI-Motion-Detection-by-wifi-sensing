import { NextRequest, NextResponse } from 'next/server';

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Retry configuration (optimized for speed)
const MAX_RETRIES = 2;  // Reduced from 3 to 2 for faster response
const INITIAL_BACKOFF_MS = 500;
const FETCH_TIMEOUT_MS = 5000;  // Reduced from 10s to 5s

// Helper function untuk send dengan retry dan timeout
async function sendTelegramWithRetry(
  url: string,
  payload: Record<string, unknown>,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[Telegram] ✓ Success on attempt ${attempt + 1}/${retries}`);
        return response;
      }

      const errorText = await response.text();
      console.error(`[Telegram] Attempt ${attempt + 1} failed: ${response.status} - ${errorText}`);

      // Jika bukan error yang bisa di-retry, throw langsung
      if (response.status === 400 || response.status === 401) {
        throw new Error(`Unrecoverable error: ${response.status}`);
      }
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`[Telegram] Attempt ${attempt + 1}/${retries} error: ${errorMsg}`);

      if (isLastAttempt) {
        throw error;
      }

      // Exponential backoff: 500ms, 1s, 2s
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.log(`[Telegram] Retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error('All retry attempts failed');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, data } = body;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('[Telegram] Missing credentials');
      return NextResponse.json(
        { error: 'Telegram credentials not configured' },
        { status: 400 }
      );
    }

    // Format message untuk Telegram
    let telegramMessage = '';
    
    if (type === 'motion_detected') {
      telegramMessage = `
🚨 **MOTION DETECTED!**

📊 Details:
• Variance: ${data?.variance?.toFixed(3) || 'N/A'}
• Threshold: ${data?.threshold?.toFixed(3) || 'N/A'}
• Signal Strength: ${data?.rssi || 'N/A'} dBm
• Time: ${new Date().toLocaleString('id-ID')}

⚠️ Action: Buzzer activated, LED on
      `.trim();
    } else if (type === 'rfid_access') {
      telegramMessage = `
✅ **RFID ACCESS GRANTED**

📋 Details:
• Card UID: ${data?.uid || 'Unknown'}
• Status: Authorized
• Time: ${new Date().toLocaleString('id-ID')}

🔓 Action: Door unlocked
      `.trim();
    } else if (type === 'rfid_denied') {
      telegramMessage = `
❌ **RFID ACCESS DENIED**

📋 Details:
• Card UID: ${data?.uid || 'Unknown'}
• Status: Unauthorized
• Time: ${new Date().toLocaleString('id-ID')}

🔒 Action: Door locked, buzzer beep 3x
      `.trim();
    } else if (type === 'door_control') {
      telegramMessage = `
🚪 **DOOR CONTROL**

📋 Details:
• Action: ${data?.action || 'Unknown'}
• Status: ${data?.status || 'Unknown'}
• Time: ${new Date().toLocaleString('id-ID')}
      `.trim();
    } else {
      telegramMessage = `
📢 **SMART DOOR LOCK ALERT**

Message: ${message}
Time: ${new Date().toLocaleString('id-ID')}
      `.trim();
    }

    // Send to Telegram dengan retry logic
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    console.log(`[Telegram] Sending alert (type: ${type})...`);
    
    await sendTelegramWithRetry(telegramUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: telegramMessage,
      parse_mode: 'Markdown',
    });

    console.log(`[Telegram] ✓ Alert sent successfully: ${type}`);
    return NextResponse.json({ 
      success: true, 
      message: 'Alert sent to Telegram',
      type,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Telegram] ✗ Failed to send alert: ${errorMsg}`);
    
    return NextResponse.json(
      { 
        error: 'Failed to send Telegram alert',
        details: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
