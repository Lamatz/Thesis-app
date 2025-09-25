// Wait for the entire page to be ready.
document.addEventListener('DOMContentLoaded', function () {

    // --- STEP 1: Get the HTML elements ---
    const datePickerElement = document.getElementById('date-picker-container');
    const timePickerElement = document.getElementById('hour-picker');

    // --- STEP 2: Initialize the Tempus Dominus pickers ---
    // We store the instances in these variables for easy access later.
    const timePicker = new tempusDominus.TempusDominus(timePickerElement, {
        display: {
            viewMode: 'clock',
            components: { hours: true, minutes: false, seconds: false, calendar: false }
        },
        localization: { format: 'h T' },
        useCurrent: false
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Sets hours, minutes, seconds, and milliseconds to 0
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 5);

    const datePicker = new tempusDominus.TempusDominus(datePickerElement, {

        restrictions: { minDate: today, maxDate: maxDate },
        display: {
            components: { calendar: true, date: true, month: false, year: false, decades: false, clock: false }
        },
        localization: { format: 'ddd, MMM d' },
        useCurrent: false
    });

});