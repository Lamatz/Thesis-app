document.addEventListener('DOMContentLoaded', function () {


    // --- CHART & MAP INITIALIZATION ---
    let map;
    let allData = []; // To store CSV data
    let geojsonData = { type: 'FeatureCollection', features: [] }; // For Mapbox

    let rawCsvData = [];

    let selectedYear = null;
    let selectedMonth = null;

    mapboxgl.accessToken = 'pk.eyJ1IjoibGFtYXR6IiwiYSI6ImNtZDczb3pyNDA1am8ya3M4czB3bjVocXIifQ.tNJchBN53I2HcuIGXJMmTQ';
    const philippinesBounds = [[116.0, 4.0], [127.0, 21.0]];

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/lamatz/cmcvi5j5g00g601sr0rva51xp', // <-- e.g., 'mapbox://styles/mapbox/streets-v12'
        center: [121.7740, 12.8797],
        zoom: 5,
        maxBounds: philippinesBounds,
        antialias: true
    });

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());

    map.on('load', () => {
        // Add the GeoJSON source for landslide points
        map.addSource('landslide-points', {
            type: 'geojson',
            data: geojsonData
        });

        // --- MODIFICATION START: Update Map Layer with Dynamic Coloring ---
        // The 'circle-color' is now a 'step' expression.
        // It checks the 'year' property of each point and assigns a color based on its value.
        // This makes recent landslides appear in "hotter" colors (red) and older ones in cooler colors.
        map.addLayer({
            id: 'landslide-layer',
            type: 'circle',
            source: 'landslide-points',
            paint: {
                'circle-radius': 6,
                'circle-color': [
                    'step',
                    ['to-number', ['get', 'year']], // Use the 'year' property we'll add to the data
                    '#aaaaaa',   // Default color for landslides before 2014 or with no date
                    2014, '#FDB813', // Yellow for landslides from 2014-2018
                    2019, '#F26522', // Orange for landslides from 2019-2021
                    2022, '#D93B24', // Orange-Red for landslides from 2022-2023
                    2024, '#B30000'  // Bright Red for landslides in 2024
                ],
                'circle-stroke-color': 'white',
                'circle-stroke-width': 1,
                'circle-opacity': 0.8
            }
        });
        // --- MODIFICATION END ---


        // Add the layer to visualize the points
        // map.addLayer({
        //     id: 'landslide-layer',
        //     type: 'circle',
        //     source: 'landslide-points',
        //     paint: {
        //         'circle-radius': 6,
        //         'circle-color': '#FF4136',
        //         'circle-stroke-color': 'white',
        //         'circle-stroke-width': 1,
        //         'circle-opacity': 0.8
        //     }
        // });

        // Create a popup, but don't add it to the map yet.
        const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
        });

        map.on('mouseenter', 'landslide-layer', (e) => {
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';

            const coordinates = e.features[0].geometry.coordinates.slice();
            // const region = e.features[0].properties.region;


            // --- MODIFICATION START: Enhance Popup with Date Information ---
            // Get all properties from the feature
            const properties = e.features[0].properties;
            const region = properties.region;
            const date = properties.date; // Get the date property we added
            // --- MODIFICATION END ---


            // Ensure that if the map is zoomed out such that multiple
            // copies of the feature are visible, the popup appears
            // over the copy being pointed to.
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            // --- MODIFICATION START: Update Popup HTML ---
            // Populate the popup with both region and date
            popup.setLngLat(coordinates).setHTML(`<strong>Region:</strong> ${region}<br><strong>Date:</strong> ${date}`).addTo(map);
            // --- MODIFICATION END ---
        });

        map.on('mouseleave', 'landslide-layer', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });

    });

    // --- Chart Data (static part for examples) ---
    // const allDataa = {
    //     labels: ['Region I - Ilocos Region', 'Region II - Cagayan Valley', 'Region III - Central Luzon', 'Region IV-A - CALABARZON', 'Region IV-B - MIMAROPA', 'Region V - Bicol Region', 'Region VI - Western Visayas', 'Region VII - Central Visayas', 'Region VIII - Eastern Visayas', 'Region IX - Zamboanga Peninsula', 'Region X - Northern Mindanao', 'Region XI - Davao Region', 'Region XII - SOCCSKSARGEN', 'Region XIII - Caraga', 'NCR - National Capital Region', 'CAR - Cordillera Administrative Region', 'BARMM - Bangsamoro Autonomous Region in Muslim Mindanao'],
    //     datasets: [{ label: 'Alerts Issued', data: [10, 15, 12, 8, 13, 7, 9, 14, 6, 11, 10, 13, 15, 12, 14, 9, 16], backgroundColor: '#007BFF' }, { label: 'Actual Landslides', data: [8, 16, 10, 12, 9, 10, 8, 13, 7, 15, 14, 11, 9, 10, 13, 8, 12], backgroundColor: '#FF4136' }]
    // };
    // const regionMonthlyData = { 'Region I - Ilocos Region': [3, 5, 12, 20, 35, 42, 50, 45, 30, 15, 8, 4], 'Region II - Cagayan Valley': [2, 4, 8, 15, 25, 30, 38, 35, 25, 12, 6, 3], 'Region III - Central Luzon': [1, 3, 6, 10, 18, 25, 30, 28, 20, 10, 5, 2], 'Region IV-A - CALABARZON': [4, 6, 10, 18, 28, 35, 40, 38, 25, 14, 7, 3], 'Region IV-B - MIMAROPA': [2, 3, 7, 12, 22, 30, 34, 32, 20, 9, 4, 2], 'Region V - Bicol Region': [3, 5, 9, 16, 26, 33, 37, 35, 22, 11, 6, 3], 'Region VI - Western Visayas': [2, 4, 6, 14, 24, 28, 32, 31, 19, 10, 5, 2], 'Region VII - Central Visayas': [3, 5, 8, 13, 21, 27, 29, 28, 18, 9, 4, 2], 'Region VIII - Eastern Visayas': [2, 4, 7, 11, 20, 26, 30, 29, 17, 8, 4, 1], 'Region IX - Zamboanga Peninsula': [1, 3, 5, 10, 18, 24, 28, 27, 16, 7, 3, 1], 'Region X - Northern Mindanao': [2, 4, 6, 12, 20, 25, 27, 26, 15, 7, 3, 1], 'Region XI - Davao Region': [2, 5, 7, 13, 22, 28, 30, 29, 18, 8, 4, 2], 'Region XII - SOCCSKSARGEN': [1, 3, 5, 11, 19, 24, 26, 25, 14, 6, 2, 1], 'Region XIII - Caraga': [2, 4, 6, 12, 21, 27, 29, 28, 17, 8, 3, 1], 'NCR - National Capital Region': [1, 2, 4, 8, 15, 20, 22, 21, 12, 6, 3, 1], 'CAR - Cordillera Administrative Region': [3, 6, 9, 14, 23, 29, 33, 31, 19, 10, 5, 2], 'BARMM - Bangsamoro Autonomous Region in Muslim Mindanao': [2, 4, 6, 10, 18, 22, 25, 24, 14, 6, 3, 1] };

    // --- Chart Instantiation ---
    // const alertsChart = new Chart(document.getElementById('structureChart').getContext('2d'), { type: 'bar', data: { labels: [], datasets: [{ label: 'Alerts Issued', data: [0], backgroundColor: '#007BFF' }, { label: 'Actual Landslides', data: [0], backgroundColor: '#FF4136' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } } });
    const historyChart = new Chart(document.getElementById('roadsChart').getContext('2d'), {
        type: 'bar', data: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], datasets: [{ label: 'Landslides', data: [], backgroundColor: '#E67300' }] }, options: {
            interaction: {
                mode: 'index', // Find items by their x-axis index (the 'column').
                intersect: false // Don't require the mouse to physically touch the bar.
            }, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: false, text: 'History of Landslides (Monthly)' } },
            scales: { y: { beginAtZero: true } },


            // When the mouse moves over the chart
            onHover: (event, chartElement) => {
                // 'native' gives us the original browser event
                const canvas = event.native.target;
                if (chartElement.length) {
                    // If the mouse is over a bar's column, change to pointer
                    canvas.style.cursor = 'pointer';
                } else {
                    // Otherwise, use the default cursor
                    canvas.style.cursor = 'default';
                }
            },

            // --- ADD THIS ONCLICK HANDLER ---
            onClick: (e) => {
                const points = historyChart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, true);
                if (points.length) {
                    const firstPoint = points[0];
                    const label = historyChart.data.labels[firstPoint.index]; // This will be the month, e.g., "Jan"

                    // This functionality is currently not fully supported by the data structure
                    // But we set up the handler for future enhancement.
                    // alert(`Month filtering is not fully implemented yet. You clicked ${label}.`);

                    // Toggle selection
                    selectedMonth = selectedMonth === label ? null : label;
                    selectedYear = null; // Clear year filter when month is clicked

                    updateAllVisuals(); // Re-render everything
                }
            }
        }
    });


    const historyChartYearly = new Chart(document.getElementById('structureChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: [], // Years will go here
            datasets: [{
                label: 'Landslides per Year',
                data: [], // Yearly counts will go here
                backgroundColor: '#4BC0C0' // A different color for the new chart
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index', // Find items by their x-axis index (the 'column').
                intersect: false // Don't require the mouse to physically touch the bar.
            },
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0 // Ensure whole numbers for counts
                    }
                }
            },

            // When the mouse moves over the chart
            onHover: (event, chartElement) => {
                // 'native' gives us the original browser event
                const canvas = event.native.target;
                if (chartElement.length) {
                    // If the mouse is over a bar's column, change to pointer
                    canvas.style.cursor = 'pointer';
                } else {
                    // Otherwise, use the default cursor
                    canvas.style.cursor = 'default';
                }
            },

            // --- ADD THIS ONCLICK HANDLER ---
            onClick: (e) => {
                const points = historyChartYearly.getElementsAtEventForMode(e, 'nearest', { intersect: false }, true);
                if (points.length) {
                    const firstPoint = points[0];
                    const label = historyChartYearly.data.labels[firstPoint.index]; // This will be the year, e.g., "2022"

                    // Toggle selection
                    selectedYear = selectedYear === label ? null : label;
                    selectedMonth = null; // Clear month filter when year is clicked

                    updateAllVisuals(); // Re-render everything
                }
            }


        }
    });
    let agriChart; // Will be created after data loads


    let monthlyCountsByRegion = {};
    let yearlyCountsByRegion = {};
    let invalidRowsCount = 0;

    // --- DATA LOADING & PROCESSING (DEBUGGING VERSION) ---
    console.log("Starting Papa.parse for complete_landslide_1.csv...");
    Papa.parse("../csv/complete_landslide_1.csv", {
        download: true,
        header: true,
        complete: function (results) {
            console.log("1. Papa.parse complete. Raw results:", results);

            rawCsvData = results.data; // <-- ADD THIS LINE to save the data

            // Check if data is empty or has issues
            if (!results.data || results.data.length === 0) {
                console.error("CSV parsing resulted in no data. Check the CSV file and its structure.");
                return; // Stop execution if there's no data
            }

            // --- Initialize all data structures we need to build ---
            const geojsonFeatures = [];
            const regionCounts = {};
            let validMapDataRowCount = 0;

            // --- Process all data in a SINGLE LOOP ---
            console.log("2. Starting combined data processing loop...");
            results.data.forEach(row => {
                // Skip empty rows which Papa.parse sometimes adds at the end
                if (!row || !row.region) {
                    console.log("Skipping empty or region-less row:", row);
                    return;
                }

                const region = row.region.trim();

                // --- Part 1: Process data for the Map and Top Regions Chart ---
                // This replaces the first .filter() and .map()
                if (row.lat && row.long) {
                    validMapDataRowCount++;

                    // --- MODIFICATION START: Add date and year properties to GeoJSON for the map ---
                    // This is the key step. We parse the year from the date string and add both
                    // the full 'date' and the extracted 'year' to the feature's properties.
                    // The map will use the 'year' property to decide the color.
                    const year = row.date ? parseInt(row.date.split('/')[2], 10) : null;

                    geojsonFeatures.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [parseFloat(row.long), parseFloat(row.lat)]
                        },
                        properties: { 
                            region: region,
                            date: row.date || 'N/A', // Store full date for the popup
                            year: year                  // Store year for coloring
                        }
                    });
                    // --- MODIFICATION END ---

                    // b. Count occurrences for the "Top Regions" chart
                    regionCounts[region] = (regionCounts[region] || 0) + 1;
                } else {
                    console.log("Filtering out row for map (missing lat/long):", row);
                }

                if (row.date) {
                    //DD/MM/YYYY
                    const dateParts = row.date.split('/'); // e.g., "23/10/2024"

                    if (dateParts.length === 3) {
                        const monthIndex = parseInt(dateParts[1], 10) - 1;
                        const year = dateParts[2];

                        // --- NEW UNIFIED AND STRICT LOGIC ---
                        // Only proceed if we have a valid year AND a valid month
                        if (year && monthIndex >= 0 && monthIndex < 12) {

                            // a. Process for Monthly Chart
                            if (!monthlyCountsByRegion[region]) {
                                monthlyCountsByRegion[region] = Array(12).fill(0);
                                console.log("invalid month");
                            }
                            monthlyCountsByRegion[region][monthIndex]++;

                            // b. Process for Yearly Chart
                            if (!yearlyCountsByRegion[region]) {
                                yearlyCountsByRegion[region] = {};
                                console.log("invalid year");
                            }
                            yearlyCountsByRegion[region][year] = (yearlyCountsByRegion[region][year] || 0) + 1;
                        } else {
                            console.log("Invalid row (bad date format or value):", row);
                            invalidRowsCount = invalidRowsCount + 1;
                        }
                    }
                }

                else {
                    console.log("Skipping row for history charts (missing date):", row);
                }
            });

            console.log("3. Data processing finished.");
            console.log("   - Total valid rows for map:", validMapDataRowCount);
            console.log("   - Monthly counts by region:", monthlyCountsByRegion);
            console.log("   - Yearly counts by region:", yearlyCountsByRegion);
            console.log("number of invalid rows: ", invalidRowsCount);

            // --- Part 3: Update UI elements with the processed data ---

            // Update GeoJSON object
            geojsonData.features = geojsonFeatures;
            console.log("4. Final GeoJSON object:", geojsonData);

            // Update the map source
            if (typeof map !== 'undefined' && map.getSource('landslide-points')) {
                console.log("5. Updating map source 'landslide-points'.");
                map.getSource('landslide-points').setData(geojsonData);
            } else {
                console.warn("Map or source 'landslide-points' not ready. It should be updated on map 'load'.");
            }

            // Update "Top Regions" chart
            const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const chartElement = document.getElementById('agriChart');
            if (chartElement) {
                console.log("6. Creating/updating the 'Top Regions' chart.", sortedRegions);
                if (window.agriChart instanceof Chart) {
                    window.agriChart.destroy();
                }
                window.agriChart = new Chart(chartElement.getContext('2d'), { type: 'bar', data: { labels: sortedRegions.map(e => e[0]), datasets: [{ label: 'Landslide Incidents', data: sortedRegions.map(e => e[1]), backgroundColor: ['#3498db', '#1abc9c', '#9b59b6', '#e74c3c', '#f1c40f'] }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } } });
            } else {
                console.error("Could not find the chart canvas element with id='agriChart'!");
            }



            // Finally, trigger the change event ONCE to initialize the history chart
            console.log("7. All data loaded. Triggering 'change' event to show initial history chart.");


            updateAllVisuals(); // This will initialize the dashboard correctly

            // Call other update functions
            // updateDashboard("");

            // if (typeof regionSelect !== 'undefined' && regionSelect) {
            //     regionSelect.dispatchEvent(new Event('change'));
            // } else {
            //     console.error("The 'regionSelect' element is not defined!");
            // }
        },
        error: (err, file) => {
            console.error("!!! Papa.parse ERROR:", err, file);
        }
    });







    const yearlyHeaderTitle = document.getElementById("yearly-chart-header-title");
    const monthlyHeaderTitle = document.getElementById("monthly-chart-header-title");
    const monthMap = {
        'Jan': 'January',
        'Feb': 'February',
        'Mar': 'March',
        'Apr': 'April',
        'May': 'May',
        'Jun': 'June',
        'Jul': 'July',
        'Aug': 'August',
        'Sep': 'September',
        'Oct': 'October',
        'Nov': 'November',
        'Dec': 'December'
    };


    // --- REWRITTEN & FULLY BI-DIRECTIONAL UPDATE FUNCTION ---
    function updateAllVisuals() {
        const selectedRegion = document.getElementById('regionSelect').value;
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];




        // =================================================================
        // --- DATA CALCULATION (This is where the major changes are) ---
        // =================================================================
        let monthlyData = Array(12).fill(0);
        let yearlyData = {};

        // --- CASE 1: A MONTH IS SELECTED ---
        // We need to calculate the yearly data based on this month.
        if (selectedMonth) {
            const targetMonthIndex = monthLabels.indexOf(selectedMonth);

            // Loop through the raw data to build the yearly totals for the selected month
            rawCsvData.forEach(row => {
                // Apply region filter first if one is active
                if (selectedRegion && row.region !== selectedRegion) {
                    return; // Skip if region doesn't match
                }

                if (row.date) {
                    const dateParts = row.date.split('/');
                    if (dateParts.length === 3) {
                        const year = dateParts[2];
                        const monthIndex = parseInt(dateParts[1], 10) - 1;

                        // If the row's month matches our target, add it to the yearly count
                        if (year && monthIndex === targetMonthIndex) {
                            yearlyData[year] = (yearlyData[year] || 0) + 1;
                        }
                    }
                }
            });

            // The monthly chart should just highlight the selected month
            monthlyData = (selectedRegion && monthlyCountsByRegion[selectedRegion])
                ? monthlyCountsByRegion[selectedRegion]
                : Object.values(monthlyCountsByRegion).reduce((acc, counts) => {
                    counts.forEach((c, i) => acc[i] += c);
                    return acc;
                }, Array(12).fill(0));

            // --- CASE 2: A YEAR IS SELECTED ---
            // This logic remains the same: calculate the monthly data for this year.
        } else if (selectedYear) {
            rawCsvData.forEach(row => {
                if (selectedRegion && row.region !== selectedRegion) {
                    return;
                }
                if (row.date) {
                    const dateParts = row.date.split('/');
                    const year = dateParts[2];
                    if (year === selectedYear) {
                        const monthIndex = parseInt(dateParts[1], 10) - 1;
                        if (monthIndex >= 0 && monthIndex < 12) {
                            monthlyData[monthIndex]++;
                        }
                    }
                }
            });

            // The yearly chart should show all years to provide context
            yearlyData = (selectedRegion && yearlyCountsByRegion[selectedRegion])
                ? yearlyCountsByRegion[selectedRegion]
                : Object.values(yearlyCountsByRegion).reduce((acc, regionYears) => {
                    for (const year in regionYears) {
                        acc[year] = (acc[year] || 0) + regionYears[year];
                    }
                    return acc;
                }, {});

            // --- CASE 3: NO FILTERS (DEFAULT VIEW) ---
        } else {
            // Calculate total monthly data
            monthlyData = (selectedRegion && monthlyCountsByRegion[selectedRegion])
                ? monthlyCountsByRegion[selectedRegion]
                : Object.values(monthlyCountsByRegion).reduce((acc, counts) => {
                    counts.forEach((c, i) => acc[i] += c);
                    return acc;
                }, Array(12).fill(0));

            // Calculate total yearly data
            yearlyData = (selectedRegion && yearlyCountsByRegion[selectedRegion])
                ? yearlyCountsByRegion[selectedRegion]
                : Object.values(yearlyCountsByRegion).reduce((acc, regionYears) => {
                    for (const year in regionYears) {
                        acc[year] = (acc[year] || 0) + regionYears[year];
                    }
                    return acc;
                }, {});
        }

        console.log("testing the new header - 1");

        // ===================================
        // --- CHART & UI UPDATES ---
        // ===================================

        // --- NEW VERSION ---
        // Update the HTML header titles to reflect the current filter
        let yearlyChartTitle = selectedMonth
            ? `Landslides in ${monthMap[selectedMonth]} (by Year)`
            : 'History of All Landslides (Yearly)';
        let monthlyChartTitle = selectedYear
            ? `Monthly Landslides in ${selectedYear}`
            : 'History of All Landslides (Monthly)';

        // Assign the new titles to your HTML elements
        yearlyHeaderTitle.textContent = yearlyChartTitle;
        monthlyHeaderTitle.textContent = monthlyChartTitle;

        console.log("testing the new header");

        // --- Finalize and Update Yearly Chart ---
        const sortedYears = Object.keys(yearlyData).sort();
        historyChartYearly.data.labels = sortedYears;
        historyChartYearly.data.datasets[0].data = sortedYears.map(year => yearlyData[year]);
        historyChartYearly.data.datasets[0].backgroundColor = sortedYears.map(year => year === selectedYear ? '#FF6384' : '#4BC0C0');
        historyChartYearly.update();

        // --- Finalize and Update Monthly Chart ---
        historyChart.data.labels = monthLabels;
        historyChart.data.datasets[0].data = monthlyData;
        historyChart.data.datasets[0].backgroundColor = monthLabels.map(month => month === selectedMonth ? '#FF6384' : '#E67300');
        historyChart.update();

        // --- Update Mapbox Filter and Reset Button (No changes needed here) ---
        if (selectedRegion === "") {
            map.setFilter('landslide-layer', null);
        } else {
            map.setFilter('landslide-layer', ['==', ['get', 'region'], selectedRegion]);
        }
        const resetButton = document.getElementById('resetFilters');
        if (selectedYear || selectedMonth) {
            resetButton.style.display = 'inline-block';
        } else {
            resetButton.style.display = 'none';
        }
    }





    // --- FINAL EVENT LISTENERS ---

    // 1. Listen for changes on the region dropdown
    const regionSelect = document.getElementById('regionSelect');
    console.log("Region select content: ", regionSelect)
    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            // When region changes, it's best to clear the year/month filters
            selectedYear = null;
            selectedMonth = null;
            updateAllVisuals();
        });
    }

    // 2. Listen for clicks on the reset button
    const resetButton = document.getElementById('resetFilters');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            selectedYear = null;
            selectedMonth = null;
            regionSelect.value = ""; // Reset dropdown to "Show All"
            updateAllVisuals();
        });
    }



    // OLD CODE ----------

    // function updateDashboard(selectedRegion) {


    //     // Update Monthly History Chart
    //     if (selectedRegion === "") {
    //         const totalMonthlyCounts = Array(12).fill(0);
    //         for (const region in monthlyCountsByRegion) {
    //             for (let i = 0; i < 12; i++) {
    //                 totalMonthlyCounts[i] += monthlyCountsByRegion[region][i];
    //             }
    //         }
    //         historyChart.data.datasets[0].data = totalMonthlyCounts;
    //     } else if (monthlyCountsByRegion[selectedRegion]) {
    //         historyChart.data.datasets[0].data = monthlyCountsByRegion[selectedRegion];
    //     } else {
    //         historyChart.data.datasets[0].data = Array(12).fill(0); // Default to zeros if no data
    //     }
    //     historyChart.update();

    //     // Update Yearly History Chart
    //     if (selectedRegion === "") {
    //         // Recalculate total for "All Regions"
    //         const totalYearlyCounts = {};
    //         for (const region in yearlyCountsByRegion) {
    //             for (const year in yearlyCountsByRegion[region]) {
    //                 totalYearlyCounts[year] = (totalYearlyCounts[year] || 0) + yearlyCountsByRegion[region][year];
    //             }
    //         }
    //         const sortedYears = Object.keys(totalYearlyCounts).sort();
    //         historyChartYearly.data.labels = sortedYears;
    //         historyChartYearly.data.datasets[0].data = sortedYears.map(year => totalYearlyCounts[year]);

    //         console.log("trying 5");
    //     } else if (yearlyCountsByRegion[selectedRegion]) {
    //         // Data for a specific region
    //         const regionData = yearlyCountsByRegion[selectedRegion];
    //         const sortedYears = Object.keys(regionData).sort();
    //         historyChartYearly.data.labels = sortedYears;
    //         historyChartYearly.data.datasets[0].data = sortedYears.map(year => regionData[year]);
    //     } else {
    //         // No data for the selected region
    //         historyChartYearly.data.labels = [];
    //         historyChartYearly.data.datasets[0].data = [];
    //     }
    //     historyChartYearly.update();


    //     // Update Mapbox Filter
    //     if (selectedRegion === "") {
    //         map.setFilter('landslide-layer', null); // Show all points
    //     } else {
    //         map.setFilter('landslide-layer', ['==', ['get', 'region'], selectedRegion]);
    //     }
    //     console.log("Testing mapbox filter");
    // }



    // // --- Step 2: Set up the event listener to call the named function ---
    // const regionSelect = document.getElementById('regionSelect');
    // regionSelect.addEventListener('change', function () {
    //     // "this.value" refers to the selected option's value
    //     updateDashboard(this.value);
    // });




}); // End DOMContentLoaded








