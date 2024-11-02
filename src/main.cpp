#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// Forward declarations of functions
void printLocalTime();
void updateMeasurementsAndLCD();
void scrollLCDText();
void sendToFirebase();

// Insert your network credentials
#define WIFI_SSID "itsr6"
#define WIFI_PASSWORD "11223344"

// Insert Firebase project API Key
#define API_KEY "AIzaSyDEG5Qv9aSZi_CQO4LVg2DvrfEm2N0DTEs"

// Insert RTDB URL
#define DATABASE_URL "https://coffee-soilmoisture-default-rtdb.asia-southeast1.firebasedatabase.app/"

// Insert authentication credentials
#define USER_EMAIL "soil.cof.one@gmail.com"
#define USER_PASSWORD "soilmoisture123"

// NTP Server Settings
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC 7 * 3600    // GMT+7 in seconds
#define DAYLIGHT_OFFSET_SEC 0      // No daylight saving time

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

const unsigned long firebaseInterval = 900000;  // interval to send to RTDB (10 minutes)
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

// Variables for real-time measurement and running text
unsigned long lastMeasurementTime = 0;
String runningTextRow1 = "";
String runningTextRow2 = "";
int textPositionRow1 = 0;
int textPositionRow2 = 0;

// Adjustable scroll speed
const int scrollSpeed = 550;  // Scroll interval in milliseconds
unsigned long lastScrollTime = 0;

// New variable for NTP sync status
bool timeInitialized = false;

// Print Local Time (helpful for debugging)
void printLocalTime() {
    if(!getLocalTime(&timeinfo)){
        Serial.println("Failed to obtain time");
        return;
    }
    Serial.println(&timeinfo, "%A, %B %d %Y %H:%M:%S");
}

// Function to get current timestamp
String getTime() {
    if(!getLocalTime(&timeinfo)){
        Serial.println("Failed to obtain time");
        return "Time Error";
    }
    char timeStringBuff[20];
    strftime(timeStringBuff, sizeof(timeStringBuff), "%d-%m-%y-%H-%M", &timeinfo);
    return String(timeStringBuff);
}

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

// Initialize and sync NTP time
void initTime() {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    Serial.println("Waiting for NTP time sync...");
    
    int attempts = 0;
    const int maxAttempts = 10;
    while(!getLocalTime(&timeinfo) && attempts < maxAttempts) {
        Serial.print(".");
        delay(1000);
        attempts++;
    }
    
    if (getLocalTime(&timeinfo)) {
        Serial.println("\nTime synchronized with NTP server!");
        timeInitialized = true;
        printLocalTime();
    } else {
        Serial.println("\nFailed to obtain time from NTP server");
        timeInitialized = false;
    }
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
    
    runningTextRow2 = newRunningTextRow2;
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
        json.set("sensor" + String(i+1), moisture);
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
        firebaseStatus = "Fail:" + fbdo.errorReason().substring(0, 10);
        
        if (fbdo.errorReason().indexOf("auth") != -1) {
            if (Firebase.authTokenInfo().status == token_status_error) {
                Firebase.refreshToken(&config);
                Serial.println("Token refreshed");
                firebaseStatus = "Token refreshed";
            }
        }
    }
    updateMeasurementsAndLCD();
    scrollLCDText();
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
    lcd.print("Waiting For Connection");

    initWiFi();
    
    // Initialize NTP
    initTime();

    // Assign the api key (required)
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;
    auth.user.email = USER_EMAIL;
    auth.user.password = USER_PASSWORD;
    config.timeout.serverResponse = 10 * 1000;

    Firebase.reconnectWiFi(true);
    fbdo.setResponseSize(4096);

    config.token_status_callback = tokenStatusCallback;
    config.max_token_generation_retry = 5;

    Firebase.begin(&config, &auth);
    Firebase.setDoubleDigits(5);

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
    
    uid = auth.token.uid.c_str();
    Serial.print("User UID: ");
    Serial.println(uid);

    databasePath = "/UsersData/" + uid + "/readings";

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("UID Obtained");
    lcd.setCursor(0, 1);
    lcd.print("Ready!");
    delay(2000);

    runningTextRow1 = getTime() + " FB:Waiting... ";
    String displayNames[] = {"2", "4", "6", "8", "Contr"};
    for (int i = 0; i < numSensors; i++) {
        runningTextRow2 += displayNames[i] + ":0% ";
    }
}

void loop() {
    unsigned long currentMillis = millis();

    // Periodic NTP sync check
    static unsigned long lastTimeSync = 0;
    if (currentMillis - lastTimeSync >= 3600000) { // Check every hour
        lastTimeSync = currentMillis;
        if (WiFi.status() == WL_CONNECTED && !timeInitialized) {
            initTime();
        }
    }

    // Check Firebase connection
    if (currentMillis - lastFirebaseConnectionCheck >= firebaseConnectionCheckInterval) {
        lastFirebaseConnectionCheck = currentMillis;
        if (Firebase.ready()) {
            Serial.println("Firebase connected successfully");
        } else {
            Serial.println("Firebase connection failed");
        }
    }

    // Update measurements
    if (currentMillis - lastMeasurementTime >= 3000) {
        updateMeasurementsAndLCD();
    }

    // Scroll text
    if (currentMillis - lastScrollTime >= scrollSpeed) {
        scrollLCDText();
    }

    // Send to Firebase
    if (Firebase.ready() && (currentMillis - previousFirebaseMillis >= firebaseInterval || previousFirebaseMillis == 0)) {
        sendToFirebase();
    }

    // Update Firebase waiting status
    if (currentMillis - lastFirebaseAttempt >= firebaseInterval + 10000) {
        firebaseStatus = "Waiting...";
        updateMeasurementsAndLCD();
        scrollLCDText();
    }
}