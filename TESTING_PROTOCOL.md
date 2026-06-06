# Testing Protocol: WiFi Motion Detection System
## Smart Door Lock - CSI Motion Detection Validation

**Tester**: [Nama Anda]  
**Date**: [Tanggal Test]  
**Location**: [Lokasi Test]  
**Device**: ESP32 DevKit v1  
**WiFi Network**: [SSID yang digunakan]

---

## 🎯 Test Objectives

Mengukur 3 parameter utama sistem deteksi gerakan WiFi:

1. **Detection Range** (Jarak Deteksi) - berapa meter efektif
2. **Detection Angle** (Sudut Deteksi) - field of view dalam derajat
3. **Object Discrimination** (Diskriminasi Objek) - kemampuan bedakan manusia vs benda

---

## 📋 Test Equipment Needed

- [x] ESP32 Smart Lock device (sudah terprogram)
- [ ] Measuring tape / meteran (minimal 10 meter)
- [ ] Protractor / busur derajat atau smartphone dengan compass app
- [ ] Marker / cone untuk tandai posisi
- [ ] Stopwatch / timer
- [ ] Laptop untuk monitor serial output / dashboard
- [ ] Objek test:
  - Manusia (tester)
  - Kursi
  - Kardus besar
  - Botol air
  - Tas ransel
- [ ] Form pencatatan data (bisa print atau digital)

---

## 🔬 TEST 1: Detection Range (Jarak Deteksi)

### Objective
Menentukan jarak maksimal dimana sistem masih bisa deteksi gerakan manusia dengan reliable.

### Setup
1. Tempatkan ESP32 di posisi tetap (reference point)
2. Mark posisi ESP32 sebagai titik 0 meter
3. Buat garis lurus dari ESP32 keluar
4. Tandai jarak setiap 0.5 meter sampai 10 meter

### Procedure

**Untuk setiap jarak (0.5m, 1m, 1.5m, 2m, 3m, 4m, 5m, 6m, 7m, 8m, 9m, 10m):**

1. **Initial Condition**: Tester berdiri diam di posisi
2. **Wait**: Tunggu 10 detik (biarkan sistem stabil)
3. **Movement Pattern**: Lakukan gerakan standar:
   - Angkat tangan kanan (2 detik)
   - Angkat tangan kiri (2 detik)
   - Berjalan 2 langkah ke kanan-kiri (4 detik)
   - Jongkok-berdiri 1x (2 detik)
4. **Wait**: Tunggu 10 detik lagi
5. **Repeat**: Ulangi 3 kali per jarak
6. **Record**: Catat berapa kali terdeteksi dari 3 percobaan

### Data Collection

| Jarak (m) | Trial 1 | Trial 2 | Trial 3 | Success Rate | Avg Response Time | Notes |
|-----------|---------|---------|---------|--------------|-------------------|-------|
| 0.5       |         |         |         |              |                   |       |
| 1.0       |         |         |         |              |                   |       |
| 1.5       |         |         |         |              |                   |       |
| 2.0       |         |         |         |              |                   |       |
| 3.0       |         |         |         |              |                   |       |
| 4.0       |         |         |         |              |                   |       |
| 5.0       |         |         |         |              |                   |       |
| 6.0       |         |         |         |              |                   |       |
| 7.0       |         |         |         |              |                   |       |
| 8.0       |         |         |         |              |                   |       |
| 9.0       |         |         |         |              |                   |       |
| 10.0      |         |         |         |              |                   |       |

**Success Rate**: Detected (✓) = 1, Not Detected (✗) = 0

### Expected Results
- **Optimal Range**: 0.5m - 3m (>90% detection)
- **Effective Range**: 3m - 6m (50-90% detection)
- **Poor Range**: >6m (<50% detection)

---

## 🔬 TEST 2: Detection Angle (Sudut Deteksi)

### Objective
Menentukan field of view (FOV) sistem - pada sudut berapa masih bisa deteksi gerakan.

### Setup
1. Tempatkan ESP32 di center posisi
2. Tetapkan jarak test = [hasil optimal dari Test 1, misal 2 meter]
3. Buat semi-circle dengan radius = jarak test
4. Tandai sudut setiap 15° dari -90° sampai +90° (0° = depan ESP32)

### Procedure

**Untuk setiap sudut (-90°, -75°, -60°, -45°, -30°, -15°, 0°, +15°, +30°, +45°, +60°, +75°, +90°):**

1. Posisikan tester di sudut yang ditentukan, jarak tetap
2. Lakukan movement pattern standar (sama seperti Test 1)
3. Ulangi 3 kali per sudut
4. Catat detection success

### Data Collection

| Angle (°) | Trial 1 | Trial 2 | Trial 3 | Success Rate | Notes |
|-----------|---------|---------|---------|--------------|-------|
| -90       |         |         |         |              |       |
| -75       |         |         |         |              |       |
| -60       |         |         |         |              |       |
| -45       |         |         |         |              |       |
| -30       |         |         |         |              |       |
| -15       |         |         |         |              |       |
| 0         |         |         |         |              |       |
| +15       |         |         |         |              |       |
| +30       |         |         |         |              |       |
| +45       |         |         |         |              |       |
| +60       |         |         |         |              |       |
| +75       |         |         |         |              |       |
| +90       |         |         |         |              |       |

### Expected Results
- **Primary FOV**: -30° to +30° (>80% detection)
- **Secondary FOV**: -60° to +60° (50-80% detection)
- **Peripheral**: >±60° (<50% detection)

---

## 🔬 TEST 3: Object Discrimination (Diskriminasi Objek)

### Objective
Menguji apakah sistem bisa membedakan gerakan manusia vs benda mati.

### Setup
1. Gunakan jarak optimal dari Test 1 (misal 2m)
2. Gunakan sudut optimal (0° - depan device)
3. Siapkan berbagai objek test

### Procedure

**Test 3A: Manusia (Baseline)**
1. Tester melakukan movement pattern standar
2. Ulangi 5 kali
3. Catat: detection rate, variance value, RSSI value

**Test 3B: Objek Besar (Kursi)**
1. Gerakkan kursi dengan pola yang sama (tarik-dorong, kiri-kanan)
2. Ulangi 5 kali
3. Catat: detection rate, variance value, RSSI value

**Test 3C: Objek Medium (Kardus)**
1. Gerakkan kardus besar dengan pola yang sama
2. Ulangi 5 kali
3. Catat sama seperti di atas

**Test 3D: Objek Kecil (Botol Air)**
1. Gerakkan botol air dengan tangan
2. Ulangi 5 kali
3. Catat sama

**Test 3E: Objek Tubuh (Tas Ransel)**
1. Gerakkan tas ransel (mirip ukuran torso manusia)
2. Ulangi 5 kali
3. Catat sama

### Data Collection

| Object Type | Trial 1 | Trial 2 | Trial 3 | Trial 4 | Trial 5 | Avg Variance | Avg RSSI | Success Rate |
|-------------|---------|---------|---------|---------|---------|--------------|----------|--------------|
| Human       |         |         |         |         |         |              |          |              |
| Chair       |         |         |         |         |         |              |          |              |
| Box         |         |         |         |         |         |              |          |              |
| Bottle      |         |         |         |         |         |              |          |              |
| Backpack    |         |         |         |         |         |              |          |              |

### Analysis Metrics

**Discrimination Score** = (Human Detection Rate) / (Average Object Detection Rate)

- Score > 2.0 = Good discrimination
- Score 1.5-2.0 = Moderate discrimination
- Score < 1.5 = Poor discrimination (sistem tidak bisa bedakan)

---

## 📊 Additional Environmental Tests

### Test 4: Environmental Factors (Optional tapi disarankan)

Test pengaruh kondisi lingkungan:

| Condition | Detection Rate | Notes |
|-----------|----------------|-------|
| Empty room (kosong) | | Baseline |
| With furniture | | Refleksi lebih banyak |
| Multiple people | | Apakah tetap terdeteksi |
| Different times (pagi/siang/malam) | | Pengaruh aktivitas WiFi |

---

## 📝 Data Analysis Guidelines

### Untuk Laporan ke Dosen:

1. **Detection Range Summary**:
   - Maximum detection distance: ___ meters
   - Optimal detection zone: ___ to ___ meters
   - Detection rate graph (distance vs success rate)

2. **Detection Angle Summary**:
   - Total field of view: ___ degrees
   - Primary detection zone: ___ degrees
   - Polar plot diagram (angle vs detection rate)

3. **Object Discrimination Summary**:
   - Discrimination capability: YES / NO / PARTIAL
   - Discrimination score: ___
   - Bar chart (object type vs detection rate)
   - Variance comparison (human vs objects)

4. **Limitations Identified**:
   - List keterbatasan sistem yang ditemukan
   - False positive rate
   - False negative rate

5. **Recommendations**:
   - Ideal installation position
   - Suggested improvements

---

## 🎓 Tips untuk Test yang Baik

1. **Consistency**: Gunakan movement pattern yang sama untuk semua test
2. **Environment**: Test di ruangan yang sama untuk semua percobaan
3. **Time**: Hindari jam sibuk WiFi (banyak device lain aktif)
4. **Documentation**: Foto/video setup test untuk laporan
5. **Repeat**: Jika hasil aneh, ulangi test tersebut
6. **Notes**: Catat semua anomali atau observasi menarik

---

## ⚠️ Safety Notes

- Pastikan device tidak overheat selama test panjang
- Monitor power supply stabil
- Jangan test di area dengan air/basah
- Jaga jarak aman dari device saat test

---

## 📸 Documentation Checklist

- [ ] Foto setup test (bird's eye view)
- [ ] Foto marking jarak dan sudut
- [ ] Screenshot dashboard saat test
- [ ] Serial monitor logs
- [ ] Video sample detection (optional)

---

**Good luck dengan testing! 🚀**

Setelah selesai test, compile semua data ke dalam spreadsheet atau grafik untuk laporan yang lebih profesional.
