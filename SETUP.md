# 🔐 Smart Door Lock - Setup Guide

Panduan lengkap untuk menghubungkan ESP32 dengan Dashboard Web.

---

## 📋 Yang Dibutuhkan

- **Hardware:**
  - ESP32 DevKit v1
  - Buzzer (pin 19)
  - LED (pin 2)
  - Solenoid Lock (pin 18)
  
- **Software:**
  - Arduino IDE dengan ESP32 board support
  - Node.js (untuk dashboard)
  - WiFi Router (ESP32 dan komputer harus di jaringan yang sama)

---

## 🚀 Langkah Setup

### 1️⃣ Setup Dashboard (Next.js)

```bash
# Masuk ke folder dashboard
cd dashboard

# Install dependencies (jika belum)
npm install

# Jalankan dev server
npm run dev
```

Dashboard akan berjalan di: **http://localhost:3000**

✅ **Jangan tutup terminal ini!** Dashboard harus tetap berjalan.

---

### 2️⃣ Cari IP Address Komputer

**Cara Otomatis (Recommended):**
```bash
# Jalankan script dari root project
powershell -ExecutionPolicy Bypass -File find-ip.ps1
```

**Cara Manual:**
1. Buka Command Prompt (cmd)
2. Ketik: `ipconfig`
3. Cari **"IPv4 Address"** di bagian WiFi/Ethernet adapter
4. Contoh: `192.168.1.105`

⚠️ **PENTING:** Komputer dan ESP32 harus terhubung ke **WiFi yang sama**!

---

### 3️⃣ Konfigurasi ESP32

1. Buka file: `firmware/SmartDoorLock.ino`

2. **Update WiFi credentials** (baris 21-22):
   ```cpp
   const char* ssid = "NAMA_WIFI_KAMU";
   const char* password = "PASSWORD_WIFI_KAMU";
   ```

3. **Update Server URL** (baris 34):
   ```cpp
   const char* SERVER_URL = "http://[IP_KOMPUTER_KAMU]:3000/api/motion";
   ```
   
   Contoh:
   ```cpp
   const char* SERVER_URL = "http://192.168.1.105:3000/api/motion";
   ```

4. **Upload ke ESP32:**
   - Buka Arduino IDE
   - Pilih Board: "ESP32 Dev Module"
   - Pilih Port yang sesuai
   - Klik Upload

---

### 4️⃣ Testing Koneksi

1. **Buka Serial Monitor** di Arduino IDE (115200 baud)
2. ESP32 akan:
   - Connect ke WiFi
   - Melakukan kalibrasi (15 detik - jangan gerak!)
   - Mulai mengirim data setiap 1 detik

3. **Cek Dashboard:**
   - Buka browser: http://localhost:3000
   - Lihat tab "Overview" - data harus muncul
   - Variance dan RSSI harus update real-time

---

## 🔍 Troubleshooting

### ❌ ESP32 tidak bisa connect ke WiFi
- Pastikan SSID dan password benar
- Pastikan WiFi 2.4GHz (ESP32 tidak support 5GHz)
- Cek jarak ESP32 ke router

### ❌ ESP32 connect tapi data tidak muncul di dashboard
- Pastikan dashboard berjalan (`npm run dev`)
- Cek IP address di `SERVER_URL` sudah benar
- Pastikan port 3000 (bukan 5000)
- Cek Serial Monitor untuk error message
- Pastikan firewall tidak memblokir port 3000

### ❌ Dashboard menampilkan "Connecting..." terus
- Pastikan ESP32 sudah mengirim data (cek Serial Monitor)
- Refresh browser (Ctrl + F5)
- Cek console browser (F12) untuk error

### ❌ Error "Failed to send data" di Serial Monitor
- Pastikan IP address benar
- Pastikan dashboard berjalan
- Coba ping IP dari command prompt: `ping [IP_KOMPUTER]`

---

## 📊 Cara Kerja Sistem

```
┌─────────────┐         WiFi          ┌──────────────┐
│   ESP32     │ ──────────────────────>│  Dashboard   │
│             │   POST /api/motion     │  (Next.js)   │
│ - Deteksi   │   {variance, rssi,     │              │
│   Gerakan   │    threshold, motion}  │ - Chart      │
│ - Buzzer    │                        │ - Settings   │
│ - Lock      │   Setiap 1 detik       │ - Logs       │
└─────────────┘                        └──────────────┘
```

**Data yang dikirim ESP32:**
- `variance`: Tingkat perubahan sinyal WiFi (0.0 - 1.0)
- `threshold`: Batas deteksi gerakan
- `motion`: Status gerakan (true/false)
- `rssi`: Kekuatan sinyal WiFi (dBm)
- `timestamp`: Waktu dalam milliseconds

---

## ⚙️ Konfigurasi Lanjutan

### Mengubah Sensitivitas Deteksi

Di dashboard → Tab "Configuration":
- **Motion Threshold**: Semakin rendah = semakin sensitif
- **Debounce Delay**: Waktu tunggu sebelum reset status

### Kalibrasi Ulang

Jika deteksi tidak akurat:
1. Buka dashboard → Tab "Configuration"
2. Klik "Kalibrasi Ulang"
3. Jangan bergerak selama 15 detik
4. Sistem akan set baseline baru

---

## 📝 Catatan Penting

- ✅ Dashboard harus **selalu berjalan** agar ESP32 bisa kirim data
- ✅ ESP32 dan komputer harus di **WiFi yang sama**
- ✅ Port yang digunakan: **3000** (Next.js default)
- ✅ Data disimpan di **memory** (hilang saat restart server)
- ✅ Maksimal history: **60 data points** (1 menit)
- ✅ Maksimal logs: **500 entries**

---

## 🎯 Next Steps

Setelah semua berjalan:
1. Test deteksi gerakan dengan berjalan di depan ESP32
2. Cek apakah buzzer berbunyi dan LED menyala
3. Monitor dashboard untuk melihat perubahan variance
4. Adjust threshold jika perlu
5. Implementasi kontrol solenoid lock

---

## 📞 Support

Jika ada masalah, cek:
1. Serial Monitor ESP32 untuk log detail
2. Browser Console (F12) untuk error frontend
3. Terminal dashboard untuk error backend

**Happy Coding! 🚀**
