#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "time.h"
#include <Preferences.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// Insert your network credentials
#define WIFI_SSID "GFM-1"
#define WIFI_PASSWORD "GFM1-123"

// Insert Firebase project API Key
#define API_KEY "AIzaSyDEG5Qv9aSZi_CQO4LVg2DvrfEm2N0DTEs"

// Insert RTDB URL
#define DATABASE_URL "https://coffee-soilmoisture-default-rtdb.asia-southeast1.firebasedatabase.app/"

// Insert authentication credentials
#define USER_EMAIL "soil.cof.4@gmail.com"
#define USER_PASSWORD "soilmoisture123"//remain same

// Define Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Variable to save USER UID
String uid;

// Database main path (to be updated in setup with the user UID)
String databasePath;
String timePath = "/timestamp";

// Parent Node (to be updated in every loop)
String parentPath;

String timestamp;
String firebaseStatus = "Waiting...";

const unsigned long firebaseInterval = 600000;  // interval to send to RTDB (10 minutes)
unsigned long previousFirebaseMillis = 0;
unsigned long lastFirebaseAttempt = 0;

// New variables for Firebase connection check
unsigned long lastFirebaseConnectionCheck = 0;
const unsigned long firebaseConnectionCheckInterval = 60000; // Check every 60 seconds

// Sensor pin definitions and calibration values
const int sensorPins[] = {32, 34, 39, 33, 36};  // s1, s2, s3, s4, s5
const int numSensors = 5;
const int dryValues[] = {3000, 3000, 3000, 3000, 3000};
const int wetValues[] = {1000, 1000, 1000, 1000, 1000};

// LCD setup
LiquidCrystal_I2C lcd(0x27, 16, 2);  // I2C address 0x27, 16 column and 2 rows

// Time structure
struct tm timeinfo;

// Preferences object for storing time
Preferences preferences;

// Variables for real-time measurement and running text
unsigned long lastMeasurementTime = 0;
String runningTextRow1 = "";
String runningTextRow2 = "";
int textPositionRow1 = 0;
int textPositionRow2 = 0;

// Adjustable scroll speed
const int scrollSpeed = 550;  // Scroll interval in milliseconds (lower value = faster scroll)
unsigned long lastScrollTime = 0;

// New variable to track time since last reset check
unsigned long lastResetCheckTime = 0;
const long resetCheckInterval = 5000; // Check for reset every 5 seconds

// Function to adjust moisture percentage
int adjustMoistureAlternative(int rawValue, int dryValue, int wetValue) {
  int moisture = map(rawValue, dryValue, wetValue, 0, 100);
  int adjusted = 100 * (moisture - 40) / 38;
  return constrain(adjusted, 0, 100);
}

// Initialize WiFi
void initWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi ..");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print('.');
    delay(1000);
  }
  Serial.println(WiFi.localIP());
  Serial.println();
}

// Function to get current timestamp
String getTime() {
  time_t now;
  time(&now);
  localtime_r(&now, &timeinfo);
  char timeStringBuff[20];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%d-%m-%y-%H-%M", &timeinfo);
  return String(timeStringBuff);
}

void manualTimeInput() {
  String input;
  while (true) {
    Serial.println("Enter time in format 'dd-mm-yy HH:MM' (e.g., 21-09-23 14:30):");
    while (!Serial.available()) {
      delay(100);
    }
    input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() == 14 && input.charAt(2) == '-' && input.charAt(5) == '-' && input.charAt(8) == ' ' && input.charAt(11) == ':') {
      break;
    } else {
      Serial.println("Invalid format. Please try again.");
    }
  }

  int day = input.substring(0, 2).toInt();
  int month = input.substring(3, 5).toInt();
  int year = input.substring(6, 8).toInt() + 2000; // Assuming 20xx for the year
  int hour = input.substring(9, 11).toInt();
  int minute = input.substring(12, 14).toInt();

  timeinfo.tm_year = year - 1900;
  timeinfo.tm_mon = month - 1;
  timeinfo.tm_mday = day;
  timeinfo.tm_hour = hour;
  timeinfo.tm_min = minute;
  timeinfo.tm_sec = 0;

  time_t t = mktime(&timeinfo);
  struct timeval now = { .tv_sec = t };
  settimeofday(&now, NULL);

  // Store the time in NVS
  preferences.begin("time_storage", false);
  preferences.putLong("epoch_time", t);
  preferences.end();

  Serial.println("Time set successfully!");
}

// New function to check for reset request
bool checkForResetRequest() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.equalsIgnoreCase("reset time")) {
      return true;
    }
  }
  return false;
}

void updateMeasurementsAndLCD() {
  lastMeasurementTime = millis();

  int moistureValues[numSensors];
  for (int i = 0; i < numSensors; i++) {
    moistureValues[i] = adjustMoistureAlternative(analogRead(sensorPins[i]), dryValues[i], wetValues[i]);
  }

  // Update the running text for row 2 with new display names
  String newRunningTextRow2 = "";
  String displayNames[] = {"2", "4", "6", "8", "Contr"};
  for (int i = 0; i < numSensors; i++) {
    newRunningTextRow2 += displayNames[i] + ":" + String(moistureValues[i]) + "% ";
  }
  
  // Only update the running text content, not its position
  runningTextRow2 = newRunningTextRow2;

  // Update the running text for row 1
  runningTextRow1 = getTime() + " FB:" + firebaseStatus + " ";
}

void scrollLCDText() {
  lastScrollTime = millis();
  
  // First row: Timestamp and Firebase status
  String displayTextRow1 = runningTextRow1 + runningTextRow1;  // Double the text for seamless looping
  int startPosRow1 = textPositionRow1 % runningTextRow1.length();
  lcd.setCursor(0, 0);
  lcd.print(displayTextRow1.substring(startPosRow1, startPosRow1 + 16));
  textPositionRow1 = (textPositionRow1 + 1) % runningTextRow1.length();
  
  // Second row: Looping sensor data
  String displayTextRow2 = runningTextRow2 + runningTextRow2;  // Double the text for seamless looping
  int startPosRow2 = textPositionRow2 % runningTextRow2.length();
  lcd.setCursor(0, 1);
  lcd.print(displayTextRow2.substring(startPosRow2, startPosRow2 + 16));
  textPositionRow2 = (textPositionRow2 + 1) % runningTextRow2.length();
}

void sendToFirebase() {
  previousFirebaseMillis = millis();
  lastFirebaseAttempt = millis();
  timestamp = getTime();
  Serial.print("Time: ");
  Serial.println(timestamp);

  parentPath = databasePath + "/" + timestamp;
  
  Serial.print("Attempting to write to path: ");
  Serial.println(parentPath);

  FirebaseJson json;
  for (int i = 0; i < numSensors; i++) {
    int moisture = adjustMoistureAlternative(analogRead(sensorPins[i]), dryValues[i], wetValues[i]);
    json.set("sensor" + String(i+1), moisture);  // Keep original "sensor1" to "sensor5" names for Firebase
  }
  json.set("timestamp", timestamp);

  Serial.print("Data to be sent: ");
  String jsonStr;
  json.toString(jsonStr, true);
  Serial.println(jsonStr);

  if (Firebase.RTDB.setJSON(&fbdo, parentPath.c_str(), &json)) {
    Serial.println("Firebase update successful");
    firebaseStatus = "OK";
  } else {
    Serial.println("Firebase update failed");
    Serial.println("Reason: " + fbdo.errorReason());
    Serial.println("Full error message: " + fbdo.errorReason());
    Serial.println("HTTP Status code: " + String(fbdo.httpCode()));
    firebaseStatus = "Fail:" + fbdo.errorReason().substring(0, 10); // Truncate to fit LCD
    
    // Check specific error and handle accordingly
    if (fbdo.errorReason().indexOf("auth") != -1) {
      // Re-authenticate
      if (Firebase.authTokenInfo().status == token_status_error) {
        Firebase.refreshToken(&config);
        Serial.println("Token refreshed");
        firebaseStatus = "Token refreshed";
      }
    }
  }
  updateMeasurementsAndLCD();
  scrollLCDText(); // Update LCD immediately after Firebase attempt
}

void handleTimeReset() {
  Serial.println("Reset request received. Please enter new time.");
  manualTimeInput();
  time_t now;
  time(&now);
  preferences.begin("time_storage", false);
  preferences.putLong("epoch_time", now);
  preferences.end();
  Serial.println("Time reset successfully!");
}

void setup() {
  Serial.begin(115200);

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Soil Moisture");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");

  initWiFi();

  // Check if time is already set
  preferences.begin("time_storage", false);
  time_t stored_time = preferences.getLong("epoch_time", 0);
  preferences.end();

  if (stored_time == 0) {
    manualTimeInput();
  } else {
    struct timeval now = { .tv_sec = stored_time };
    settimeofday(&now, NULL);
    Serial.println("Time restored from storage");
  }

  // Assign the api key (required)
  config.api_key = API_KEY;

  // Assign the RTDB URL (required)
  config.database_url = DATABASE_URL;

  // Assign the user sign in credentials
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  config.timeout.serverResponse = 10 * 1000;  // Increase timeout to 10 seconds

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  config.token_status_callback = tokenStatusCallback;
  config.max_token_generation_retry = 5;

  Firebase.begin(&config, &auth);
  Firebase.setDoubleDigits(5);

  // Getting the user UID might take a few seconds
  Serial.println("Getting User UID");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Getting UID");
  while ((auth.token.uid) == "") {
    Serial.print('.');
    lcd.setCursor(0, 1);
    lcd.print(".");
    delay(1000);
  }
  // Print user UID
  uid = auth.token.uid.c_str();
  Serial.print("User UID: ");
  Serial.println(uid);

  // Update database path
  databasePath = "/UsersData/" + uid + "/readings";

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("UID Obtained");
  lcd.setCursor(0, 1);
  lcd.print("Ready!");
  delay(2000);

  // Initialize the running text for both rows
  runningTextRow1 = getTime() + " FB:Waiting... ";
  String displayNames[] = {"2", "4", "6", "8", "Contr"};
  for (int i = 0; i < numSensors; i++) {
    runningTextRow2 += displayNames[i] + ":0% ";
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // Check Firebase connection every minute
  if (currentMillis - lastFirebaseConnectionCheck >= firebaseConnectionCheckInterval) {
    lastFirebaseConnectionCheck = currentMillis;
    if (Firebase.ready()) {
      Serial.println("Firebase connected successfully");
    } else {
      Serial.println("Firebase connection failed");
    }
  }

  // Check for reset request
  if (currentMillis - lastResetCheckTime >= resetCheckInterval) {
    lastResetCheckTime = currentMillis;
    if (checkForResetRequest()) {
      handleTimeReset();
    }
  }

  // Update measurements every 3 seconds
  if (currentMillis - lastMeasurementTime >= 3000) {
    updateMeasurementsAndLCD();
  }

  // Scroll text based on scrollSpeed
  if (currentMillis - lastScrollTime >= scrollSpeed) {
    scrollLCDText();
  }

  // Send new readings to Firebase every 10 minutes
  if (Firebase.ready() && (currentMillis - previousFirebaseMillis >= firebaseInterval || previousFirebaseMillis == 0)) {
    sendToFirebase();
  }

  // Update Firebase status to "Waiting..." if it's been a while since last attempt
  if (currentMillis - lastFirebaseAttempt >= firebaseInterval + 10000) {
    firebaseStatus = "Waiting...";
    updateMeasurementsAndLCD();
    scrollLCDText();  // Update LCD immediately
  }
}