# Quick Start Guide - Testing untuk Dosen

Panduan singkat untuk mulai testing sistem deteksi gerakan.

## ⚡ Setup 5 Menit

### Step 1: Install Python Tools

```bash
cd d:\Hudi\Projects\SmartDoorLock\testing
pip install -r requirements.txt
```

### Step 2: Check Port ESP32

1. Colok ESP32 ke laptop via USB
2. Buka Device Manager (Win + X, pilih Device Manager)
3. Lihat di "Ports (COM & LPT)"
4. Catat nomor COM (misal: **COM3**)

### Step 3: Test Koneksi

```bash
python data_logger.py
```

- Pilih option 4 (General Logging)
- Duration: tekan Enter (unlimited)
- Port: masukkan COM port kamu (misal: COM3)
- Kalau berhasil, kamu akan lihat log output

Press Ctrl+C untuk stop.

✅ Kalau sampai sini berhasil, kamu siap mulai testing!

---

## 🧪 Test 1: Range (Jarak) - 30 menit

### Persiapan:
- Meteran 10 meter
- Marker/cone untuk tandai jarak
- Ruangan kosong minimal 10m

### Run:

```bash
python data_logger.py range_test 30 COM3
```

*(Ganti COM3 dengan port kamu)*

### Prosedur:

Untuk setiap jarak (0.5m, 1m, 2m, 3m, 4m, 5m, 6m, 7m, 8m):

1. **Berdiri di jarak yang ditentukan** (depan ESP32)
2. **Diam 10 detik** (baseline)
3. **Gerakan standar**:
   - Angkat tangan kanan (2 detik)
   - Angkat tangan kiri (2 detik)
   - Jalan 2 langkah kanan-kiri (4 detik)
   - Jongkok-berdiri 1x (2 detik)
4. **Diam 10 detik** lagi
5. **Ulangi 3x** per jarak
6. **Catat manual**: Berapa kali terdeteksi dari 3 percobaan

### Hasil:

Setelah selesai, analyze:

```bash
python analyze_results.py test_data/[filename_range_test].csv
```

Buka folder `test_data/[filename]_analysis/` untuk lihat grafik.

**Yang dicari:**
- Jarak maksimal dengan >80% detection rate
- Jarak optimal dengan >95% detection rate

---

## 🧪 Test 2: Angle (Sudut) - 20 menit

### Persiapan:
- Gunakan **jarak optimal dari Test 1** (misal 2m)
- Tandai semicircle dengan radius = jarak optimal
- Tandai sudut setiap 15° dari -90° hingga +90°
- Busur derajat atau compass app di smartphone

### Run:

```bash
python data_logger.py angle_test 20 COM3
```

### Prosedur:

Untuk setiap sudut (-90°, -60°, -30°, 0°, +30°, +60°, +90°):

1. Posisi di sudut yang ditentukan, **jarak tetap**
2. Lakukan gerakan standar (sama seperti Test 1)
3. Ulangi 3x per sudut
4. Catat manual: detection success

### Hasil:

```bash
python analyze_results.py test_data/[filename_angle_test].csv
```

**Yang dicari:**
- Total field of view (FOV) dalam derajat
- Sudut dengan >80% detection rate

---

## 🧪 Test 3: Object Discrimination - 15 menit

### Persiapan:
- Gunakan **jarak optimal** dan **sudut 0°** (depan)
- Siapkan objek:
  - Manusia (kamu sendiri)
  - Kursi
  - Kardus besar
  - Botol air
  - Tas ransel

### Run:

```bash
python data_logger.py object_discrimination 15 COM3
```

### Prosedur:

**Untuk setiap objek:**

1. Gerakkan objek dengan pola yang sama
   - Tarik-dorong
   - Kiri-kanan
   - (Untuk manusia: gerakan standar)
2. Ulangi 5x per objek
3. **Penting**: Catat di notes **objek apa yang sedang di-test**
   - Tulis di kertas dengan timestamp
   - Atau record video saat test

### Hasil:

```bash
python analyze_results.py test_data/[filename_object_test].csv
```

**Manual Analysis** (karena logger tidak tahu objek apa):

1. Lihat timeline.png
2. Match timestamp dengan notes kamu
3. Compare variance values:
   - Manusia: biasanya **variance tinggi** (0.1-0.5)
   - Objek besar: **variance sedang** (0.05-0.2)
   - Objek kecil: **variance rendah** (<0.05)

**Calculate Discrimination Score:**

```
Score = (Average Human Variance) / (Average Object Variance)
```

- Score > 2.0 = **Good** discrimination
- Score 1.5-2.0 = **Moderate**
- Score < 1.5 = **Poor** (tidak bisa bedakan)

---

## 📊 Compile Laporan

### Data yang perlu ada di laporan:

1. **Range Test Results**
   - Tabel jarak vs detection rate
   - Grafik dari analyze_results.py
   - Kesimpulan: jarak maksimal dan optimal

2. **Angle Test Results**
   - Tabel sudut vs detection rate
   - Polar plot (bisa bikin manual di Excel)
   - Kesimpulan: total FOV dalam derajat

3. **Object Discrimination Results**
   - Tabel objek vs average variance
   - Bar chart perbandingan
   - Discrimination score
   - Kesimpulan: bisa/tidak bisa bedakan

4. **Limitations & Recommendations**
   - Keterbatasan yang ditemukan
   - False positive/negative rate
   - Saran perbaikan sistem

### Template Laporan

```
LAPORAN TESTING SISTEM DETEKSI GERAKAN WiFi
Smart Door Lock - [Nama Kamu]

1. PENDAHULUAN
   - Tujuan testing
   - Perangkat yang digunakan
   - Lokasi dan kondisi test

2. METODOLOGI
   - Protokol testing (refer ke TESTING_PROTOCOL.md)
   - Setup dan prosedur
   - Tools yang digunakan

3. HASIL TEST 1: RANGE
   - Data dan grafik
   - Analisis
   - Kesimpulan

4. HASIL TEST 2: ANGLE
   - Data dan grafik
   - Analisis
   - Kesimpulan

5. HASIL TEST 3: OBJECT DISCRIMINATION
   - Data dan grafik
   - Analisis
   - Kesimpulan

6. DISKUSI
   - Limitasi sistem
   - Faktor yang mempengaruhi
   - Comparison dengan ekspektasi

7. KESIMPULAN
   - Summary ketiga test
   - Rekomendasi implementasi

8. LAMPIRAN
   - Raw data (CSV)
   - Foto setup
   - Code yang digunakan
```

---

## 📸 Documentation Tips

**Wajib foto:**
- [ ] Setup overview (bird's eye view)
- [ ] Marking jarak untuk range test
- [ ] Marking sudut untuk angle test
- [ ] Object-object yang di-test
- [ ] Screenshot dashboard saat motion detected
- [ ] Screenshot serial monitor logs

**Optional tapi bagus:**
- [ ] Video saat testing (bisa slow-mo)
- [ ] Diagram setup test
- [ ] Screenshot analyzer output

---

## ❓ FAQ

**Q: Berapa lama total testing?**  
A: Range (30 min) + Angle (20 min) + Object (15 min) = ~1 jam aktif testing + setup ~30 menit = **Total ~1.5 jam**

**Q: Bisa test sendiri atau perlu bantuan?**  
A: Bisa sendiri, tapi **lebih bagus ada 2 orang**:
- 1 orang jadi test subject (bergerak)
- 1 orang monitor laptop/catat data

**Q: Kalau hasil jelek, gimana?**  
A: **Jujur report apa adanya**. Ini test untuk evaluasi sistem, bukan untuk dapetin nilai bagus. Dosen mau tahu **real performance** dan **limitations**.

**Q: Harus test di lab atau bisa di rumah?**  
A: **Bisa di mana aja** asal:
- Ruangan cukup besar (minimal 10m panjang)
- Relatif sepi (ga banyak orang lalu-lalang)
- WiFi stabil

**Q: Data logger ga capture data?**  
A: Check:
1. Port number benar?
2. ESP32 sudah di-upload firmware?
3. Arduino IDE serial monitor ditutup? (conflict)
4. Reset ESP32, coba lagi

---

## 🎯 Success Checklist

Sebelum submit ke dosen, pastikan punya:

- [ ] 3 CSV files (range, angle, object)
- [ ] Grafik dari analyzer untuk tiap test
- [ ] Tabel manual data collection
- [ ] Foto dokumentasi
- [ ] Laporan lengkap (PDF)
- [ ] Kesimpulan jelas untuk 3 parameter:
  - ✓ Jarak deteksi: ___ meter
  - ✓ Sudut deteksi: ___ derajat
  - ✓ Diskriminasi objek: YA / TIDAK

---

**Semangat testing! Kalau ada kendala, refer ke README.md atau TESTING_PROTOCOL.md yang lebih detail. 💪**
