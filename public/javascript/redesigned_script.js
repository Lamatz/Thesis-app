// ===================================
// == MAP AND UI INITIALIZATION
// ===================================
var map = L.map('map', {
    maxBounds: [[4, 116], [21, 127]],
    maxBoundsViscosity: 1.0
}).setView([12.8797, 121.7740], 6);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Global variables to store state
let currentMarker = null;
let selectedLocation = { lat: null, lng: null, name: null };
let fetchedLocationData = { soil_type: null, slope: null };
let lastFetchedWeatherData = null;
let lastPredictionResult = { prediction: null, confidence: null };
let selectedPredictionDate = null;
let selectedPredictionTime = null; // NEW
let selectedForecastPeriod = { value: null, text: null };

// MODIFIED: Chart instances (now four)
let hourlyCumulativeChart = null;
let hourlyIntensityChart = null;
let dailyCumulativeChart = null;
let dailyIntensityChart = null;


// To get ID OF predict-btn for loading time
const predictBtn = document.getElementById("predict-btn");



// --- Soil Type Mapping (same as your original)
const soilTypeMapping = {
    "4413": { category: 3, label: "Clay Loam" }, "4424": { category: 2, label: "Loam" },
    "4465": { category: 2, label: "Loam" }, "4478": { category: 3, label: "Clay Loam" },
    "4503": { category: 1, label: "Sandy Loam" }, "4504": { category: 3, label: "Clay Loam" },
    "4517": { category: 1, label: "Sandy Loam" }, "4537": { category: 2, label: "Loam" },
    "4546": { category: 5, label: "Clay" }, "4564": { category: 1, label: "Sandy Loam" },
    "4578": { category: 3, label: "Clay Loam" }, "4582": { category: 5, label: "Clay" },
    "4589": { category: 5, label: "Clay" }, "Unknown": { category: 0, label: "Unknown" },
    "Error": { category: 0, label: "Error Fetching" }
};
function getSoilLabel(snum) { return (soilTypeMapping[snum] || soilTypeMapping["Unknown"]).label; }

// ===================================
// == CORE FUNCTIONS (Fetch, Update UI, etc.)
// ===================================

// MODIFIED: resetUI to clear new inputs and charts
function resetUI() {
    console.log("Resetting UI and all data.");
    document.getElementById("search-input").value = "";
    document.getElementById("suggestions").style.display = "none";
    document.getElementById("loc-lat").innerText = "N/A";
    document.getElementById("loc-lng").innerText = "N/A";
    document.getElementById("loc-name").innerText = "No location selected.";
    document.getElementById("date-picker").value = "";
    document.getElementById("time-picker").value = ""; // NEW
    document.getElementById("forecast-period").selectedIndex = 0;
    // Clear hidden inputs...
    const hiddenInputs = document.querySelectorAll('.visually-hidden input');
    hiddenInputs.forEach(input => input.value = "");
    if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
    selectedLocation = { lat: null, lng: null, name: null };
    fetchedLocationData = { soil_type: null, slope: null };
    lastFetchedWeatherData = null;
    lastPredictionResult = { prediction: null, confidence: null };
    selectedPredictionDate = null;
    selectedPredictionTime = null; // NEW
    selectedForecastPeriod = { value: null, text: null };
    hideAndClearReportSummary();
}


// Update the "Selected Location" card and other UI elements after a location is chosen
async function updateLocationInfo(lat, lng) {
    // --- 1. Store location, clear old data ---
    selectedLocation = { lat, lng, name: "Fetching..." };
    fetchedLocationData = { soil_type: null, slope: null };
    lastFetchedWeatherData = null;
    //hideAndClearReportSummary();

    // --- 2. Update UI immediately with "Fetching..." status ---
    document.getElementById("loc-lat").innerText = lat.toFixed(4);
    document.getElementById("loc-lng").innerText = lng.toFixed(4);
    document.getElementById("loc-name").innerText = "Fetching name...";

    // For The Loading Prediction Button------
    const originalButtonText = predictBtn.innerHTML; // Store original text/HTML
    predictBtn.disabled = true;
    predictBtn.innerHTML = 'Fetching Weather... <span class="spinner"></span>';
    // For The Loading Prediction Button------

    // --- 3. Place marker on map ---
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([lat, lng]).addTo(map);

    // --- 4. Fetch data from APIs in parallel ---
    const locationPromise = fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        .then(res => res.json());
    const dataPromise = fetch(`http://127.0.0.1:5000/get_location_data?lat=${lat}&lon=${lng}`)
        .then(res => res.json());

    try {
        const [locationData, siteData] = await Promise.all([locationPromise, dataPromise]);

        // --- 5. Process and store fetched data ---
        selectedLocation.name = locationData.display_name || "Unknown Location";

        if (siteData.error) throw new Error(siteData.error);
        fetchedLocationData = {
            soil_type_snum: siteData.soil_type,
            soil_type_label: getSoilLabel(siteData.soil_type),
            slope: siteData.slope
        };
        // Populate hidden inputs for prediction
        document.getElementById("slope").value = fetchedLocationData.slope;
        document.getElementById("soil-type").value = fetchedLocationData.soil_type_label;


        // --- 6. Update UI with final data ---
        document.getElementById("loc-name").innerText = selectedLocation.name;;
        currentMarker.bindPopup(`Location: <b>${selectedLocation.name}</b><br>Slope: <b>${fetchedLocationData.slope}</b><br>Soil: <b>${fetchedLocationData.soil_type_label}</b>`).openPopup();

        // For The Loading Prediction Button------
        predictBtn.disabled = false;
        predictBtn.innerHTML = originalButtonText;
        // For The Loading Prediction Button------




        // --- 7. Fetch weather if date is already selected ---
        const date = document.getElementById("date-picker").value;
        const time = document.getElementById("time-picker").value;
        if (date) {
            fetchWeatherData(lat, lng, date, time);
        }

    } catch (error) {
        console.error("Error updating location info:", error);
        alert("Could not fetch all data for this location. " + error.message);
        document.getElementById("loc-name").innerText = "Error fetching data.";
    }
}




// MODIFIED: fetchWeatherData to accept and send time
async function fetchWeatherData(lat, lon, date, time) {
    if (!lat || !lon || !date || !time) return;


    // --- ADD THIS ---
    // 1. Disable the button and show a loading state
    const originalButtonText = predictBtn.innerHTML; // Store original text/HTML
    predictBtn.disabled = true;
    predictBtn.innerHTML = 'Fetching Weather... <span class="spinner"></span>';
    // --- END ADD ---


    console.log(`Fetching weather for: ${lat}, ${lon}, on ${date} at ${time}`);
    try {
        const response = await fetch(`http://127.0.0.1:5000/get_weather?latitude=${lat}&longitude=${lon}&date=${date}&time=${time}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        lastFetchedWeatherData = data;
        selectedPredictionDate = date;
        selectedPredictionTime = time; // NEW

        // Populate hidden inputs (no change to logic, just sourcing from new backend response)
        document.getElementById("soil-moisture").value = data.soil_moisture?.toFixed(3) || "N/A";
        for (const key in data.cumulative_rainfall) {
            const id = `rainfall-${key.replace('_', '-')}`;
            if (document.getElementById(id)) document.getElementById(id).value = data.cumulative_rainfall[key].toFixed(4);
        }
        for (const key in data.rain_intensity) {
            const id = `rain-intensity-${key.replace('_', '-')}`;
            if (document.getElementById(id)) document.getElementById(id).value = data.rain_intensity[key].toFixed(4);
        }
        console.log("Weather data fetched and stored.", lastFetchedWeatherData);
    } catch (error) {
        console.error("Failed to fetch weather data:", error);
        alert("Error fetching weather data: " + error.message);
        lastFetchedWeatherData = null;
    } finally {
        // --- ADD THIS ---
        // 2. ALWAYS re-enable the button and restore its text when done
        predictBtn.disabled = false;
        // Restore the original text (e.g., "Predict"). If you just use text, you can set it directly.
        // Using `originalButtonText` is safer if you have icons or other HTML inside.
        predictBtn.innerHTML = originalButtonText;
        // Or simply: predictBtn.textContent = "Predict";
        // --- END ADD ---
    }
}

// ===================================
// == CORRECTED JAVASCRIPT FUNCTION
// ===================================

const chartForecastText = document.getElementsByClassName("chart-summary-text");

function populateReportSummary() {

    // --- 1. Validation ---
    if (!lastPredictionResult || !lastFetchedWeatherData) {
        alert("Cannot generate report: Critical data is missing. Please try the prediction again.");
        return;
    }

    // --- 2. Show the report section ---
    const reportSection = document.getElementById("report-summary-section");
    reportSection.style.display = "block";


    // --- 3. Populate all text fields ---
    document.getElementById("report-location-name").innerText = selectedLocation.name || "N/A";
    document.getElementById("report-coords").innerText = selectedLocation.lat ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}` : "N/A";
    document.getElementById("report-prediction-date").innerText = (selectedPredictionDate && selectedPredictionTime) ? `${selectedPredictionDate} at ${selectedPredictionTime}` : "N/A";
    document.getElementById("report-prediction").innerText = lastPredictionResult.prediction || "N/A";
    document.getElementById("report-confidence").innerText = lastPredictionResult.confidence || "N/A";
    document.getElementById("report-slope").innerText = fetchedLocationData.slope ?? "N/A";
    document.getElementById("report-soil-type").innerText = fetchedLocationData.soil_type_label || "N/A";
    document.getElementById("report-soil-moisture").innerText = lastFetchedWeatherData.soil_moisture?.toFixed(1) ?? "N/A";



    const selectedDate = datePicker.value;
    const selectedTime = timePicker.value;

    // --- 3.5 Add the Chart Forecast Summary Text ---
    const chartSummary = generateForecastSummaryString(
        selectedDate,
        selectedTime,
        12,                      // Report always shows past 12 hours
        'parenthetical'          // We want the format "(... - ...)"
    );

    for (const element of chartForecastText) {
        // Set the textContent for each individual span element in the collection
        element.textContent = chartSummary;
    }



    // --- 4. Destroy old charts ---
    // Your code for this is perfect. It prevents memory leaks and canvas conflicts.
    if (hourlyCumulativeChart) hourlyCumulativeChart.destroy();
    if (hourlyIntensityChart) hourlyIntensityChart.destroy();
    if (dailyCumulativeChart) dailyCumulativeChart.destroy();
    if (dailyIntensityChart) dailyIntensityChart.destroy();

    // --- 5. Generate all four new charts with FULL CONFIGURATIONS ---
    const hourlyData = lastFetchedWeatherData.hourly_chart_data || [];
    const dailyData = lastFetchedWeatherData.daily_chart_data || [];

    // Chart 1: Hourly Cumulative
    hourlyCumulativeChart = new Chart(document.getElementById('hourly-cumulative-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: hourlyData.map(d => d.hour),
            datasets: [{
                label: 'Cumulative Rainfall (mm)',
                data: hourlyData.map(d => d.cumulative),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                fill: true
            }]
        },
        // IMPROVEMENT: Add titles and more options for better readability
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Rainfall (mm)' } } },
            plugins: { title: { display: false } } // Title is in HTML H3
        }
    });

    // Chart 2: Hourly Intensity
    hourlyIntensityChart = new Chart(document.getElementById('hourly-intensity-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: hourlyData.map(d => d.hour),
            datasets: [{
                label: 'Intensity (mm/hr)',
                data: hourlyData.map(d => d.intensity),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)'
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Intensity (mm/hr)' } } },
            plugins: { title: { display: false } }
        }
    });

    // Chart 3: Daily Cumulative
    dailyCumulativeChart = new Chart(document.getElementById('daily-cumulative-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: dailyData.map(d => d.date),
            datasets: [{
                label: 'Cumulative Rainfall (mm)',
                data: dailyData.map(d => d.cumulative),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)'
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Rainfall (mm)' } } },
            plugins: { title: { display: false } }
        }
    });

    // Chart 4: Daily Intensity
    dailyIntensityChart = new Chart(document.getElementById('daily-intensity-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: dailyData.map(d => d.date),
            datasets: [{
                label: 'Avg. Intensity (mm/hr)',
                data: dailyData.map(d => d.intensity),
                backgroundColor: 'rgba(255, 206, 86, 0.5)',
                borderColor: 'rgba(255, 206, 86, 1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Intensity (mm/hr)' } } },
            plugins: { title: { display: false } }
        }
    });

    // --- 6. Scroll the report into view ---
    reportSection.scrollIntoView({ behavior: 'smooth' });
}


// MODIFIED: hideAndClearReportSummary to destroy all four charts
function hideAndClearReportSummary() {
    const reportSection = document.getElementById("report-summary-section");
    if (reportSection) {
        reportSection.style.display = "none";
        document.getElementById("report-detailed-description").value = "";
        if (hourlyCumulativeChart) hourlyCumulativeChart.destroy();
        if (hourlyIntensityChart) hourlyIntensityChart.destroy();
        if (dailyCumulativeChart) dailyCumulativeChart.destroy();
        if (dailyIntensityChart) dailyIntensityChart.destroy();
        hourlyCumulativeChart = hourlyIntensityChart = dailyCumulativeChart = dailyIntensityChart = null;
    }
}

// ===================================
// == EVENT LISTENERS
// ===================================


// I THINK THIS SNIPPET OF CODE IS USELESS MAYBE REMOVE IN THE FUTURE
// document.addEventListener('DOMContentLoaded', () => {
//     // --- Helper function to get a date in YYYY-MM-DD format for the local timezone ---
//     function toLocalISOString(date) {
//         const year = date.getFullYear();
//         // getMonth() is zero-based, so we add 1
//         let month = date.getMonth() + 1;
//         let day = date.getDate();

//         // Pad with a leading zero if needed
//         if (month < 10) {
//             month = '0' + month;
//         }
//         if (day < 10) {
//             day = '0' + day;
//         }

//         return `${year}-${month}-${day}`;
//     }

//     resetUI(); // Initialize the UI on load

//     // --- Restrict date picker using the local timezone ---
//     const datePicker = document.getElementById("date-picker");
//     const today = new Date();

//     // Set the minimum date to today (local time)
//     datePicker.min = toLocalISOString(today);

//     // Set the maximum date to 5 days from now
//     const maxDate = new Date();
//     maxDate.setDate(today.getDate() + 5);
//     datePicker.max = toLocalISOString(maxDate);
// });

// Map click event
map.on("click", (e) => {
    updateLocationInfo(e.latlng.lat, e.latlng.lng);
});

// ===================================
// == SEARCH FUNCTIONALITY (Corrected & Enhanced)
// ===================================

const searchInput = document.getElementById("search-input");
const suggestionsContainer = document.getElementById("suggestions");

// A dedicated, reusable function to fetch and display search suggestions
async function getSearchSuggestions(query) {
    if (!query || query.length < 3) {
        suggestionsContainer.innerHTML = "";
        suggestionsContainer.style.display = "none";
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/search_locations?query=${query}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        suggestionsContainer.innerHTML = ""; // Clear previous suggestions

        // Handle case where no suggestions are returned
        if (!data.suggestions || data.suggestions.length === 0) {
            const noResult = document.createElement("div");
            noResult.innerText = "No matching locations found.";
            noResult.className = "suggestion-item no-results"; // Add class for styling
            suggestionsContainer.appendChild(noResult);
            suggestionsContainer.style.display = "block";
            return;
        }

        // Create and append suggestion items
        data.suggestions.forEach(loc => {
            const item = document.createElement("div");
            item.className = "suggestion-item";
            item.innerText = loc.name;

            // When a suggestion is clicked...
            item.onclick = () => {
                searchInput.value = loc.name; // Set search box value
                suggestionsContainer.style.display = "none"; // Hide dropdown
                map.setView([loc.lat, loc.lon], 14); // Zoom to location

                // Call the main function to handle all data fetching and UI updates
                updateLocationInfo(parseFloat(loc.lat), parseFloat(loc.lon));
            };
            suggestionsContainer.appendChild(item);
        });

        suggestionsContainer.style.display = "block";

    } catch (error) {
        console.error("Error fetching search suggestions:", error);
        suggestionsContainer.innerHTML = `<div class="suggestion-item no-results">Error fetching suggestions.</div>`;
        suggestionsContainer.style.display = "block";
    }
}

// --- Event Listeners for Search ---

// 1. Listen for typing in the search box
searchInput.addEventListener("input", () => {
    getSearchSuggestions(searchInput.value.trim());
});

// 2. Listen for the 'Enter' key press
searchInput.addEventListener("keydown", (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent form submission
        // Hide suggestions and remove focus from the input
        suggestionsContainer.style.display = "none";
        searchInput.blur();
    }
});

// 3. Listen for a click on the search icon
document.getElementById('search-btn-icon').addEventListener('click', () => {
    // Manually trigger the search with the current input value
    getSearchSuggestions(searchInput.value.trim());
});

// 4. Hide suggestions when clicking anywhere else on the page
document.addEventListener("click", (e) => {
    // Check if the click was outside the search input and the suggestions container
    if (e.target !== searchInput && !suggestionsContainer.contains(e.target)) {
        suggestionsContainer.style.display = "none";
    }
});
// Hide suggestions when clicking outside
document.addEventListener("click", (e) => {
    if (!document.querySelector('.card-body').contains(e.target)) {
        document.getElementById("suggestions").style.display = "none";
    }
});
document.getElementById('search-btn-icon').addEventListener('click', () => searchInput.dispatchEvent(new Event('input')));
// ===================================
// == END OF SEARCH FUNCTIONALITY (Corrected & Enhanced)
// ===================================


// ===================================
// == "Forecast Setting" Input Variables
// ===================================
const forecastSelect = document.getElementById("forecast-period");
const datePicker = document.getElementById("date-picker");
const timePicker = document.getElementById("time-picker");
const summaryText = document.getElementById('forecast-summary-text');

// MODIFIED: Combined listener for Date and Time pickers
function handleDateTimeChange() {
    // const forecastSelect = document.getElementById("forecast-period");
    const date = datePicker.value;
    const time = timePicker.value;
    const forecastSelectText = forecastSelect.options[forecastSelect.selectedIndex].text;
    const forecastPeriodHours = parseInt(forecastSelectText, 10);
    
    console.log("DATE FORMAT: ", date);
    console.log("The data type of 'date' is:", typeof date);

    console.log("TIME FORMAT: ", time);
    console.log("The data type of 'time' is:", typeof time);



    updateSummaryText(date, time, forecastPeriodHours);

    if (selectedLocation.lat && date && time) {
        fetchWeatherData(selectedLocation.lat, selectedLocation.lng, date, time);
    } else if (date && time) {
        alert("Please select a location first.");
        datePicker.value = "";
        timePicker.value = "";
    }
}

datePicker.addEventListener("change", handleDateTimeChange);
timePicker.addEventListener("change", handleDateTimeChange);
forecastSelect.addEventListener("change", handleDateTimeChange);


function generateForecastSummaryString(date, time, forecastHours, formatType = 'sentence') {
    // Helper function to ensure two digits (e.g., 7 -> "07")
    const formatHour = (hour) => hour.toString().padStart(2, '0');

    const endDate = new Date(`${date}T${time}`);

    if (isNaN(endDate.getTime())) {
        return 'Please select a valid date and time.';
    }

    const startDate = new Date(endDate.getTime());
    startDate.setHours(startDate.getHours() - forecastHours);

    const dateOptions = { month: 'long', day: 'numeric' };

    const formattedEndDate = endDate.toLocaleDateString(undefined, dateOptions);
    const startTimeFormatted = `${formatHour(startDate.getHours())}:00`;
    const endTimeFormatted = `${formatHour(endDate.getHours())}:00`;

    // Check if the forecast crosses midnight
    const ifDifferentDay = startDate.getDate() !== endDate.getDate();

    if (formatType === 'parenthetical') {
        if (ifDifferentDay) {
            const formattedStartDate = startDate.toLocaleDateString(undefined, dateOptions);
            return `${startTimeFormatted}, ${formattedStartDate} - ${endTimeFormatted}, ${formattedEndDate}`;
        } else {
            return `${startTimeFormatted} - ${endTimeFormatted}, ${formattedEndDate}`;
        }
    } else { // Default to 'sentence' format
        if (ifDifferentDay) {
            const formattedStartDate = startDate.toLocaleDateString(undefined, dateOptions);
            return `Forecasting from ${startTimeFormatted} on ${formattedStartDate} to ${endTimeFormatted} on ${formattedEndDate}`;
        } else {
            return `Forecasting from ${startTimeFormatted} to ${endTimeFormatted} on ${formattedEndDate}`;
        }
    }
}


// This function's only job is to update the main UI summary text
function updateSummaryText(date, time, forecastHours) {
    // Call the generator to get the string in 'sentence' format
    const summary = generateForecastSummaryString(date, time, forecastHours);

    // Display it
    summaryText.textContent = summary;
}



// Predict button click
predictBtn.addEventListener("click", async () => {
    // --- 1. Validation ---
    const forecastSelect = document.getElementById("forecast-period");
    selectedForecastPeriod.value = forecastSelect.value;
    selectedForecastPeriod.text = forecastSelect.options[forecastSelect.selectedIndex].text;

    if (!selectedLocation.lat || !selectedPredictionDate || !selectedPredictionTime || !selectedForecastPeriod.value || !lastFetchedWeatherData) {
        alert("Validation Error: Please ensure a Location, a valid Date, Time, and Forecast Period are selected.");
        return;
    }

    // Your original model needs all 6 rainfall features. We still send them.
    const requestData = {
        soil_type: fetchedLocationData.soil_type_snum,
        slope: parseFloat(document.getElementById("slope").value),
        soil_moisture: parseFloat(document.getElementById("soil-moisture").value),

        "rainfall-3_hr": parseFloat(document.getElementById("rainfall-3-hr").value),
        "rainfall-6_hr": parseFloat(document.getElementById("rainfall-6-hr").value),
        "rainfall-12_hr": parseFloat(document.getElementById("rainfall-12-hr").value),

        "rain-intensity-3_hr": parseFloat(document.getElementById("rain-intensity-3-hr").value),
        "rain-intensity-6_hr": parseFloat(document.getElementById("rain-intensity-6-hr").value),
        "rain-intensity-12_hr": parseFloat(document.getElementById("rain-intensity-12-hr").value),
        "rainfall-1-day": parseFloat(document.getElementById("rainfall-1-day").value),
        "rainfall-3-day": parseFloat(document.getElementById("rainfall-3-day").value),
        "rainfall-5-day": parseFloat(document.getElementById("rainfall-5-day").value),
        "rain-intensity-1-day": parseFloat(document.getElementById("rain-intensity-1-day").value),
        "rain-intensity-3-day": parseFloat(document.getElementById("rain-intensity-3-day").value),
        "rain-intensity-5-day": parseFloat(document.getElementById("rain-intensity-5-day").value),
    };

    // Check for NaN values before sending
    for (const key in requestData) {
        if (isNaN(requestData[key])) {
            alert(`Validation Error: Invalid data for "${key}". Cannot predict.`);
            return;
        }
    }

    // --- 2. API Call ---
    console.log("Sending for prediction:", requestData);
    try {
        const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);

        lastPredictionResult = { prediction: result.prediction, confidence: result.confidence };

        // --- 3. Show Modal ---
        document.getElementById("modal-body").innerHTML = `<p><strong>Prediction:</strong> ${result.prediction}</p><p><strong>Confidence:</strong> ${result.confidence}</p>`;
        document.getElementById("prediction-modal").style.display = "flex";

    } catch (error) {
        console.error("Prediction failed:", error);
        alert("Prediction Error: " + error.message);
    }
});


// Report Summary button in modal
document.getElementById("report-btn").addEventListener("click", () => {
    document.getElementById("prediction-modal").style.display = "none";
    populateReportSummary();
    const reportSection = document.getElementById("report-summary-section");
    reportSection.style.display = "block";
    reportSection.scrollIntoView({ behavior: 'smooth' });
});

// Reset All button
document.getElementById("reset-btn").addEventListener("click", resetUI);



// ===================================
// == Automatic Report AI Generator
// ===================================

// --- NEW ---
// Add a new event listener for the report generator button
const reportBtn = document.getElementById("generate-report-btn");
const reportDiv = document.getElementById("report-detailed-description");


reportBtn.addEventListener("click", async () => {
    // You can copy the validation and data gathering logic from the other button
    // --- 1. Validation & Data Gathering ---
    const requestData = {
        // === Data from User Selection & Location Fetch ===
        soil_type: fetchedLocationData?.soil_type_label,
        slope: fetchedLocationData?.slope,
        prediction_date: (selectedPredictionDate && selectedPredictionTime)
            ? `${selectedPredictionDate} at ${selectedPredictionTime}`
            : "N/A",

        // === Data from Initial Prediction Model ===
        // We use optional chaining (?.) in case the first prediction hasn't been run yet.
        original_model_prediction: lastPredictionResult?.prediction ?? "Not run",
        original_model_confidence: lastPredictionResult?.confidence ?? "Not run",

        // === Data from Weather API Fetch ===
        soil_moisture: lastFetchedWeatherData?.soil_moisture,
        "rainfall-3_hr": lastFetchedWeatherData?.cumulative_rainfall?.['3_hr'],
        "rainfall-6_hr": lastFetchedWeatherData?.cumulative_rainfall?.['6_hr'],
        "rainfall-12_hr": lastFetchedWeatherData?.cumulative_rainfall?.['12_hr'],
        "rainfall-1-day": lastFetchedWeatherData?.cumulative_rainfall?.['1_day'],
        "rainfall-3-day": lastFetchedWeatherData?.cumulative_rainfall?.['3_day'],
        "rainfall-5-day": lastFetchedWeatherData?.cumulative_rainfall?.['5_day'],
        "rain-intensity-3_hr": lastFetchedWeatherData?.rain_intensity?.['3_hr'],
        "rain-intensity-6_hr": lastFetchedWeatherData?.rain_intensity?.['6_hr'],
        "rain-intensity-12_hr": lastFetchedWeatherData?.rain_intensity?.['12_hr'],
        "rain-intensity-1-day": lastFetchedWeatherData?.rain_intensity?.['1_day'],
        "rain-intensity-3-day": lastFetchedWeatherData?.rain_intensity?.['3_day'],
        "rain-intensity-5-day": lastFetchedWeatherData?.rain_intensity?.['5_day'],
    };

    console.log("Checking if it gathered the result: ", requestData);



    // --- 2. API Call with Streaming Logic ---
    const originalButtonText = reportBtn.innerHTML;
    let fullReportText = ""; // Variable to accumulate the full plain text


    try {
        // --- Setup UI for streaming ---
        reportBtn.disabled = true;
        reportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';
        reportDiv.value = ""; // Clear previous content
        // reportTextarea.placeholder = "AI is generating the report...";
        // reportTextarea.classList.add("streaming"); // For the blinking cursor effect
        reportDiv.setAttribute("aria-placeholder", "AI is generating the report...");
        reportDiv.style.whiteSpace = 'pre-wrap';



        const response = await fetch("http://127.0.0.1:5000/generate_report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            // Handle HTTP errors (like 500)
            const errorData = await response.json(); // Error responses are not streamed
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        // --- Read the stream from the response body ---
        const reader = response.body.getReader();
        const decoder = new TextDecoder(); // To convert bytes to text

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                // The stream is finished.
                break;
            }
            // Decode the chunk of data and append it to the textarea
            const textChunk = decoder.decode(value, { stream: true });
            // reportTextarea.value += textChunk;


            fullReportText += textChunk;

            reportDiv.textContent = fullReportText;
        }




        reportDiv.style.whiteSpace = 'normal';

        const reportHTML = marked.parse(fullReportText, { breaks: true });
        reportDiv.innerHTML = reportHTML; // Now, display the final rendered HTML

    } catch (error) {
        console.error("Report generation failed:", error);
        reportTextarea.value = `Error: ${error.message}`;
        alert("Report Generation Error: " + error.message);
    } finally {
        // --- Cleanup UI after streaming is done or an error occurs ---
        reportBtn.disabled = false;
        reportBtn.innerHTML = originalButtonText;
        // reportTextarea.classList.remove("streaming"); // Remove blinking cursor
        // reportTextarea.placeholder = "Summarize findings, observations, and recommendations here...";
        reportDiv.setAttribute("aria-placeholder", "Summarize findings, observations, and recommendations here...");
        reportDiv.style.whiteSpace = 'normal';
    }
});




// ===================================
// == SCROLL BUTTON
// ===================================

let scrollTopButton = document.getElementById("scrollTopBtn");

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function () {
    scrollFunction();
};

function scrollFunction() {
    // The threshold for showing the button (e.g., 100 pixels)
    const showButtonThreshold = 500;

    if (document.body.scrollTop > showButtonThreshold || document.documentElement.scrollTop > showButtonThreshold) {
        scrollTopButton.style.display = "block";
    } else {
        scrollTopButton.style.display = "none";
    }
}
// When the user clicks on the button, scroll to the top of the document smoothly
scrollTopButton.addEventListener("click", function () {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});


// ===================================
// == FOR PDF
// ===================================
document.getElementById("download-pdf-btn").addEventListener("click", function () {
    const { jsPDF } = window.jspdf;

    console.log("testing - 1");

    const reportSection = document.getElementById("report-content");
    // const descriptionText = document.getElementById("report-detailed-description").value || "N/A";
    const descriptionText = document.getElementById("report-detailed-description").innerText || "N/A";


    console.log("testing - 2");
    const pdf = new jsPDF();
    let y = 10;

    // Title
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Landslide Prediction Report", 105, y, { align: "center" });
    y += 10;

    // Get report values
    const locationName = document.getElementById("report-location-name").innerText;
    const coords = document.getElementById("report-coords").innerText;
    const date = document.getElementById("report-prediction-date").innerText;
    const prediction = document.getElementById("report-prediction").innerText;
    const confidence = document.getElementById("report-confidence").innerText;
    const slope = document.getElementById("report-slope").innerText;
    const soilType = document.getElementById("report-soil-type").innerText;
    const soilMoisture = document.getElementById("report-soil-moisture").innerText;

    // General Info
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Location: ${locationName}`, 10, y); y += 7;
    pdf.text(`Coordinates: ${coords}`, 10, y); y += 7;
    pdf.text(`Prediction Date: ${date}`, 10, y); y += 10;

    // Prediction
    pdf.setFont("helvetica", "bold");
    pdf.text("Prediction:", 10, y); y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Risk: ${prediction}`, 10, y); y += 7;
    pdf.text(`Confidence: ${confidence}`, 10, y); y += 10;

    // Environmental Variables
    pdf.setFont("helvetica", "bold");
    pdf.text("Environmental Variables:", 10, y); y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Slope: ${slope}`, 10, y); y += 7;
    pdf.text(`Soil Type: ${soilType}`, 10, y); y += 7;
    pdf.text(`Soil Moisture: ${soilMoisture}`, 10, y); y += 10;



    const chartIds = [
        { id: "hourly-cumulative-chart", label: "Past 12 Hours Cumulative Rainfall" },
        { id: "hourly-intensity-chart", label: "Past 12 Hours Rainfall Intensity" },
        { id: "daily-cumulative-chart", label: "Past 5 Days Cumulative Rainfall" },
        { id: "daily-intensity-chart", label: "Past 5 Days Average Intensity" }
    ];

    const chartsPerRow = 2;
    const chartWidth = 90;  // half of 180
    const chartHeight = 60;
    const marginX = 10;
    const spacingX = 10;
    const spacingY = 10;
    let chartX = marginX;
    let rowHeight = chartHeight + 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("Rainfall Analysis Charts:", 10, y);
    y += 6;

    chartIds.forEach((chartInfo, index) => {
        const canvas = document.getElementById(chartInfo.id);
        if (canvas) {
            const imgData = canvas.toDataURL("image/png", 1.0);

            // Add label above each chart
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.text(chartInfo.label, chartX, y);

            // Move down to draw the chart
            pdf.addImage(imgData, "PNG", chartX, y + 2, chartWidth, chartHeight);

            // Next column or new row
            if ((index + 1) % chartsPerRow === 0) {
                y += rowHeight + spacingY;
                chartX = marginX;
                if (y + chartHeight > 280) {
                    pdf.addPage();
                    y = 20;
                }
            } else {
                chartX += chartWidth + spacingX;
            }
        }
    });



    console.log("Prediction Result For Sending", lastPredictionResult);

    // Description
    pdf.setFont("helvetica", "bold");
    pdf.text("Detailed Description:", 10, y); y += 7;
    pdf.setFont("helvetica", "normal");


    console.log("testing 5");

    const lines = pdf.splitTextToSize(descriptionText, 180); // wrap text
    pdf.text(lines, 10, y);
    y += lines.length * 7;
    // Save the PDF
    pdf.save("Landslide_Prediction_Report.pdf");
});
