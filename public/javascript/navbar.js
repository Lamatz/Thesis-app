
// Select the navbar element by its ID
const nav = document.querySelector("#mainNavbar");

// Store the last scroll position
let lastScrollY = window.scrollY;

window.addEventListener("scroll", () => {
    // If the user scrolls down, hide the navbar
    if (lastScrollY < window.scrollY && window.scrollY > 100) {
        nav.classList.add("navbar--hidden");
    } else {
        // If the user scrolls up, show the navbar
        nav.classList.remove("navbar--hidden");
    }

    // Update the last scroll position
    lastScrollY = window.scrollY;
});