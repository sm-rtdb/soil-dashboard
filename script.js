// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-analytics.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

// Import Chart.js and the date adapter
import 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
import 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDEG5Qv9aSZi_CQO4LVg2DvrfEm2N0DTEs",
    authDomain: "coffee-soilmoisture.firebaseapp.com",
    databaseURL: "https://coffee-soilmoisture-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "coffee-soilmoisture",
    storageBucket: "coffee-soilmoisture.appspot.com",
    messagingSenderId: "461967846771",
    appId: "1:461967846771:web:c7dc054877ea3cc2756906",
    measurementId: "G-T5SXGVQGSF"
};

// Sensor labels mapping
const sensorLabels = {
    sensor1: '2 Day Watering',
    sensor2: '4 Day Watering',
    sensor3: '6 Day Watering',
    sensor4: '8 Day Watering',
    sensor5: 'Control'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

console.log("Firebase initialized");

let allData = null;

// Function to sign in anonymously
function signInAnonymouslyFunc() {
    return signInAnonymously(auth)
        .then(() => {
            console.log("Signed in anonymously");
        })
        .catch((error) => {
            console.error("Error signing in anonymously:", error);
        });
}

// Function to fetch data from Firebase
async function fetchData() {
    console.log("Fetching data from Firebase...");
    const dbRef = ref(database, 'UsersData');
    try {
        const snapshot = await get(dbRef);
        const data = snapshot.val();
        console.log("Data fetched successfully:", data);
        return data;
    } catch (error) {
        console.error("Error fetching data:", error);
        throw error;
    }
}

// Function to process data for charts
function processDataForCharts(data) {
    console.log("Processing data for charts...");
    const chartData = {};

    for (const userId in data) {
        console.log("Processing data for user:", userId);
        const userReadings = data[userId].readings;
        if (userReadings) {
            chartData[userId] = {
                sensor1: [], sensor2: [], sensor3: [], sensor4: [], sensor5: []
            };

            for (const timestamp in userReadings) {
                const reading = userReadings[timestamp];
                const [day, month, year, hour, minute] = timestamp.split('-');
                const date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                for (let i = 1; i <= 5; i++) {
                    chartData[userId][`sensor${i}`].push({
                        x: date,
                        y: parseFloat(reading[`sensor${i}`]) || 0
                    });
                }
            }
        } else {
            console.log("No readings found for user:", userId);
        }
    }

    console.log("Processed chart data:", chartData);
    return chartData;
}

// Function to get a color for each sensor
function getColor(sensorIndex) {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
    return colors[sensorIndex - 1] || '#000000';
}

// Function to create/update charts
function updateCharts(chartData, selectedUserId = null) {
    console.log("Updating charts...");
    const chartsContainer = document.getElementById('chartsContainer');
    chartsContainer.innerHTML = ''; // Clear existing charts

    const users = selectedUserId ? [selectedUserId] : Object.keys(chartData);

    for (const userId of users) {
        const userContainer = document.createElement('div');
        userContainer.className = 'user-container';
        userContainer.innerHTML = `<h2>User: ${userId}</h2>`;
        chartsContainer.appendChild(userContainer);

        for (let i = 1; i <= 5; i++) {
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            userContainer.appendChild(chartWrapper);

            const canvasId = `chart-${userId}-sensor${i}`;
            const canvas = document.createElement('canvas');
            canvas.id = canvasId;
            chartWrapper.appendChild(canvas);

            const sensorKey = `sensor${i}`;
            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: sensorLabels[sensorKey],
                        data: chartData[userId][sensorKey],
                        borderColor: getColor(i),
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'hour',
                                displayFormats: {
                                    hour: 'HH:mm'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Moisture Level'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        title: {
                            display: true,
                            text: sensorLabels[sensorKey],
                            font: {
                                size: 14,
                                weight: 'normal'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    const date = new Date(context[0].parsed.x);
                                    return date.toLocaleString('en-US', { 
                                        year: 'numeric', 
                                        month: '2-digit', 
                                        day: '2-digit', 
                                        hour: '2-digit', 
                                        minute: '2-digit', 
                                        hour12: false 
                                    });
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    
    console.log("Charts created");
}

// Function to convert data to CSV
function convertToCSV(data) {
    const headers = [
        'Timestamp', 
        'User ID', 
        '2 Day Watering', 
        '4 Day Watering', 
        '6 Day Watering', 
        '8 Day Watering', 
        'Control'
    ];
    let csvContent = headers.join(',') + '\n';

    for (const userId in data) {
        const readings = data[userId].readings;
        for (const timestamp in readings) {
            const reading = readings[timestamp];
            const [day, month, year, hour, minute] = timestamp.split('-');
            const formattedTimestamp = `${year}-${month}-${day} ${hour}:${minute}`;
            const row = [
                formattedTimestamp,
                userId,
                reading.sensor1,
                reading.sensor2,
                reading.sensor3,
                reading.sensor4,
                reading.sensor5
            ];
            csvContent += row.join(',') + '\n';
        }
    }

    return csvContent;
}

// Function to trigger download
function downloadCSV(csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'soil_moisture_data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Function to update user list in drawer
function updateUserList(data) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    for (const userId in data) {
        const li = document.createElement('li');
        li.textContent = userId;
        li.onclick = () => {
            updateCharts(processDataForCharts(data), userId);
            toggleDrawer(); // Close drawer after selection
        };
        userList.appendChild(li);
    }
}

// Function to toggle drawer
function toggleDrawer() {
    const drawer = document.querySelector('.drawer');
    const mainContent = document.querySelector('.main-content');
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open')) {
        mainContent.style.marginLeft = '200px';
    } else {
        mainContent.style.marginLeft = '50px';
    }
}

// Event listener for update charts button
document.querySelector('.controls').addEventListener('click', async () => {
    console.log("Update charts button clicked");
    const statusElement = document.getElementById('status');
    try {
        await signInAnonymouslyFunc(); // Ensure user is signed in
        allData = await fetchData();
        if (allData) {
            const chartData = processDataForCharts(allData);
            updateCharts(chartData);
            updateUserList(allData);
            document.querySelector('.auth-status').textContent = 'Charts updated!';
        } else {
            document.querySelector('.auth-status').textContent = 'No data available.';
        }
    } catch (error) {
        console.error('Error:', error);
        document.querySelector('.auth-status').textContent = 'An error occurred while updating the charts.';
    }
});

// Event listener for download CSV button
document.querySelector('.header').addEventListener('click', async (e) => {
    if (e.target.textContent.includes('Download CSV')) {
        console.log("Download CSV button clicked");
        try {
            await signInAnonymouslyFunc(); // Ensure user is signed in
            if (allData) {
                const csvContent = convertToCSV(allData);
                downloadCSV(csvContent);
                document.querySelector('.auth-status').textContent = 'CSV downloaded!';
            } else {
                document.querySelector('.auth-status').textContent = 'No data available for download. Please update charts first.';
            }
        } catch (error) {
            console.error('Error:', error);
            document.querySelector('.auth-status').textContent = 'An error occurred while downloading the CSV.';
        }
    }
});

// Event listener for drawer toggle
document.querySelector('.drawer').addEventListener('click', (e) => {
    if (e.target.textContent.includes('☰')) {
        toggleDrawer();
    }
});

// Initial charts update and drawer setup
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM content loaded, initializing charts...");
    try {
        await signInAnonymouslyFunc(); // Sign in anonymously when the page loads
        allData = await fetchData();
        if (allData) {
            const chartData = processDataForCharts(allData);
            updateCharts(chartData);
            updateUserList(allData);
        } else {
            document.querySelector('.auth-status').textContent = 'No initial data available.';
        }
    } catch (error) {
        console.error('Error:', error);
        document.querySelector('.auth-status').textContent = 'An error occurred while initializing the charts.';
    }
});

// Monitor auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('User is signed in:', user.uid);
        document.querySelector('.auth-status').textContent = 'Authenticated';
        document.querySelector('.auth-status').style.color = '#2ecc71';
    } else {
        console.log('User is signed out');
        document.querySelector('.auth-status').textContent = 'Not authenticated';
        document.querySelector('.auth-status').style.color = '#e74c3c';
    }
});

console.log("Script loaded");