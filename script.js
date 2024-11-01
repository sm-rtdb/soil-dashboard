// Add this mapping object at the top of your script
const sensorLabels = {
    'sensor1': '2 Day Watering',
    'sensor2': '4 Day Watering',
    'sensor3': '6 Day Watering',
    'sensor4': '7 Day Watering',
    'sensor5': 'Control'
};

// Modified getColor function remains the same
function getColor(sensorIndex) {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
    return colors[sensorIndex - 1] || '#000000';
}

// Modified updateCharts function with new labels
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
                            display: false
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

// Modified convertToCSV function with new headers
function convertToCSV(data) {
    const headers = [
        'Timestamp', 
        'User ID', 
        '2 Day Watering', 
        '4 Day Watering', 
        '6 Day Watering', 
        '7 Day Watering', 
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