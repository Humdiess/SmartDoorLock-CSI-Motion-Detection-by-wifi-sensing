import { NextRequest, NextResponse } from 'next/server';

// Module-level storage untuk settings
let settings = {
  threshold: 0.6,
  debounceDelay: 5000,
  calibrationMode: false,
  lastCalibration: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.threshold !== undefined) {
      settings.threshold = Math.max(0, Math.min(1, body.threshold));
    }

    if (body.debounceDelay !== undefined) {
      settings.debounceDelay = Math.max(1000, body.debounceDelay);
    }

    if (body.calibrationMode !== undefined) {
      settings.calibrationMode = body.calibrationMode;
      if (body.calibrationMode) {
        settings.lastCalibration = new Date().toISOString();
      }
    }

    console.log('[API] Settings updated:', settings);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('[API] Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
