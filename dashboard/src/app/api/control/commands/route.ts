import { NextRequest, NextResponse } from 'next/server';

// Store pending commands for ESP32
let pendingCommands: string[] = [];

export async function GET(request: NextRequest) {
  // ESP32 polls this endpoint to get pending commands
  if (pendingCommands.length > 0) {
    const command = pendingCommands.shift();
    console.log('[API] Sending command to ESP32:', command);
    return NextResponse.json({ command });
  }
  
  return NextResponse.json({ command: null });
}

export async function POST(request: NextRequest) {
  // Web dashboard sends commands here
  try {
    const body = await request.json();
    const { action, value } = body;

    let command = '';

    if (action === 'door') {
      command = value === 'lock' ? 'door:lock' : 'door:unlock';
    } else if (action === 'buzzer') {
      command = value === 'on' ? 'buzzer:on' : 'buzzer:off';
    } else if (action === 'lcd') {
      command = `lcd:${value}|`;
    } else if (action === 'calibrate') {
      command = 'calibrate';
    } else if (action === 'threshold') {
      command = `threshold:${value}`;
    }

    if (command) {
      pendingCommands.push(command);
      console.log('[API] Command queued:', command);
      
      return NextResponse.json({
        success: true,
        message: 'Command sent to device',
        command,
      });
    }

    return NextResponse.json(
      { error: 'Invalid command' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error processing command:', error);
    return NextResponse.json(
      { error: 'Failed to process command' },
      { status: 500 }
    );
  }
}
