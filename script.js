// First, the HTML structure should be updated to include an ul element:
const drawerHtml = `
<div class="drawer">
    <button id="toggleDrawer">☰</button>
    <h2>User IDs</h2>
    <ul id="userList"></ul>
</div>
`;

// Add this mapping at the top of your file
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

// Modified updateUserList function
function updateUserList(data) {
    // Find the container that holds the user IDs
    const userListContainer = document.querySelector('.drawer');
    if (!userListContainer) {
        console.error('Drawer container not found');
        return;
    }

    // Clear existing content
    const existingHeading = userListContainer.querySelector('h2');
    if (existingHeading) {
        existingHeading.textContent = 'Box Numbers';  // Update the heading
    }

    // Create or get the userList element
    let userList = userListContainer.querySelector('ul');
    if (!userList) {
        userList = document.createElement('ul');
        userList.id = 'userList';
        userListContainer.appendChild(userList);
    }
    userList.innerHTML = '';

    // Sort users by box number
    const sortedUsers = Object.keys(data).sort((a, b) => {
        const boxA = parseInt(userIdToBox[a]?.split(' ')[1]) || Infinity;
        const boxB = parseInt(userIdToBox[b]?.split(' ')[1]) || Infinity;
        return boxA - boxB;
    });

    // Add each user to the list
    for (const userId of sortedUsers) {
        const li = document.createElement('li');
        const boxNumber = userIdToBox[userId] || userId;
        li.textContent = boxNumber;
        li.style.cursor = 'pointer';
        li.onclick = () => {
            updateCharts(processDataForCharts(data), userId);
            toggleDrawer();
        };
        userList.appendChild(li);
    }
}

// Ensure this is added to your DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM content loaded, initializing...");
    
    try {
        await signInAnonymouslyFunc();
        allData = await fetchData();
        if (allData) {
            console.log("Data fetched, updating user list...");
            updateUserList(allData); // Make sure this is called
            const chartData = processDataForCharts(allData);
            updateCharts(chartData);
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});