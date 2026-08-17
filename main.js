// ── YEAR ─────────────────────────────────────────────────
document.getElementById('year').textContent = new Date().getFullYear();

// ── COPY EMAIL TO CLIPBOARD ──────────────────────────────
function copyEmail() {
    navigator.clipboard.writeText('rtraswinppgit@gmail.com').then(() => {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2600);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// ── SKILLS CATEGORY FILTERING ───────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn');
const skillPills = document.querySelectorAll('.skill-pill');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');

        skillPills.forEach(pill => {
            const categories = pill.getAttribute('data-category').split(' ');
            if (filter === 'all' || categories.includes(filter)) {
                pill.classList.remove('hidden');
            } else {
                pill.classList.add('hidden');
            }
        });
    });
});

// ── MOBILE MENU DRAWER ───────────────────────────────────
const mobileNavToggle = document.getElementById('mobileNavToggle');
const mobileDrawer = document.getElementById('mobileDrawer');

if (mobileNavToggle && mobileDrawer) {
    mobileNavToggle.addEventListener('click', () => {
        mobileDrawer.classList.toggle('open');
    });

    mobileDrawer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileDrawer.classList.remove('open');
        });
    });
}

// ── SCROLL-SPY ACTIVE NAV HIGHLIGHTING ─────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// ── CUSTOM CURSOR (JIT PHYSICS) ─────────────────────────
const dot = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
const canvas = document.getElementById('cursor-trail');
const ctx = canvas.getContext('2d');

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;
window.addEventListener('resize', () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; });

const particles = [];
const MAX_TRAIL = 28;

let mx = -200, my = -200;
let rx = -200, ry = -200;
let vx = 0, vy = 0;
const SPRING = 0.14;
const DAMPING = 0.72;

document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;

    particles.push({ x: mx, y: my, r: 4 + Math.random() * 3, life: 1, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2 });
    if (particles.length > MAX_TRAIL) particles.shift();
});

document.querySelectorAll('a, button, .magnetic, .btn, .social-btn, .theme-btn, .filter-btn').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-link'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-link'));
});

document.querySelectorAll('p, h1, h2, h3, span, li').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-text'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-text'));
});

document.querySelectorAll('.card, .project-card, .skill-pill, .timeline-item, .floating-card').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

document.addEventListener('click', e => {
    const r = document.createElement('div');
    r.className = 'ripple';
    const size = 80 + Math.random() * 60;
    r.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:${size}px;height:${size}px;`;
    document.body.appendChild(r);
    r.addEventListener('animationend', () => r.remove());

    dot.style.transform = 'translate(-50%,-50%) scale(2.5)';
    dot.style.opacity = '0.5';
    setTimeout(() => { dot.style.transform = ''; dot.style.opacity = ''; }, 200);
});

document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('mousemove', e => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) * 0.3;
        const dy = (e.clientY - cy) * 0.3;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    el.addEventListener('mouseleave', () => {
        el.style.transform = '';
        el.style.transition = 'transform 0.5s var(--ease-back)';
        setTimeout(() => el.style.transition = '', 500);
    });
});

document.querySelectorAll('.card, .project-card').forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--cx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--cy', `${e.clientY - rect.top}px`);
    });
});

const frame = document.querySelector('.image-frame');
if (frame) {
    const parent = frame.closest('.hero-visual');
    parent.addEventListener('mousemove', e => {
        const rect = frame.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rx2 = ((e.clientY - cy) / rect.height) * -12;
        const ry2 = ((e.clientX - cx) / rect.width) * 12;
        frame.style.transform = `perspective(900px) rotateX(${rx2}deg) rotateY(${ry2}deg)`;
    });
    parent.addEventListener('mouseleave', () => {
        frame.style.transform = 'perspective(900px) rotateX(0) rotateY(0)';
        frame.style.transition = 'transform 0.6s var(--ease)';
    });
}

function loop() {
    requestAnimationFrame(loop);

    dot.style.left = mx + 'px';
    dot.style.top = my + 'px';

    vx += (mx - rx) * SPRING;
    vy += (my - ry) * SPRING;
    vx *= DAMPING;
    vy *= DAMPING;
    rx += vx;
    ry += vy;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';

    ctx.clearRect(0, 0, W, H);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.07;
        p.x += p.vx;
        p.y += p.vy;
        p.r *= 0.94;
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.r), 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        const alpha = p.life * 0.35;
        const col = isLight ? `rgba(102,85,232,${alpha})` : `rgba(124,111,247,${alpha})`;
        grad.addColorStop(0, col);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
    }
}
loop();

// ── THEME TOGGLE ─────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (saved === 'light' || (!saved && !sysDark)) {
    document.documentElement.setAttribute('data-theme', 'light');
}
themeToggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
});

// ── SCROLL-BASED HEADER ───────────────────────────────────
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (window.scrollY > 30) {
        header.style.background = isLight
            ? 'rgba(247,246,252,0.85)'
            : 'rgba(5,5,8,0.85)';
    } else {
        header.style.background = 'transparent';
        header.style.borderBottom = '1px solid var(--border)';
    }
});

// ── SCROLL REVEAL ─────────────────────────────────────────
const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal, .stagger').forEach(el => observer.observe(el));

document.querySelectorAll('.hero .reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), i * 100 + 100);
});

