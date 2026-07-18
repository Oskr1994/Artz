// ARTZ — interacciones: hero slides, navbar, menú móvil, reveal, form WhatsApp

// Hero: crossfade entre slides
const slides = document.querySelectorAll('.hero-slide');
if (slides.length > 1) {
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('is-active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('is-active');
  }, 6000);
}

// Navbar: transparente sobre el hero, sólida al bajar
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > window.innerHeight - 120);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Menú móvil
const burger = document.getElementById('nav-burger');
const links = document.getElementById('nav-links');
burger.addEventListener('click', () => {
  const open = links.classList.toggle('is-open');
  nav.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
});
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  links.classList.remove('is-open');
  nav.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
}));

// Reveal on scroll
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Formulario: abre WhatsApp con el mensaje prellenado (GitHub Pages no tiene backend)
const form = document.getElementById('form-contacto');
form.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(form);
  const texto = `Hola, soy ${data.get('nombre')} (${data.get('email')}). ${data.get('mensaje')}`;
  window.open('https://wa.me/51969792034?text=' + encodeURIComponent(texto), '_blank');
});
