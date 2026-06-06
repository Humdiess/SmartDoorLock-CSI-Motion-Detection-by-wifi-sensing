# LAPORAN TESTING - TEMPLATE
## Sistem Deteksi Gerakan WiFi - Smart Door Lock

---

**Nama Mahasiswa**: [Nama Kamu]  
**NRP**: [NRP Kamu]  
**Mata Kuliah**: [Nama MK]  
**Dosen**: [Nama Dosen]  
**Tanggal Test**: [DD/MM/YYYY]  
**Lokasi Test**: [Nama Ruangan/Lokasi]

---

## 1. PENDAHULUAN

### 1.1 Latar Belakang
Sistem Smart Door Lock menggunakan teknologi WiFi-based motion detection untuk mendeteksi kehadiran orang di depan pintu. Sistem ini memanfaatkan perubahan RSSI (Received Signal Strength Indicator) sebagai indikator gerakan.

### 1.2 Tujuan Testing
Testing ini bertujuan untuk mengukur dan mengevaluasi tiga parameter utama sistem:
1. **Detection Range** - Jarak efektif deteksi gerakan (dalam meter)
2. **Detection Angle** - Sudut atau field of view sistem (dalam derajat)
3. **Object Discrimination** - Kemampuan membedakan manusia dengan objek lain

### 1.3 Perangkat yang Digunakan

| Komponen | Spesifikasi |
|----------|-------------|
| Microcontroller | ESP32 DevKit v1 |
| WiFi Network | [SSID yang dipakai] |
| Detection Method | RSSI Variance Analysis |
| Threshold | [nilai dari kalibrasi] |
| Sampling Rate | 20 samples, 100ms interval |

---

## 2. METODOLOGI

### 2.1 Setup Environment
- **Ruangan**: [Deskripsi ruangan - ukuran, furniture, dll]
- **Kondisi WiFi**: [Jumlah access point, interferensi]
- **Waktu Test**: [Pagi/Siang/Malam, pengaruh aktivitas WiFi]
- **Posisi ESP32**: [Ketinggian dari lantai, orientasi]

### 2.2 Tools & Software
- Python Data Logger (custom script)
- CSV Data Analysis Tool
- Arduino IDE (firmware upload)
- Web Dashboard (monitoring real-time)
- Measuring tape, protractor/compass app

### 2.3 Prosedur Umum
Semua test menggunakan gerakan standar yang konsisten:
1. Stand still 10 detik (baseline)
2. Angkat tangan kanan (2 detik)
3. Angkat tangan kiri (2 detik)
4. Jalan 2 langkah kanan-kiri (4 detik)
5. Jongkok-berdiri 1x (2 detik)
6. Stand still 10 detik (recovery)

---

## 3. HASIL TEST 1: DETECTION RANGE

### 3.1 Setup
- Test dilakukan pada sudut 0° (tepat di depan ESP32)
- Setiap jarak di-test 3 kali
- Jarak diukur dari center ESP32 ke posisi tester

### 3.2 Raw Data

| Jarak (m) | Trial 1 | Trial 2 | Trial 3 | Success Rate | Avg Response Time (s) |
|-----------|---------|---------|---------|--------------|----------------------|
| 0.5       | ✓       | ✓       | ✓       | 100%         | 0.8                  |
| 1.0       | ✓       | ✓       | ✓       | 100%         | 1.2                  |
| 1.5       | ✓       | ✓       | ✓       | 100%         | 1.5                  |
| 2.0       | ✓       | ✓       | ✓       | 100%         | 1.8                  |
| 3.0       | ✓       | ✓       | ✓       | 100%         | 2.2                  |
| 4.0       | ✓       | ✓       | ✗       | 67%          | 2.8                  |
| 5.0       | ✓       | ✗       | ✗       | 33%          | 3.5                  |
| 6.0       | ✗       | ✗       | ✓       | 33%          | 4.0                  |
| 7.0       | ✗       | ✗       | ✗       | 0%           | -                    |
| 8.0       | ✗       | ✗       | ✗       | 0%           | -                    |

*(Ini contoh data - ganti dengan data real kamu)*

### 3.3 Grafik

**[INSERT GRAPH: Distance vs Success Rate]**
- X-axis: Jarak (meter)
- Y-axis: Success Rate (%)
- Expected: downward trend

**[INSERT GRAPH: Variance Timeline from analyzer]**
- Screenshot dari timeline.png hasil analyzer

### 3.4 Analisis

**Observed Patterns:**
- Deteksi sangat reliable pada jarak 0.5m - 3.0m (100% success)
- Mulai degradasi pada jarak 4m ke atas
- Tidak ada deteksi sama sekali di atas 6m

**Variance Values:**
| Zone | Distance Range | Avg Variance | Detection Quality |
|------|---------------|--------------|-------------------|
| Optimal | 0.5m - 2m | 0.25 - 0.40 | Excellent (100%) |
| Good | 2m - 4m | 0.15 - 0.25 | Good (67-100%) |
| Poor | 4m - 6m | 0.05 - 0.15 | Poor (0-33%) |
| No Detection | >6m | <0.05 | None (0%) |

### 3.5 Kesimpulan Test 1

**Maximum Detection Range**: 6 meter (intermittent)  
**Reliable Detection Range**: 3 meter (100% success)  
**Optimal Range**: 0.5m - 2m (best performance)

**Rekomendasi**: Install ESP32 pada posisi yang menjamin target dalam radius 3 meter.

---

## 4. HASIL TEST 2: DETECTION ANGLE

### 4.1 Setup
- Jarak tetap: **2 meter** (dari hasil optimal Test 1)
- Test pada sudut: -90°, -60°, -30°, 0°, +30°, +60°, +90°
- Semicircle marking dengan tape di lantai

### 4.2 Raw Data

| Angle | Trial 1 | Trial 2 | Trial 3 | Success Rate | Notes |
|-------|---------|---------|---------|--------------|-------|
| -90°  | ✗       | ✗       | ✗       | 0%           | Behind ESP32 |
| -75°  | ✗       | ✗       | ✗       | 0%           | Side, minimal signal |
| -60°  | ✓       | ✗       | ✗       | 33%          | Weak detection |
| -45°  | ✓       | ✓       | ✗       | 67%          | |
| -30°  | ✓       | ✓       | ✓       | 100%         | |
| -15°  | ✓       | ✓       | ✓       | 100%         | |
| 0°    | ✓       | ✓       | ✓       | 100%         | Front - best |
| +15°  | ✓       | ✓       | ✓       | 100%         | |
| +30°  | ✓       | ✓       | ✓       | 100%         | |
| +45°  | ✓       | ✓       | ✗       | 67%          | |
| +60°  | ✗       | ✓       | ✗       | 33%          | Weak detection |
| +75°  | ✗       | ✗       | ✗       | 0%           | Side, minimal signal |
| +90°  | ✗       | ✗       | ✗       | 0%           | Perpendicular |

*(Contoh data - ganti dengan hasil real)*

### 4.3 Grafik

**[INSERT POLAR PLOT: Angle vs Success Rate]**
- Bisa bikin di Excel atau Python matplotlib polar plot
- Visualisasi FOV coverage

### 4.4 Analisis

**Field of View Zones:**
- **Primary FOV** (-30° to +30°): 100% detection - Total 60°
- **Secondary FOV** (-45° to +45°): >67% detection - Total 90°
- **Peripheral** (-60° to +60°): Inconsistent - Total 120°
- **No Coverage**: Beyond ±60°

**Total Effective FOV**: Approximately **60-90 degrees** (depending on reliability threshold)

### 4.5 Kesimpulan Test 2

**Maximum Detection Angle**: ±60° (inconsistent)  
**Reliable Detection Angle**: ±30° (100% success)  
**Total Reliable FOV**: 60 degrees

**Rekomendasi**: Posisikan ESP32 menghadap area utama yang ingin dimonitor. Untuk coverage lebih luas, perlu multiple sensor.

---

## 5. HASIL TEST 3: OBJECT DISCRIMINATION

### 5.1 Setup
- Jarak: 2 meter (optimal)
- Sudut: 0° (front)
- Objek test: Human, Chair, Box, Water Bottle, Backpack
- 5 trials per object

### 5.2 Raw Data

| Object Type | T1 | T2 | T3 | T4 | T5 | Success Rate | Avg Variance | Notes |
|-------------|----|----|----|----|----|--------------|--------------| ------|
| Human | ✓ | ✓ | ✓ | ✓ | ✓ | 100% | 0.315 | Baseline |
| Chair | ✓ | ✓ | ✗ | ✓ | ✗ | 60% | 0.185 | Large object |
| Large Box | ✓ | ✗ | ✓ | ✗ | ✓ | 60% | 0.172 | Similar to chair |
| Water Bottle | ✗ | ✗ | ✗ | ✗ | ✗ | 0% | 0.023 | Too small |
| Backpack | ✓ | ✗ | ✓ | ✗ | ✓ | 60% | 0.165 | Medium size |

*(Contoh data - sesuaikan dengan hasil real)*

### 5.3 Grafik

**[INSERT BAR CHART: Object Type vs Average Variance]**
- Compare variance values
- Show discrimination capability

**[INSERT BAR CHART: Object Type vs Detection Rate]**
- Success rate per object

### 5.4 Analisis

**Variance Comparison:**
```
Human:        0.315 (baseline)
Chair:        0.185 (59% of human)
Large Box:    0.172 (55% of human)
Backpack:     0.165 (52% of human)
Water Bottle: 0.023 (7% of human)
```

**Discrimination Score Calculation:**
```
Average Object Variance = (0.185 + 0.172 + 0.023 + 0.165) / 4 = 0.136
Discrimination Score = Human Variance / Avg Object Variance
                     = 0.315 / 0.136
                     = 2.32
```

**Score > 2.0 = Good Discrimination ✓**

### 5.5 Kesimpulan Test 3

**Discrimination Capability**: YES - Score 2.32

**Observations:**
1. **Human**: Clearly distinguishable dengan variance paling tinggi
2. **Large Objects** (chair, box, backpack): Menimbulkan variance 50-60% dari human - masih ter-detect tapi dengan confidence lebih rendah
3. **Small Objects** (bottle): Tidak ter-detect sama sekali

**Kesimpulan**: Sistem dapat membedakan manusia dengan objek kecil, namun objek besar (sebesar tubuh manusia) juga ter-detect. Ini bisa jadi **false positive** jika kursi digerakkan, dll.

**Rekomendasi**: 
- Adjust threshold lebih tinggi untuk reduce false positives
- Combine dengan sensor lain (PIR, camera) untuk verifikasi
- Gunakan machine learning untuk pattern recognition yang lebih baik

---

## 6. DISKUSI

### 6.1 Limitasi Sistem

**Technical Limitations:**
1. **Range**: Efektif hanya sampai 3 meter
2. **FOV**: Terbatas 60° - tidak bisa cover area luas
3. **False Positives**: Objek besar juga ter-detect
4. **Environmental**: Sensitif terhadap furniture, walls, reflections
5. **WiFi Dependency**: Memerlukan WiFi aktif dan stabil

**Environmental Factors:**
- Jumlah furniture mempengaruhi multipath
- WiFi traffic dari device lain dapat cause noise
- Metal objects dapat block/reflect signals
- Human traffic area can cause constant triggers

### 6.2 Comparison dengan Ekspektasi

| Parameter | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Max Range | 5-10m | ~3m | Below |
| Reliable Range | 3-5m | 0.5-2m | Below |
| FOV | 120° | 60° | Below |
| Discrimination | Partial | Yes (score 2.32) | Meet/Exceed |
| False Positive Rate | <10% | ~60% for large objects | Above |

**Overall**: Sistem functional tapi dengan limitations signifikan pada range dan FOV.

### 6.3 Factors yang Mempengaruhi

**Positive Factors** (meningkatkan detection):
- Open space, minimal furniture
- Clean line of sight
- Optimal ESP32 positioning (height ~1.5m)
- Strong WiFi signal

**Negative Factors** (menurunkan detection):
- Obstacles between ESP32 and target
- High WiFi traffic (banyak device)
- Metal walls/furniture
- Long distance

---

## 7. KESIMPULAN AKHIR

### 7.1 Summary Hasil Testing

**Test 1 - Detection Range:**
- Maximum: 6m (intermittent)
- Reliable: 3m (consistent)
- Optimal: 0.5m - 2m
- **Grade: B** (functional but limited)

**Test 2 - Detection Angle:**
- Total FOV: 90° (peripheral)
- Reliable FOV: 60° (±30°)
- **Grade: C+** (narrow coverage)

**Test 3 - Object Discrimination:**
- Score: 2.32 (good)
- Can distinguish human vs small objects
- Cannot distinguish human vs large objects reliably
- **Grade: B+** (partial success)

### 7.2 Overall System Evaluation

**Strengths:**
✓ Reliable dalam optimal zone (0.5-2m, ±30°)  
✓ Non-intrusive (no camera privacy concern)  
✓ Low cost implementation  
✓ Can distinguish humans from small objects  

**Weaknesses:**
✗ Limited range compared to PIR sensors  
✗ Narrow field of view  
✗ False positives from large moving objects  
✗ WiFi dependency  

**Use Case Recommendation:**
Sistem ini cocok untuk:
- Smart door lock (short range, frontal approach)
- Presence detection di area kecil
- Kombinasi dengan sensor lain

Tidak cocok untuk:
- Wide area monitoring
- Long-range detection
- High-security applications (too many false positives/negatives)

### 7.3 Rekomendasi Perbaikan

**Hardware:**
1. Multiple ESP32 di berbagai sudut untuk expand FOV
2. Posisi ESP32 di ketinggian optimal (~1.5m dari lantai)
3. Shield dari metal interference

**Software:**
1. Machine learning untuk better discrimination
2. Sensor fusion (combine dengan PIR, ultrasonic)
3. Adaptive threshold berdasarkan environment
4. Pattern recognition untuk distinguish walking vs object movement

**Deployment:**
1. Install di area dengan clear line of sight
2. Kalibrasi per lokasi (environment berbeda)
3. Regular maintenance dan re-calibration
4. Monitor false positive rate dan adjust

---

## 8. LAMPIRAN

### 8.1 Dokumentasi Foto
- [FOTO 1: Setup overview]
- [FOTO 2: Range test marking]
- [FOTO 3: Angle test setup]
- [FOTO 4: Objects tested]
- [FOTO 5: Dashboard screenshot]

### 8.2 Raw Data Files
- `range_test_20260606.csv` - [Link atau attach]
- `angle_test_20260606.csv` - [Link atau attach]
- `object_discrimination_20260606.csv` - [Link atau attach]

### 8.3 Code Repository
- Firmware: `../firmware/SmartDoorLock_Simple/`
- Testing tools: `../testing/`
- Dashboard: `../dashboard/`

### 8.4 References
1. ESP32 WiFi RSSI Documentation
2. CSI (Channel State Information) Research Papers
3. WiFi-based Motion Detection Studies

---

**Tanda Tangan:**

____________________  
[Nama Mahasiswa]

**Tanggal**: [DD/MM/YYYY]

---

*Report generated using Smart Door Lock Testing Framework*
