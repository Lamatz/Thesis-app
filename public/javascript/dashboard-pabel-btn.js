// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', function () {

    // Get the offcanvas element and the toggle button
    const controlPanel = document.getElementById('controlPanel');
    const panelToggleButton = document.getElementById('panel-toggle-btn');

    // 1. Listen for when the offcanvas STARTS to show
    controlPanel.addEventListener('show.bs.offcanvas', function () {
        // Get the computed width of the offcanvas panel
        const panelWidth = controlPanel.offsetWidth;
        panelToggleButton.innerHTML = '&gt;';
        // Move the button to the left by the width of the panel
        panelToggleButton.style.transform = `translateY(-50%) translateX(-${panelWidth}px)`;
    });

    // 2. Listen for when the offcanvas STARTS to hide
    controlPanel.addEventListener('hide.bs.offcanvas', function () {
        panelToggleButton.innerHTML = '&lt;';
        // Reset the button's position to its default state
        panelToggleButton.style.transform = 'translateY(-50%)';
    });

    // 3. (Optional but recommended) Handle window resizing while the panel is open
    window.addEventListener('resize', function () {
        // Check if the panel is currently shown
        if (controlPanel.classList.contains('show')) {
            const panelWidth = controlPanel.offsetWidth;
            panelToggleButton.style.transform = `translateY(-50%) translateX(-${panelWidth}px)`;
        } else {
            panelToggleButton.innerHTML = '&lt;';
            // Reset to the default position
            panelToggleButton.style.transform = 'translate(0, -50%)';
        }
    });
});