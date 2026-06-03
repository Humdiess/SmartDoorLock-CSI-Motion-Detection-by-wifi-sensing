'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/* ── Types ─────────────────────────────────────── */
interface MotionData {
  current: {
    variance: number; threshold: number; motion: boolean;
    rssi: number; timestamp: number; receivedAt: string;
    lastRfidUid?: string; lastRfidStatus?: string;
    connectedWiFi?: string;
  };
  history: Array<{ time: string; variance: number; threshold: number }>;
}
interface Settings {
  threshold: number; debounceDelay: number;
  calibrationMode: boolean; lastCalibration: string;
}
interface LogEntry {
  id: string; timestamp: string;
  type: 'motion' | 'calibration' | 'threshold_change' | 'system';
  message: string; data?: Record<string, unknown>;
}
type Tab = 'dashboard' | 'settings' | 'logs' | 'control' | 'rfid';

const LOG_META = {
  motion:           { tag: 'MOTION', clr: '#E84040', bg: 'rgba(232,64,64,0.1)'      },
  calibration:      { tag: 'CALIB',  clr: '#8B8BFF', bg: 'rgba(139,139,255,0.1)'   },
  threshold_change: { tag: 'CONFIG', clr: '#E8A535', bg: 'rgba(232,165,53,0.1)'    },
  system:           { tag: 'SYSTEM', clr: '#30D88A', bg: 'rgba(48,216,138,0.1)'    },
} as const;

/* ── Component ─────────────────────────────────── */
export default function SmartGuard() {
  const [tab,      setTab]      = useState<Tab>('dashboard');
  const [motion,   setMotion]   = useState<MotionData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs,     setLogs]     = useState<LogEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [thr,      setThr]      = useState('0.60');
  const [deb,      setDeb]      = useState('5000');
  const [now,      setNow]      = useState(new Date());
  
  // Control states
  const [doorLocked, setDoorLocked] = useState(true);
  const [buzzerOn, setBuzzerOn] = useState(false);
  const [lcdMsg, setLcdMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [rfidCards, setRfidCards] = useState([
    { id: '1', name: 'Hudi (Main Owner Card)', uid: 'DB 63 03 07', active: true, registeredAt: '30/05/2026' }
  ]);
  const [rfidLogs, setRfidLogs] = useState<Array<{
    id: string; uid: string; status: 'Authorized' | 'Denied'; timestamp: string; name?: string;
  }>>([]);
  
  // ESP32 Connection Status
  const [isConnected, setIsConnected] = useState(false);

  // SSE internal tracking via refs (NOT state — avoids re-render loops)
  const reconnectAttemptsRef = useRef(0);
  const lastDataTimeRef = useRef(Date.now() - 10000);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* manual reconnect */
  const manualReconnect = useCallback(() => {
    console.log('[Manual] Triggering reconnect...');
    // Close existing connection
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    // Reset attempts and force reconnect
    reconnectAttemptsRef.current = 0;
    lastDataTimeRef.current = Date.now() - 10000;
    setIsConnected(false);
    // Will be picked up by the SSE effect's internal connect
    window.dispatchEvent(new CustomEvent('sse-reconnect'));
  }, []);

  /* send command to ESP32 */
  const sendCommand = async (action: string, value: string) => {
    setSending(true);
    try {
      const r = await fetch('/api/control/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
      if (r.ok) {
        if (action === 'door') setDoorLocked(value === 'lock');
        if (action === 'buzzer') setBuzzerOn(value === 'on');
      }
    } catch (e) {
      console.error('Error sending command:', e);
    } finally {
      setSending(false);
    }
  };

  /* test telegram alert */
  const testTelegram = async () => {
    setSending(true);
    try {
      const r = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'motion_detected',
          data: {
            variance: 0.456,
            threshold: 0.060,
            rssi: -45,
            motion: true,
          },
        }),
      });
      if (r.ok) {
        alert('✅ Test alert sent to Telegram!');
      } else {
        alert('❌ Failed to send test alert');
      }
    } catch (e) {
      alert('❌ Error: ' + (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  /* clock */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── SSE CONNECTION (self-contained, no state deps) ── */
  useEffect(() => {
    let mounted = true;

    const connectSSE = () => {
      if (!mounted) return;

      try {
        console.log(`[SSE] Connecting (attempt ${reconnectAttemptsRef.current + 1})...`);
        const es = new EventSource('/api/motion?stream=true');
        sseRef.current = es;

        es.onmessage = (event) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data);
            setMotion(data);
            setLoading(false);
            lastDataTimeRef.current = Date.now();
            setIsConnected(true);
            reconnectAttemptsRef.current = 0; // Reset on success
          } catch (e) {
            console.error('[SSE] Parse error:', e);
          }
        };

        es.onerror = () => {
          if (!mounted) return;
          console.warn('[SSE] Connection error');
          setIsConnected(false);

          es.close();
          sseRef.current = null;

          // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
          const attempt = reconnectAttemptsRef.current;
          const backoffMs = Math.min(2000 * Math.pow(2, attempt), 30000);
          reconnectAttemptsRef.current = attempt + 1;

          console.log(`[SSE] Reconnecting in ${backoffMs}ms (attempt ${attempt + 1})`);

          reconnectTimeoutRef.current = setTimeout(connectSSE, backoffMs);
        };
      } catch (e) {
        console.error('[SSE] Failed:', e);
        setIsConnected(false);
      }
    };

    // Listen for manual reconnect events
    const handleReconnect = () => connectSSE();
    window.addEventListener('sse-reconnect', handleReconnect);

    connectSSE();

    return () => {
      mounted = false;
      window.removeEventListener('sse-reconnect', handleReconnect);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []); // ← EMPTY deps: fully self-contained, no re-render loops

  /* connection status monitor */
  useEffect(() => {
    const checkConnection = setInterval(() => {
      const timeSinceLastData = Date.now() - lastDataTimeRef.current;
      const connected = timeSinceLastData < 5000;
      setIsConnected(connected);
    }, 2000); // Check every 2s instead of 1s to reduce overhead
    return () => clearInterval(checkConnection);
  }, []); // ← EMPTY deps: uses ref, not state

  /* settings */
  useEffect(() => {
    const go = async () => {
      try {
        const r = await fetch('/api/settings');
        if (r.ok) {
          const d = await r.json();
          setSettings(d);
          setThr(d.threshold.toString());
          setDeb(d.debounceDelay.toString());
        }
      } catch {}
    };
    go();
  }, []);

  /* logs polling */
  useEffect(() => {
    const go = async () => {
      try {
        const r = await fetch('/api/logs?limit=100');
        if (r.ok) { const d = await r.json(); setLogs(d.logs); }
      } catch {}
    };
    go();
    const id = setInterval(go, 5000);
    return () => clearInterval(id);
  }, []);

  /* rfid logs polling */
  useEffect(() => {
    const fetchRfidLogs = async () => {
      try {
        const r = await fetch('/api/rfid/logs?limit=50');
        if (r.ok) { const d = await r.json(); setRfidLogs(d.logs); }
      } catch {}
    };
    fetchRfidLogs();
    const id = setInterval(fetchRfidLogs, 5000);
    return () => clearInterval(id);
  }, []);

  /* handlers */
  const saveSettings = async () => {
    const t = parseFloat(thr);
    if (isNaN(t) || t < 0 || t > 1) { alert('Threshold harus antara 0 dan 1'); return; }
    try {
      const r = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: t, debounceDelay: parseInt(deb) }),
      });
      if (r.ok) {
        const d = await r.json(); setSettings(d.settings);
        
        // Send threshold command to ESP32
        await sendCommand('threshold', t.toString());
        
        await fetch('/api/logs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'threshold_change',
            message: `Threshold diubah ke ${t.toFixed(3)} dan dikirim ke ESP32`,
            data: { newThreshold: t },
          }),
        });
      }
    } catch {}
  };

  const calibrate = async () => {
    try {
      // Send calibrate command to ESP32
      await sendCommand('calibrate', 'true');
      
      const r = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calibrationMode: true }),
      });
      if (r.ok) {
        const d = await r.json(); setSettings(d.settings);
        await fetch('/api/logs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'calibration', message: 'Kalibrasi sistem dimulai dari dashboard', data: {} }),
        });
        alert('Kalibrasi dimulai — ESP32 akan kalibrasi selama 5 detik. Jangan bergerak!');
      }
    } catch {}
  };

  const clearLogs = async () => {
    if (!confirm('Hapus semua log?')) return;
    try { await fetch('/api/logs', { method: 'DELETE' }); setLogs([]); } catch {}
  };

  /* loading */
  if (loading) return (
    <div style={S.loadWrap}>
      <Styles />
      <div style={{ textAlign: 'center' }}>
        <div style={S.spinner} />
        <p className="ibm" style={S.loadText}>Connecting…</p>
      </div>
    </div>
  );

  const cur     = motion?.current;
  const hist    = motion?.history ?? [];
  const isAlert = !!cur?.motion;

  /* ── RENDER ─────────────────────────────────── */
  return (
    <div className="responsive-root" style={{ ...S.root, fontFamily: 'Outfit, sans-serif' }}>
      <Styles />
      <ScanLine />

      {/* ambient danger glow */}
      <div style={{ ...S.ambientGlow, opacity: isAlert ? 1 : 0 }} />

      {/* ── SIDEBAR ── */}
      <aside className="responsive-sidebar" style={S.sidebar}>

        {/* brand */}
        <div style={S.brand}>
          <ShieldIcon />
          <div>
            <p style={S.brandName}>SmartGuard</p>
            <p className="ibm responsive-sidebar-extra" style={S.brandSub}>CSI v2</p>
          </div>
        </div>

        {/* nav */}
        <nav className="responsive-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {([
            ['dashboard', 'Overview',      OverviewIcon],
            ['settings',  'Configuration', ConfigIcon  ],
            ['control',   'Control',       ControlIcon ],
            ['rfid',      'RFID Cards',    RfidIcon    ],
            ['logs',      'Event Log',     LogIcon     ],
          ] as const).map(([id, label, Icon]) => (
            <NavBtn key={id} active={tab === id} onClick={() => setTab(id)}>
              <Icon active={tab === id} />
              {label}
              {tab === id && <span style={S.navDot} />}
            </NavBtn>
          ))}
        </nav>

        <div className="responsive-sidebar-spacer" style={{ flex: 1 }} />

        {/* mini status */}
        <div className="responsive-sidebar-extra" style={{
          ...S.miniStatus,
          background:   isAlert ? 'rgba(232,64,64,0.08)'   : 'rgba(255,255,255,0.025)',
          borderColor:  isAlert ? 'rgba(232,64,64,0.22)'   : 'rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: isAlert ? '#E84040' : '#30D88A',
              animation: isAlert ? 'pulse-danger 1.2s ease-in-out infinite' : 'pulse-safe 2.5s ease-in-out infinite',
            }} />
            <span className="ibm" style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600, color: isAlert ? '#E84040' : '#30D88A' }}>
              {isAlert ? 'Alert' : 'Aman'}
            </span>
          </div>
          <p className="barlow" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: isAlert ? '#E84040' : '#E8A535', letterSpacing: '-0.01em' }}>
            {cur?.variance.toFixed(3) ?? '—'}
          </p>
          <p className="ibm" style={{ fontSize: 9, color: '#30333D', marginTop: 4, letterSpacing: '0.15em' }}>variance index</p>
        </div>

        {/* connection status */}
        <div className="responsive-sidebar-extra" style={{
          padding: '12px',
          borderRadius: 8,
          background: isConnected ? 'rgba(48,216,138,0.08)' : 'rgba(232,64,64,0.08)',
          border: `1px solid ${isConnected ? 'rgba(48,216,138,0.2)' : 'rgba(232,64,64,0.2)'}`,
          marginTop: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: isConnected ? '#30D88A' : '#E84040',
              animation: isConnected ? 'pulse-safe 2s infinite' : 'pulse-danger 1s infinite',
            }} />
            <span className="ibm" style={{ fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: isConnected ? '#30D88A' : '#E84040' }}>
              {isConnected ? 'ESP32 Online' : 'ESP32 Offline'}
            </span>
          </div>
          <p className="ibm" style={{ fontSize: 8, color: '#30333D', lineHeight: 1.3 }}>
            {isConnected ? '✓ Connected' : '✗ Waiting...'}
          </p>
          {isConnected && cur?.connectedWiFi && (
            <p className="ibm" style={{ fontSize: 7, color: '#5C6070', marginTop: 4, letterSpacing: '0.1em' }}>
              WiFi: {cur.connectedWiFi}
            </p>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="responsive-main" style={S.main}>

        {/* topbar */}
        <div className="responsive-topbar" style={S.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={S.topbarTitle}>
              { tab === 'dashboard' ? 'System Overview'
              : tab === 'settings'  ? 'Configuration'
              :                       'Event Log' }
            </h1>
            {tab === 'logs' && (
              <span className="ibm" style={S.logBadge}>{logs.length} events</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D88A', animation: 'pulse-safe 2s infinite' }} />
              <span className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.2em' }}>LIVE</span>
            </div>
            <p className="ibm" style={{ fontSize: 11, color: '#30333D', letterSpacing: '0.05em' }}>
              {now.toLocaleTimeString('id-ID')}
            </p>
          </div>
        </div>

        {/* scrollable content */}
        <div className="responsive-content" style={S.content}>

          {/* ESP32 Connection Warning */}
          {!isConnected && (
            <div style={{
              padding: '16px',
              borderRadius: 12,
              background: 'rgba(232,64,64,0.1)',
              border: '1px solid rgba(232,64,64,0.3)',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#E84040', marginBottom: 4 }}>
                    ESP32 Not Connected
                  </p>
                  <p className="ibm" style={{ fontSize: 11, color: '#E84040', opacity: 0.8 }}>
                    Waiting for device... Make sure ESP32 is powered on and connected to WiFi.
                  </p>
                </div>
              </div>
              <button
                onClick={manualReconnect}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: 'rgba(232,64,64,0.2)',
                  border: '1px solid rgba(232,64,64,0.4)',
                  color: '#E84040',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '0.05em',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,64,64,0.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,64,64,0.2)';
                }}
              >
                🔄 Reconnect
              </button>
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* hero split */}
              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* left: status */}
                <div style={{
                  ...S.card,
                  padding: 36,
                  borderColor: isAlert ? 'rgba(232,64,64,0.2)' : 'rgba(255,255,255,0.07)',
                  boxShadow: isAlert ? '0 0 80px rgba(232,64,64,0.07)' : 'none',
                  transition: 'border-color 0.5s, box-shadow 0.5s',
                }}>
                  <CornerBrackets active={isAlert} />
                  <DotGrid />
                  <div style={{ position: 'relative' }}>
                    <p className="ibm" style={S.eyebrow}>Motion Status</p>
                    <p className="barlow responsive-hero-text" style={{
                      fontSize: 76, fontWeight: 700, lineHeight: 0.9,
                      color: isAlert ? '#E84040' : '#30D88A',
                      letterSpacing: '-0.02em', marginBottom: 14,
                      transition: 'color 0.4s',
                    }}>
                      {isAlert ? 'WASPADA' : 'AMAN'}
                    </p>
                    <p style={{ fontSize: 13, color: '#5C6070', marginBottom: 28, lineHeight: 1.6 }}>
                      {isAlert
                        ? 'Variance WiFi melebihi batas — kemungkinan ada pergerakan di zona pantau.'
                        : 'Tidak ada anomali terdeteksi. Sistem aktif memantau.'}
                    </p>
                    {/* variance bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.25em', textTransform: 'uppercase' }}>Variance Index</span>
                        <span className="ibm" style={{ fontSize: 9, color: '#5C6070' }}>{cur?.variance.toFixed(3)} / 1.000</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 2, transition: 'width 0.5s ease, background 0.4s',
                          width: `${Math.min((cur?.variance ?? 0) * 100, 100)}%`,
                          background: isAlert
                            ? 'linear-gradient(90deg, #E84040, #FF7070)'
                            : 'linear-gradient(90deg, #E8A535, #F5C870)',
                        }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* right: metric cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <MetricCard label="Signal Strength" unit="dBm" value={String(cur?.rssi ?? '—')}>
                    <SignalBar rssi={cur?.rssi ?? -100} />
                  </MetricCard>
                  <div className="responsive-flex-col" style={{ display: 'flex', gap: 10 }}>
                    <MetricCard label="Threshold Aktif" value={cur?.threshold.toFixed(3) ?? '—'} accent />
                    <div style={{ ...S.card, padding: '16px 22px', flex: 1 }}>
                      <p className="ibm" style={S.eyebrow}>Last Sync</p>
                      <p className="ibm" style={{ fontSize: 16, color: '#DDD9D0', marginTop: 6 }}>
                        {cur?.receivedAt ? new Date(cur.receivedAt).toLocaleTimeString('id-ID') : '—'}
                      </p>
                    </div>
                  </div>
                  <div style={{ ...S.card, padding: '16px 22px' }}>
                    <p className="ibm" style={S.eyebrow}>Last RFID Scan</p>
                    <p className="barlow" style={{ fontSize: 24, color: cur?.lastRfidStatus === 'Authorized' ? '#30D88A' : cur?.lastRfidStatus === 'Denied' ? '#E84040' : '#DDD9D0', marginTop: 6, fontWeight: 'bold', letterSpacing: '0.05em' }}>
                      {cur?.lastRfidUid && cur?.lastRfidUid !== 'None' ? cur.lastRfidUid : 'Belum Ada Scan'}
                    </p>
                    {cur?.lastRfidStatus && cur?.lastRfidStatus !== 'None' && (
                      <p className="ibm" style={{ fontSize: 9, color: cur.lastRfidStatus === 'Authorized' ? '#30D88A' : '#E84040', marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        STATUS: {cur.lastRfidStatus}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* chart */}
              <div style={{ ...S.card, padding: '28px 28px 18px' }}>
                <CornerBrackets />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Variance Timeline</p>
                    <p className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.2em' }}>Real-time WiFi CSI signal analysis</p>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {[
                      { clr: '#E8A535', label: 'Variance',  dash: false },
                      { clr: '#E84040', label: 'Threshold', dash: true  },
                    ].map(({ clr, label, dash }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="18" height="10" viewBox="0 0 18 10">
                          { dash
                            ? <line x1="0" y1="5" x2="18" y2="5" stroke={clr} strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.55" />
                            : <line x1="0" y1="5" x2="18" y2="5" stroke={clr} strokeWidth="2" />
                          }
                        </svg>
                        <span className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {hist.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={hist} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="varGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#E8A535" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#E8A535" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 8" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="time" stroke="transparent"
                        tick={{ fontSize: 9, fill: '#30333D', fontFamily: 'IBM Plex Mono, monospace' }}
                        tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 1]} stroke="transparent"
                        tick={{ fontSize: 9, fill: '#30333D', fontFamily: 'IBM Plex Mono, monospace' }}
                        tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#0C0D12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 11 }}
                        labelStyle={{ color: '#5C6070', marginBottom: 4, fontSize: 10 }}
                        itemStyle={{ color: '#DDD9D0' }}
                      />
                      <Area type="monotone" dataKey="variance"  stroke="#E8A535" strokeWidth={1.5} fill="url(#varGrad)" dot={false} name="Variance" />
                      <Area type="monotone" dataKey="threshold" stroke="#E84040" strokeWidth={1} strokeDasharray="5 5" fill="none" dot={false} name="Threshold" opacity={0.45} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.4em', textTransform: 'uppercase' }}>Menunggu data…</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab === 'settings' && (
            <div style={{ maxWidth: 500 }}>
              <div style={{ ...S.card, padding: 32 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Detection Parameters</p>
                <p style={{ fontSize: 12, color: '#5C6070', marginBottom: 32 }}>Konfigurasi sensitivitas dan respons sistem</p>

                {/* threshold */}
                <SliderRow
                  label="Motion Threshold" sub="Batas variance untuk trigger deteksi"
                  value={parseFloat(thr).toFixed(2)}
                  min={0} max={1} step={0.01} rawValue={thr}
                  pct={parseFloat(thr) * 100}
                  onChange={setThr} minLabel="0.00" maxLabel="1.00"
                />

                <Divider />

                {/* debounce */}
                <SliderRow
                  label="Debounce Delay" sub="Jeda sebelum reset status gerakan"
                  value={`${(parseInt(deb) / 1000).toFixed(0)}s`}
                  min={1000} max={30000} step={1000} rawValue={deb}
                  pct={((parseInt(deb) - 1000) / 29000) * 100}
                  onChange={setDeb} minLabel="1s" maxLabel="30s"
                />

                <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 32 }}>
                  <PrimaryBtn onClick={saveSettings}>Simpan Konfigurasi</PrimaryBtn>
                  <GhostBtn   onClick={calibrate}>Kalibrasi Ulang</GhostBtn>
                </div>
              </div>

              <div style={{ ...S.card, padding: '16px 22px', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p className="ibm" style={S.eyebrow}>Kalibrasi Terakhir</p>
                  <p className="ibm" style={{ fontSize: 13, color: '#8A9098', marginTop: 4 }}>
                    {settings?.lastCalibration ? new Date(settings.lastCalibration).toLocaleString('id-ID') : '— Belum pernah'}
                  </p>
                </div>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" opacity="0.25">
                  <circle cx="9" cy="9" r="7.5" stroke="#E8A535" strokeWidth="1" />
                  <path d="M9 5.5V9L11.5 11.5" stroke="#E8A535" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          )}
          {/* ── CONTROL ── */}
          {tab === 'control' && (
            <div style={{ maxWidth: 600 }}>
              {/* Door Control */}
              <div style={{ ...S.card, padding: 32, marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Door Lock Control</p>
                <p style={{ fontSize: 12, color: '#5C6070', marginBottom: 20 }}>Manual kontrol solenoid lock</p>
                
                <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    onClick={() => sendCommand('door', 'unlock')}
                    disabled={sending}
                    style={{
                      padding: '14px',
                      borderRadius: 10,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      background: !doorLocked ? 'linear-gradient(135deg, #30D88A, #20B870)' : 'rgba(48,216,138,0.1)',
                      color: !doorLocked ? '#050608' : '#30D88A',
                      fontSize: 13,
                      fontWeight: 700,
                      border: 'none',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.02em',
                      transition: 'all 0.15s',
                      opacity: sending ? 0.6 : 1,
                    }}
                  >
                    🔓 Buka Pintu
                  </button>
                  <button
                    onClick={() => sendCommand('door', 'lock')}
                    disabled={sending}
                    style={{
                      padding: '14px',
                      borderRadius: 10,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      background: doorLocked ? 'linear-gradient(135deg, #E84040, #C83030)' : 'rgba(232,64,64,0.1)',
                      color: doorLocked ? '#050608' : '#E84040',
                      fontSize: 13,
                      fontWeight: 700,
                      border: 'none',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.02em',
                      transition: 'all 0.15s',
                      opacity: sending ? 0.6 : 1,
                    }}
                  >
                    🔒 Kunci Pintu
                  </button>
                </div>
                
                <div style={{ marginTop: 16, padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>Status</p>
                  <p style={{ fontSize: 13, color: doorLocked ? '#E84040' : '#30D88A' }}>
                    {doorLocked ? '🔒 Terkunci' : '🔓 Terbuka'}
                  </p>
                </div>
              </div>

              {/* Buzzer Control */}
              <div style={{ ...S.card, padding: 32, marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>Buzzer Control</p>
                <p style={{ fontSize: 12, color: '#5C6070', marginBottom: 20 }}>Manual kontrol alarm buzzer</p>
                
                <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    onClick={() => sendCommand('buzzer', 'on')}
                    disabled={sending}
                    style={{
                      padding: '14px',
                      borderRadius: 10,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      background: buzzerOn ? 'linear-gradient(135deg, #E8A535, #C87820)' : 'rgba(232,165,53,0.1)',
                      color: buzzerOn ? '#050608' : '#E8A535',
                      fontSize: 13,
                      fontWeight: 700,
                      border: 'none',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.02em',
                      transition: 'all 0.15s',
                      opacity: sending ? 0.6 : 1,
                    }}
                  >
                    🔊 Nyalakan
                  </button>
                  <button
                    onClick={() => sendCommand('buzzer', 'off')}
                    disabled={sending}
                    style={{
                      padding: '14px',
                      borderRadius: 10,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      background: !buzzerOn ? 'rgba(255,255,255,0.05)' : 'rgba(232,165,53,0.1)',
                      color: !buzzerOn ? '#DDD9D0' : '#E8A535',
                      fontSize: 13,
                      fontWeight: 700,
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.02em',
                      transition: 'all 0.15s',
                      opacity: sending ? 0.6 : 1,
                    }}
                  >
                    🔇 Matikan
                  </button>
                </div>
                
                <div style={{ marginTop: 16, padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>Status</p>
                  <p style={{ fontSize: 13, color: buzzerOn ? '#E8A535' : '#5C6070' }}>
                    {buzzerOn ? '🔊 Menyala' : '🔇 Mati'}
                  </p>
                </div>
              </div>

              {/* LCD Message */}
              <div style={{ ...S.card, padding: 32 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>LCD Message</p>
                <p style={{ fontSize: 12, color: '#5C6070', marginBottom: 16 }}>Kirim pesan ke LCD (komunikasi dengan tamu)</p>
                
                <input
                  type="text"
                  value={lcdMsg}
                  onChange={(e) => setLcdMsg(e.target.value.slice(0, 16))}
                  placeholder="Ketik pesan (max 16 karakter)"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#DDD9D0',
                    fontSize: 13,
                    fontFamily: 'Outfit, sans-serif',
                    marginBottom: 12,
                    boxSizing: 'border-box',
                  }}
                />
                
                <p className="ibm" style={{ fontSize: 9, color: '#30333D', marginBottom: 12 }}>
                  {lcdMsg.length}/16 karakter
                </p>
                
                <button
                  onClick={() => {
                    if (lcdMsg.trim()) {
                      sendCommand('lcd', lcdMsg);
                      setLcdMsg('');
                    }
                  }}
                  disabled={sending || !lcdMsg.trim()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    cursor: sending || !lcdMsg.trim() ? 'not-allowed' : 'pointer',
                    background: lcdMsg.trim() ? 'linear-gradient(135deg, #8B8BFF, #6B6BFF)' : 'rgba(139,139,255,0.1)',
                    color: lcdMsg.trim() ? '#050608' : '#8B8BFF',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '0.02em',
                    transition: 'all 0.15s',
                    opacity: sending || !lcdMsg.trim() ? 0.6 : 1,
                  }}
                >
                  📤 Kirim Pesan
                </button>
              </div>

              {/* Test Alerts */}
              <div style={{ ...S.card, padding: 32, marginTop: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>🧪 Test Telegram Alert</p>
                <p style={{ fontSize: 12, color: '#5C6070', marginBottom: 16 }}>Send test alert to Telegram</p>
                
                <button
                  onClick={testTelegram}
                  disabled={sending}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #0088cc, #0066aa)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '0.02em',
                    transition: 'all 0.15s',
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  📱 Send Test Alert
                </button>
              </div>
            </div>
          )}

          {/* ── LOGS ── */}
          {tab === 'logs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <DangerBtn onClick={clearLogs}>Hapus Semua Log</DangerBtn>
              </div>

              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="ibm responsive-logs-header" style={{ display: 'grid', gridTemplateColumns: '88px 130px 1fr', gap: 24, padding: '11px 24px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 9, letterSpacing: '0.3em', color: '#30333D', textTransform: 'uppercase' }}>
                  <span>Type</span><span>Waktu</span><span>Pesan</span>
                </div>

                {logs.length > 0 ? logs.map((log, i) => {
                  const m = LOG_META[log.type] ?? LOG_META.system;
                  return (
                    <div key={log.id} className="responsive-log-item" style={{ display: 'grid', gridTemplateColumns: '88px 130px 1fr', gap: 24, padding: '13px 24px', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.013)', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                      <span className="ibm" style={{ fontSize: 9, padding: '3px 7px', borderRadius: 4, color: m.clr, background: m.bg, fontWeight: 700, letterSpacing: '0.12em', width: 'fit-content' }}>{m.tag}</span>
                      <span className="ibm" style={{ fontSize: 11, color: '#3A3D4A' }}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</span>
                      <span style={{ fontSize: 13, color: '#8A9098' }}>{log.message}</span>
                    </div>
                  );
                }) : (
                  <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <p className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.4em', textTransform: 'uppercase' }}>Tidak ada event tercatat</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RFID CARDS ── */}
          {tab === 'rfid' && (
            <div style={{ maxWidth: 650 }}>
              <div style={{ ...S.card, padding: 32, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>RFID Card Manager</p>
                    <p style={{ fontSize: 12, color: '#5C6070' }}>Manage authorized RFID cards for physical access</p>
                  </div>
                  <button
                    onClick={() => {
                      const name = prompt('Masukkan nama pemilik kartu:');
                      const uid = prompt('Masukkan UID kartu (Format: XX XX XX XX):');
                      if (name && uid) {
                        setRfidCards([...rfidCards, { id: Date.now().toString(), name, uid: uid.toUpperCase(), active: true, registeredAt: new Date().toLocaleDateString('id-ID') }]);
                      }
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #E8A535, #C07820)',
                      color: '#050608',
                      fontSize: 11,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    ➕ Register Card
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                  {rfidCards.map((card) => (
                    <div key={card.id} className="responsive-rfid-item" style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px 20px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 42, height: 28, borderRadius: 5,
                          background: 'linear-gradient(135deg, #E8A535, #A06010)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#050608', fontWeight: 'bold'
                        }}>
                          RFID
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{card.name}</p>
                          <p className="ibm" style={{ fontSize: 10, color: '#30D88A', marginTop: 2 }}>UID: {card.uid}</p>
                        </div>
                      </div>
                      <div className="responsive-rfid-btns" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="ibm" style={{ fontSize: 9, color: '#5C6070' }}>Reg: {card.registeredAt}</span>
                        <button
                          onClick={() => {
                            if (confirm(`Hapus kartu ${card.name}?`)) {
                              setRfidCards(rfidCards.filter(c => c.id !== card.id));
                            }
                          }}
                          style={{
                            background: 'transparent', border: 'none', color: '#E84040',
                            fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit, sans-serif'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RFID Scan History */}
              <div style={{ ...S.card, padding: 32, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>RFID Scan History</p>
                    <p style={{ fontSize: 12, color: '#5C6070' }}>Tracking semua RFID scan attempts</p>
                  </div>
                  <span className="ibm" style={{ fontSize: 10, color: '#30333D', letterSpacing: '0.2em' }}>
                    {rfidLogs.length} SCANS
                  </span>
                </div>
                
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {rfidLogs.length > 0 ? rfidLogs.map((log) => (
                    <div key={log.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', borderRadius: 8, marginBottom: 8,
                      background: log.status === 'Authorized' 
                        ? 'rgba(48,216,138,0.05)' 
                        : 'rgba(232,64,64,0.05)',
                      border: `1px solid ${log.status === 'Authorized' 
                        ? 'rgba(48,216,138,0.15)' 
                        : 'rgba(232,64,64,0.15)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>
                          {log.status === 'Authorized' ? '✅' : '❌'}
                        </span>
                        <div>
                          <p className="ibm" style={{ fontSize: 12, color: '#DDD9D0', fontWeight: 600 }}>
                            {log.uid}
                          </p>
                          <p className="ibm" style={{ fontSize: 9, color: '#5C6070', marginTop: 2 }}>
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                      <span className="ibm" style={{
                        fontSize: 9, padding: '3px 8px', borderRadius: 4,
                        color: log.status === 'Authorized' ? '#30D88A' : '#E84040',
                        background: log.status === 'Authorized' 
                          ? 'rgba(48,216,138,0.1)' 
                          : 'rgba(232,64,64,0.1)',
                        fontWeight: 700, letterSpacing: '0.1em',
                      }}>
                        {log.status.toUpperCase()}
                      </span>
                    </div>
                  )) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <p className="ibm" style={{ fontSize: 9, color: '#30333D', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                        Belum ada scan tercatat
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>{/* /content */}
      </div>{/* /main */}
    </div>
  );
}

/* ── Styles object ──────────────────────────────── */
const S = {
  root:       { background: '#050608', minHeight: '100vh', display: 'flex', color: '#DDD9D0' },
  loadWrap:   { background: '#050608', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner:    { width: 38, height: 38, border: '1px solid rgba(232,165,53,0.25)', borderRadius: '50%', borderTopColor: '#E8A535', animation: 'spin 1s linear infinite', margin: '0 auto 18px' },
  loadText:   { fontSize: 9, letterSpacing: '0.45em', color: 'rgba(232,165,53,0.45)', textTransform: 'uppercase' as const },
  ambientGlow:{ position: 'fixed' as const, inset: 0, pointerEvents: 'none' as const, zIndex: 0, background: 'radial-gradient(ellipse 65% 55% at 20% 50%, rgba(232,64,64,0.055) 0%, transparent 70%)', transition: 'opacity 1s' },
  sidebar:    { width: 190, flexShrink: 0, position: 'sticky' as const, top: 0, height: '100vh', display: 'flex', flexDirection: 'column' as const, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '26px 14px', zIndex: 10 },
  brand:      { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 },
  brandName:  { fontSize: 13, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' },
  brandSub:   { fontSize: 8, color: 'rgba(232,165,53,0.5)', letterSpacing: '0.32em', textTransform: 'uppercase' as const, marginTop: 2 },
  navDot:     { marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#E8A535', flexShrink: 0 },
  miniStatus: { padding: '14px 12px', borderRadius: 11, border: '1px solid' },
  main:       { flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0, position: 'relative' as const, zIndex: 1 },
  topbar:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '19px 34px', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', background: 'rgba(5,6,8,0.85)', position: 'sticky' as const, top: 0, zIndex: 20 },
  topbarTitle:{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' },
  logBadge:   { fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(232,165,53,0.1)', color: '#E8A535', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono, monospace' },
  content:    { padding: '30px 34px', flex: 1, overflowY: 'auto' as const },
  card:       { background: 'linear-gradient(145deg, rgba(255,255,255,0.027), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, position: 'relative' as const, overflow: 'hidden' as const },
  eyebrow:    { fontSize: 9, letterSpacing: '0.32em', color: '#30333D', textTransform: 'uppercase' as const, fontWeight: 500, marginBottom: 8 },
} as const;

/* ── Sub-components ─────────────────────────────── */

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, background: active ? 'rgba(232,165,53,0.1)' : hover ? 'rgba(255,255,255,0.04)' : 'transparent', border: active ? '1px solid rgba(232,165,53,0.2)' : '1px solid transparent', color: active ? '#E8A535' : hover ? '#DDD9D0' : '#5C6070', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.13s', textAlign: 'left', width: '100%', fontFamily: 'Outfit, sans-serif' }}
    >
      {children}
    </button>
  );
}

function MetricCard({ label, value, unit, accent, children }: { label: string; value: string; unit?: string; accent?: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ ...S.card, padding: '18px 22px', flex: 1 }}>
      <p className="ibm" style={S.eyebrow}>{label}</p>
      <p className="barlow" style={{ fontSize: 42, fontWeight: 700, color: accent ? '#E8A535' : '#DDD9D0', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}{unit && <span className="ibm" style={{ fontSize: 13, color: '#5C6070', marginLeft: 5 }}>{unit}</span>}
      </p>
      {children}
    </div>
  );
}

function SignalBar({ rssi }: { rssi: number }) {
  const pct = Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100));
  const clr = rssi > -60 ? '#30D88A' : rssi > -75 ? '#E8A535' : '#E84040';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, marginTop: 8 }}>
      {[0.2, 0.4, 0.6, 0.8, 1].map((lvl, i) => (
        <div key={i} style={{ width: 7, height: 7 + i * 4, borderRadius: 2, background: pct >= lvl * 100 ? clr : 'rgba(255,255,255,0.07)', transition: 'background 0.3s' }} />
      ))}
      <span className="ibm" style={{ fontSize: 9, color: '#30333D', marginLeft: 5, letterSpacing: '0.1em' }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function SliderRow({ label, sub, value, min, max, step, rawValue, pct, onChange, minLabel, maxLabel }: { label: string; sub: string; value: string; min: number; max: number; step: number; rawValue: string; pct: number; onChange: (v: string) => void; minLabel: string; maxLabel: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600 }}>{label}</p>
          <p style={{ fontSize: 11, color: '#5C6070', marginTop: 2 }}>{sub}</p>
        </div>
        <p className="barlow" style={{ fontSize: 34, fontWeight: 700, color: '#E8A535', lineHeight: 1 }}>{value}</p>
      </div>
      <input type="range" min={min} max={max} step={step} value={rawValue}
        onChange={e => onChange(e.target.value)}
        className="range-styled"
        style={{ '--pct': `${pct}%` } as React.CSSProperties} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
        <span className="ibm" style={{ fontSize: 9, color: '#30333D' }}>{minLabel}</span>
        <span className="ibm" style={{ fontSize: 9, color: '#30333D' }}>{maxLabel}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '28px 0' }} />;
}

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: '12px', borderRadius: 10, cursor: 'pointer', background: hov ? 'linear-gradient(135deg, #F0B545, #C87820)' : 'linear-gradient(135deg, #E8A535, #C07820)', color: '#050608', fontSize: 13, fontWeight: 700, border: 'none', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.02em', transition: 'background 0.15s' }}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: '12px', borderRadius: 10, cursor: 'pointer', background: hov ? 'rgba(255,255,255,0.05)' : 'transparent', color: '#C0BDB8', fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.02em', transition: 'background 0.15s' }}>
      {children}
    </button>
  );
}

function DangerBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: hov ? 'rgba(232,64,64,0.13)' : 'rgba(232,64,64,0.08)', color: '#E84040', fontSize: 11, fontWeight: 600, border: '1px solid rgba(232,64,64,0.2)', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.05em', transition: 'background 0.13s' }}>
      {children}
    </button>
  );
}

function DotGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 0.025, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
  );
}

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 2L3 7V16C3 21.523 7.477 26 14 26C20.523 26 25 21.523 25 16V7L14 2Z" fill="rgba(232,165,53,0.08)" stroke="#E8A535" strokeWidth="1.2" />
      <path d="M10 14.5L13 17.5L18.5 11.5" stroke="#E8A535" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function OverviewIcon({ active }: { active: boolean }) {
  const c = active ? '#E8A535' : 'currentColor';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1"   y="7.5" width="3.5" height="5.5" rx="1" fill={c} opacity={active ? 1   : 0.45} />
      <rect x="5.5" y="4"   width="3.5" height="9"   rx="1" fill={c} opacity={active ? 0.7 : 0.3 } />
      <rect x="10"  y="1"   width="3"   height="12"  rx="1" fill={c} opacity={active ? 0.4 : 0.2 } />
    </svg>
  );
}
function ConfigIcon({ active }: { active: boolean }) {
  const c = active ? '#E8A535' : 'currentColor';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2.5" stroke={c} strokeWidth="1.2" opacity={active ? 1 : 0.45} />
      <path d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M10.8 3.2l-1.4 1.4M4.6 9.4l-1.4 1.4" stroke={c} strokeWidth="1.1" strokeLinecap="round" opacity={active ? 1 : 0.35} />
    </svg>
  );
}
function LogIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M2 7h7M2 10h5" stroke={active ? '#E8A535' : 'currentColor'} strokeWidth="1.3" strokeLinecap="round" opacity={active ? 1 : 0.45} />
    </svg>
  );
}
function RfidIcon({ active }: { active: boolean }) {
  const c = active ? '#E8A535' : 'currentColor';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.45}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
function ControlIcon({ active }: { active: boolean }) {
  const c = active ? '#E8A535' : 'currentColor';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke={c} strokeWidth="1.2" opacity={active ? 1 : 0.45} />
      <circle cx="7" cy="7" r="2.5" fill={c} opacity={active ? 1 : 0.45} />
      <path d="M7 2v2M7 10v2M2 7h2M10 7h2" stroke={c} strokeWidth="1" strokeLinecap="round" opacity={active ? 0.7 : 0.3} />
    </svg>
  );
}

function ScanLine() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(180deg, transparent 0%, rgba(232,165,53,0.04) 50%, transparent 100%)',
      backgroundSize: '100% 150px',
      animation: 'scanline 8s linear infinite',
      pointerEvents: 'none',
      zIndex: 5,
    }} />
  );
}

function CornerBrackets({ active }: { active?: boolean }) {
  const color = active ? '#E8A535' : 'rgba(232,165,53,0.25)';
  const size = 16;
  return (
    <>
      <div style={{ position: 'absolute', top: 8, left: 8, width: size, height: size, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}`, transition: 'all 0.3s', opacity: active ? 1 : 0.6 }} />
      <div style={{ position: 'absolute', top: 8, right: 8, width: size, height: size, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}`, transition: 'all 0.3s', opacity: active ? 1 : 0.6 }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, width: size, height: size, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}`, transition: 'all 0.3s', opacity: active ? 1 : 0.6 }} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, width: size, height: size, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}`, transition: 'all 0.3s', opacity: active ? 1 : 0.6 }} />
    </>
  );
}

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Barlow+Condensed:wght@600;700;800&display=swap');

      .ibm    { font-family: 'IBM Plex Mono', monospace; }
      .barlow { font-family: 'Barlow Condensed', sans-serif; }

      ::-webkit-scrollbar       { width: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(232,165,53,0.18); border-radius: 2px; }

      @keyframes spin          { to { transform: rotate(360deg); } }
      @keyframes pulse-danger  { 0%,100% { box-shadow: 0 0 0 0 rgba(232,64,64,0.55); }  50% { box-shadow: 0 0 0 8px rgba(232,64,64,0); }   }
      @keyframes pulse-safe    { 0%,100% { box-shadow: 0 0 0 0 rgba(48,216,138,0.45); } 50% { box-shadow: 0 0 0 7px rgba(48,216,138,0); }  }
      @keyframes scanline      { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }

      input.range-styled {
        -webkit-appearance: none; appearance: none;
        width: 100%; height: 2px; border-radius: 2px; outline: none;
        background: linear-gradient(to right, #E8A535 var(--pct, 60%), rgba(255,255,255,0.08) var(--pct, 60%));
      }
      input.range-styled::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px; height: 16px; border-radius: 50%;
        background: #050608; border: 2px solid #E8A535; cursor: pointer;
        box-shadow: 0 0 10px rgba(232,165,53,0.35); transition: box-shadow 0.15s;
      }
      input.range-styled::-webkit-slider-thumb:hover { box-shadow: 0 0 16px rgba(232,165,53,0.6); }

      /* Responsive Overrides */
      @media (max-width: 800px) {
        .responsive-root { flex-direction: column !important; }
        .responsive-sidebar { 
          width: 100% !important; height: auto !important; position: sticky !important; 
          flex-direction: row !important; align-items: center; border-right: none !important; 
          border-bottom: 1px solid rgba(255,255,255,0.06) !important; padding: 12px 15px !important; 
          overflow-x: auto; z-index: 30; background: rgba(5,6,8,0.95); backdrop-filter: blur(10px);
        }
        .responsive-sidebar-nav { flex-direction: row !important; gap: 6px !important; margin-left: 20px; }
        .responsive-sidebar-nav button { padding: 8px 12px !important; white-space: nowrap; }
        .responsive-sidebar-spacer { display: none !important; }
        .responsive-sidebar-extra { display: none !important; }
        .responsive-main { width: 100% !important; overflow-x: hidden !important; }
        .responsive-topbar { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; padding: 15px !important; position: static !important; }
        .responsive-content { padding: 15px !important; }
        .responsive-grid-2 { grid-template-columns: 1fr !important; }
        .responsive-flex-col { flex-direction: column !important; }
        .responsive-logs-header { display: none !important; }
        .responsive-log-item { grid-template-columns: 1fr !important; gap: 8px !important; padding: 12px 15px !important; }
        .responsive-rfid-item { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        .responsive-rfid-btns { width: 100%; justify-content: flex-end; }
        .responsive-hero-text { font-size: 52px !important; }
      }
    `}</style>
  );
}