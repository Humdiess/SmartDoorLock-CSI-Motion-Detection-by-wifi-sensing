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

#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_wifi.h>
#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>  // For NTP time sync

// ================= KONFIGURASI =================
const char* ssid = "Kucing Salto";
const char* password = "ucing8382428";
const char* SERVER_URL = "http://192.168.1.7:3000/api/motion"; 

// Pin definitions
const int PIN_RELAY  = 16;    // Solenoid lock relay
const int PIN_BUZZER = 17;    // Alarm buzzer
const int LED_PIN    = 2;     // Built-in LED
const int SS_PIN     = 5;     // RFID SPI SS
const int RST_PIN    = 4;     // RFID Reset
const int SCK_PIN    = 18;    // SPI Clock
const int MISO_PIN   = 19;    // SPI MISO
const int MOSI_PIN   = 23;    // SPI MOSI
const int LCD_SDA    = 26;    // I2C Data
const int LCD_SCL    = 27;    // I2C Clock
const int LCD_ADDR   = 0x27;  // I2C Address

// Motion detection settings
const float THRESHOLD_MULT = 1.3;  
const int DEBOUNCE_DELAY = 5000;

// Door timing
const unsigned long UNLOCK_DURATION = 5000;  // 5s auto-lock
const unsigned long DENIED_DURATION = 2000;  // 2s display denied

// Time-based alarm schedule
bool scheduleEnabled = false;      // Enable/disable schedule
int scheduleStartHour = 22;        // 10 PM (alarm ON)
int scheduleEndHour = 6;           // 6 AM (alarm OFF)
bool demoMode = false;             // Demo mode: simulate nighttime

// NTP time sync
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7 * 3600;  // GMT+7 (Indonesia)
const int daylightOffset_sec = 0;
bool timeInitialized = false;

// ================= HARDWARE OBJECTS =================
MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);

// Authorized RFID UIDs
byte authorizedUIDs[][4] = { {0xDB, 0x63, 0x03, 0x07} };
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
unsigned long motionStartMillis = 0;
unsigned long lastSendTime = 0;
unsigned long lastRFIDCheck = 0;
String lastScannedUID = "None";
String lastScannedStatus = "None";

float varianceBuffer[20];
int bufIdx = 0;

// ================= LCD FUNCTIONS =================
void lcdLine(int row, const char* text) {
  lcd.setCursor(0, row);
  int i;
  for (i = 0; i < 16 && text[i] != '\0'; i++) {
    lcd.write(text[i]);
  }
  for (; i < 16; i++) lcd.write(' ');  // Pad with spaces
}

void updateLCD(const char* line1, const char* line2 = "") {
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
  if (doorState != DOOR_IDLE) return false;

  // Force occasional RFID re-init to keep the module from locking up
  static unsigned long lastRFIDInit = 0;
  if (millis() - lastRFIDInit > 4000) {
    rfid.PCD_Init();
    lastRFIDInit = millis();
  }

  if (!rfid.PICC_IsNewCardPresent()) return false;
  if (!rfid.PICC_ReadCardSerial()) return false;

  // Get UID string
  String cardUID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    char hex[4];
    sprintf(hex, "%02X", rfid.uid.uidByte[i]);
    cardUID += String(hex) + (i < rfid.uid.size - 1 ? " " : "");
  }
  Serial.print("[RFID] Card scanned: ");
  Serial.println(cardUID);

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
  rfid.PCD_Init(); // Reset immediately after reading a card to allow multiple scans!

  // Forward declarations for helper functions
  void postLog(const String& type, const String& message);
  void postTelegramAlert(const String& type, const String& uid);

  if (authorized) {
    Serial.println("[RFID] AUTHORIZED - unlocking door");
    controlDoor(false);
    doorState = DOOR_UNLOCKED;
    doorStateTime = millis();
    
    lastScannedUID = cardUID;
    lastScannedStatus = "Authorized";
    
    // Post events asynchronously
    postLog("system", "RFID ACCESS GRANTED: Card " + cardUID);
    postTelegramAlert("rfid_access", cardUID);
    return true;
  } else {
    Serial.println("[RFID] DENIED");
    updateLCD("Access Denied", "Invalid Card");
    
    lastScannedUID = cardUID;
    lastScannedStatus = "Denied";
    
    // Start beep sequence
    beepState = BEEP_ON;
    beepTime = millis();
    beepCount = 0;
    digitalWrite(PIN_BUZZER, HIGH);
    
    doorState = DOOR_DENIED;
    doorStateTime = millis();
    
    // Post events asynchronously
    postLog("system", "RFID ACCESS DENIED: Card " + cardUID);
    postTelegramAlert("rfid_denied", cardUID);
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
  if (beepState == BEEP_IDLE) return;
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
  if (currentVariance > 1.0) currentVariance = 1.0;
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
  Serial.print("  Baseline: "); Serial.println(baselineVariance, 4);
  Serial.print("  Threshold: "); Serial.println(currentThreshold, 4);
  Serial.println("========================================\n");
  
  updateLCD("System Ready!", "Scan card");
  isCalibrating = false;
}

void send_to_server() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(5000);
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"variance\":" + String(currentVariance, 4) + ",";
  json += "\"threshold\":" + String(currentThreshold, 4) + ",";
  json += "\"motion\":" + String(isMotionDetected ? "true" : "false") + ",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"doorLocked\":" + String(isDoorLocked ? "true" : "false") + ",";
  json += "\"lastRfidUid\":\"" + lastScannedUID + "\",";
  json += "\"lastRfidStatus\":\"" + lastScannedStatus + "\",";
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

void postTelegramAlert(const String& type, const String& uid) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.setTimeout(3000);
  String url = String(SERVER_URL);
  url.replace("/motion", "/alerts/telegram");
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  String json = "{\"type\":\"" + type + "\",\"data\":{\"uid\":\"" + uid + "\"}}";
  http.POST(json);
  http.end();
}

void checkWebCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(3000); // 3 seconds timeout
  String url = String(SERVER_URL);
  url.replace("/motion", "/control/commands");

  http.begin(url);
  int httpResponseCode = http.GET();

  if (httpResponseCode == 200) {
    String payload = http.getString();
    // Simple JSON parsing to detect queued manual control commands
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
      int start = idx + 15; // offset to parse message
      int end = payload.indexOf("|", start);
      if (end > start) {
        String msg = payload.substring(start, end);
        Serial.printf("[COMMAND] Web LCD Message: %s\n", msg.c_str());
        updateLCD("SYSTEM ALERT:", msg.c_str());
        // Temporarily change doorState to prevent immediate reset of LCD
        doorState = DOOR_DENIED;
        doorStateTime = millis();
        postLog("system", "LCD display message updated: " + msg);
      }
    }
  }
  http.end();
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
  
  digitalWrite(PIN_RELAY, LOW);   // Locked
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(LED_PIN, LOW);

  // Initialize LCD
  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();
  updateLCD("Smart Door Lock", "Starting...");
  Serial.println("[LCD] OK");

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

  // Connect WiFi
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Connecting");
  updateLCD("Connecting WiFi", "Please wait...");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WiFi] Connected! IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\n[WiFi] Failed to connect!");
    updateLCD("WiFi Failed", "Check settings");
  }

  // Calibrate
  delay(1000);
  calibrate_system();
  
  Serial.println("========================================");
  Serial.println("  SYSTEM READY!");
  Serial.println("========================================\n");
  
  controlDoor(true);  // Start locked
}

// ================= LOOP =================
void loop() {
  unsigned long now = millis();
  
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

        // Send alert logs and Telegram notifications
        postLog("motion", "ALERT: Motion detected! Variance: " + String(currentVariance, 3));
        postTelegramAlert("motion_detected", "");
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
            updateLCD("Smart Door Lock", isDoorLocked ? "Locked - Scan" : "Unlocked");
          }

          postLog("system", "Motion cleared - area secured");
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
  static unsigned long lastCommandCheck = 0;
  if (now - lastCommandCheck > 1000) {
    checkWebCommands();
    lastCommandCheck = now;
  }

  delay(100);
}