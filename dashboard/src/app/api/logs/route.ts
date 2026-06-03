import { NextRequest, NextResponse } from 'next/server';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'motion' | 'calibration' | 'threshold_change' | 'system';
  message: string;
  data?: Record<string, any>;
}

// Module-level storage untuk logs (max 500 entries)
let logs: LogEntry[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    type: 'system',
    message: 'System initialized',
    data: { version: '1.0.0' },
  },
];

const MAX_LOGS = 500;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '50');

  let filtered = logs;
  if (type) {
    filtered = logs.filter((log) => log.type === type);
  }

  return NextResponse.json({
    total: filtered.length,
    logs: filtered.slice(-limit).reverse(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: body.type || 'system',
      message: body.message,
      data: body.data,
    };

    logs.push(logEntry);

    // Batasi logs ke MAX_LOGS
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }

    console.log('[API] Log added:', logEntry);

    return NextResponse.json({
      success: true,
      log: logEntry,
    });
  } catch (error) {
    console.error('[API] Error adding log:', error);
    return NextResponse.json(
      { error: 'Failed to add log' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  logs = [];
  return NextResponse.json({
    success: true,
    message: 'All logs cleared',
  });
}
