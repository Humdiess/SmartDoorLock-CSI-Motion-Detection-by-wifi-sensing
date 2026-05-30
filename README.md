# 🔐 Smart Door Lock CSI

Smart Door Lock dengan WiFi-based motion detection menggunakan ESP32 dan Next.js dashboard.

## 📁 Struktur Repository

```
SmartDoorLock/
├── firmware/
│   └── SmartDoorLock.ino          # ESP32 firmware
├── dashboard/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/               # API endpoints
│   │   │   ├── page.tsx           # Dashboard UI
│   │   │   ├── globals.css        # Styling
│   │   │   └── layout.tsx
│   │   └── ...
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
├── README.md
└── .gitignore
```

## 🚀 Quick Start

### Firmware (ESP32)

1. **Requirements:**
   - Arduino IDE atau PlatformIO
   - ESP32 DevKit v1
   - USB Cable

2. **Setup:**
   - Buka `firmware/SmartDoorLock.ino` di Arduino IDE
   - Update WiFi credentials (baris 21-22):
     ```cpp
     const char* ssid = "Your_WiFi_SSID";
     const char* password = "Your_WiFi_Password";
     ```
   - Update server URL (baris 26):
     ```cpp
     const char* SERVER_URL = "http://192.168.1.100:3000/api/motion";
     ```

3. **Upload:**
   - Select Board: ESP32 DevKit v1
   - Select Port: COM port ESP32
   - Click Upload

### Dashboard (Next.js)

1. **Requirements:**
   - Node.js 18+
   - npm atau yarn

2. **Setup:**
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```

3. **Access:**
   - Local: `http://localhost:3000`
   - Network: `http://192.168.1.7:3000`

## 📊 Features

### Dashboard
- ✅ Real-time motion detection monitoring
- ✅ Variance trend graph (Recharts)
- ✅ Threshold adjustment
- ✅ Calibration controls
- ✅ System event logging
- ✅ Premium dark mode UI
- ✅ Mobile responsive

### Firmware
- ✅ WiFi CSI-based motion detection
- ✅ Auto-calibration on boot
- ✅ Buzzer alarm on motion
- ✅ LED status indicator
- ✅ HTTP POST to dashboard
- ✅ Debounce logic

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/motion` | POST | Receive ESP32 data |
| `/api/motion` | GET | Get latest data + history |
| `/api/settings` | GET | Get configuration |
| `/api/settings` | POST | Update configuration |
| `/api/logs` | GET | Get event logs |
| `/api/logs` | POST | Add event log |
| `/api/logs` | DELETE | Clear all logs |

## 📝 Configuration

### ESP32 Settings (SmartDoorLock.ino)

```cpp
const char* ssid = "Your_WiFi";           // WiFi SSID
const char* password = "Your_Password";   // WiFi Password
const char* SERVER_URL = "http://...";    // Dashboard URL
const int THRESHOLD_MULT = 2.5;           // Threshold multiplier
const int DEBOUNCE_DELAY = 5000;          // Debounce delay (ms)
```

### Dashboard Settings (Web UI)

- Motion Threshold: 0.0 - 1.0
- Debounce Delay: 1000 - 30000 ms
- Calibration: Manual trigger

## 🌐 Deployment

### Deploy Dashboard to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy:**
   - Go to https://vercel.com
   - Import repository
   - Click Deploy
   - Get URL: `https://your-app.vercel.app`

3. **Update ESP32:**
   ```cpp
   const char* SERVER_URL = "https://your-app.vercel.app/api/motion";
   ```

## 📱 Hardware

- **Microcontroller:** ESP32 DevKit v1
- **Lock Actuator:** GPIO 18
- **Buzzer:** GPIO 19
- **LED:** GPIO 2
- **Power:** USB or Battery

## 🔍 Troubleshooting

### ESP32 not connecting
- Check WiFi credentials
- Verify WiFi signal strength
- Check USB cable connection

### Dashboard not receiving data
- Verify ESP32 URL is correct
- Check firewall settings
- Ensure ESP32 is connected to WiFi

### Threshold not working
- Adjust sensitivity in Settings tab
- Click "Save Settings"
- Check Logs for confirmation

## 📚 Documentation

- [Firmware Documentation](firmware/README.md)
- [Dashboard Documentation](dashboard/README.md)

## 📄 License

MIT License

## 👨‍💻 Author

Smart Door Lock CSI Project

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-05-30
