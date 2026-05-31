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

#include <Arduino.h>
#include <HTTPClient.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFi.h>
#include <Wire.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>
#include <esp_wifi.h>
#include <time.h> // For NTP time sync

// ================= KONFIGURASI =================
// Primary WiFi
const char *ssid = "Kucing Salto";
const char *password = "ucing8382428";

// Fallback Hotspot
const char *hotspot_ssid = "SmartLock_Hotspot";
const char *hotspot_password = "ucing8382428";

const char *SERVER_URL = "http://192.168.1.7:3000/api/motion";

// Pin definitions
const int PIN_RELAY = 16;  // Solenoid lock relay
const int PIN_BUZZER = 17; // Alarm buzzer
const int LED_PIN = 2;     // Built-in LED
const int SS_PIN = 5;      // RFID SPI SS
const int RST_PIN = 4;     // RFID Reset
const int SCK_PIN = 18;    // SPI Clock
const int MISO_PIN = 19;   // SPI MISO
const int MOSI_PIN = 23;   // SPI MOSI
const int LCD_SDA = 26;    // I2C Data
const int LCD_SCL = 27;    // I2C Clock
const int LCD_ADDR = 0x27; // I2C Address

// Motion detection settings
const float THRESHOLD_MULT = 2.0;
const int DEBOUNCE_DELAY = 5000;

// Door timing
const unsigned long UNLOCK_DURATION = 5000; // 5s auto-lock
const unsigned long DENIED_DURATION = 2000; // 2s display denied

// Time-based alarm schedule
bool scheduleEnabled = false; // Enable/disable schedule
int scheduleStartHour = 22;   // 10 PM (alarm ON)
int scheduleEndHour = 6;      // 6 AM (alarm OFF)
bool demoMode = false;        // Demo mode: simulate nighttime

// NTP time sync
const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7 * 3600; // GMT+7 (Indonesia)
const int daylightOffset_sec = 0;
bool timeInitialized = false;

// ================= HARDWARE OBJECTS =================
MFRC522 rfid(SS_PIN, RST_PIN);
hd44780_I2Cexp lcd;

// Authorized RFID UIDs
byte authorizedUIDs[][4] = {{0xDB, 0x63, 0x03, 0x07}};
const int numAuthorizedUIDs = 1;

// ================= STATE MACHINES =================
// Door state
enum DoorState { DOOR_IDLE, DOOR_UNLOCKED, DOOR_DENIED };
DoorState doorState = DOOR_IDLE;
unsigned long doorStateTime = 0;

// Buzzer beep state
enum BeepState { BEEP_IDLE, BEEP_ON, BEEP_OFF };
BeepState beepState = BEEP_IDLE;
unsigned long beepTime = 0;
int beepCount = 0;
const int BEEP_TOTAL = 3;
const unsigned long BEEP_ON_MS = 200;
const unsigned long BEEP_OFF_MS = 200;

// ================= GLOBAL VARIABLES =================
float baselineVariance = 0.0;
float currentThreshold = 0.0;
float currentVariance = 0.0;
bool isMotionDetected = false;
bool isCalibrating = true;
bool isDoorLocked = true;
String connectedWiFi = "None";
unsigned long motionStartMillis = 0;
unsigned long lastSendTime = 0;
unsigned long lastRFIDCheck = 0;
unsigned long lastCommandCheck = 0;

float varianceBuffer[20];
int bufIdx = 0;

// ================= LCD FUNCTIONS =================
void lcdLine(int row, const char *text) {
  lcd.setCursor(0, row);
  int i;
  for (i = 0; i < 16 && text[i] != '\0'; i++) {
    lcd.write(text[i]);
  }
  for (; i < 16; i++)
    lcd.write(' '); // Pad with spaces
}

void updateLCD(const char *line1, const char *line2 = "") {
  lcdLine(0, line1);
  lcdLine(1, line2);
}

// ================= DOOR CONTROL =================
void controlDoor(bool lock) {
  isDoorLocked = lock;
  digitalWrite(PIN_RELAY, lock ? LOW : HIGH);
  Serial.println(lock ? "[DOOR] LOCKED" : "[DOOR] UNLOCKED");

  if (lock) {
    updateLCD("Smart Door Lock", "Locked - Scan");
  } else {
    updateLCD("Access Granted", "Welcome!");
  }
}

// ================= RFID FUNCTIONS =================
bool checkRFID() {
  if (doorState != DOOR_IDLE)
    return false;
  if (!rfid.PICC_IsNewCardPresent())
    return false;
  if (!rfid.PICC_ReadCardSerial())
    return false;

  // Print UID
  Serial.print("[RFID] Card: ");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.printf("%02X ", rfid.uid.uidByte[i]);
  }
  Serial.println();

  // Check authorization
  bool authorized = false;
  for (int i = 0; i < numAuthorizedUIDs; i++) {
    bool match = true;
    for (byte j = 0; j < 4; j++) {
      if (rfid.uid.uidByte[j] != authorizedUIDs[i][j]) {
        match = false;
        break;
      }
    }
    if (match) {
      authorized = true;
      break;
    }
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  if (authorized) {
    Serial.println("[RFID] AUTHORIZED - unlocking door");
    controlDoor(false);
    doorState = DOOR_UNLOCKED;
    doorStateTime = millis();
    return true;
  } else {
    Serial.println("[RFID] DENIED");
    updateLCD("Access Denied", "Invalid Card");

    // Start beep sequence
    beepState = BEEP_ON;
    beepTime = millis();
    beepCount = 0;
    digitalWrite(PIN_BUZZER, HIGH);

    doorState = DOOR_DENIED;
    doorStateTime = millis();
    return false;
  }
}

// ================= STATE MACHINE UPDATES =================
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
      updateLCD("Smart Door Lock", "Locked - Scan");
    }
    break;
  default:
    break;
  }
}

void updateBeepState() {
  if (beepState == BEEP_IDLE)
    return;
  unsigned long now = millis();

  switch (beepState) {
  case BEEP_ON:
    if (now - beepTime >= BEEP_ON_MS) {
      digitalWrite(PIN_BUZZER, LOW);
      beepState = BEEP_OFF;
      beepTime = now;
    }
    break;
  case BEEP_OFF:
    beepCount++;
    if (beepCount >= BEEP_TOTAL) {
      beepState = BEEP_IDLE;
      beepCount = 0;
    } else if (now - beepTime >= BEEP_OFF_MS) {
      digitalWrite(PIN_BUZZER, HIGH);
      beepState = BEEP_ON;
      beepTime = now;
    }
    break;
  default:
    break;
  }
}

// ================= MOTION DETECTION =================
void read_signal_variance() {
  int rssi = WiFi.RSSI();
  static int lastRssi = -100;

  float diff = abs(rssi - lastRssi);
  varianceBuffer[bufIdx] = diff;
  bufIdx = (bufIdx + 1) % 20;
  lastRssi = rssi;

  float sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += varianceBuffer[i];
  }

  currentVariance = (sum / 20.0) / 10.0;
  if (currentVariance > 1.0)
    currentVariance = 1.0;
}

void calibrate_system() {
  Serial.println("\n========================================");
  Serial.println("  CALIBRATION - DON'T MOVE!");
  Serial.println("========================================");
  updateLCD("Calibrating...", "Don't move 5s");
  digitalWrite(LED_PIN, HIGH);

  float sumVar = 0;
  for (int i = 0; i < 50; i++) {
    read_signal_variance();
    sumVar += currentVariance;
    delay(100);

    if (i % 10 == 0) {
      Serial.print(".");
    }
  }
  Serial.println();

  baselineVariance = sumVar / 50.0;
  currentThreshold = baselineVariance * THRESHOLD_MULT;

  digitalWrite(LED_PIN, LOW);

  Serial.println("========================================");
  Serial.println("  CALIBRATION COMPLETE!");
  Serial.print("  Baseline: ");
  Serial.println(baselineVariance, 4);
  Serial.print("  Threshold: ");
  Serial.println(currentThreshold, 4);
  Serial.println("========================================\n");

  updateLCD("System Ready!", "Scan card");
  isCalibrating = false;
}

void send_to_server() {
  if (WiFi.status() != WL_CONNECTED)
    return;

  HTTPClient http;
  http.setTimeout(3000); // Reduced from 5000ms to prevent watchdog issues
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"variance\":" + String(currentVariance, 4) + ",";
  json += "\"threshold\":" + String(currentThreshold, 4) + ",";
  json += "\"motion\":" + String(isMotionDetected ? "true" : "false") + ",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"doorLocked\":" + String(isDoorLocked ? "true" : "false") + ",";
  json += "\"connectedWiFi\":\"" + connectedWiFi + "\",";
  json += "\"timestamp\":" + String(millis());
  json += "}";

  int httpResponseCode = http.POST(json);

  if (httpResponseCode > 0) {
    Serial.print("[SEND] OK | var=");
    Serial.print(currentVariance, 3);
    Serial.print(" thr=");
    Serial.print(currentThreshold, 3);
    Serial.print(" motion=");
    Serial.print(isMotionDetected ? "YES" : "NO");
    Serial.print(" door=");
    Serial.println(isDoorLocked ? "LOCKED" : "UNLOCKED");
  } else {
    Serial.print("[SEND] FAIL | code=");
    Serial.println(httpResponseCode);
  }

  http.end();
}

void postLog(const String& type, const String& message) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.setTimeout(3000);
  String url = String(SERVER_URL);
  url.replace("/motion", "/logs");
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  String json = "{\"type\":\"" + type + "\",\"message\":\"" + message + "\"}";
  http.POST(json);
  http.end();
}

void checkWebCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(3000);
  String url = String(SERVER_URL);
  url.replace("/motion", "/control/commands");

  http.begin(url);
  int httpResponseCode = http.GET();

  if (httpResponseCode == 200) {
    String payload = http.getString();
    
    if (payload.indexOf("\"command\":\"door:unlock\"") >= 0) {
      Serial.println("[COMMAND] Web Unlocking Door!");
      controlDoor(false);
      doorState = DOOR_UNLOCKED;
      doorStateTime = millis();
      postLog("system", "Manual door unlock command from dashboard");
    } 
    else if (payload.indexOf("\"command\":\"door:lock\"") >= 0) {
      Serial.println("[COMMAND] Web Locking Door!");
      controlDoor(true);
      doorState = DOOR_IDLE;
      postLog("system", "Manual door lock command from dashboard");
    }
    else if (payload.indexOf("\"command\":\"buzzer:on\"") >= 0) {
      Serial.println("[COMMAND] Web Buzzer ON!");
      digitalWrite(PIN_BUZZER, HIGH);
      postLog("system", "Manual buzzer ON command from dashboard");
    }
    else if (payload.indexOf("\"command\":\"buzzer:off\"") >= 0) {
      Serial.println("[COMMAND] Web Buzzer OFF!");
      digitalWrite(PIN_BUZZER, LOW);
      postLog("system", "Manual buzzer OFF command from dashboard");
    }
    else if (payload.indexOf("\"command\":\"lcd:") >= 0) {
      int idx = payload.indexOf("\"command\":\"lcd:");
      int start = idx + 15;
      int end = payload.indexOf("|", start);
      if (end > start) {
        String msg = payload.substring(start, end);
        Serial.printf("[COMMAND] Web LCD Message: %s\n", msg.c_str());
        updateLCD("SYSTEM ALERT:", msg.c_str());
        doorState = DOOR_DENIED;
        doorStateTime = millis();
        postLog("system", "LCD display message updated: " + msg);
      }
    }
    else if (payload.indexOf("\"command\":\"calibrate\"") >= 0) {
      Serial.println("[COMMAND] Web Calibration Request!");
      isCalibrating = true;
      calibrate_system();
      postLog("system", "Manual calibration triggered from dashboard");
    }
    else if (payload.indexOf("\"command\":\"threshold:") >= 0) {
      int idx = payload.indexOf("\"command\":\"threshold:");
      int start = idx + 21;
      int end = payload.indexOf("\"", start);
      if (end > start) {
        String thrStr = payload.substring(start, end);
        float newThr = thrStr.toFloat();
        if (newThr > 0 && newThr <= 1.0) {
          currentThreshold = newThr;
          Serial.printf("[COMMAND] Threshold updated to: %.3f\n", newThr);
          postLog("system", "Threshold updated from dashboard: " + String(newThr, 3));
        }
      }
    }
  }
  http.end();
}

// ================= WIFI CONNECTION =================
bool connectWiFi() {
  // Try primary WiFi first
  Serial.println("[WiFi] Trying primary WiFi...");
  WiFi.begin(ssid, password);
  updateLCD("WiFi: Primary", "Connecting...");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected to primary! IP: ");
    Serial.println(WiFi.localIP());
    updateLCD("WiFi: Primary", "Connected!");
    delay(1000);
    return true;
  }
  
  // Fallback to hotspot
  Serial.println("[WiFi] Primary failed, trying hotspot...");
  WiFi.begin(hotspot_ssid, hotspot_password);
  updateLCD("WiFi: Hotspot", "Connecting...");
  
  attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected to hotspot! IP: ");
    Serial.println(WiFi.localIP());
    updateLCD("WiFi: Hotspot", "Connected!");
    delay(1000);
    return true;
  }
  
  Serial.println("[WiFi] Both connections failed!");
  updateLCD("WiFi Failed", "Check settings");
  return false;
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n\n========================================");
  Serial.println("  Smart Door Lock - Complete Version");
  Serial.println("========================================\n");

  // Setup pins
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  digitalWrite(PIN_RELAY, LOW); // Locked
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(LED_PIN, LOW);

  // Initialize LCD
  Wire.begin(LCD_SDA, LCD_SCL);
  int status = lcd.begin(16, 2);
  if (status) {
    Serial.printf("[LCD] Init failed: %d\n", status);
  } else {
    Serial.println("[LCD] OK");
  }
  updateLCD("Smart Door Lock", "Starting...");

  // Initialize RFID
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  rfid.PCD_Init();
  delay(200);
  byte rfidVer = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (rfidVer == 0x91 || rfidVer == 0x92) {
    Serial.printf("[RFID] OK (v%X)\n", rfidVer);
  } else {
    Serial.printf("[RFID] Warning: v=0x%X (might not be connected)\n", rfidVer);
  }

  // Connect WiFi with fallback
  bool wifiConnected = connectWiFi();
  
  if (wifiConnected) {
    Serial.print("[WiFi] RSSI: ");
    Serial.println(WiFi.RSSI());
    
    // Store which WiFi we're connected to
    String currentSSID = WiFi.SSID();
    if (currentSSID == ssid) {
      connectedWiFi = "Primary";
    } else if (currentSSID == hotspot_ssid) {
      connectedWiFi = "Hotspot";
    } else {
      connectedWiFi = currentSSID;
    }
    Serial.print("[WiFi] Connected to: ");
    Serial.println(connectedWiFi);
    
    // CRITICAL FIX: Disable WiFi power saving to prevent disconnections
    WiFi.setSleep(false);
    Serial.println("[WiFi] Power saving DISABLED - stable connection mode");
  } else {
    connectedWiFi = "Offline";
    Serial.println("[WiFi] No connection available - system will run in offline mode");
  }

  // Calibrate
  delay(1000);
  calibrate_system();

  Serial.println("========================================");
  Serial.println("  SYSTEM READY!");
  Serial.println("========================================\n");

  controlDoor(true); // Start locked
}

// ================= LOOP =================
void loop() {
  unsigned long now = millis();

  // 0. Check WiFi connection and reconnect if needed
  static unsigned long lastWiFiCheck = 0;
  if (now - lastWiFiCheck > 10000) { // Check every 10 seconds
    lastWiFiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] DISCONNECTED! Attempting reconnect...");
      updateLCD("WiFi Lost", "Reconnecting...");
      
      WiFi.disconnect();
      delay(100);
      WiFi.begin(ssid, password);
      
      int attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        WiFi.setSleep(false); // Re-disable power saving
        Serial.println("\n[WiFi] RECONNECTED!");
        Serial.print("[WiFi] IP: ");
        Serial.println(WiFi.localIP());
        updateLCD("WiFi Restored", "Connected");
        delay(1000);
        updateLCD("Smart Door Lock", isDoorLocked ? "Locked - Scan" : "Unlocked");
      } else {
        Serial.println("\n[WiFi] Reconnect FAILED");
      }
    }
  }

  // 1. Read variance
  if (!isCalibrating) {
    read_signal_variance();

    // 2. Detect motion
    if (currentVariance > currentThreshold) {
      // Motion detected!
      if (!isMotionDetected) {
        isMotionDetected = true;
        motionStartMillis = now;

        // Trigger alarm (only if not in beep sequence)
        if (beepState == BEEP_IDLE) {
          digitalWrite(PIN_BUZZER, HIGH);
        }
        digitalWrite(LED_PIN, HIGH);

        Serial.println(">>> MOTION DETECTED!");
        Serial.print("    Variance: ");
        Serial.print(currentVariance, 4);
        Serial.print(" > Threshold: ");
        Serial.println(currentThreshold, 4);

        if (doorState == DOOR_IDLE) {
          updateLCD("!! ALERT !!", "Motion Detected");
        }
      }
    } else {
      // No motion
      if (isMotionDetected) {
        // Check debounce
        if (now - motionStartMillis > DEBOUNCE_DELAY) {
          isMotionDetected = false;

          // Clear alarm (only if not in beep sequence)
          if (beepState == BEEP_IDLE) {
            digitalWrite(PIN_BUZZER, LOW);
          }
          digitalWrite(LED_PIN, LOW);

          Serial.println("--- Motion cleared (safe)");

          if (doorState == DOOR_IDLE) {
            updateLCD("Smart Door Lock",
                      isDoorLocked ? "Locked - Scan" : "Unlocked");
          }
        }
      }
    }
  }

  // 3. Check RFID (every 300ms)
  if (now - lastRFIDCheck > 300) {
    checkRFID();
    lastRFIDCheck = now;
  }

  // 4. Update state machines
  updateDoorState();
  updateBeepState();

  // 5. Send data to server (every 2 seconds)
  if (now - lastSendTime > 2000) {
    send_to_server();
    lastSendTime = now;
  }

  // 6. Poll web commands (every 1 second)
  if (now - lastCommandCheck > 1000) {
    checkWebCommands();
    lastCommandCheck = now;
  }

  delay(100);
}
