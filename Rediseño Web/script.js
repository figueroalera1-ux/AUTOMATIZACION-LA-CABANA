document.addEventListener('DOMContentLoaded', () => {

    /* ---- HEADER SCROLL ---- */
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 60);
    });

    /* ---- MOBILE MENU ---- */
    const toggle = document.querySelector('.mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (toggle) {
        toggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = toggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
    }
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            const icon = toggle?.querySelector('i');
            if (icon) { icon.classList.add('fa-bars'); icon.classList.remove('fa-times'); }
        });
    });

    /* ---- HERO SLIDER ---- */
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length > 1) {
        let current = 0;
        setInterval(() => {
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            slides[current].classList.add('active');
        }, 5000);
    }

    /* ---- SMOOTH SCROLL ---- */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const target = document.querySelector(a.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = header.offsetHeight;
                window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
            }
        });
    });

    /* ---- SCROLL ANIMATIONS ---- */
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.evento-card, .paquete-card, .testimonio-card, .stat-item, .feature-item, .galeria-item, .aloj-feature, .dig-feat, .blog-card').forEach(el => {
        el.classList.add('fade-up');
        observer.observe(el);
    });

    /* ---- BLOG DESDE WORDPRESS REST API ---- */
    cargarBlog();

});

/* ---- TABS PAQUETES ---- */
function switchTab(tab, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    btn.classList.add('active');
}

/* ---- LIGHTBOX ---- */
function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-img').src = src;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ---- FORMULARIO → WEBHOOK MAKE.COM ---- */
window.enviarFormulario = async function(event) {
    event.preventDefault();

    var nombre   = (document.getElementById('nombre')      || {value:''}).value.trim();
    var telefono = (document.getElementById('telefono')    || {value:''}).value.trim();
    var correo   = (document.getElementById('correo')      || {value:''}).value.trim();
    var tipo     = (document.getElementById('tipo-evento') || {value:''}).value;
    var fecha    = (document.getElementById('fecha')       || {value:''}).value;
    var personas = (document.getElementById('personas')    || {value:''}).value;
    var mensaje  = (document.getElementById('mensaje')     || {value:''}).value.trim();

    var errEl  = document.getElementById('form-error-msg');
    var succEl = document.getElementById('form-success-msg');
    var btn    = document.getElementById('btn-contacto');
    var form   = document.getElementById('contacto-form');

    console.log('[Formulario] submit detectado en contacto-form');

    if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }

    if (!nombre || !telefono) {
        if (errEl) { errEl.textContent = 'Nombre y WhatsApp son obligatorios.'; errEl.classList.add('show'); }
        if (!nombre && document.getElementById('nombre')) document.getElementById('nombre').focus();
        else if (document.getElementById('telefono')) document.getElementById('telefono').focus();
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }

    var notasParts = [];
    if (fecha)    notasParts.push('Fecha: ' + fecha);
    if (personas) notasParts.push('Invitados: ' + personas);
    if (mensaje)  notasParts.push('Mensaje: ' + mensaje);

var payload = {
    full_name: nombre,
    phone: telefono,
    email: correo,
    tipo_evento: tipo || '',
    fecha_evento: fecha || '',
    num_personas: personas || '',
    paquete_interes: '',
    mensaje: notasParts.join(' | '),
    fuente: 'website'
};

    console.log('[Formulario] payload listo:', payload);

    try {
        var r = await fetch('https://n8n.lacabanaeventos.com/webhook/lacabana-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        var responseText = await r.text();
        console.log('[Formulario] respuesta fetch:', { status: r.status, ok: r.ok, body: responseText });
        if (r.ok || r.status === 200) {
            // Meta Pixel Lead — solo cuando webhook responde OK (r.ok)
            if (typeof fbq === 'function') { fbq('track', 'Lead'); }
            if (form)  { form.reset(); form.style.display = 'none'; }
            if (succEl){ succEl.classList.add('show'); }
        } else {
            throw new Error('HTTP ' + r.status);
        }
    } catch(err) {
        console.error('[Formulario] Error al enviar lead:', err);
        if (btn)  { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar cotización'; }
        if (errEl){ errEl.textContent = 'Hubo un error al enviar. Inténtalo de nuevo o escríbenos por WhatsApp.'; errEl.classList.add('show'); }
    }
};

/* ---- BLOG WORDPRESS REST API ---- */
function cargarBlog() {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    fetch('https://lacabanaeventos.com/wp-json/wp/v2/posts?per_page=3&_embed')
        .then(res => res.json())
        .then(posts => {
            if (!posts || !posts.length) {
                grid.innerHTML = placeholderBlog();
                return;
            }
            grid.innerHTML = posts.map(post => {
                const img = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
                const fecha = new Date(post.date).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
                const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 120) + '…';
                return `
                <div class="blog-card fade-up visible">
                    ${img ? `<div class="blog-card-img" style="background-image:url('${img}')"></div>` : `<div class="blog-card-img" style="background:linear-gradient(135deg,#5F0020,#3d0015)"></div>`}
                    <div class="blog-card-body">
                        <div class="blog-card-date"><i class="fas fa-calendar-alt"></i> ${fecha}</div>
                        <div class="blog-card-title">${post.title?.rendered || ''}</div>
                        <div class="blog-card-excerpt">${excerpt}</div>
                        <a href="${post.link}" class="blog-card-link" target="_blank">Leer artículo <i class="fas fa-arrow-right"></i></a>
                    </div>
                </div>`;
            }).join('');
        })
        .catch(() => {
            grid.innerHTML = placeholderBlog();
        });
}

function placeholderBlog() {
    const posts = [
        { titulo: '5 consejos para organizar la boda perfecta en La Cabaña', categoria: 'Bodas', img: '../../CAMBIOS/SECCION%204%20(1).png' },
        { titulo: 'Tendencias en decoración para XV Años 2026', categoria: 'XV Años', img: '../../CAMBIOS/SECCION%20BLOG%20(2).png' },
        { titulo: 'Cómo elegir el paquete ideal para tu graduación', categoria: 'Graduaciones', img: '../../CAMBIOS/SECCION%203%20GRADUACIONES.png' },
    ];
    return posts.map(p => `
        <div class="blog-card fade-up visible">
            <div class="blog-card-img" style="background-image:url('${p.img}')"></div>
            <div class="blog-card-body">
                <div class="blog-card-cat">${p.categoria}</div>
                <div class="blog-card-title">${p.titulo}</div>
                <div class="blog-card-excerpt">Descubre los mejores consejos y tendencias para hacer de tu evento algo verdaderamente memorable en La Cabaña.</div>
                <a href="/blog" class="blog-card-link">Leer artículo <i class="fas fa-arrow-right"></i></a>
            </div>
        </div>`).join('');
}
