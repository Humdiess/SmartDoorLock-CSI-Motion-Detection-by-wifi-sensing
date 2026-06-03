import { NextRequest, NextResponse } from 'next/server';

interface RfidLog {
  id: string;
  uid: string;
  status: 'Authorized' | 'Denied';
  timestamp: string;
  name?: string; // If we can match to known cards
}

// In-memory storage (will reset on server restart)
let rfidLogs: RfidLog[] = [];
const MAX_LOGS = 200;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  
  return NextResponse.json({
    logs: rfidLogs.slice(0, limit),
    total: rfidLogs.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, status, name } = body;
    
    if (!uid || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: uid, status' },
        { status: 400 }
      );
    }
    
    const log: RfidLog = {
      id: Date.now().toString(),
      uid,
      status,
      timestamp: new Date().toISOString(),
      name,
    };
    
    // Add to beginning of array (newest first)
    rfidLogs.unshift(log);
    
    // Keep only MAX_LOGS entries
    if (rfidLogs.length > MAX_LOGS) {
      rfidLogs = rfidLogs.slice(0, MAX_LOGS);
    }
    
    console.log('[RFID LOG] New entry:', log);
    
    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('[RFID LOG] Error:', error);
    return NextResponse.json(
      { error: 'Failed to log RFID scan' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const count = rfidLogs.length;
  rfidLogs = [];
  console.log(`[RFID LOG] Cleared ${count} entries`);
  return NextResponse.json({ success: true, cleared: count });
}
