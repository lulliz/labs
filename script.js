// Subtle interactions for the Labs landing page
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c Labs 2026 ', 'background: #00ffcc; color: #050505; font-weight: bold; padding: 4px; border-radius: 4px;');
    
    const cards = document.querySelectorAll('.tech-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
});
