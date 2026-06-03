/*
  Smart Door Lock - Complete Version
  WiFi RSSI Motion Detection + RFID + LCD

  Hardware: ESP32 DevKit v1
  - RFID: SS=5, RST=4, SCK=18, MISO=19, MOSI=23
  - LCD: SDA=26, SCL=27 (I2C addr 0x27)
  - Relay: GPIO 16
  - Buzzer: GPIO 17
  - LED: GPIO 2

  RFID Authorized: DB 63 03 07
*/
/*
  Smart Door Lock - Complete Version + PREMIUM SOUNDS & LCD
*/

#include <Arduino.h>
#include <HTTPClient.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>
#include <esp_wifi.h>
#include <time.h>

// ================= KONFIGURASI =================
const char *ssid = "Kucing Salto";
const char *password = "ucing8382428";
const char *hotspot_ssid = "SmartLock_Hotspot";
const char *hotspot_password = "ucing8382428";
const char *FALLBACK_SERVER_URL = "https://proj-pens-smartdoor-lock.vercel.app/api/motion";
const char *SERVER_URL = "http://192.168.1.7:3000/api/motion";

const int PIN_RELAY  = 16;
const int PIN_BUZZER = 17;
const int LED_PIN    = 2;
const int SS_PIN     = 5;
const int RST_PIN    = 4;
const int SCK_PIN    = 18;
const int MISO_PIN   = 19;
const int MOSI_PIN   = 23;
const int LCD_SDA    = 26;
const int LCD_SCL    = 27;
const int LCD_ADDR   = 0x27;

const float THRESHOLD_MULT  = 2.0;
const int   DEBOUNCE_DELAY  = 5000;
const unsigned long UNLOCK_DURATION = 5000;
const unsigned long DENIED_DURATION = 2000;

bool scheduleEnabled  = false;
int  scheduleStartHour = 22;
int  scheduleEndHour   = 6;
bool demoMode = false;

const char *ntpServer       = "pool.ntp.org";
const long  gmtOffset_sec   = 7 * 3600;
const int   daylightOffset_sec = 0;
bool timeInitialized = false;

// ================= HARDWARE OBJECTS =================
MFRC522       rfid(SS_PIN, RST_PIN);
hd44780_I2Cexp lcd;

byte authorizedUIDs[][4] = {{0xDB, 0x63, 0x03, 0x07}};
const int numAuthorizedUIDs = 1;

// ================= STATE MACHINES =================
enum DoorState  { DOOR_IDLE, DOOR_UNLOCKED, DOOR_DENIED };
DoorState doorState = DOOR_IDLE;
unsigned long doorStateTime = 0;

enum BeepState  { BEEP_IDLE, BEEP_ON, BEEP_OFF };
BeepState beepState = BEEP_IDLE;
unsigned long beepTime = 0;
int beepCount = 0;
const int BEEP_TOTAL   = 3;
const unsigned long BEEP_ON_MS  = 200;
const unsigned long BEEP_OFF_MS = 200;

// ================= GLOBAL VARIABLES =================
float baselineVariance = 0.0, currentThreshold = 0.0, currentVariance = 0.0;
bool  isMotionDetected = false, isCalibrating = true, isDoorLocked = true;
String connectedWiFi = "None";
unsigned long motionStartMillis = 0, lastSendTime = 0;
unsigned long lastRFIDCheck = 0, lastCommandCheck = 0;
float varianceBuffer[20];
int   bufIdx = 0;

// Server failover memory (sticky failover)
bool usingPrimaryServer = true;

// ============================================================
// ==================== MELODY ENGINE =========================
// Non-blocking melody player pakai millis()
// ============================================================
struct Note { int freq; int dur; };

#define MAX_MELODY 12
Note   melodyQueue[MAX_MELODY];
int    melodyLen    = 0;
int    melodyIdx    = 0;
unsigned long melodyNextTime = 0;
bool   melodyPlaying = false;

void playMelody(const Note* notes, int len) {
  melodyLen = min(len, MAX_MELODY);
  for (int i = 0; i < melodyLen; i++) melodyQueue[i] = notes[i];
  melodyIdx = 0;
  melodyPlaying = true;
  melodyNextTime = millis();
}

void updateMelody() {
  if (!melodyPlaying) return;
  unsigned long now = millis();
  if (now < melodyNextTime) return;

  if (melodyIdx < melodyLen) {
    Note& n = melodyQueue[melodyIdx];
    if (n.freq > 0) tone(PIN_BUZZER, n.freq, n.dur);
    else noTone(PIN_BUZZER);
    melodyNextTime = now + n.dur + 20; // 20ms gap antar nada
    melodyIdx++;
  } else {
    melodyPlaying = false;
    noTone(PIN_BUZZER);
  }
}

// ---- Siren dua-nada untuk motion alarm ----
bool sirenActive = false;
bool sirenHigh   = false;
unsigned long sirenTime = 0;
const int SIREN_LO  = 800;
const int SIREN_HI  = 1200;
const int SIREN_INTERVAL = 120;

void startSiren() { sirenActive = true; sirenHigh = false; sirenTime = millis(); }
void stopSiren()  { sirenActive = false; noTone(PIN_BUZZER); }

void updateSiren() {
  if (!sirenActive) return;
  if (millis() - sirenTime >= SIREN_INTERVAL) {
    sirenHigh = !sirenHigh;
    tone(PIN_BUZZER, sirenHigh ? SIREN_HI : SIREN_LO, SIREN_INTERVAL);
    sirenTime = millis();
  }
}

// ---- Definisi melodi ----
const Note MELODY_STARTUP[]   = {{523,120},{659,120},{784,200}};          // DO MI SOL
const Note MELODY_WIFI_OK[]   = {{784,80},{1047,80},{1319,150}};          // connecting OK
const Note MELODY_WIFI_FAIL[] = {{880,120},{660,120},{440,180}};          // WiFi lost
const Note MELODY_WIFI_TICK[] = {{1000,30},{0,30},{1000,30}};             // retry tick
const Note MELODY_CAL_DONE[]  = {{523,100},{659,100},{784,100},{1047,180}}; // fanfare kalibrasi
const Note MELODY_CAL_TICK[]  = {{440,50}};                               // tick tiap sample
const Note MELODY_RFID_OK[]   = {{784,150},{0,50},{1047,200}};            // ding-dong valid
const Note MELODY_RFID_DENY[] = {{600,150},{400,150},{300,200}};          // turun = ditolak

// ============================================================
// ==================== LCD UPGRADE ===========================
// ============================================================

// Custom characters CGRAM
byte CHAR_LOCK_CLOSED[8] = {0x0E,0x11,0x11,0x1F,0x1B,0x1B,0x1F,0x00};
byte CHAR_LOCK_OPEN[8]   = {0x0E,0x10,0x10,0x1F,0x1B,0x1B,0x1F,0x00};
byte CHAR_BELL[8]        = {0x04,0x0E,0x0E,0x0E,0x1F,0x00,0x04,0x00};
byte CHAR_CHECK[8]       = {0x00,0x01,0x03,0x16,0x1C,0x08,0x00,0x00};
byte CHAR_BLOCK[8]       = {0x1F,0x1F,0x1F,0x1F,0x1F,0x1F,0x1F,0x1F};

void initCustomChars() {
  lcd.createChar(0, CHAR_LOCK_CLOSED);
  lcd.createChar(1, CHAR_LOCK_OPEN);
  lcd.createChar(2, CHAR_BELL);
  lcd.createChar(3, CHAR_CHECK);
  lcd.createChar(4, CHAR_BLOCK);
}

// Progress bar di row ke-2, 0-100%
void lcdProgressBar(int percent, const char* label) {
  lcd.setCursor(0, 0);
  for (int i = 0; label[i] && i < 16; i++) lcd.write(label[i]);

  lcd.setCursor(0, 1);
  lcd.write('[');
  int filled = map(percent, 0, 100, 0, 14);
  for (int i = 0; i < 14; i++) {
    if (i < filled) lcd.write((uint8_t)4); // blok penuh
    else lcd.write(' ');
  }
  lcd.write(']');
}

void lcdLine(int row, const char *text) {
  lcd.setCursor(0, row);
  int i;
  for (i = 0; i < 16 && text[i]; i++) lcd.write(text[i]);
  for (; i < 16; i++) lcd.write(' ');
}

void updateLCD(const char *line1, const char *line2 = "") {
  lcdLine(0, line1);
  lcdLine(1, line2);
}

// LCD dengan custom char di depan
void updateLCDIcon(byte icon, const char* line1, const char* line2 = "") {
  lcd.setCursor(0, 0);
  lcd.write(icon);
  lcd.write(' ');
  int i = 0;
  for (; i < 14 && line1[i]; i++) lcd.write(line1[i]);
  for (; i < 14; i++) lcd.write(' ');
  lcdLine(1, line2);
}

// Tampilkan waktu di row 1 jika NTP ready
void updateLCDWithTime() {
  if (!timeInitialized) return;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  char timeBuf[9]; // "HH:MM:SS"
  strftime(timeBuf, sizeof(timeBuf), "%H:%M:%S", &timeinfo);

  lcd.setCursor(0, 0);
  lcd.write((uint8_t)0); // lock icon
  lcd.print(" Smart Lock   ");

  lcd.setCursor(0, 1);
  char row2[17];
  snprintf(row2, sizeof(row2), "%-8s %s", isDoorLocked ? "Locked" : "OPEN  ", timeBuf);
  // hanya 16 char muat: "Locked   14:32:0" — trim ke 16
  for (int i = 0; i < 16; i++) lcd.write(row2[i] ? row2[i] : ' ');
}

// Blink LCD untuk alert
unsigned long lcdBlinkTime = 0;
bool lcdBlinkState = true;
bool lcdBlinkActive = false;

void startLCDBlink() { lcdBlinkActive = true; lcdBlinkState = true; lcdBlinkTime = millis(); }
void stopLCDBlink()  { lcdBlinkActive = false; lcd.display(); }

void updateLCDBlink() {
  if (!lcdBlinkActive) return;
  if (millis() - lcdBlinkTime >= 300) {
    lcdBlinkState = !lcdBlinkState;
    lcdBlinkState ? lcd.display() : lcd.noDisplay();
    lcdBlinkTime = millis();
  }
}

// ============================================================
// ==================== DOOR CONTROL ==========================
// ============================================================
void controlDoor(bool lock) {
  isDoorLocked = lock;
  digitalWrite(PIN_RELAY, lock ? LOW : HIGH);
  Serial.println(lock ? "[DOOR] LOCKED" : "[DOOR] UNLOCKED");
  stopLCDBlink();
  if (lock) {
    updateLCDIcon(0, "Smart Door Lock", "Locked  - Scan");
  } else {
    updateLCDIcon(1, "Access Granted", "Welcome!");
  }
}

// ============================================================
// ==================== RFID ==================================
// ============================================================
bool checkRFID() {
  if (doorState != DOOR_IDLE) return false;
  if (!rfid.PICC_IsNewCardPresent()) return false;
  if (!rfid.PICC_ReadCardSerial()) return false;

  Serial.print("[RFID] Card: ");
  for (byte i = 0; i < rfid.uid.size; i++) Serial.printf("%02X ", rfid.uid.uidByte[i]);
  Serial.println();

  bool authorized = false;
  for (int i = 0; i < numAuthorizedUIDs; i++) {
    bool match = true;
    for (byte j = 0; j < 4; j++) {
      if (rfid.uid.uidByte[j] != authorizedUIDs[i][j]) { match = false; break; }
    }
    if (match) { authorized = true; break; }
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  if (authorized) {
    Serial.println("[RFID] AUTHORIZED");
    playMelody(MELODY_RFID_OK, 3);     // ding-dong
    controlDoor(false);
    doorState = DOOR_UNLOCKED;
    doorStateTime = millis();
    return true;
  } else {
    Serial.println("[RFID] DENIED");
    playMelody(MELODY_RFID_DENY, 3);   // dun dun dun

    lcd.setCursor(0, 0); lcd.write(2); // bell icon
    lcdLine(0, " Access Denied  ");
    lcdLine(1, " Invalid Card   ");

    doorState = DOOR_DENIED;
    doorStateTime = millis();
    return false;
  }
}

// ============================================================
// ==================== STATE MACHINES ========================
// ============================================================
void updateDoorState() {
  unsigned long now = millis();
  switch (doorState) {
    case DOOR_UNLOCKED:
      if (now - doorStateTime >= UNLOCK_DURATION) {
        controlDoor(true);
        doorState = DOOR_IDLE;
      }
      break;
    case DOOR_DENIED:
      if (now - doorStateTime >= DENIED_DURATION) {
        doorState = DOOR_IDLE;
        stopLCDBlink();
        updateLCDIcon(0, "Smart Door Lock", "Locked  - Scan");
      }
      break;
    default: break;
  }
}

void updateBeepState() {
  // Beep state lama dipertahankan untuk kompatibilitas
  // tapi sekarang sudah digantikan melodyEngine untuk efek baru
  if (beepState == BEEP_IDLE) return;
  unsigned long now = millis();
  switch (beepState) {
    case BEEP_ON:
      if (now - beepTime >= BEEP_ON_MS) {
        noTone(PIN_BUZZER);
        beepState = BEEP_OFF;
        beepTime = now;
      }
      break;
    case BEEP_OFF:
      beepCount++;
      if (beepCount >= BEEP_TOTAL) { beepState = BEEP_IDLE; beepCount = 0; }
      else if (now - beepTime >= BEEP_OFF_MS) {
        tone(PIN_BUZZER, 1000, BEEP_ON_MS);
        beepState = BEEP_ON;
        beepTime = now;
      }
      break;
    default: break;
  }
}

// ============================================================
// ==================== MOTION DETECTION ======================
// ============================================================
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

void calibrate_system() {
  Serial.println("\n[CAL] Starting calibration...");
  digitalWrite(LED_PIN, HIGH);

  float sumVar = 0;
  for (int i = 0; i < 50; i++) {
    read_signal_variance();
    sumVar += currentVariance;
    delay(100);

    // Tick buzzer tiap 10 sample (~1 detik)
    if (i % 10 == 0) {
      playMelody(MELODY_CAL_TICK, 1);
      int pct = map(i, 0, 50, 0, 100);
      lcdProgressBar(pct, "Calibrating...");
      Serial.print(".");
    }
  }
  Serial.println();

  lcdProgressBar(100, "Calibrating...");
  delay(300);

  baselineVariance = sumVar / 50.0;
  currentThreshold = baselineVariance * THRESHOLD_MULT;

  // Fanfare selesai kalibrasi
  playMelody(MELODY_CAL_DONE, 4);
  digitalWrite(LED_PIN, LOW);

  Serial.printf("[CAL] Done! Baseline=%.4f Threshold=%.4f\n",
                baselineVariance, currentThreshold);

  delay(600); // tunggu fanfare selesai
  updateLCDIcon(3, "System Ready!", "Scan your card");
  isCalibrating = false;
}

// ============================================================
// ==================== SERVER FUNCTIONS ======================
// ============================================================
void send_to_server() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.setTimeout(3000);

  String json = "{";
  json += "\"variance\":"     + String(currentVariance, 4) + ",";
  json += "\"threshold\":"    + String(currentThreshold, 4) + ",";
  json += "\"motion\":"       + String(isMotionDetected ? "true" : "false") + ",";
  json += "\"rssi\":"         + String(WiFi.RSSI()) + ",";
  json += "\"doorLocked\":"   + String(isDoorLocked ? "true" : "false") + ",";
  json += "\"connectedWiFi\":\"" + connectedWiFi + "\",";
  json += "\"timestamp\":"    + String(millis());
  json += "}";

  int code = -1;

  // STICKY FAILOVER: Use whichever server is currently working
  if (usingPrimaryServer) {
    // Try PRIMARY (Vercel HTTPS)
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    http.begin(secureClient, SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(json);
    http.end();

    if (code <= 0) {
      // PRIMARY failed, try FALLBACK
      Serial.printf("[SEND] Primary failed (%d), switching to fallback...\n", code);
      http.begin(FALLBACK_SERVER_URL);
      http.addHeader("Content-Type", "application/json");
      code = http.POST(json);
      http.end();
      if (code > 0) {
        usingPrimaryServer = false; // Remember to use fallback from now on
        Serial.println("[SEND] Switched to FALLBACK server");
      }
    }
  } else {
    // Try FALLBACK (Local HTTP)
    http.begin(FALLBACK_SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(json);
    http.end();

    if (code <= 0) {
      // FALLBACK failed, try PRIMARY
      Serial.printf("[SEND] Fallback failed (%d), trying primary...\n", code);
      WiFiClientSecure secureClient;
      secureClient.setInsecure();
      http.begin(secureClient, SERVER_URL);
      http.addHeader("Content-Type", "application/json");
      code = http.POST(json);
      http.end();
      if (code > 0) {
        usingPrimaryServer = true; // Switch back to primary
        Serial.println("[SEND] Switched back to PRIMARY server");
      }
    }
  }

  if (code > 0) {
    Serial.printf("[SEND] OK var=%.3f thr=%.3f motion=%s door=%s\n",
      currentVariance, currentThreshold,
      isMotionDetected?"YES":"NO", isDoorLocked?"LOCKED":"UNLOCKED");
  } else {
    Serial.printf("[SEND] FAIL both servers code=%d\n", code);
  }
}

void postLog(const String& type, const String& message) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.setTimeout(3000);
  String json = "{\"type\":\"" + type + "\",\"message\":\"" + message + "\"}";
  
  String url = String(SERVER_URL);
  url.replace("/motion", "/logs");
  // PRIMARY is HTTPS (Vercel)
  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  http.begin(secureClient, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  http.end();

  if (code <= 0) {
    url = String(FALLBACK_SERVER_URL);
    url.replace("/motion", "/logs");
    // FALLBACK is HTTP (local)
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.POST(json);
    http.end();
  }
}

void checkWebCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.setTimeout(3000);
  String url = String(SERVER_URL);
  url.replace("/motion", "/control/commands");
  // PRIMARY is HTTPS (Vercel)
  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  http.begin(secureClient, url);
  int code = http.GET();
  if (code <= 0) {
    http.end();
    url = String(FALLBACK_SERVER_URL);
    url.replace("/motion", "/control/commands");
    // FALLBACK is HTTP (local)
    http.begin(url);
    code = http.GET();
  }
  if (code == 200) {
    String payload = http.getString();
    if (payload.indexOf("\"command\":\"door:unlock\"") >= 0) {
      controlDoor(false);
      doorState = DOOR_UNLOCKED; doorStateTime = millis();
      playMelody(MELODY_RFID_OK, 3);
      postLog("system", "Manual door unlock from dashboard");
    } else if (payload.indexOf("\"command\":\"door:lock\"") >= 0) {
      controlDoor(true); doorState = DOOR_IDLE;
      postLog("system", "Manual door lock from dashboard");
    } else if (payload.indexOf("\"command\":\"buzzer:on\"") >= 0) {
      startSiren();
      postLog("system", "Manual buzzer ON from dashboard");
    } else if (payload.indexOf("\"command\":\"buzzer:off\"") >= 0) {
      stopSiren();
      postLog("system", "Manual buzzer OFF from dashboard");
    } else if (payload.indexOf("\"command\":\"lcd:") >= 0) {
      int idx = payload.indexOf("\"command\":\"lcd:"), start = idx + 15;
      int end = payload.indexOf("|", start);
      if (end > start) {
        String msg = payload.substring(start, end);
        updateLCDIcon(2, "SYSTEM ALERT:", msg.c_str());
        doorState = DOOR_DENIED; doorStateTime = millis();
        postLog("system", "LCD updated: " + msg);
      }
    } else if (payload.indexOf("\"command\":\"calibrate\"") >= 0) {
      isCalibrating = true;
      calibrate_system();
      postLog("system", "Manual calibration from dashboard");
    } else if (payload.indexOf("\"command\":\"threshold:") >= 0) {
      int idx = payload.indexOf("\"command\":\"threshold:"), start = idx + 21;
      int end = payload.indexOf("\"", start);
      if (end > start) {
        float newThr = payload.substring(start, end).toFloat();
        if (newThr > 0 && newThr <= 1.0) {
          currentThreshold = newThr;
          postLog("system", "Threshold updated: " + String(newThr, 3));
        }
      }
    }
  }
  http.end();
}

// ============================================================
// ==================== WIFI ==================================
// ============================================================
bool connectWiFi() {
  Serial.println("[WiFi] Trying Hotspot...");
  lcdProgressBar(0, "WiFi Hotspot...");
  WiFi.begin(hotspot_ssid, hotspot_password);

  for (int i = 0; i < 30; i++) {
    delay(500);
    if (WiFi.status() == WL_CONNECTED) break;
    if (i % 10 == 9) playMelody(MELODY_WIFI_TICK, 3);
    lcdProgressBar(map(i, 0, 29, 0, 95), "WiFi Hotspot...");
  }

  if (WiFi.status() == WL_CONNECTED) {
    lcdProgressBar(100, "WiFi Hotspot...");
    delay(200);
    playMelody(MELODY_WIFI_OK, 3);
    return true;
  }

  // Fallback primary
  Serial.println("[WiFi] Hotspot failed, trying Primary...");
  WiFi.disconnect();
  delay(100);
  WiFi.begin(ssid, password);
  lcdProgressBar(0, "WiFi Primary...");

  for (int i = 0; i < 30; i++) {
    delay(500);
    if (WiFi.status() == WL_CONNECTED) break;
    // Tick tiap 10 attempt
    if (i % 10 == 9) playMelody(MELODY_WIFI_TICK, 3);
    lcdProgressBar(map(i, 0, 29, 0, 95), "WiFi Primary...");
  }

  if (WiFi.status() == WL_CONNECTED) {
    lcdProgressBar(100, "WiFi Primary...");
    delay(200);
    playMelody(MELODY_WIFI_OK, 3);
    return true;
  }

  playMelody(MELODY_WIFI_FAIL, 3);
  updateLCD("WiFi Failed", "Offline Mode");
  return false;
}

// ============================================================
// ==================== SETUP =================================
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n=== Smart Door Lock - Premium Edition ===\n");

  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(PIN_RELAY, LOW);
  noTone(PIN_BUZZER);
  digitalWrite(LED_PIN, LOW);

  Wire.begin(LCD_SDA, LCD_SCL);
  int status = lcd.begin(16, 2);
  if (status) Serial.printf("[LCD] Init failed: %d\n", status);
  else        Serial.println("[LCD] OK");

  initCustomChars();

  // === STARTUP SEQUENCE ===
  // Animasi dots
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Smart Door Lock");
  for (int d = 0; d < 3; d++) {
    lcd.setCursor(d, 1); lcd.write('.');
    delay(300);
  }

  // Startup melody
  playMelody(MELODY_STARTUP, 3);
  // Tunggu melody selesai (~500ms)
  unsigned long t = millis();
  while (millis() - t < 600) updateMelody();

  // RFID
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  rfid.PCD_Init();
  delay(200);
  byte rfidVer = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("[RFID] %s (v=0x%X)\n",
    (rfidVer == 0x91 || rfidVer == 0x92) ? "OK" : "Warning", rfidVer);

  // WiFi
  bool wifiOK = connectWiFi();
  if (wifiOK) {
    WiFi.setSleep(false);
    String curSSID = WiFi.SSID();
    if (curSSID == ssid) connectedWiFi = "Primary";
    else if (curSSID == hotspot_ssid) connectedWiFi = "Hotspot";
    else connectedWiFi = curSSID;

    // NTP sync
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    struct tm ti;
    if (getLocalTime(&ti, 5000)) {
      timeInitialized = true;
      Serial.println("[NTP] Time synced");
    }
    delay(500);
  } else {
    connectedWiFi = "Offline";
  }

  // Kalibrasi
  delay(500);
  calibrate_system();

  Serial.println("=== SYSTEM READY ===\n");
  controlDoor(true);
}

// ============================================================
// ==================== LOOP ==================================
// ============================================================

// Ticker untuk update jam di LCD (setiap 1 detik)
unsigned long lastClockUpdate = 0;

// Blink counter LCD saat alert
void loop() {
  unsigned long now = millis();

  // === Update semua engine ===
  updateMelody();
  updateSiren();
  updateLCDBlink();

  // === WiFi reconnect (tiap 10 detik) ===
  static unsigned long lastWiFiCheck = 0;
  if (now - lastWiFiCheck > 10000) {
    lastWiFiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] DISCONNECTED! Reconnecting...");
      updateLCD("WiFi Lost", "Reconnecting...");
      playMelody(MELODY_WIFI_FAIL, 3);

      WiFi.disconnect(); delay(100);
      WiFi.begin(hotspot_ssid, hotspot_password);
      int att = 0;
      while (WiFi.status() != WL_CONNECTED && att < 20) { delay(500); att++; }
      
      if (WiFi.status() != WL_CONNECTED) {
        WiFi.disconnect();
        delay(100);
        WiFi.begin(ssid, password);
        att = 0;
        while (WiFi.status() != WL_CONNECTED && att < 20) { delay(500); att++; }
      }

      if (WiFi.status() == WL_CONNECTED) {
        WiFi.setSleep(false);
        playMelody(MELODY_WIFI_OK, 3);
        Serial.println("[WiFi] RECONNECTED");
        updateLCDIcon(0, "Smart Door Lock", "Locked  - Scan");
      }
    }
  }

  // === Motion detection ===
  if (!isCalibrating) {
    read_signal_variance();

    if (currentVariance > currentThreshold) {
      if (!isMotionDetected) {
        isMotionDetected = true;
        motionStartMillis = now;

        // Siren dua-nada (lebih berkelas dari buzzer solid)
        if (beepState == BEEP_IDLE && !melodyPlaying) startSiren();
        digitalWrite(LED_PIN, HIGH);

        Serial.printf(">>> MOTION DETECTED! var=%.4f thr=%.4f\n",
          currentVariance, currentThreshold);

        if (doorState == DOOR_IDLE) {
          updateLCDIcon(2, "!! ALERT !!", "Motion Detected");
          startLCDBlink(); // LCD blink saat alert
        }
      }
    } else {
      if (isMotionDetected && now - motionStartMillis > DEBOUNCE_DELAY) {
        isMotionDetected = false;
        if (beepState == BEEP_IDLE) stopSiren();
        digitalWrite(LED_PIN, LOW);
        stopLCDBlink();
        Serial.println("--- Motion cleared");
        if (doorState == DOOR_IDLE) {
          updateLCDIcon(0, "Smart Door Lock", "Locked  - Scan");
        }
      }
    }
  }

  // === RFID (tiap 300ms) ===
  if (now - lastRFIDCheck > 300) { checkRFID(); lastRFIDCheck = now; }

  // === State machines ===
  updateDoorState();
  updateBeepState();

  // === Send data (tiap 2 detik) ===
  if (now - lastSendTime > 2000) { send_to_server(); lastSendTime = now; }

  // === Web commands (tiap 1 detik) ===
  if (now - lastCommandCheck > 1000) { checkWebCommands(); lastCommandCheck = now; }

  // === Update jam di LCD (tiap 1 detik, saat idle) ===
  if (timeInitialized && doorState == DOOR_IDLE && !isMotionDetected && !lcdBlinkActive) {
    if (now - lastClockUpdate > 1000) {
      lastClockUpdate = now;
      updateLCDWithTime();
    }
  }

  delay(50); // Turunkan dari 100 ke 50ms biar melody lebih smooth
}