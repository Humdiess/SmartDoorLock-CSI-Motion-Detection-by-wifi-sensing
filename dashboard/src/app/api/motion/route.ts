import { NextRequest } from 'next/server';

// Module-level storage untuk data terakhir
let lastMotionData = {
  variance: 0,
  threshold: 0,
  motion: false,
  rssi: 0,
  timestamp: Date.now(),
  receivedAt: new Date().toISOString(),
  lastRfidUid: 'None',
  lastRfidStatus: 'None',
};

// Menyimpan history untuk grafik (max 60 data points = 1 menit)
let varianceHistory: Array<{
  time: string;
  variance: number;
  threshold: number;
}> = [];

const MAX_HISTORY = 60;

// Store active SSE connections with proper TextEncoder
const encoder = new TextEncoder();
const clients = new Set<ReadableStreamDefaultController>();

// Track previous motion state untuk detect perubahan
let previousMotionState = false;
let lastMotionAlertTime = 0;

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[API] JSON parse error:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON from ESP32' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validasi data dari ESP32
    if (
      typeof body.variance !== 'number' ||
      typeof body.threshold !== 'number' ||
      typeof body.motion !== 'boolean' ||
      typeof body.rssi !== 'number'
    ) {
      return new Response(JSON.stringify({ error: 'Invalid data format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update data terakhir
    lastMotionData = {
      variance: body.variance,
      threshold: body.threshold,
      motion: body.motion,
      rssi: body.rssi,
      timestamp: body.timestamp || Date.now(),
      receivedAt: new Date().toISOString(),
      lastRfidUid: body.lastRfidUid || lastMotionData.lastRfidUid,
      lastRfidStatus: body.lastRfidStatus || lastMotionData.lastRfidStatus,
    };

    // Log RFID scans to RFID logs API
    if (body.lastRfidUid && body.lastRfidUid !== 'None' && body.lastRfidStatus && body.lastRfidStatus !== 'None') {
      // Check if this is a new scan (UID changed from previous)
      const isNewScan = body.lastRfidUid !== lastMotionData.lastRfidUid;
      
      if (isNewScan) {
        console.log('[RFID] New scan detected:', body.lastRfidUid, body.lastRfidStatus);
        
        // Log to RFID logs API (async, non-blocking)
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const rfidLogsUrl = `${protocol}://${host}/api/rfid/logs`;
        
        fetch(rfidLogsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: body.lastRfidUid,
            status: body.lastRfidStatus,
          }),
        })
        .then(r => console.log('[RFID LOG] Logged scan, status:', r.status))
        .catch(e => console.error('[RFID LOG] Failed to log scan:', e));
      }
    }

    // Trigger alerts jika motion terdeteksi (state change dari false ke true)
    if (body.motion && !previousMotionState) {
      previousMotionState = true;
      const now = Date.now();
      
      // Debounce: hanya trigger alert setiap 2 detik
      if (now - lastMotionAlertTime > 2000) {
        lastMotionAlertTime = now;
        
        console.log('[Motion Alert] Motion detected - sending Telegram alert');
        
        // Send Telegram alert (async, non-blocking)
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const telegramUrl = `${protocol}://${host}/api/alerts/telegram`;
        
        // Fire-and-forget: don't await, let it run in background
        fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'motion_detected',
            data: lastMotionData,
          }),
        })
        .then(r => console.log('[Telegram] Alert sent, status:', r.status))
        .catch(e => console.error('[Telegram] Failed to send alert:', e));
      }
    } else if (!body.motion && previousMotionState) {
      previousMotionState = false;
      console.log('[Motion Alert] Motion cleared');
    }

    // Tambah ke history
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    varianceHistory.push({
      time: timeStr,
      variance: body.variance,
      threshold: body.threshold,
    });

    // Batasi history ke MAX_HISTORY
    if (varianceHistory.length > MAX_HISTORY) {
      varianceHistory = varianceHistory.slice(-MAX_HISTORY);
    }

    // Broadcast ke semua SSE clients (properly encoded)
    const message = JSON.stringify({
      current: lastMotionData,
      history: varianceHistory,
    });

    const encoded = encoder.encode(`data: ${message}\n\n`);
    const deadClients: ReadableStreamDefaultController[] = [];

    clients.forEach((controller) => {
      try {
        controller.enqueue(encoded);
      } catch (e) {
        deadClients.push(controller);
      }
    });

    // Clean up dead clients outside iteration
    deadClients.forEach((c) => clients.delete(c));

    console.log(`[API] Motion data received (clients: ${clients.size})`);

    return new Response(JSON.stringify({ success: true, message: 'Data received' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[API] Error processing POST:', error);
    return new Response(JSON.stringify({ error: 'Failed to process data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isStream = searchParams.get('stream');

  // SSE endpoint
  if (isStream === 'true') {
    const stream = new ReadableStream({
      start(controller) {
        // Add client to set
        clients.add(controller);

        // Send initial data
        const initialData = JSON.stringify({
          current: lastMotionData,
          history: varianceHistory,
        });
        controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

        // SSE Heartbeat: Send ping setiap 15 detik untuk keep connection alive
        // (reduced frequency to lower overhead)
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch (e) {
            // Connection closed, cleanup
            clearInterval(heartbeatInterval);
            clients.delete(controller);
            try { controller.close(); } catch {}
          }
        }, 15000);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          clients.delete(controller);
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',  // Disable buffering untuk real-time
      },
    });
  }

  // Regular GET endpoint (fallback)
  return new Response(
    JSON.stringify({
      current: lastMotionData,
      history: varianceHistory,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
