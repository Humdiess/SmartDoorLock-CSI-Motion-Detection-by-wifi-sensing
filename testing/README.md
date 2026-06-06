# Testing Tools - Smart Door Lock Motion Detection

Tools untuk melakukan testing sistematis pada sistem deteksi gerakan WiFi.

## 📁 Files

- **`data_logger.py`** - Script untuk capture data dari ESP32 secara otomatis
- **`analyze_results.py`** - Script untuk analisis data dan generate laporan
- **`requirements.txt`** - Python dependencies
- **`test_data/`** - Folder penyimpanan hasil test (auto-created)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd testing
pip install -r requirements.txt
```

### 2. Check Serial Port

Cek port COM ESP32 di Device Manager (Windows):
- Buka Device Manager
- Lihat di "Ports (COM & LPT)"
- Catat nomor COM port (misal: COM3, COM5, dll)

### 3. Run Data Logger

**Mode Interactive:**
```bash
python data_logger.py
```

**Mode Command Line:**
```bash
# Format: python data_logger.py <test_name> <duration_minutes> <port>
python data_logger.py range_test 10 COM3
```

**Test types:**
- `range_test` - untuk test jarak
- `angle_test` - untuk test sudut
- `object_discrimination` - untuk test diskriminasi objek
- `general` - logging umum

### 4. Analyze Results

```bash
python analyze_results.py test_data/20260606_143000_range_test.csv
```

Atau run tanpa parameter untuk memilih file interaktif:
```bash
python analyze_results.py
```

## 📊 Workflow Testing

### Test 1: Range (Jarak)

```bash
# Start logger
python data_logger.py range_test 30 COM3

# Di terminal lain, monitor dashboard
# http://localhost:3000

# Lakukan test sesuai TESTING_PROTOCOL.md
# - Mulai dari 0.5m
# - Test setiap 0.5m increment
# - Catat hasil manual + otomatis

# Analyze results
python analyze_results.py test_data/[filename].csv
```

### Test 2: Angle (Sudut)

```bash
python data_logger.py angle_test 20 COM3

# Test pada berbagai sudut (-90° hingga +90°)
# Analyze results
python analyze_results.py test_data/[filename].csv
```

### Test 3: Object Discrimination

```bash
python data_logger.py object_discrimination 15 COM3

# Test dengan berbagai objek:
# - Manusia (baseline)
# - Kursi
# - Kardus
# - Botol
# - Tas ransel

# Analyze results
python analyze_results.py test_data/[filename].csv
```

## 📈 Output Files

### Data Logger menghasilkan:
- `test_data/<timestamp>_<test_name>.csv` - Raw data
- `test_data/<timestamp>_<test_name>_summary.json` - Ringkasan test

### Analyzer menghasilkan:
- `test_data/<test_name>_analysis/timeline.png` - Grafik variance over time
- `test_data/<test_name>_analysis/histogram.png` - Distribusi variance
- `test_data/<test_name>_analysis/summary.json` - Statistik lengkap

## 📝 CSV Format

Kolom dalam CSV output:

| Column | Description |
|--------|-------------|
| Timestamp | ISO timestamp |
| Time_ms | Milliseconds from ESP32 |
| Variance | Calculated variance value |
| Threshold | Current threshold |
| Motion_Detected | True/False |
| RSSI | WiFi signal strength (dBm) |
| Door_Locked | True/False |
| Connected_WiFi | Primary/Hotspot/Offline |
| Raw_Line | Original serial output |

## 🔧 Troubleshooting

### "Error connecting to COM3"
- Check ESP32 terhubung via USB
- Verify port number di Device Manager
- Close Arduino IDE serial monitor (conflict)
- Install driver CH340/CP2102 jika perlu

### "No data captured"
- Pastikan ESP32 sudah di-upload firmware
- Check baud rate (harus 115200)
- Reset ESP32
- Monitor langsung via Arduino IDE serial monitor dulu

### "matplotlib not found"
- Install: `pip install matplotlib`
- Atau skip plotting (analyzer tetap jalan, hanya tanpa grafik)

### Data tidak masuk akal
- Re-kalibrasi ESP32 (tunggu startup selesai)
- Check WiFi connection ESP32
- Pastikan environment test konsisten

## 💡 Tips

1. **Consistent Environment**: Test di ruangan yang sama, kondisi similar
2. **Multiple Runs**: Minimal 3 kali per test point untuk reliability
3. **Note Taking**: Catat kondisi environment (ada orang lain, furnitur, dll)
4. **Timing**: Hindari jam sibuk WiFi (banyak device aktif)
5. **Battery**: Gunakan power stable (bukan battery lemah)

## 📊 Expected Results

### Range Test
- **Optimal**: 0.5m - 3m (>90% detection)
- **Good**: 3m - 5m (70-90%)
- **Poor**: >5m (<70%)

### Angle Test
- **Primary FOV**: -30° to +30° (>80% detection)
- **Secondary**: -60° to +60° (50-80%)
- **Peripheral**: >±60° (<50%)

### Object Discrimination
- **Human**: High variance (0.1 - 0.5)
- **Large objects**: Medium variance (0.05 - 0.2)
- **Small objects**: Low variance (<0.05)

Discrimination score > 1.5 = dapat membedakan

## 📧 Support

Jika ada masalah atau pertanyaan, check:
1. `../TESTING_PROTOCOL.md` - Protokol lengkap
2. Serial output ESP32 untuk error messages
3. Dashboard logs

---

**Happy Testing! 🚀**
