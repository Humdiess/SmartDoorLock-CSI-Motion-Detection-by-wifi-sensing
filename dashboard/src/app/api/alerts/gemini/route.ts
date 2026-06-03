import { NextRequest, NextResponse } from 'next/server';

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, message } = body;

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 400 }
      );
    }

    // Prepare context untuk Gemini
    let context = '';
    
    if (type === 'motion_detected') {
      context = `
Analyze this motion detection event from a Smart Door Lock system:
- Variance: ${data?.variance?.toFixed(3)}
- Threshold: ${data?.threshold?.toFixed(3)}
- Signal Strength: ${data?.rssi} dBm
- Time: ${new Date().toLocaleString('id-ID')}

Please provide:
1. Risk assessment (Low/Medium/High)
2. Possible cause (person, animal, wind, etc.)
3. Recommended action
4. Brief analysis in Indonesian
      `.trim();
    } else if (type === 'rfid_event') {
      context = `
Analyze this RFID access event from a Smart Door Lock system:
- Event: ${data?.event || 'Unknown'}
- Card UID: ${data?.uid || 'Unknown'}
- Status: ${data?.status || 'Unknown'}
- Time: ${new Date().toLocaleString('id-ID')}

Please provide:
1. Security assessment
2. Anomaly detection (is this normal?)
3. Recommended action
4. Brief analysis in Indonesian
      `.trim();
    } else {
      context = `
Analyze this Smart Door Lock event:
${message}

Please provide analysis and recommendations in Indonesian.
      `.trim();
    }

    // Call Gemini API
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: context,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      console.error('Gemini API error:', await response.text());
      return NextResponse.json(
        { error: 'Failed to get Gemini analysis' },
        { status: 500 }
      );
    }

    const result = await response.json();
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available';

    console.log('[Gemini] Analysis generated for:', type);
    
    return NextResponse.json({
      success: true,
      type,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Gemini] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process analysis' },
      { status: 500 }
    );
  }
}
