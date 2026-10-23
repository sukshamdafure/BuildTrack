(() => {
    const nav = document.getElementById("site-nav");
    const toggle = nav && nav.querySelector(".nav-toggle");

    if (!nav || !toggle) {
        return;
    }

    toggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.textContent = isOpen ? "Close" : "Menu";
    });
})();
