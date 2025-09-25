document.addEventListener('DOMContentLoaded', () => {




    // --- DOM Elements ---
    const dateSelect = document.getElementById('date-picker');
    // const timeSlider = document.getElementById('time-slider');
    // const timeSliderValue = document.getElementById('time-slider-value');
    // const dateSliderValue = document.getElementById('date-slider-value');
    // const durationSelector = document.getElementById('duration-selector');
    // const summaryText = document.getElementById('forecast-summary-text');
    // const timelineSelection = document.getElementById('timeline-selection');

    // --- Helper Functions ---
    const formatHour = (hour) => {
        const h = hour % 12 === 0 ? 12 : hour % 12;
        const period = hour < 12 || hour === 24 ? 'AM' : 'PM';
        return `${h}:00 ${period}`;
    };


    // <<< NEW HELPER FUNCTION >>>
    /**
     * Converts a JavaScript Date object to YYYY-MM-DD format.
     * @param {Date} dateObject - The JavaScript Date object to format.
     * @returns {string} The formatted date string, e.g., "2024-07-10".
     */
    const formatDateToYYYYMMDD = (dateObject) => {
        const year = dateObject.getFullYear();
        const month = String(dateObject.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(dateObject.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- Initial Setup Functions ---
    function generateDateOptions() {

        // 1. Create and add the placeholder option first
        const placeholderOption = document.createElement('option');
        placeholderOption.textContent = 'yy/mm/dd';
        placeholderOption.value = ""; // Use an empty value for easy validation
        placeholderOption.selected = true;
        placeholderOption.disabled = true;
        dateSelect.appendChild(placeholderOption);

        const today = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        for (let i = 0; i < 6; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const option = document.createElement('option');
            option.textContent = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', options);
            option.value = formatDateToYYYYMMDD(date);
            option.dataset.dateLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'long' });
            dateSelect.appendChild(option);
        }
    }

    // --- Main Update Function ---
    function updateForecast() {
        // 1. Get current values
        const selectedDateOption = dateSelect.options[dateSelect.selectedIndex];
        const selectedDateLabel = selectedDateOption.dataset.dateLabel;
        const selectedStartHour = parseInt(timeSlider.value, 10);
        const selectedDuration = parseInt(document.querySelector('input[name="duration"]:checked').value, 10);

        // 2. Handle "Entire Day" logic
        const isEntireDay = selectedDuration === 24;
        timeSlider.disabled = isEntireDay;

        const startHour = isEntireDay ? 0 : selectedStartHour;
        const duration = isEntireDay ? 24 : selectedDuration;

        // Cap duration at the end of the day
        const effectiveDuration = Math.min(duration, 24 - startHour);
        const endHour = (startHour + effectiveDuration);

        // 3. Update summary text
        if (isEntireDay) {
            summaryText.textContent = `the ${selectedDateLabel}`;
        } else {
            summaryText.textContent = `${selectedDateLabel} from ${formatHour(startHour)} to ${formatHour(endHour)}`;
        }

        // 4. Update timeline visualization
        // const leftPercent = (startHour / 24) * 100;
        // const widthPercent = (effectiveDuration / 24) * 100;
        // timelineSelection.style.left = `${leftPercent}%`;
        // timelineSelection.style.width = `${widthPercent}%`;

        // 5. Update day label
        const dateForBackend = dateSelect.value;
        dateSliderValue.textContent = dateForBackend;
        console.log("Date for backend:", dateForBackend);
    }

    // --- Event Listeners ---
    dateSelect.addEventListener('change', updateForecast);



    const timeInput = document.getElementById('time-picker');

    timeInput.addEventListener('input', (e) => {
        let hour = e.target.value.split(':')[0]
        e.target.value = `${hour}:00`
    })



    // --- Initialization ---
    generateDateOptions();
    updateForecast(); // Initial call to set the default state
});