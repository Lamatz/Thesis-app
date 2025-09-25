


// ===================================
// FEATURE IMPORTANCE CHART DATA
// ===================================
// This is the data object for the bar chart.
// It contains the labels for the y-axis and a dataset for the x-axis values.
const featureImportanceData = {
    labels: [
        'soil_type',
        'cumulative_rainfall_3hr',
        'rainfall_intensity_3hr',
        'rainfall_intensity_6hr',
        'cumulative_rainfall_6hr',
        'cumulative_rainfall_12hr',
        'rainfall_intensity_12hr',
        'cumulative_rainfall_1d',
        'soil_moisture',
        'rainfall_intensity_1d',
        'rainfall_intensity_5d',
        'cumulative_rainfall_5d',
        'rainfall_intensity_3d',
        'cumulative_rainfall_3d',
        'slope'
    ],
    datasets: [{
        label: 'Importance', // This label is for the legend, which is hidden in this config.
        data: [
            0.01, 0.015, 0.018, 0.02, 0.025, 0.03, 0.035,
            0.06, 0.065, 0.07, 0.075, 0.08, 0.085, 0.11, 0.295
        ],
        backgroundColor: 'rgba(60, 122, 153, 1)',
        borderColor: 'rgba(60, 122, 153, 1)',
        borderWidth: 1
    }]
};


console.log("testing chart");
// ===================================
// FEATURE IMPORTANCE CHART CONFIG
// ===================================
// This is the main configuration object, similar to your `config2`.
const featureImportanceConfig = {
    type: 'bar', // The type of chart
    data: featureImportanceData, // Link to the data object above
    options: {
        // This is the key option for creating a horizontal bar chart
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false, // Allows chart to fill container height
        plugins: {
            title: {
                display: true,
                text: 'Random Forest Feature Importance',
                font: { size: 16 }
            },
            legend: {
                // We hide the legend as the axes are self-explanatory
                display: false
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Importance'
                },
                min: 0,
                max: 0.30,
                ticks: {
                    stepSize: 0.05
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Feature'
                }
            }
        }
    }
};

console.log("testing chart 1");
// --- Render Chart ---
// Get the canvas element's context and create the new chart instance.
const ctxfeat = document.getElementById('featureImportanceChart').getContext('2d');
new Chart(ctxfeat, featureImportanceConfig);

console.log("testing chart 2");




// The JSON configuration from above goes here
const classificationConfig = {
    "type": "bar",
    "data": {
        "labels": [
            "Class 0 (Support: 304)",
            "Class 1 (Support: 386)",
            "Macro Avg (Support: 618)",
            "Weighted Avg (Support: 618)"
        ],
        "datasets": [
            {
                "label": "Precision",
                "data": [
                    0.88,
                    0.93,
                    0.91,
                    0.91
                ],
                "backgroundColor": "rgba(54, 162, 235, 0.6)",
                "borderColor": "rgba(54, 162, 235, 1)",
                "borderWidth": 1
            },
            {
                "label": "Recall",
                "data": [
                    0.94,
                    0.88,
                    0.91,
                    0.91
                ],
                "backgroundColor": "rgba(75, 192, 192, 0.6)",
                "borderColor": "rgba(75, 192, 192, 1)",
                "borderWidth": 1
            },
            {
                "label": "F1-Score",
                "data": [
                    0.91,
                    0.90,
                    0.91,
                    0.91
                ],
                "backgroundColor": "rgba(255, 99, 132, 0.6)",
                "borderColor": "rgba(255, 99, 132, 1)",
                "borderWidth": 1
            }
        ]
    },
    "options": {
        "responsive": true,
        "plugins": {
            "title": {
                "display": true,
                "text": "Classification Report",
                "font": {
                    "size": 18
                }
            },
            "subtitle": {
                "display": true,
                "text": "Overall Accuracy: 0.91",
                "padding": {
                    "bottom": 15
                },
                "font": {
                    "size": 14,
                    "style": "italic"
                }
            },
            "legend": {
                "position": "top"
            }
        },
        "scales": {
            "y": {
                "beginAtZero": true,
                "max": 1.0,
                "title": {
                    "display": true,
                    "text": "Score"
                }
            },
            "x": {
                "title": {
                    "display": true,
                    "text": "Metric by Class"
                }
            }
        }
    }
};

// --- Render Chart ---
const ctxReport = document.getElementById('classificationReportChart').getContext('2d');
new Chart(ctxReport, classificationConfig);