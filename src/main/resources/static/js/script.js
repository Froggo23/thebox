// --- THEME SWITCHER LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;

    themeSwitcher.addEventListener('click', () => {
        // Toggle the animation class on the button
        themeSwitcher.classList.toggle('night-theme');
        // Toggle the theme class on the body for sitewide CSS changes
        body.classList.toggle('dark-theme');
    });
});

// --- TITLE PROXIMITY ANIMATION ---
document.addEventListener('DOMContentLoaded', () => {
    const title = document.getElementById('game-title');
    if (!title) return;

    // 1. Prepare the text by wrapping each letter in a span
    const originalText = title.innerText;
    title.innerHTML = originalText
        .split('')
        .map(letter => `<span>${letter === ' ' ? '&nbsp;' : letter}</span>`)
        .join('');

    const letterSpans = Array.from(title.querySelectorAll('span'));

    // Animation parameters
    const settings = {
        from: { wght: 400, opsz: 9 },
        to: { wght: 1000, opsz: 40 },
        radius: 100 // CHANGED: Reduced from 150
    };

    // 2. Track the mouse position
    let mousePos = { x: -9999, y: -9999 };
    window.addEventListener('mousemove', (e) => {
        mousePos = { x: e.clientX, y: e.clientY };
    });

    // 3. Run the animation loop
    const animate = () => {
        for (const letter of letterSpans) {
            const rect = letter.getBoundingClientRect();
            const letterCenterX = rect.left + rect.width / 2;
            const letterCenterY = rect.top + rect.height / 2;

            // 4. Calculate distance and influence
            const distance = Math.sqrt(
                (letterCenterX - mousePos.x) ** 2 + (letterCenterY - mousePos.y) ** 2
            );

            // CHANGED: Influence calculation now uses a Gaussian falloff
            const influence = Math.exp(-((distance / (settings.radius / 2)) ** 2) / 2);

            // 5. Interpolate settings and apply styles
            const wght = settings.from.wght + (settings.to.wght - settings.from.wght) * influence;
            const opsz = settings.from.opsz + (settings.to.opsz - settings.from.opsz) * influence;

            letter.style.fontVariationSettings = `'wght' ${wght}, 'opsz' ${opsz}`;
        }
        requestAnimationFrame(animate);
    };

    // Start the animation loop
    requestAnimationFrame(animate);
});


// --- GAME LOGIC ---
const form = document.getElementById('prompt-form');
const input = document.getElementById('prompt-input');
const gameCanvas = document.getElementById('game-canvas');
const loader = document.getElementById('loader');

// Form submission listener
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userPrompt = input.value.trim();
    if (!userPrompt) return;

    loader.classList.remove('hidden');
    input.disabled = true;
    form.querySelector('button').disabled = true;

    try {
        const currentSVGState = gameCanvas.innerHTML.trim();
        const apiEndpoint = '/api/transform';

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: userPrompt,
                svgState: currentSVGState
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || ''}`);
        }

        const parsedResponse = await response.json();

        if(parsedResponse.error) {
            throw new Error(parsedResponse.error);
        }

        applyUpdates(parsedResponse.updates);

    } catch (error) {
        console.error("Error processing request:", error);
        alert("An error occurred. Please check the console for details.");
    } finally {
        loader.classList.add('hidden');
        input.value = '';
        input.disabled = false;
        form.querySelector('button').disabled = false;
    }
});

function applyUpdates(updates) {
    if (!updates || !Array.isArray(updates)) {
        console.error("Invalid update format received from server.");
        return;
    }

    updates.forEach(update => {
        if (update.newElement) {
            gameCanvas.insertAdjacentHTML('beforeend', update.newElement);
        }

        const element = gameCanvas.querySelector(update.selector);
        if (element && update.attributes) {
            for (const [attr, value] of Object.entries(update.attributes)) {
                element.setAttribute(attr, value);
            }
        }
    });
}