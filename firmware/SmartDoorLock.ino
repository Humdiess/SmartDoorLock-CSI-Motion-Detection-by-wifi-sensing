/*
  Smart Door Lock - WiFi CSI Motion Detection
  Hardware: ESP32 DevKit v1
  Fitur:
  - Deteksi gerakan via perubahan sinyal WiFi (CSI/RSSI proxy)
  - Auto-Calibration saat boot (15 detik)
  - Web Server Dashboard (IP/ untuk akses)
  - Kontrol Kunci Manual (Buka via Web)
  - Alarm Buzzer otomatis saat gerakan terdeteksi

  Catatan:
  - Kode ini menggunakan 1 ESP32 yang terhubung ke Router WiFi.
  - Tidak perlu 3 ESP32 untuk deteksi dasar "Ada/Tidak Ada".
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_wifi.h>
#include <Arduino.h>

// ================= KONFIGURASI =================
const char* ssid = "Kucing Salto";
const char* password = "Ucing8382428";

// GANTI DENGAN URL SERVER KAMU (Contoh: http://192.168.1.100:5000/api/motion)
// Atau pakai IP komputer/laptop kamu yang sedang menjalankan server
const char* SERVER_URL = "http://192.168.1.100:5000/api/motion"; 

const int LOCK_PIN = 18;      
const int BUZZER_PIN = 19;    
const int LED_PIN = 2;        

const int THRESHOLD_MULT = 2.5;  
const int DEBOUNCE_DELAY = 5000; 

// ================= VARIABEL GLOBAL =================
float baselineVariance = 0.0;
float currentThreshold = 0.0;
float currentVariance = 0.0;
bool isMotionDetected = false;
bool isCalibrating = true;
unsigned long motionStartMillis = 0;
unsigned long lastSendTime = 0;

float varianceBuffer;
int bufIdx = 0;

// ================= FUNGSI BACA SINYAL =================
void read_signal_variance() {
  int rssi = WiFi.RSSI();
  static int lastRssi = -100;
  
  float diff = abs(rssi - lastRssi);
  varianceBuffer[bufIdx] = diff;
  bufIdx = (bufIdx + 1) % 20;
  lastRssi = rssi;
  
  float sum = 0;
  for (int i = 0; i < 20; i++) sum += varianceBuffer[i];
  
  currentVariance = (sum / 20.0) / 10.0; 
  if (currentVariance > 1.0) currentVariance = 1.0;
}

// ================= KALIBRASI =================
void calibrate_system() {
  Serial.println("\n=== KALIBRASI (JANGAN GERAK) ===");
  digitalWrite(LED_PIN, HIGH);
  
  float sumVar = 0;
  for (int i = 0; i < 50; i++) {
    read_signal_variance();
    sumVar += currentVariance;
    delay(100);
  }
  
  baselineVariance = sumVar / 50;
  currentThreshold = baselineVariance * THRESHOLD_MULT;
  
  digitalWrite(LED_PIN, LOW);
  Serial.println("=== KALIBRASI SELESAI ===");
  Serial.print("Threshold: "); Serial.println(currentThreshold, 4);
  isCalibrating = false;
}

// ================= KIRIM DATA KE SERVER =================
void send_to_server() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Buat JSON
  String json = "{";
  json += "\"variance\":" + String(currentVariance, 4) + ",";
  json += "\"threshold\":" + String(currentThreshold, 4) + ",";
  json += "\"motion\":" + String(isMotionDetected ? "true" : "false") + ",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"timestamp\":" + String(millis());
  json += "}";

  Serial.print("Mengirim data: ");
  Serial.println(json);

  int httpResponseCode = http.POST(json);

  if (httpResponseCode > 0) {
    Serial.print("Response Code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Error sending: ");
    Serial.println(httpResponseCode);
  }

  http.end();
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  pinMode(LOCK_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  
  digitalWrite(LOCK_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  calibrate_system();
}

// ================= LOOP =================
void loop() {
  // 1. Logika Deteksi (Sama seperti sebelumnya)
  if (!isCalibrating) {
    read_signal_variance();

    if (currentVariance > currentThreshold) {
      if (!isMotionDetected) {
        isMotionDetected = true;
        motionStartMillis = millis();
        digitalWrite(BUZZER_PIN, HIGH);
        digitalWrite(LED_PIN, HIGH);
        Serial.println(">>> MOTION DETECTED (Local Alarm)");
      }
    } else {
      if (isMotionDetected) {
        if (millis() - motionStartMillis > DEBOUNCE_DELAY) {
          isMotionDetected = false;
          digitalWrite(BUZZER_PIN, LOW);
          digitalWrite(LED_PIN, LOW);
          Serial.println("Status Aman");
        }
      }
    }
  }

  // 2. Kirim Data ke Server (Setiap 1 detik)
  unsigned long now = millis();
  if (now - lastSendTime > 1000) {
    send_to_server();
    lastSendTime = now;
  }

  delay(100);
}