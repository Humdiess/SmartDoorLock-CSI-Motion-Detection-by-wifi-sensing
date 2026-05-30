# 🚨 Telegram + Gemini AI Alerting Setup

## 📋 Fitur yang Ditambahkan

### ✅ **Telegram Bot Alerting**
- Kirim alert ke Telegram saat motion detected
- Kirim notifikasi RFID access (granted/denied)
- Kirim notifikasi door control
- Real-time notifications

### ✅ **Gemini AI Analysis**
- Analyze motion events
- Risk assessment (Low/Medium/High)
- Anomaly detection
- Recommendations in Indonesian

---

## 🔧 Setup Telegram Bot

### Step 1: Create Telegram Bot
1. Open Telegram
2. Search for **@BotFather**
3. Send `/start`
4. Send `/newbot`
5. Follow instructions:
   - Bot name: `SmartDoorLock Bot` (atau nama lain)
   - Bot username: `smartdoorlock_bot` (harus unik)
6. Copy **API Token** (contoh: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### Step 2: Get Chat ID
1. Search for **@userinfobot** di Telegram
2. Send `/start`
3. Bot akan reply dengan Chat ID Anda (contoh: `123456789`)

### Step 3: Add Environment Variables
Buat file `.env.local` di folder `dashboard`:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789

# Gemini Configuration
GEMINI_API_KEY=AIzaSyD...your_gemini_api_key...
```

### Step 4: Restart Dashboard
```bash
npm run dev
```

---

## 🤖 Setup Gemini AI

### Step 1: Get Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Select project or create new
4. Copy API Key

### Step 2: Add to .env.local
```env
GEMINI_API_KEY=AIzaSyD...your_gemini_api_key...
```

### Step 3: Restart Dashboard
```bash
npm run dev
```

---

## 📊 How It Works

### Motion Detection Flow:
```
1. ESP32 detects motion
   ↓
2. POST to /api/motion
   ↓
3. Motion state changes (false → true)
   ↓
4. Trigger Telegram alert
   ↓
5. Trigger Gemini analysis
   ↓
6. Send analysis to Telegram
```

### Telegram Alert Format:
```
🚨 MOTION DETECTED!

📊 Details:
• Variance: 0.234
• Threshold: 0.060
• Signal Strength: -45 dBm
• Time: 30/05/2026 16:08:20

⚠️ Action: Buzzer activated, LED on
```

### Gemini Analysis:
```
Risk Assessment: MEDIUM

Possible Cause: Person walking

Recommended Action: 
- Check camera footage
- Verify if authorized person
- Monitor for repeated events

Analysis: Terdeteksi gerakan dengan variance 
tinggi, kemungkinan ada orang yang bergerak 
di area pantau. Buzzer sudah aktif sebagai 
deterrent.
```

---

## 🧪 Testing

### Test 1: Motion Alert
1. Trigger motion detection (gerak di depan ESP32)
2. Cek Telegram - seharusnya dapat alert
3. Cek Gemini analysis di log

### Test 2: RFID Alert
1. Scan kartu RFID authorized
2. Cek Telegram - seharusnya dapat "Access Granted"
3. Scan kartu unauthorized
4. Cek Telegram - seharusnya dapat "Access Denied"

### Test 3: Door Control Alert
1. Klik "Buka Pintu" di web
2. Cek Telegram - seharusnya dapat "Door Control" alert

---

## 📝 API Endpoints

### Telegram Alert
```
POST /api/alerts/telegram
Body: {
  type: 'motion_detected' | 'rfid_access' | 'rfid_denied' | 'door_control',
  message: 'Custom message',
  data: { ... }
}
```

### Gemini Analysis
```
POST /api/alerts/gemini
Body: {
  type: 'motion_detected' | 'rfid_event',
  data: { ... },
  message: 'Custom message'
}
Response: {
  success: true,
  analysis: 'AI analysis text',
  timestamp: '2026-05-30T16:08:20.000Z'
}
```

---

## 🔐 Security Notes

- ✅ API keys disimpan di `.env.local` (tidak di-commit)
- ✅ Telegram bot token aman di server
- ✅ Gemini API key aman di server
- ✅ Alerts hanya dikirim ke authorized chat ID

---

## 🚨 Troubleshooting

### Telegram Alert Tidak Terkirim
- Cek `TELEGRAM_BOT_TOKEN` di `.env.local`
- Cek `TELEGRAM_CHAT_ID` di `.env.local`
- Cek internet connection
- Lihat console log untuk error

### Gemini Analysis Tidak Muncul
- Cek `GEMINI_API_KEY` di `.env.local`
- Cek API key valid di [Google AI Studio](https://aistudio.google.com/app/apikey)
- Cek quota/rate limit
- Lihat console log untuk error

### Alert Terlalu Sering
- Debounce sudah di-set 10 detik
- Adjust di `motion/route.ts` line 62 jika perlu

---

## 📚 File Locations

- **Telegram API**: `/api/alerts/telegram/route.ts`
- **Gemini API**: `/api/alerts/gemini/route.ts`
- **Motion Trigger**: `/api/motion/route.ts` (lines 56-88)
- **Environment**: `.env.local` (di folder dashboard)

---

## ✨ Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| Telegram Alerts | ✅ | Real-time motion/RFID alerts |
| Gemini Analysis | ✅ | AI-powered event analysis |
| Debouncing | ✅ | 10 second cooldown |
| Error Handling | ✅ | Graceful error handling |
| Async Processing | ✅ | Non-blocking alerts |

---

**Setup selesai! Sekarang dashboard akan kirim alert ke Telegram dan analyze dengan Gemini AI!** 🎉
