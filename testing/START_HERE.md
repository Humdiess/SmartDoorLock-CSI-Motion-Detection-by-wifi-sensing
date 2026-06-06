# 🎯 TESTING FRAMEWORK - READY TO USE!

## Apa yang Sudah Dibuat

Saya sudah membuatkan complete testing framework untuk membantu kamu menyelesaikan tugas dari dosen. Berikut yang sudah siap:

### 📁 File Structure

```
SmartDoorLock/
│
├── testing/                          [NEW - Testing Framework]
│   ├── run_tests.bat                 # Windows launcher (klik 2x untuk mulai)
│   ├── data_logger.py                # Auto-capture data dari ESP32
│   ├── analyze_results.py            # Analisis otomatis + grafik
│   ├── requirements.txt              # Python dependencies
│   ├── data_collection_template.csv  # Template manual data entry
│   ├── README.md                     # Documentation lengkap
│   ├── QUICK_START.md                # Panduan 5 menit
│   ├── REPORT_TEMPLATE.md            # Template laporan untuk dosen
│   └── test_data/                    # Folder hasil test (auto-created)
│
├── TESTING_PROTOCOL.md               # Protokol testing detail
├── firmware/                         # ESP32 firmware (sudah ada)
└── dashboard/                        # Web dashboard (sudah ada)
```

---

## 🚀 Quick Start - 3 Steps

### Step 1: Install Python Tools (5 menit)

```bash
cd d:\Hudi\Projects\SmartDoorLock\testing
pip install -r requirements.txt
```

### Step 2: Check COM Port ESP32

1. Colok ESP32 via USB
2. Device Manager → Ports (COM & LPT)
3. Catat nomor COM (misal: COM3)

### Step 3: Run Tests

**MUDAH - Gunakan Launcher:**
```bash
# Double-click file ini:
testing/run_tests.bat
```

Pilih menu:
- 1 = Range Test (30 min)
- 2 = Angle Test (20 min)
- 3 = Object Test (15 min)
- 5 = Analyze Results

**ATAU Manual via Command Line:**
```bash
# Range test
python data_logger.py range_test 30 COM3

# Analyze
python analyze_results.py test_data/[file].csv
```

---

## 📊 What You Need to Answer

Tugas dari dosen kamu:

### ✅ Test 1: Jarak Deteksi (Range)
**Pertanyaan**: Pada jarak berapa meter bisa deteksi gerakan?

**Cara Test**: 
- Test di jarak: 0.5m, 1m, 2m, 3m, 4m, 5m, 6m, 7m, 8m
- Ulangi 3x per jarak
- Catat success rate

**Expected Answer Format**:
```
Maximum Range: ~6 meter (intermittent)
Reliable Range: ~3 meter (>90% detection)
Optimal Range: 0.5m - 2m (>95% detection)
```

### ✅ Test 2: Sudut Deteksi (Angle)
**Pertanyaan**: Pada sudut berapa bisa deteksi?

**Cara Test**:
- Gunakan jarak optimal dari Test 1
- Test sudut: -90°, -60°, -30°, 0°, +30°, +60°, +90°
- Ulangi 3x per sudut

**Expected Answer Format**:
```
Total FOV: ~90° (peripheral)
Reliable FOV: ~60° (±30° from center)
Best Coverage: 0° (front-facing)
```

### ✅ Test 3: Bedakan Objek
**Pertanyaan**: Bisa ga bedain manusia atau benda di depannya?

**Cara Test**:
- Test dengan: Manusia, Kursi, Kardus, Botol, Tas
- Ulangi 5x per objek
- Compare variance values

**Expected Answer Format**:
```
Discrimination Score: 2.32 (Good - score > 2.0)

DAPAT BEDAKAN:
✓ Manusia vs objek kecil (botol, dll)

TIDAK DAPAT BEDAKAN:
✗ Manusia vs objek besar (kursi, kardus besar)

Kesimpulan: PARTIAL discrimination capability
```

---

## 📝 Timeline Pengerjaan

### Day 1: Preparation (30 min)
- [ ] Install Python + dependencies
- [ ] Test koneksi ESP32
- [ ] Run general logging untuk cek sistem OK
- [ ] Siapkan ruangan dan alat ukur (meteran, busur)

### Day 2: Testing (2 hours)
- [ ] Range Test (30 min active + 15 min setup)
- [ ] Angle Test (20 min active + 10 min setup)
- [ ] Object Discrimination Test (15 min active + 10 min setup)
- [ ] Backup: Foto dokumentasi, video

### Day 3: Analysis (2 hours)
- [ ] Run analyzer untuk semua test
- [ ] Buat grafik tambahan di Excel (optional)
- [ ] Compile data ke template laporan
- [ ] Review dan verifikasi hasil

### Day 4: Report Writing (3 hours)
- [ ] Isi REPORT_TEMPLATE.md dengan data real
- [ ] Insert grafik dan foto
- [ ] Tulis analisis dan kesimpulan
- [ ] Proofread
- [ ] Export ke PDF

**Total Time**: ~7-8 jam (bisa dikerjakan 2-3 hari)

---

## 🎓 Tips untuk Dosen

### Hal yang Bikin Dosen Senang:
✓ **Data lengkap** - raw data + grafik + analisis  
✓ **Jujur** - report keterbatasan sistem apa adanya  
✓ **Metodologi jelas** - bisa di-reproduce  
✓ **Visual bagus** - grafik, foto, diagram  
✓ **Diskusi mendalam** - factors yang mempengaruhi, comparison  
✓ **Rekomendasi** - perbaikan yang bisa dilakukan  

### Hal yang Harus Dihindari:
✗ Data asal-asalan atau dibuat-buat  
✗ Cuma kasih angka tanpa analisis  
✗ Copy-paste tanpa understanding  
✗ Tidak ada dokumentasi foto/video  
✗ Laporan terlalu singkat (minimal 10-15 halaman)  

---

## 📊 Expected Results (Ballpark Estimates)

Berdasarkan sistem WiFi RSSI yang sudah dibuat, expected results sekitar:

### Range Test
- **Optimal**: 0.5m - 2m (hampir 100% detection)
- **Good**: 2m - 4m (70-90% detection)
- **Poor**: 4m - 6m (20-50% detection)
- **None**: >6m (0-10% detection)

**Faktor**: RSSI variance menurun dengan jarak, noise increases

### Angle Test
- **Primary**: ±30° (90-100% detection)
- **Secondary**: ±45° (60-80% detection)
- **Peripheral**: ±60° (20-50% detection)
- **Behind/Side**: ±90° (0-10% detection)

**Faktor**: WiFi antenna radiation pattern, omnidirectional tapi strongest di depan

### Object Discrimination
- **Human**: Variance ~0.2-0.4 (high)
- **Large objects**: Variance ~0.1-0.2 (medium)
- **Small objects**: Variance <0.05 (low/none)
- **Discrimination Score**: 1.5 - 2.5 (PARTIAL success)

**Faktor**: Size dan movement pattern mempengaruhi RSSI variance

**NOTE**: Ini estimates - hasil real bisa beda tergantung environment!

---

## 🆘 Troubleshooting

### Problem: "Python not found"
**Solution**: Install Python dari https://www.python.org/downloads/
- Pastikan centang "Add to PATH" saat install

### Problem: "Cannot connect to COM3"
**Solution**: 
- Check Device Manager untuk port yang benar
- Close Arduino IDE serial monitor
- Reset ESP32
- Install CH340 driver jika perlu

### Problem: "No motion detected sama sekali"
**Solution**:
- Check WiFi ESP32 connected
- Tunggu calibration selesai (50 samples, ~5 detik)
- Check threshold tidak terlalu tinggi
- Coba gerakan lebih besar (lompat, jalan cepat)

### Problem: "False positive terus-terusan"
**Solution**:
- Environment terlalu noisy
- Ada orang lain lewat
- Furniture/AC bergerak
- Recalibrate di environment lebih stabil

### Problem: "Data logger tidak capture apa-apa"
**Solution**:
- Check serial output manual di Arduino IDE dulu
- Pastikan firmware sudah di-upload
- Verify baud rate 115200
- Check ESP32 tidak restart terus

---

## 📚 Documentation Files

Baca file-file ini untuk detail lebih lanjut:

1. **[QUICK_START.md](testing/QUICK_START.md)** 
   → Panduan tercepat, 5 menit ready

2. **[TESTING_PROTOCOL.md](TESTING_PROTOCOL.md)**  
   → Protokol lengkap, methodology detail

3. **[testing/README.md](testing/README.md)**  
   → Documentation tools, troubleshooting

4. **[REPORT_TEMPLATE.md](testing/REPORT_TEMPLATE.md)**  
   → Template laporan lengkap untuk dosen

5. **Firmware**: [firmware/SmartDoorLock_Simple.ino](firmware/SmartDoorLock_Simple/SmartDoorLock_Simple.ino)  
   → Kode ESP32 (sudah ada, ga perlu diubah)

---

## ✅ Checklist Sebelum Submit

Print checklist ini dan ceklis satu-satu:

### Pre-Testing
- [ ] Python installed & dependencies OK
- [ ] ESP32 connected & firmware uploaded
- [ ] COM port identified
- [ ] Test environment prepared (ruangan, meteran, marker)
- [ ] Test tools ready (run_tests.bat bisa jalan)

### Testing Phase
- [ ] Range test completed (3 trials × 8-10 distances)
- [ ] Angle test completed (3 trials × 7-9 angles)
- [ ] Object test completed (5 trials × 5 objects)
- [ ] Manual notes taken (timestamps, conditions)
- [ ] Photos/videos documented

### Analysis Phase
- [ ] All CSV files analyzed with analyzer script
- [ ] Graphs generated (timeline, histogram)
- [ ] Manual calculations verified (discrimination score, etc)
- [ ] Data make sense (no impossible values)

### Report Phase
- [ ] REPORT_TEMPLATE filled completely
- [ ] All graphs inserted
- [ ] All photos inserted
- [ ] Analysis written (not just raw data)
- [ ] Conclusions clear for 3 parameters
- [ ] Limitations discussed honestly
- [ ] Recommendations provided
- [ ] References included
- [ ] Proofread (typos, grammar)
- [ ] Exported to PDF

### Final Check
- [ ] File naming consistent
- [ ] All attachments included (CSV, photos)
- [ ] Report >10 pages (dengan grafik)
- [ ] Submit on time!

---

## 🎯 Success Criteria

Laporan kamu akan dinilai baik jika:

1. **Methodology Clear** (20%)
   - Prosedur jelas dan reproducible
   - Tools dan setup explained

2. **Data Complete** (30%)
   - 3 tests completed
   - Multiple trials per test point
   - Raw data + processed data

3. **Analysis Thorough** (25%)
   - Statistical analysis
   - Graphs and visualization
   - Pattern identification

4. **Critical Thinking** (15%)
   - Discuss limitations
   - Environmental factors
   - Comparison with expectations

5. **Presentation** (10%)
   - Well-formatted
   - Clear structure
   - Professional appearance

**Target**: >80 points = A grade! 🎓

---

## 💪 Motivasi

Ini project bagus untuk portfolio:
- Real hardware integration (ESP32)
- Data collection & analysis
- Scientific methodology
- Complete documentation

**Kerjakan dengan serius**, bukan cuma asal jadi. Hasil testing ini bisa kamu showcase ke:
- Interview future jobs
- Skripsi/thesis reference
- GitHub portfolio
- LinkedIn projects

**You got this! 🚀**

---

## 📞 Next Steps

**SEKARANG:**
1. ✅ Baca QUICK_START.md
2. ✅ Install dependencies: `pip install -r requirements.txt`
3. ✅ Test koneksi: `python data_logger.py` (pilih option 4)

**BESOK:**
4. ✅ Siapkan ruangan dan alat ukur
5. ✅ Run 3 tests (range, angle, object)
6. ✅ Foto dokumentasi

**LUSA:**
7. ✅ Analyze results
8. ✅ Tulis laporan
9. ✅ Review & submit

**Deadline kamu kapan?** Kalau masih ada 1 minggu, santai. Kalau 2-3 hari, prioritaskan testing dulu, laporan bisa nyusul.

---

**Good luck! Kalau ada kendala atau pertanyaan, refer ke documentation atau debug step-by-step. Framework ini sudah complete dan tested. 💯**

---

*Generated: 2026-06-06*  
*Testing Framework v1.0*
