/* Net & Net – comportement du site (menu, animations, galerie, formulaire de devis) */

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Pas d'effet de profondeur sur mobile (économise la batterie et évite les saccades)
    const isSmallScreen = window.matchMedia('(max-width: 767px)');

    // 0. Image de secours (intégrée) si une photo ne charge pas
    const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D192E"/><stop offset="1" stop-color="#130D24"/></linearGradient>' +
      '<radialGradient id="r" cx="0.3" cy="0.25" r="0.7"><stop offset="0" stop-color="#00F5D4" stop-opacity="0.28"/><stop offset="1" stop-color="#00F5D4" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="800" height="600" fill="url(#g)"/><rect width="800" height="600" fill="url(#r)"/>' +
      '<g fill="none" stroke="#00F5D4" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">' +
      '<path d="M300 270 L400 180 L500 270"/><path d="M325 250 V325 H475 V250"/></g>' +
      '<text x="400" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#E2E8F0">Net &amp; Net</text>' +
      '<text x="400" y="428" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" letter-spacing="5" fill="#00F5D4">DÉBARRAS &amp; NETTOYAGE</text></svg>');

    function applyImageFallback(img) {
      if (img && !img.dataset.fallback) {
        img.dataset.fallback = '1';
        img.removeAttribute('srcset');
        img.src = FALLBACK_IMG;
      }
    }
    document.addEventListener('error', e => {
      if (e.target && e.target.tagName === 'IMG') applyImageFallback(e.target);
    }, true);
    // Les images qui ont déjà échoué avant l'exécution du script
    function checkBrokenImages() {
      document.querySelectorAll('img').forEach(img => {
        if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')) applyImageFallback(img);
      });
    }

    // 3. Menu Mobile
    let mobileMenuOpen = false;
    function toggleMobileMenu() {
      mobileMenuOpen = !mobileMenuOpen;
      const menu = document.getElementById('mobile-menu');
      const l1 = document.getElementById('b-line-1');
      const l2 = document.getElementById('b-line-2');
      const l3 = document.getElementById('b-line-3');

      if (mobileMenuOpen) {
        menu.classList.remove('opacity-0', 'pointer-events-none');
        l1.style.transform = 'translateY(8px) rotate(45deg)';
        l2.style.opacity = '0';
        l3.style.transform = 'translateY(-8px) rotate(-45deg)';
      } else {
        menu.classList.add('opacity-0', 'pointer-events-none');
        l1.style.transform = '';
        l2.style.opacity = '1';
        l3.style.transform = '';
      }
    }

    // 4. Barre de progression, header, bouton « haut de page », parallaxe (une mise à jour par image affichée)
    let scrollTicking = false;
    function onScrollFrame() {
      scrollTicking = false;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      document.getElementById('scroll-progress').style.width = progress + '%';

      const headerContainer = document.getElementById('header-container');
      if (scrollTop > 40) {
        headerContainer.classList.add('glass-panel', 'shadow-[0_10px_40px_rgba(0,0,0,0.6)]', 'border', 'border-white/10');
      } else {
        headerContainer.classList.remove('glass-panel', 'shadow-[0_10px_40px_rgba(0,0,0,0.6)]', 'border', 'border-white/10');
      }

      const topBtn = document.getElementById('scroll-top-btn');
      if (scrollTop > 400) {
        topBtn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
      } else {
        topBtn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
      }

      const heroVis = document.getElementById('hero-parallax');
      if (heroVis && !prefersReducedMotion && !isSmallScreen.matches && scrollTop < 900) {
        heroVis.style.transform = `translateY(${scrollTop * 0.08}px)`;
      }
    }
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(onScrollFrame);
      }
    }, { passive: true });

    // 5. Boîtes Interactives : Spotlight dynamique + Effet Tilt 3D au survol
    document.querySelectorAll('.spotlight-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);

        // Tilt 3D léger sur les cartes équipées de .tilt-card
        if (!prefersReducedMotion && card.classList.contains('tilt-card')) {
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -4.5;
          const rotateY = ((x - centerX) / centerX) * 4.5;
          card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        }
      });

      card.addEventListener('mouseleave', () => {
        if (card.classList.contains('tilt-card')) {
          card.style.transform = '';
        }
      });
    });

    // 6. Apparition & disparition au scroll (IntersectionObserver)
    let scrollObserver;
    function initScrollAnimations() {
      const nodes = document.querySelectorAll('.scroll-node');

      // Navigateur trop ancien : on affiche simplement tout
      if (!('IntersectionObserver' in window)) {
        nodes.forEach(n => n.classList.add('in-view'));
        return;
      }

      scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const el = entry.target;
          if (entry.isIntersecting) {
            el.classList.add('in-view');
            el.classList.remove('out-top');
            if (el.id === 'counters-section') animateCounters();
          } else {
            el.classList.remove('in-view');
            if (entry.boundingClientRect.top < 0) {
              el.classList.add('out-top');
            } else {
              el.classList.remove('out-top');
            }
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      nodes.forEach(node => scrollObserver.observe(node));
    }

    // 7. Compteurs animés
    let countersAnimated = false;
    function animateCounters() {
      if (countersAnimated) return;
      countersAnimated = true;

      document.querySelectorAll('.counter-val').forEach(counter => {
        const target = parseInt(counter.dataset.target, 10);
        const prefix = counter.dataset.prefix || '';
        const suffix = counter.dataset.suffix || '';

        if (prefersReducedMotion) {
          counter.textContent = prefix + target + suffix;
          return;
        }

        let current = 0;
        const duration = 1500;
        const stepTime = 24;
        const steps = Math.ceil(duration / stepTime);
        const increment = target / steps;

        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          counter.textContent = prefix + Math.round(current) + suffix;
        }, stepTime);
      });
    }

    // 8. Carrousel de témoignages interactif
    let currentSlide = 0;
    const track = document.getElementById('testimonial-track');
    const totalSlides = track ? track.children.length : 0;
    const dotsContainer = document.getElementById('testimonial-dots');

    if (dotsContainer && totalSlides > 0) {
      for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('button');
        dot.setAttribute('aria-label', `Avis ${i + 1}`);
        dot.className = `h-2.5 rounded-full transition-all duration-300 ${i === 0 ? 'w-8 bg-cyber-cyan' : 'w-2.5 bg-white/20 hover:bg-white/40'}`;
        dot.onclick = () => goToSlide(i);
        dotsContainer.appendChild(dot);
      }
    }

    function updateCarousel() {
      if (!track) return;
      track.style.transform = `translateX(-${currentSlide * 100}%)`;
      Array.from(dotsContainer.children).forEach((dot, index) => {
        if (index === currentSlide) {
          dot.className = 'h-2.5 w-8 rounded-full bg-cyber-cyan transition-all duration-300 shadow-[0_0_10px_rgba(0,245,212,0.6)]';
        } else {
          dot.className = 'h-2.5 w-2.5 rounded-full bg-white/20 hover:bg-white/40 transition-all duration-300';
        }
      });
    }

    function goToSlide(idx) {
      currentSlide = idx;
      updateCarousel();
    }

    function nextTestimonial() {
      currentSlide = (currentSlide + 1) % totalSlides;
      updateCarousel();
    }

    function prevTestimonial() {
      currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
      updateCarousel();
    }

    // Défilement automatique (désactivé si l'utilisateur préfère réduire les animations)
    if (!prefersReducedMotion && totalSlides > 1) {
      setInterval(nextTestimonial, 5500);
    }

    // 9. Lightbox Galerie
    function openLightbox(cardEl) {
      const img = cardEl.querySelector('img');
      const title = cardEl.querySelector('span');
      const lb = document.getElementById('lightbox');
      const lbImg = document.getElementById('lightbox-img');
      lbImg.removeAttribute('data-fallback');
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt || 'Agrandissement';
      document.getElementById('lightbox-caption').textContent = title ? title.textContent : '';
      lb.classList.remove('hidden');
      lb.classList.add('flex');
    }

    function closeLightbox() {
      const lb = document.getElementById('lightbox');
      lb.classList.add('hidden');
      lb.classList.remove('flex');
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeLightbox();
    });

    // Galerie accessible au clavier (Entrée / Espace)
    document.querySelectorAll('.spotlight-card[onclick^="openLightbox"]').forEach(card => {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(card);
        }
      });
    });

    // 10. Upload & Prévisualisation de photos + Validation du formulaire de devis
    const MAX_PHOTOS = 8;
    let uploadedPhotos = []; // { file, url }
    const fileInput = document.getElementById('f-photos');
    const previewsContainer = document.getElementById('photo-previews');
    const dropZone = document.getElementById('drop-zone');

    function addFiles(fileList) {
      const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
      let skipped = 0;

      files.forEach(file => {
        if (uploadedPhotos.length >= MAX_PHOTOS) {
          skipped++;
          return;
        }
        uploadedPhotos.push({ file: file, url: URL.createObjectURL(file) });
      });

      renderPhotoPreviews();
      document.getElementById('info-photos').classList.toggle('hidden', skipped === 0);
      if (uploadedPhotos.length > 0) {
        document.getElementById('err-photos').classList.add('hidden');
      }
    }

    if (dropZone) {
      ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, e => {
          e.preventDefault();
          dropZone.classList.add('border-cyber-cyan', 'bg-cyber-cyan/10');
        });
      });
      dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropZone.classList.remove('border-cyber-cyan', 'bg-cyber-cyan/10');
      });
      // Correctif : on récupère réellement les fichiers déposés
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('border-cyber-cyan', 'bg-cyber-cyan/10');
        if (e.dataTransfer && e.dataTransfer.files) {
          addFiles(e.dataTransfer.files);
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        addFiles(this.files);
        this.value = '';
      });
    }

    function renderPhotoPreviews() {
      previewsContainer.innerHTML = '';
      uploadedPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'relative w-20 h-20 rounded-xl overflow-hidden border border-cyber-cyan/30 group shadow-lg';
        item.innerHTML = `
          <img src="${photo.url}" alt="Aperçu ${index + 1}" class="w-full h-full object-cover" />
          <button type="button" onclick="removePhoto(${index})" aria-label="Supprimer la photo ${index + 1}" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyber-coral text-white text-[10px] flex items-center justify-center shadow hover:scale-110 transition-transform">
            <svg class="ic " aria-hidden="true" focusable="false"><use href="#i-times"/></svg>
          </button>
        `;
        previewsContainer.appendChild(item);
      });
    }

    function removePhoto(index) {
      const removed = uploadedPhotos.splice(index, 1)[0];
      if (removed) URL.revokeObjectURL(removed.url);
      renderPhotoPreviews();
      document.getElementById('info-photos').classList.add('hidden');
    }

    // ===== Envoi du formulaire : Google Apps Script + Drive + Telegram =====
    // Colle ici l'URL de déploiement de ton Apps Script (elle se termine par /exec) :
    const QUOTE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyAFIKw9khzPvTUfzfGm1O-ABLQxMSO70dcqC0eldzH1mnUNAhnU8t6rVOTeXqE1hEsIw/exec';
    const formStartedAt = Date.now();
    const quoteForm = document.getElementById('quote-form');
    let isSending = false;

    function endpointReady() {
      return /^https:\/\/script\.google\.com\/macros\/s\/[^\s]+\/exec$/.test(QUOTE_ENDPOINT);
    }

    // Réduit une photo (JPEG, côté max limité) pour un envoi rapide et léger
    function compressImage(file, maxSide, quality) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PHOTO_FORMAT')), 'image/jpeg', quality);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('PHOTO_FORMAT'));
        };
        img.src = url;
      });
    }

    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('PHOTO_READ'));
        reader.readAsDataURL(blob);
      });
    }

    // Compresse toutes les photos ; si le total reste trop lourd, on réessaie en plus petit
    async function buildPhotoPayload() {
      const presets = [[1600, 0.75], [1280, 0.65], [1000, 0.55]];
      const LIMIT = 9 * 1024 * 1024; // 9 Mo au total
      for (let p = 0; p < presets.length; p++) {
        const result = [];
        let total = 0;
        for (let i = 0; i < uploadedPhotos.length; i++) {
          const blob = await compressImage(uploadedPhotos[i].file, presets[p][0], presets[p][1]);
          total += blob.size;
          result.push({ name: 'photo-' + (i + 1) + '.jpg', type: 'image/jpeg', data: await blobToBase64(blob) });
        }
        if (total <= LIMIT) return result;
      }
      throw new Error('PHOTOS_TOO_LARGE');
    }

    function showFieldsError(message) {
      document.getElementById('err-fields-text').textContent = message;
      document.getElementById('err-fields').classList.remove('hidden');
    }
    function hideFieldsError() {
      document.getElementById('err-fields').classList.add('hidden');
    }
    function showSubmitError(html) {
      document.getElementById('err-submit-text').innerHTML = html;
      document.getElementById('err-submit').classList.remove('hidden');
    }
    function hideSubmitError() {
      document.getElementById('err-submit').classList.add('hidden');
    }

    const CONTACT_FALLBACK = `contactez-nous au <a href="tel:+33758695823" class="underline font-semibold">07 58 69 58 23</a> ou sur <a href="https://wa.me/33758695823" target="_blank" rel="noopener" class="underline font-semibold">WhatsApp</a>`;

    function submitErrorMessage(code) {
      switch (code) {
        case 'PHOTO_FORMAT':
          return "Une photo n'a pas pu être lue (format non pris en charge). Utilisez des photos JPG ou PNG, ou " + CONTACT_FALLBACK + '.';
        case 'PHOTOS_TOO_LARGE':
          return 'Vos photos sont trop volumineuses. Essayez avec moins de photos, ou ' + CONTACT_FALLBACK + '.';
        case 'RATE_LIMIT':
          return 'Beaucoup de demandes en ce moment. Réessayez dans quelques minutes, ou ' + CONTACT_FALLBACK + '.';
        case 'INVALID':
          return 'Certaines informations semblent invalides. Vérifiez le formulaire, ou ' + CONTACT_FALLBACK + '.';
        default:
          return "L'envoi a échoué. Vérifiez votre connexion et réessayez, ou " + CONTACT_FALLBACK + '.';
      }
    }

    function showQuoteSuccess() {
      document.getElementById('form-fields-wrapper').classList.add('hidden');
      document.getElementById('form-success').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (quoteForm) {
      const requiredIds = ['f-nom', 'f-tel', 'f-email', 'f-ville', 'f-type'];

      // L'erreur disparaît dès que l'utilisateur corrige un champ
      requiredIds.forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => el.classList.remove('input-error'));
        el.addEventListener('change', () => el.classList.remove('input-error'));
      });

      quoteForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (isSending) return;
        hideSubmitError();

        // Anti-spam : champ piège rempli => on simule un succès (le robot ne le saura pas)
        const trap = document.getElementById('f-company');
        if (trap && trap.value.trim() !== '') {
          showQuoteSuccess();
          return;
        }

        // --- Validation ---
        let isValid = true;
        let fieldsMessage = "Veuillez remplir tous les champs obligatoires marqués d'un astérisque (*).";

        requiredIds.forEach(id => {
          const input = document.getElementById(id);
          if (!input.value.trim()) {
            isValid = false;
            input.classList.add('input-error');
          } else {
            input.classList.remove('input-error');
          }
        });

        if (isValid) {
          const emailInput = document.getElementById('f-email');
          const telInput = document.getElementById('f-tel');
          const telDigits = telInput.value.replace(/\D/g, '');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailInput.value.trim())) {
            isValid = false;
            emailInput.classList.add('input-error');
            fieldsMessage = 'Veuillez saisir une adresse email valide.';
          } else if (telDigits.length < 9 || telDigits.length > 15) {
            isValid = false;
            telInput.classList.add('input-error');
            fieldsMessage = 'Veuillez saisir un numéro de téléphone valide.';
          }
        }

        if (isValid) {
          const df = document.getElementById('f-date');
          if (df && df.value && df.min && df.value < df.min) {
            isValid = false;
            df.classList.add('input-error');
            fieldsMessage = 'La date souhaitée ne peut pas être dans le passé.';
          }
        }

        if (isValid) {
          hideFieldsError();
        } else {
          showFieldsError(fieldsMessage);
        }

        const errPhotos = document.getElementById('err-photos');
        if (uploadedPhotos.length === 0) {
          errPhotos.classList.remove('hidden');
          isValid = false;
        } else {
          errPhotos.classList.add('hidden');
        }

        if (!isValid) return;

        // Tant que l'URL du script n'est pas renseignée, on n'affiche JAMAIS un faux succès
        if (!endpointReady()) {
          showSubmitError("Le formulaire n'est pas encore activé. Merci de " + CONTACT_FALLBACK + '.');
          return;
        }

        // --- Envoi ---
        const submitBtn = quoteForm.querySelector('button[type="submit"]');
        const originalBtn = submitBtn.innerHTML;
        isSending = true;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70', 'cursor-wait');
        submitBtn.innerHTML = '<svg class="ic animate-spin" aria-hidden="true" focusable="false"><use href="#i-spinner"/></svg><span>Envoi en cours…</span>';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        try {
          const photos = await buildPhotoPayload();
          const payload = {
            nom: document.getElementById('f-nom').value.trim(),
            tel: document.getElementById('f-tel').value.trim(),
            email: document.getElementById('f-email').value.trim(),
            ville: document.getElementById('f-ville').value.trim(),
            prestation: document.getElementById('f-type').value,
            surface: document.getElementById('f-surf').value.trim(),
            message: (function () {
              // La date est ajoutée au message : aucun changement nécessaire côté Apps Script
              let m = document.getElementById('f-msg').value.trim();
              const dv = document.getElementById('f-date');
              const fx = document.getElementById('f-flex');
              let line = '';
              if (dv && dv.value) { const x = dv.value.split('-'); line = 'Date souhaitée : ' + x[2] + '/' + x[1] + '/' + x[0] + (fx && fx.checked ? ' (flexible)' : ''); }
              else if (fx && fx.checked) { line = 'Date : flexible'; }
              return (m + (line ? '\n\n' + line : '')).trim();
            })(),
            company: '',
            elapsed: Date.now() - formStartedAt,
            photos: photos
          };

          // text/plain évite la requête "preflight" que Google Apps Script n'accepte pas
          const response = await fetch(QUOTE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          const result = await response.json();

          if (result && result.success) {
            showQuoteSuccess();
          } else {
            throw new Error((result && result.error) || 'SERVER');
          }
        } catch (err) {
          showSubmitError(submitErrorMessage(err && err.message));
        } finally {
          clearTimeout(timeout);
          isSending = false;
          submitBtn.disabled = false;
          submitBtn.classList.remove('opacity-70', 'cursor-wait');
          submitBtn.innerHTML = originalBtn;
        }
      });
    }

    function resetQuoteForm() {
      quoteForm.reset();
      uploadedPhotos.forEach(p => URL.revokeObjectURL(p.url));
      uploadedPhotos = [];
      renderPhotoPreviews();
      document.querySelectorAll('#quote-form .input-error').forEach(el => el.classList.remove('input-error'));
      hideFieldsError();
      hideSubmitError();
      document.getElementById('err-photos').classList.add('hidden');
      document.getElementById('info-photos').classList.add('hidden');
      document.getElementById('form-success').classList.add('hidden');
      document.getElementById('form-fields-wrapper').classList.remove('hidden');
    }


    // Pré-remplissage de la ville depuis les pages locales (ex. /devis/?ville=Créteil)
    function prefillFromUrl() {
      try {
        const q = new URLSearchParams(location.search);
        const ville = (q.get('ville') || '').slice(0, 80);
        const field = document.getElementById('f-ville');
        if (ville && field && !field.value) field.value = ville;

        // Données venant de l'estimateur (/estimation/) : type, surface et résumé
        const type = (q.get('type') || '').slice(0, 80);
        const sel = document.getElementById('f-type');
        if (type && sel && !sel.value) {
          Array.from(sel.options).forEach(o => { if (o.text === type) sel.value = o.value || o.text; });
        }
        const surf = (q.get('surface') || '').replace(/[^0-9.,]/g, '').slice(0, 6);
        const surfField = document.getElementById('f-surf');
        if (surf && surfField && !surfField.value) surfField.value = surf;
        const dateParam = (q.get('date') || '').slice(0, 10);
        const dateField = document.getElementById('f-date');
        if (dateField) {
          const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
          dateField.min = t.toISOString().slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam >= dateField.min && !dateField.value) dateField.value = dateParam;
        }
        const flexField = document.getElementById('f-flex');
        if (flexField && q.get('flex') === '1') flexField.checked = true;
        const note = (q.get('note') || '').slice(0, 400);
        const msg = document.getElementById('f-msg');
        if (note && msg && !msg.value) msg.value = note;
      } catch (e) { /* sans importance */ }
    }

    // ===== Démarrage : dès que la page est construite, sans attendre les photos =====
    if ('IntersectionObserver' in window && !prefersReducedMotion) {
      document.querySelectorAll('.counter-val').forEach(c => { c.textContent = '0'; });
    }
    initScrollAnimations();
    onScrollFrame();
    prefillFromUrl();
    window.addEventListener('load', checkBrokenImages);
    setTimeout(checkBrokenImages, 4000);
