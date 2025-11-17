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
    document.getElementById("forecast-date").value = "";
    document.getElementById("hour-picker-input").value = "";
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
    summaryText.textContent = "";
    selectedDate = "";
    selectedTime = "";
    document.getElementById("report-detailed-description").value = " It works - 1";
    reportDiv.textContent = "";
    disablePickers();

    hideAndClearReportSummary();
}


// Update the "Selected Location" card and other UI elements after a location is chosen
async function updateLocationInfo(lat, lng) {
    // --- 1. Store location, clear old data ---
    selectedLocation = { lat, lng, name: "Fetching..." };
    fetchedLocationData = { soil_type: null, slope: null };
    lastFetchedWeatherData = null;
    //hideAndClearReportSummary();



    // *** ENSURE PICKERS ARE DISABLED DURING FETCH ***
    // disablePickers();



    // --- 2. Update UI immediately with "Fetching..." status ---
    document.getElementById("loc-lat").innerText = lat.toFixed(4);
    document.getElementById("loc-lng").innerText = lng.toFixed(4);
    document.getElementById("loc-name").innerText = "Fetching name...";

    predictBtnLoad();

    reportDiv.textContent = ``;

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
        document.getElementById("loc-name").innerText = selectedLocation.name;
        currentMarker.bindPopup(`Location: <b>${selectedLocation.name}</b><br>Slope: <b>${fetchedLocationData.slope}</b><br>Soil: <b>${fetchedLocationData.soil_type_label}</b>`).openPopup();


        predictBtnUnload();


        enablePickers();


        // --- 7. Fetch weather if date is already selected ---
        const date = selectedDate;
        const time = selectedTime;
        if (date && time) {
            fetchWeatherData(lat, lng, date, time);
        }

    } catch (error) {
        console.error("Error updating location info:", error);
        alert("Could not fetch all data for this location. " + error.message);
        document.getElementById("loc-name").innerText = "Error fetching data.";

        // *** ERROR! KEEP THE PICKERS DISABLED ***
        disablePickers();
    }
}

/**
 * Enables the date and time pickers and hides the overlay.
 */
const pickerOverlay = document.getElementById("picker-overlay");

function enablePickers() {
    datePicker.disabled = false;
    timePicker.disabled = false;
    forecastSelect.disabled = false;

    pickerOverlay.classList.add('hidden');
}
function disablePickers() {


    datePicker.disabled = true;
    timePicker.disabled = true;
    forecastSelect.disabled = true;
    // Also clear any values they might have had
    // console.log("disable picker test, 1");
    datePicker.value = '';
    timePicker.value = '';
    forecastSelect.value = 'none';
    pickerOverlay.classList.remove('hidden');
}
// Ensure pickers are disabled when the page first loads
document.addEventListener('DOMContentLoaded', disablePickers);




// MODIFIED: fetchWeatherData to accept and send time
async function fetchWeatherData(lat, lon, date, time) {
    if (!lat || !lon || !date || !time) return;


    // --- Button Load ---
    predictBtnLoad();
    // --- Button Load ---


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
        predictBtnUnload();
    }
}


// HELPER FUNCTIONS FOR CONVERTING SLOPE AND SOIL MOISTURE FOR USER READABILITY
// ========================

function convertSlope(slope) {
    const slopeMap = {
        1: "0-10 degrees",
        2: "10-20 degrees",
        3: "20-30 degrees",
        4: "30-40 degrees",
        5: "40-50 degrees",
        6: "above 50 degrees"
    };

    return slopeMap[slope] || "Invalid slope data";
}

function convertSoilMoisture(soil_moisture) {
    // Add a safety check for null/undefined/non-number values
    if (soil_moisture == null || typeof soil_moisture !== 'number') {
        return "N/A";
    }
    const percentage = soil_moisture * 100;
    return Math.floor(percentage) + "%";
}

// ========================

const chartForecastText = document.getElementsByClassName("chart-summary-text");

function populateReportSummary() {

    // --- 1. Validation ---
    if (!lastPredictionResult || !lastFetchedWeatherData) {
        alert("Cannot generate report: Critical data is missing. Please try the prediction again.");
        return;
    }

    // --- 2. Show the report section ---
    const reportSection = document.getElementById("report-sect");
    reportSection.style.display = "block";
    scrollTopButton.style.display = "block";
    // ADDED so that the report and the map are mutually exculsive
    document.getElementById("main-cont").style.display = "none";



    // --- 3. Populate all text fields ---
    document.getElementById("report-location-name").innerText = selectedLocation.name || "N/A";
    document.getElementById("report-coords").innerText = selectedLocation.lat ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}` : "N/A";
    document.getElementById("report-prediction-date").innerText = (selectedPredictionDate && selectedPredictionTime) ? `${selectedPredictionDate} at ${selectedPredictionTime}` : "N/A";
    document.getElementById("report-prediction").innerText = lastPredictionResult.prediction || "N/A";
    document.getElementById("report-confidence").innerText = lastPredictionResult.confidence || "N/A";
    document.getElementById("report-slope").innerText = convertSlope(fetchedLocationData.slope) ?? "N/A";
    document.getElementById("report-soil-type").innerText = fetchedLocationData.soil_type_label || "N/A";
    document.getElementById("report-soil-moisture").innerText = convertSoilMoisture(lastFetchedWeatherData.soil_moisture);



    // const selectedDate = datePicker.value;
    // const selectedTime = timePicker.value;

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
    const mainSection = document.getElementById("main-cont");
    if (reportSection) {
        reportSection.style.display = "none";
        mainSection.style.display = "flex"
        document.getElementById("report-detailed-description").value = "";
        if (hourlyCumulativeChart) hourlyCumulativeChart.destroy();
        if (hourlyIntensityChart) hourlyIntensityChart.destroy();
        if (dailyCumulativeChart) dailyCumulativeChart.destroy();
        if (dailyIntensityChart) dailyIntensityChart.destroy();
        hourlyCumulativeChart = hourlyIntensityChart = dailyCumulativeChart = dailyIntensityChart = null;
    }
}


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
// == END OF SEARCH FUNCTIONALITY 
// ===================================


// ===================================
// == "Forecast Setting" Input Variables
// ===================================
const forecastSelect = document.getElementById("forecast-period");
const datePicker = document.getElementById("forecast-date");
// const datePickerInput = document.getElementById("forecast-date");
const timePicker = document.getElementById("hour-picker-input");
const timePickerInput = document.getElementById("hour-picker");
const summaryText = document.getElementById('forecast-summary-text');

let selectedDate = "";
let selectedTime = "";

// MODIFIED: Combined listener for Date and Time pickers
function handleDateTimeChange() {

    const date = selectedDate;
    const time = selectedTime;
    const forecastSelectText = forecastSelect.options[forecastSelect.selectedIndex].text;
    const forecastPeriodHours = parseInt(forecastSelectText, 10);

    console.log("DATE FORMAT: ", date); // DATE FORMAT:  2025-07-21
    console.log("The data type of 'date' is:", typeof date); // String

    console.log("TIME FORMAT: ", time); // 21:00 OR 09:00
    console.log("The data type of 'time' is:", typeof time); // String



    updateSummaryText(date, time, forecastPeriodHours);

    if (selectedLocation.lat && date && time) {
        fetchWeatherData(selectedLocation.lat, selectedLocation.lng, date, time);
    } else if (date && time) {
        alert("Please select a location first.");
        datePicker.value = "";
        timePicker.value = "";
    }
}

datePicker.addEventListener("change", function (e) {
    console.log("DATE PICKER: ", datePicker);
    selectedDate = dateFormatter(e.detail.date, true);
    handleDateTimeChange();
});


timePickerInput.addEventListener("hide.td", function (e) {
    // --- BUTTON PAUSE---
    predictBtnUnload();
    // --- BUTTON PAUSE ---
    // forecastSelect.disabled = false;

    selectedTime = dateFormatter(e.detail.date, false);
    handleDateTimeChange();


});
timePickerInput.addEventListener("show.td", function (e) {
    // BUTTON UNPAUSE
    predictBtnLoad();
    // forecastSelect.disabled = true;
    // BUTTON UNPAUSE
});
forecastSelect.addEventListener("change", handleDateTimeChange);


function generateForecastSummaryString(date, time, forecastHours, formatType = 'sentence') {
    // Helper function to ensure two digits (e.g., 7 -> "07")
    const formatHour = (hour) => hour.toString().padStart(2, '0');

    console.log("Summary String date: ", date);
    // SAMPLE OUTPUT: Summary String date:  2025-6-24
    console.log("Summary String time: ", time);
    // SAMPLE OUTPUT: Summary String time:  20:00

    const endDate = new Date(`${date}T${time}`);

    console.log("testing endDate: ", endDate);
    // SAMPLE OUTPUT: Invalid Date

    if (isNaN(endDate.getTime())) {
        return 'Please select a date and time.';
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
    const summary = generateForecastSummaryString(date, time, forecastHours);
    summaryText.textContent = summary;
}



function dateFormatter(date, isdate) {
    if (isdate) {
        //  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();

        // 2. Pad the month and day with a leading zero to ensure "MM" and "DD" format
        const formattedMonth = String(month).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');

        return `${year}-${formattedMonth}-${formattedDay}`;
    } else {

        const hours = date.getHours(); // Returns 0-23
        const minutes = 0; // Returns 0-59

        const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        return formattedTime;
    }
}

const originalButtonTextTime = predictBtn.innerHTML;
const loadButtonTextTime = 'Fetching Weather... <span class="spinner"></span>';

function predictBtnUnload() {
    console.log("testing loading button", originalButtonTextTime);
    // --- BUTTON PAUSE---
    predictBtn.disabled = false;
    predictBtn.innerHTML = originalButtonTextTime;
    // --- BUTTON PAUSE ---
}

function predictBtnLoad() {
    // BUTTON PAUSE
    predictBtn.disabled = true;
    predictBtn.innerHTML = loadButtonTextTime;
    // BUTTON PAUSE
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



    console.log("Location Name test 1; ", selectedLocation.name);
    console.log("Latitude: ", selectedLocation.lat);
    console.log("Longitude: ", selectedLocation.lng);

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



    // =========================================================================
    // === NEW: Add the confirmation prompt at the very beginning ==============
    // =========================================================================
    const disclaimerMessage = `You are about to use an AI to generate a summary.

Please be aware that AI-generated content may contain inaccuracies and should be reviewed carefully.

Do you wish to proceed?`;

    // If the user clicks "Cancel", window.confirm() returns false.
    // The "!" inverts this to true, the `if` block runs, and we exit the function.
    if (!window.confirm(disclaimerMessage)) {
        console.log("User cancelled the report generation.");
        return; // <-- This is the crucial part. It stops the function from continuing.
    }

    // 1. Get today's date
    const today = new Date();

    // 2. Format it as YYYY-MM-DD
    // .toISOString() gives "YYYY-MM-DDTHH:mm:ss.sssZ", so we split at 'T' and take the first part.
    const date_today = today.toISOString().split('T')[0];


    let slopeReport;
    let slopeCheck = fetchedLocationData?.slope;

    if (slopeCheck === 1){
        slopeReport = "below 10 degerees"
    } else if (slopeCheck === 2){
        slopeReport = "between 10 to 20 degrees"
    } else if (slopeCheck === 3){
        slopeReport = "between 30 to 40 degrees"
    } else if (slopeCheck === 4) {
        slopeReport = "between 40 to 50 degrees"
    } else {
        slopeReport = "above 50 degrees"
    }

   let soil_moisture_percent = Math.round((lastFetchedWeatherData?.soil_moisture ?? 0) * 100);


    console.log("slope to check: ", slopeCheck);
    console.log("Slope REPORT: ", slopeReport);

    // You can copy the validation and data gathering logic from the other button
    // --- 1. Validation & Data Gathering ---
    const requestData = {
        // === Data from User Selection & Location Fetch ===
        soil_type: fetchedLocationData?.soil_type_label,
        slope: slopeReport,
        prediction_date: (selectedPredictionDate && selectedPredictionTime)
            ? `${selectedPredictionDate} at ${selectedPredictionTime}`
            : "N/A",
        location_name: selectedLocation.name,
        location_lat: selectedLocation.lat,
        location_lng: selectedLocation.lng,
        date_today,


        // === Data from Initial Prediction Model ===
        // We use optional chaining (?.) in case the first prediction hasn't been run yet.
        original_model_prediction: lastPredictionResult?.prediction ?? "Not run",
        original_model_confidence: lastPredictionResult?.confidence ?? "Not run",

        // === Data from Weather API Fetch ===
        soil_moisture: soil_moisture_percent,
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
        reportDiv.textContent = ""; // Clear previous content
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
// window.onscroll = function () {
//     scrollFunction();
// };

// function scrollFunction() {
//     // The threshold for showing the button (e.g., 100 pixels)
//     const showButtonThreshold = 500;

//     if (document.body.scrollTop > showButtonThreshold || document.documentElement.scrollTop > showButtonThreshold) {
//         scrollTopButton.style.display = "block";
//     } else {
//         scrollTopButton.style.display = "none";
//     }
// }


// When the user clicks on the button, scroll to the top of the document smoothly
scrollTopButton.addEventListener("click", function () {
    
    // In order to make the scroll smoother i have to find a way to first make the main content
    // show and then wait for the scroll to go to the top and then thats when you make the 
    //report section disappear
    
    document.getElementById("report-sect").style.display="none";
    document.getElementById("main-cont").style.display = "flex";
    
     setTimeout(function() {
        map.invalidateSize();
    }, 100); // A 100ms delay is usually safe and unnoticeable.

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});


// ===================================
// == FOR PDF
// ===================================
// document.getElementById("download-pdf-btn").addEventListener("click", function () {
//     const { jsPDF } = window.jspdf;

//     const reportSection = document.getElementById("report-content");
//     const descriptionText = document.getElementById("report-detailed-description").innerText || "N/A";

//     const pdf = new jsPDF();
//     let y = 10;

//     // Title
//     pdf.setFontSize(16);
//     pdf.setFont("helvetica", "bold");
//     pdf.text("Landslide Prediction Report", 105, y, { align: "center" });
//     y += 10;

//     // Get report values
//     const locationName = document.getElementById("report-location-name").innerText;
//     const coords = document.getElementById("report-coords").innerText;
//     const date = document.getElementById("report-prediction-date").innerText;
//     const prediction = document.getElementById("report-prediction").innerText;
//     const confidence = document.getElementById("report-confidence").innerText;
//     const slope = document.getElementById("report-slope").innerText;
//     const soilType = document.getElementById("report-soil-type").innerText;
//     const soilMoisture = document.getElementById("report-soil-moisture").innerText;

//     // General Info
//     pdf.setFontSize(12);
//     pdf.setFont("helvetica", "normal");
//     pdf.text(`Location: ${locationName}`, 10, y); y += 7;
//     pdf.text(`Coordinates: ${coords}`, 10, y); y += 7;
//     pdf.text(`Prediction Date: ${date}`, 10, y); y += 10;

//     // Prediction
//     pdf.setFont("helvetica", "bold");
//     pdf.text("Prediction:", 10, y); y += 7;
//     pdf.setFont("helvetica", "normal");
//     pdf.text(`Risk: ${prediction}`, 10, y); y += 7;
//     pdf.text(`Confidence: ${confidence}`, 10, y); y += 10;

//     // Environmental Variables
//     pdf.setFont("helvetica", "bold");
//     pdf.text("Environmental Variables:", 10, y); y += 7;
//     pdf.setFont("helvetica", "normal");
//     pdf.text(`Slope: ${slope}`, 10, y); y += 7;
//     pdf.text(`Soil Type: ${soilType}`, 10, y); y += 7;
//     pdf.text(`Soil Moisture: ${soilMoisture}`, 10, y); y += 10;



//     const chartIds = [
//         { id: "hourly-cumulative-chart", label: "Past 12 Hours Cumulative Rainfall" },
//         { id: "hourly-intensity-chart", label: "Past 12 Hours Rainfall Intensity" },
//         { id: "daily-cumulative-chart", label: "Past 5 Days Cumulative Rainfall" },
//         { id: "daily-intensity-chart", label: "Past 5 Days Average Intensity" }
//     ];

//     const chartsPerRow = 2;
//     const chartWidth = 90;  // half of 180
//     const chartHeight = 60;
//     const marginX = 10;
//     const spacingX = 10;
//     const spacingY = 10;
//     let chartX = marginX;
//     let rowHeight = chartHeight + 10;

//     pdf.setFont("helvetica", "bold");
//     pdf.text("Rainfall Analysis Charts:", 10, y);
//     y += 6;

//     chartIds.forEach((chartInfo, index) => {
//         const canvas = document.getElementById(chartInfo.id);
//         if (canvas) {
//             const imgData = canvas.toDataURL("image/png", 1.0);

//             // Add label above each chart
//             pdf.setFontSize(10);
//             pdf.setFont("helvetica", "normal");
//             pdf.text(chartInfo.label, chartX, y);

//             // Move down to draw the chart
//             pdf.addImage(imgData, "PNG", chartX, y + 2, chartWidth, chartHeight);

//             // Next column or new row
//             if ((index + 1) % chartsPerRow === 0) {
//                 y += rowHeight + spacingY;
//                 chartX = marginX;
//                 if (y + chartHeight > 280) {
//                     pdf.addPage();
//                     y = 20;
//                 }
//             } else {
//                 chartX += chartWidth + spacingX;
//             }
//         }
//     });



//     console.log("Prediction Result For Sending", lastPredictionResult);

//     // Description
//     pdf.setFont("helvetica", "bold");
//     pdf.text("Detailed Description:", 10, y); y += 7;
//     pdf.setFont("helvetica", "normal");


//     console.log("testing 1 2 3");

//     const lines = pdf.splitTextToSize(descriptionText, 180); // wrap text
//     const lineHeight = 7;
//     // pdf.text(lines, 10, y);
//     // y += lines.length * 7;

//     console.log("testing 1 ");
//     lines.forEach(line => {
//         console.log("testing 2 ");
//         if (y > 280) { // Check if we're near the bottom of the page
//             console.log("testing 5 ");
//             pdf.addPage();
//                console.log("testing 3 ");
//             y = 20; // Reset Y for new page
//                console.log("testing 4 ");
//         }
//         console.log("testing 6");
//         pdf.text(line, 10, y);
//         console.log("testing 7");
//         y += lineHeight;
//         console.log("testing 8");
//     });

//     console.log("testing 9");
//     // Save the PDF
//     pdf.save("Landslide_Prediction_Report.pdf");
// });



/**
 * Renders HTML content from a DOM element onto a jsPDF document.
 * This version correctly handles inline elements (<b>, <i>), block elements (<p>, <ul>),
 * semantic headings (<h2>, <h3>, <h4>), horizontal rules (<hr>), and automatic page breaks.
 *
 * @param {jsPDF} pdf The jsPDF instance.
 * @param {HTMLElement} element The source HTML element.
 * @param {object} options Configuration options.
 * @returns {number} The final Y position after rendering.
 */
function drawHtmlContent(pdf, element, options) {
    const settings = Object.assign({
        x: 10,
        y: 10,
        lineHeight: 7,
        maxWidth: 180,
        pageMargin: 15,
        listIndent: 5,
        bulletRadius: 1,
        bulletSpacing: 5
    }, options);

    let currentY = settings.y;
    const pageHeight = pdf.internal.pageSize.height;
    const pageMarginX = settings.x; // The absolute left margin of the page.
    const baseFontSize = 12;

    pdf.setFontSize(baseFontSize);

    // --- HELPER FUNCTIONS ---
    function checkPageBreak(neededHeight = settings.lineHeight) {
        if (currentY + neededHeight >= pageHeight - settings.pageMargin) {
            pdf.addPage();
            currentY = settings.pageMargin;
        }
    }

    // --- THE RECURSIVE RENDERER ---
    // The `lineStartX` parameter is key to handling indented wrapping correctly.
    function processNode(node, lineStartX, currentX, listCounter = 0) {
        const fontSize = pdf.getFontSize();

        switch (node.nodeName) {
            case '#text':
                const text = node.textContent.replace(/\s+/g, ' ').trim();
                if (!text) break;

                const words = text.split(' ');
                for (const word of words) {
                    const wordWidth = pdf.getTextWidth(word);
                    // Check if word fits on the current line. Use lineStartX for the boundary.
                    if (currentX > lineStartX && (currentX + wordWidth > lineStartX + settings.maxWidth)) {
                        currentY += settings.lineHeight;
                        checkPageBreak();
                        currentX = lineStartX; // Wrap to the start of the CURRENT line (which could be indented)
                    }
                    pdf.text(word, currentX, currentY);
                    currentX += wordWidth + pdf.getTextWidth(' ');
                }
                break;

            case 'P':
            case 'DIV':
                currentY += settings.lineHeight; // Add space before a new paragraph
                checkPageBreak();
                // A paragraph always starts at the page margin.
                currentX = pageMarginX;
                Array.from(node.childNodes).forEach(child => {
                    currentX = processNode(child, pageMarginX, currentX, listCounter);
                });
                currentY += settings.lineHeight / 2; // Add a smaller space after
                break;

            case 'H2':
            case 'H3':
            case 'H4':
                const headingSizes = { H2: 16, H3: 14, H4: 12 };
                const headingSize = headingSizes[node.nodeName];

                currentY += settings.lineHeight * 1.5;
                checkPageBreak();

                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(headingSize);

                currentX = pageMarginX;
                Array.from(node.childNodes).forEach(child => {
                    currentX = processNode(child, pageMarginX, currentX, listCounter);
                });

                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(baseFontSize);
                currentY += settings.lineHeight;
                break;

            case 'HR':
                currentY += settings.lineHeight;
                checkPageBreak();
                pdf.setDrawColor(180, 180, 180);
                pdf.line(pageMarginX, currentY, pageMarginX + settings.maxWidth, currentY);
                currentY += settings.lineHeight * 1.5;
                break;

            case 'STRONG':
            case 'B':
                pdf.setFont(undefined, 'bold');
                Array.from(node.childNodes).forEach(child => {
                    currentX = processNode(child, lineStartX, currentX, listCounter);
                });
                pdf.setFont(undefined, 'normal');
                break;

            case 'EM':
            case 'I':
                pdf.setFont(undefined, 'italic');
                Array.from(node.childNodes).forEach(child => {
                    currentX = processNode(child, lineStartX, currentX, listCounter);
                });
                pdf.setFont(undefined, 'normal');
                break;

            case 'UL':
            case 'OL':
                currentY += settings.lineHeight / 2;
                checkPageBreak();
                currentX = pageMarginX;

                const isOrdered = node.nodeName === 'OL';
                let counter = 1;
                Array.from(node.childNodes).forEach(child => {
                    if (child.nodeName === 'LI') {
                        // The processNode call for LI will handle its own line break and positioning
                        processNode(child, pageMarginX, currentX, isOrdered ? counter++ : 0);
                    }
                });
                currentY += settings.lineHeight / 2;
                break;

            // ===== FIX WAS HERE =====
            case 'LI':
                currentY += settings.lineHeight; // Start the LI on a new line
                checkPageBreak();

                let bulletX = lineStartX + settings.listIndent; // Indent from the line's start

                // Draw bullet or number
                if (listCounter > 0) { // Ordered list
                    const numberText = `${listCounter}.`;
                    pdf.text(numberText, bulletX, currentY);
                    bulletX += pdf.getTextWidth(numberText);
                } else { // Unordered list
                    pdf.circle(bulletX + settings.bulletRadius, currentY - (fontSize / 4), settings.bulletRadius, 'F');
                    bulletX += settings.bulletRadius * 2;
                }

                // Define the starting X for the content of this list item. This will be our new line start.
                let liContentStartX = bulletX + settings.bulletSpacing;
                let liCurrentX = liContentStartX;

                // Process the children of the LI, telling them their line starts at the indented position
                Array.from(node.childNodes).forEach(child => {
                    liCurrentX = processNode(child, liContentStartX, liCurrentX, listCounter);
                });

                // No need to restore anything, as we didn't modify shared variables.
                // The currentX is managed internally and returned.
                currentX = liCurrentX; // Update the outer currentX if needed, though often not necessary here.
                break;

            case 'BR':
                currentY += settings.lineHeight;
                checkPageBreak();
                currentX = lineStartX; // Go to the start of the current line (which could be indented)
                break;

            default:
                Array.from(node.childNodes).forEach(child => {
                    currentX = processNode(child, lineStartX, currentX, listCounter);
                });
                break;
        }
        return currentX;
    }

    // Initial call to start the process
    processNode(element, settings.x, settings.x);

    return currentY; // This will now be reached!
}

// =======================================================================
// == PART 2: Your Modified PDF Download Event Listener
// =======================================================================
document.getElementById("download-pdf-btn").addEventListener("click", function () {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    let y = 10;

    // --- Section 1: Title (No Changes) ---
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Landslide Prediction Report", 105, y, { align: "center" });
    y += 10;

    // --- Section 2: General Info & Prediction (No Changes) ---
    const locationName = document.getElementById("report-location-name").innerText;
    const coords = document.getElementById("report-coords").innerText;
    const date = document.getElementById("report-prediction-date").innerText;
    const prediction = document.getElementById("report-prediction").innerText;
    const confidence = document.getElementById("report-confidence").innerText;
    const slope = document.getElementById("report-slope").innerText;
    const soilType = document.getElementById("report-soil-type").innerText;
    const soilMoisture = document.getElementById("report-soil-moisture").innerText;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Location: ${locationName}`, 10, y); y += 7;
    pdf.text(`Coordinates: ${coords}`, 10, y); y += 7;
    pdf.text(`Prediction Date: ${date}`, 10, y); y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("Prediction:", 10, y); y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Risk: ${prediction}`, 10, y); y += 7;
    pdf.text(`Confidence: ${confidence}`, 10, y); y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("Environmental Variables:", 10, y); y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Slope: ${slope}`, 10, y); y += 7;
    pdf.text(`Soil Type: ${soilType}`, 10, y); y += 7;
    pdf.text(`Soil Moisture: ${soilMoisture}`, 10, y); y += 10;

    // --- Section 3: Charts (No Changes) ---
    const chartIds = [
        { id: "hourly-cumulative-chart", label: "Past 12 Hours Cumulative Rainfall" },
        { id: "hourly-intensity-chart", label: "Past 12 Hours Rainfall Intensity" },
        { id: "daily-cumulative-chart", label: "Past 5 Days Cumulative Rainfall" },
        { id: "daily-intensity-chart", label: "Past 5 Days Average Intensity" }
    ];

    const chartsPerRow = 2;
    const chartWidth = 90;
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
            if (y + rowHeight > 280) { // Check for page break before drawing a new row
                pdf.addPage();
                y = 20;
            }

            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.text(chartInfo.label, chartX, y);
            pdf.addImage(imgData, "PNG", chartX, y + 2, chartWidth, chartHeight);

            if ((index + 1) % chartsPerRow === 0) {
                y += rowHeight + spacingY;
                chartX = marginX;
            } else {
                chartX += chartWidth + spacingX;
            }
        }
    });
    // Ensure 'y' is set correctly after the last row of charts if it wasn't a full row
    if (chartIds.length % chartsPerRow !== 0) {
        y += rowHeight + spacingY;
    }


    // --- Section 4: Detailed Description (THIS IS THE NEW, IMPROVED PART) ---

    // Check if we need to start this section on a new page
    if (y + 20 > pdf.internal.pageSize.height - 15) {
        pdf.addPage();
        y = 15; // Start at top margin
    }

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Detailed Description:", 10, y);
    y += 10;

    // Get the element containing the rich HTML content
    const descriptionElement = document.getElementById("report-detailed-description");

    // Call our powerful renderer function to draw the rich text
    // It will handle all formatting and page breaks automatically.
    drawHtmlContent(pdf, descriptionElement, {
        x: 10,
        y: y, // Start where the previous content left off
        maxWidth: 180,
        lineHeight: 7
    });


    // --- Section 5: Save the PDF (No Changes) ---
    pdf.save("Landslide_Prediction_Report.pdf");
});




// document.getElementById('generate-report-btn').addEventListener('click', function () {
//     const disclaimerMessage = `You are about to use an AI to generate a summary.

// Please be aware that AI-generated content may contain inaccuracies and should be reviewed carefully.

// Do you wish to proceed?`;

//     // The confirm() function shows a dialog and returns true (if OK) or false (if Cancel).
//     if (window.confirm(disclaimerMessage)) {
//         // --- THIS IS WHERE YOUR AI LOGIC GOES ---
//         console.log('User confirmed. Starting AI report generation...');

//         // Put your AI generation code here.
//         // For demonstration:
//         // alert("Generating report...");

//     } else {
//         // User clicked "Cancel"
//         console.log('User cancelled the AI report generation.');
//     }
// });