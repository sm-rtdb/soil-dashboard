// Add this mapping at the top of your file, after the firebaseConfig
const userIdToBox = {
    'lb0NH2Pl7AQOjjFyxi94kMkZ2YB3': 'Box 1',
    '6LWt9fPF3gWtY2Wu2AdRQk41TF43': 'Box 2',
    'Xbnl5dadNoXiTVefhPfoq6e8w3D3': 'Box 3',
    'zCLIFfSHaYaHXpGTNytbnZdYlFH2': 'Box 4',
    'oGjSNfSbqWfVYyvdqdm10i8vmry2': 'Box 5',
    'yOwqoSHy2lWZIrwXk7bNZkVQdD62': 'Box 6',
    'li8FvgAgJ5dj3vqsjwIGJiZUoR52': 'Box 7',
    'x71jKqGf3ZOrpuBNb3PqXhQxY5n2': 'Box 8'
};

// Modify the updateCharts function
function updateCharts(chartData, selectedUserId = null) {
    console.log("Updating charts...");
    const chartsContainer = document.getElementById('chartsContainer');
    chartsContainer.innerHTML = ''; // Clear existing charts

    const users = selectedUserId ? [selectedUserId] : Object.keys(chartData);

    for (const userId of users) {
        const userContainer = document.createElement('div');
        userContainer.className = 'user-container';
        const boxNumber = userIdToBox[userId] || userId; // Fallback to userId if not in mapping
        userContainer.innerHTML = `<h2>${boxNumber}</h2>`; // Display box number instead of userId
        chartsContainer.appendChild(userContainer);

        // Rest of the chart creation code remains the same
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

// Modify the updateUserList function
function updateUserList(data) {
    const userList = document.getElementById('userList');
    if (!userList) {
        console.error('User list element not found');
        return;
    }
    userList.innerHTML = '';
    
    // Sort users by box number
    const sortedUsers = Object.keys(data).sort((a, b) => {
        const boxA = parseInt(userIdToBox[a]?.split(' ')[1]) || Infinity;
        const boxB = parseInt(userIdToBox[b]?.split(' ')[1]) || Infinity;
        return boxA - boxB;
    });

    for (const userId of sortedUsers) {
        const li = document.createElement('li');
        const boxNumber = userIdToBox[userId] || userId; // Fallback to userId if not in mapping
        li.textContent = boxNumber;
        li.onclick = () => {
            updateCharts(processDataForCharts(data), userId);
            toggleDrawer(); // Close drawer after selection
        };
        userList.appendChild(li);
    }
}

// Modify the convertToCSV function to use box numbers
function convertToCSV(data) {
    const headers = [
        'Timestamp', 
        'Box Number', 
        '2 Day Watering', 
        '4 Day Watering', 
        '6 Day Watering', 
        '8 Day Watering', 
        'Control'
    ];
    let csvContent = headers.join(',') + '\n';

    for (const userId in data) {
        const readings = data[userId].readings;
        const boxNumber = userIdToBox[userId] || userId; // Fallback to userId if not in mapping
        
        for (const timestamp in readings) {
            const reading = readings[timestamp];
            const [day, month, year, hour, minute] = timestamp.split('-');
            const formattedTimestamp = `${year}-${month}-${day} ${hour}:${minute}`;
            const row = [
                formattedTimestamp,
                boxNumber,
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