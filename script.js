// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-analytics.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

// User ID mapping with Box labels
const userIdMapping = {
    'lb0NH2Pl7AQOjjFyxi94kMkZ2YB3': 'Box 1',
    '6LWt9fPF3gWtY2Wu2AdRQk41TF43': 'Box 2',
    'Xbnl5dadNoXiTVefhPfoq6e8w3D3': 'Box 3',
    'zCLIFfSHaYaHXpGTNytbnZdYlFH2': 'Box 4',
    'oGjSNfSbqWfVYyvdqdm10i8vmry2': 'Box 5',
    'yOwqoSHy2lWZIrwXk7bNZkVQdD62': 'Box 6',
    'li8FvgAgJ5dj3vqsjwIGJiZUoR52': 'Box 7',
    'x71jKqGf3ZOrpuBNb3PqXhQxY5n2': 'Box 8'
};

// Sensor labels mapping
const sensorLabels = {
    sensor1: '2 Day Watering',
    sensor2: '4 Day Watering',
    sensor3: '6 Day Watering',
    sensor4: '8 Day Watering',
    sensor5: 'Control'
};

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

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
        console.log("Data fetched successfully");
        return data;
    } catch (error) {
        console.error("Error fetching data:", error);
        throw error;
    }
}

// Function to process data for charts
function processDataForCharts(data) {
    const chartData = {};

    for (const userId in data) {
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

            // Sort data points by time for each sensor
            Object.keys(chartData[userId]).forEach(sensor => {
                chartData[userId][sensor].sort((a, b) => a.x - b.x);
            });
        }
    }
    
    return chartData;
}

// Function to get color for charts
function getColor(sensorIndex) {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
    return colors[sensorIndex - 1] || '#000000';
}

// Function to update charts
function updateCharts(chartData, selectedUserId = null) {
    const chartsContainer = document.getElementById('chartsContainer');
    chartsContainer.innerHTML = '';

    const users = selectedUserId ? [selectedUserId] : Object.keys(chartData);

    for (const userId of users) {
        const userContainer = document.createElement('div');
        userContainer.className = 'user-container';
        userContainer.innerHTML = `<h2>${userIdMapping[userId]}</h2>`;
        chartsContainer.appendChild(userContainer);

        for (let i = 1; i <= 5; i++) {
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            userContainer.appendChild(chartWrapper);

            const canvas = document.createElement('canvas');
            canvas.id = `chart-${userId}-sensor${i}`;
            chartWrapper.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: sensorLabels[`sensor${i}`],
                        data: chartData[userId][`sensor${i}`],
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
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    const date = new Date(context[0].raw.x);
                                    return date.toLocaleString();
                                },
                                label: function(context) {
                                    return `Moisture: ${context.raw.y.toFixed(2)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
}

// Function to update user list in drawer
function updateUserList(data) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    
    for (const userId in data) {
        const li = document.createElement('li');
        li.textContent = userIdMapping[userId];
        li.onclick = () => {
            updateCharts(processDataForCharts(data), userId);
            toggleDrawer();
        };
        userList.appendChild(li);
    }
}

// Function to toggle drawer
function toggleDrawer() {
    const drawer = document.querySelector('.drawer');
    const mainContent = document.querySelector('.main-content');
    drawer.classList.toggle('open');
    mainContent.style.marginLeft = drawer.classList.contains('open') ? '200px' : '50px';
}

// Function to convert data to CSV and download
function downloadCSV(data) {
    let csvContent = 'Timestamp,User ID,2 Day Watering,4 Day Watering,6 Day Watering,8 Day Watering,Control\n';

    for (const userId in data) {
        const readings = data[userId].readings;
        for (const timestamp in readings) {
            const reading = readings[timestamp];
            const [day, month, year, hour, minute] = timestamp.split('-');
            const formattedTimestamp = `20${year}-${month}-${day} ${hour}:${minute}`;
            const row = [
                formattedTimestamp,
                userIdMapping[userId],
                reading.sensor1,
                reading.sensor2,
                reading.sensor3,
                reading.sensor4,
                reading.sensor5
            ];
            csvContent += row.join(',') + '\n';
        }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'soil_moisture_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event listeners setup
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Setting up event listeners...");

    // Drawer toggle
    const drawerButton = document.querySelector('.drawer');
    drawerButton.addEventListener('click', (e) => {
        if (e.target.textContent.includes('☰')) {
            toggleDrawer();
        }
    });

    // Update charts button
    const updateButton = document.querySelector('.controls button');
    updateButton.addEventListener('click', async () => {
        try {
            await signInAnonymouslyFunc();
            allData = await fetchData();
            if (allData) {
                const chartData = processDataForCharts(allData);
                updateCharts(chartData);
                updateUserList(allData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Download CSV button
    const downloadButton = document.querySelector('.header button');
    downloadButton.addEventListener('click', async () => {
        try {
            await signInAnonymouslyFunc();
            if (!allData) {
                allData = await fetchData();
            }
            if (allData) {
                downloadCSV(allData);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Initial load
    try {
        await signInAnonymouslyFunc();
        allData = await fetchData();
        if (allData) {
            const chartData = processDataForCharts(allData);
            updateCharts(chartData);
            updateUserList(allData);
        }
    } catch (error) {
        console.error('Error during initial load:', error);
    }
});

// Auth state monitoring
onAuthStateChanged(auth, (user) => {
    const authStatus = document.querySelector('.auth-status');
    if (!authStatus) return;

    if (user) {
        console.log('User is signed in:', user.uid);
        authStatus.textContent = 'Connected to database';
        authStatus.style.color = '#2ecc71';
    } else {
        console.log('User is signed out');
        authStatus.textContent = 'Disconnected';
        authStatus.style.color = '#e74c3c';
    }
});