/*
    EazyLife Robotics & Electronics Solutions
    Custom Script Integration
*/

(function () {
    'use strict';

    // --- 1. Create Particles (Branded Teal & Green) ---
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;

        const particleCount = 40; // Increased density for a more "High-Tech" feel
        const colors = ['#2AC5C5', '#88C888']; // Your Teal and Green

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random positioning and timing
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 10 + 's';
            particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
            
            // Assign random brand color
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            particle.style.background = randomColor;
            particle.style.boxShadow = `0 0 10px ${randomColor}`; // Adds a subtle tech glow
            
            particlesContainer.appendChild(particle);
        }
    }

    // --- 2. Mobile Menu Logic ---
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            
            // Prevent background scrolling when menu is open
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        // Close menu when a link is clicked
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // --- 3. Text Rotator (The "Elon Musk" Vibe) ---
    const textSets = document.querySelectorAll('.text-set');
    let currentIndex = 0;
    let isAnimating = false;

    function animateTextIn(element) {
        const h1 = element.querySelector('h1');
        h1.style.opacity = '1';
        h1.style.transform = 'translateY(0)';
        h1.style.filter = 'blur(0)';
    }

    function animateTextOut(element) {
        const h1 = element.querySelector('h1');
        h1.style.opacity = '0';
        h1.style.transform = 'translateY(-20px)';
        h1.style.filter = 'blur(10px)';
    }

    function rotateText() {
        if (isAnimating || textSets.length < 2) return;
        isAnimating = true;

        const currentSet = textSets[currentIndex];
        const nextIndex = (currentIndex + 1) % textSets.length;
        const nextSet = textSets[nextIndex];

        animateTextOut(currentSet);

        setTimeout(() => {
            currentSet.classList.remove('active');
            nextSet.classList.add('active');
            animateTextIn(nextSet);
            
            currentIndex = nextIndex;
            isAnimating = false;
        }, 600);
    }

    // --- 4. Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        createParticles();

        if (textSets.length > 0) {
            textSets[0].classList.add('active');
            animateTextIn(textSets[0]);

            // Change text every 5 seconds
            setInterval(rotateText, 5000);
        }

        // Random Glitch Effect on Brand Text
        setInterval(() => {
            const glitchText = document.querySelector('.glitch-text');
            if (glitchText && Math.random() > 0.90) {
                glitchText.style.transform = `translateX(${Math.random() * 4 - 2}px)`;
                setTimeout(() => { glitchText.style.transform = 'translateX(0)'; }, 100);
            }
        }, 2000);
    });

})();
