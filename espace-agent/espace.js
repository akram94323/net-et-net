/* Net & Net – Espace agent (page). Aucune donnée client n'est dans cette page :
   tout est chargé après connexion Google, depuis le script Apps Script. */
(function () {
  'use strict';

  const CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbyAFIKw9khzPvTUfzfGm1O-ABLQxMSO70dcqC0eldzH1mnUNAhnU8t6rVOTeXqE1hEsIw/exec',
    CLIENT_ID: '551648143280-5qd7pm4j9c5g10hbeqgpensuea55a3om.apps.googleusercontent.com',
    TZ: 'Europe/Paris'
  };
  const DEMO = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && /[?&]demo\b/.test(location.search);

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euros = n => Math.round(n).toLocaleString('fr-FR') + ' €';

  let etat = { token: null, tableau: null, onglet: 'nouvelles', sel: null, formOuvert: false };

  /* ---------------- Heure de France ---------------- */
  const fmtParis = (ms, opts) => new Date(ms).toLocaleString('fr-FR', Object.assign({ timeZone: CONFIG.TZ }, opts));
  function horloge() { $('#horloge').textContent = '🇫🇷 ' + fmtParis(Date.now(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }); }
  horloge(); setInterval(horloge, 20000);

  // « 2026-12-03T14:30 » saisi en heure de France → horodatage
  function parisVersMs(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
    if (!m) return null;
    const naif = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(naif)).map(x => [x.type, x.value]));
    const vu = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    return naif - (vu - naif);
  }
  function depuis(ms) {
    const min = Math.floor((Date.now() - ms) / 60000);
    if (min < 60) return 'il y a ' + Math.max(0, min) + ' min';
    if (min < 48 * 60) return 'il y a ' + Math.floor(min / 60) + ' h';
    return 'il y a ' + Math.floor(min / 1440) + ' j';
  }

  /* ---------------- Toast ---------------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500);
  }

  /* ---------------- Connexion Google ---------------- */
  function jwtExp(tok) {
    try { return JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch (e) { return 0; }
  }
  function lireToken() {
    try { const t = sessionStorage.getItem('nn_agent_tok'); return t && jwtExp(t) > Date.now() + 60000 ? t : null; } catch (e) { return null; }
  }
  function garderToken(t) { try { sessionStorage.setItem('nn_agent_tok', t); } catch (e) { /* navigation privée */ } }
  function oublierToken() { try { sessionStorage.removeItem('nn_agent_tok'); } catch (e) { /* rien */ } }

  function ecranConnexion(msg) {
    etat.token = null;
    $('#ecran-tableau').hidden = true; $('#who').hidden = true; $('#ecran-connexion').hidden = false;
    $('#login-msg').textContent = msg || '';
    if (DEMO) {
      $('#login-btn').innerHTML = '<button type="button" class="btn" id="demo-login">Entrer (démo)</button>';
      $('#demo-login').onclick = () => connecte('demo');
      return;
    }
    if (!window.google || !google.accounts) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => ecranConnexion(msg);
      document.head.appendChild(s);
      return;
    }
    google.accounts.id.initialize({ client_id: CONFIG.CLIENT_ID, callback: r => connecte(r.credential), auto_select: true, itp_support: true });
    google.accounts.id.renderButton($('#login-btn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'fr' });
    google.accounts.id.prompt();
  }

  function connecte(tok) {
    etat.token = tok; if (!DEMO) garderToken(tok);
    $('#ecran-connexion').hidden = true; $('#ecran-tableau').hidden = false; $('#who').hidden = false;
    charger();
  }

  $('#btn-deconnexion').onclick = () => {
    oublierToken();
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    ecranConnexion('Tu es déconnecté.');
  };

  /* ---------------- Appels au serveur ---------------- */
  async function api(action, extra) {
    if (DEMO) return demoApi(action, extra || {});
    const res = await fetch(CONFIG.ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action, token: etat.token }, extra || {}))
    });
    const j = await res.json();
    if (!j.ok) {
      if (j.error === 'AUTH') { oublierToken(); ecranConnexion('Session expirée : reconnecte-toi.'); throw new Error('AUTH'); }
      if (j.error === 'BLOQUE') { ecranConnexion('Ton accès est momentanément suspendu. Contacte Akram.'); throw new Error('BLOQUE'); }
      throw new Error(j.message || 'Erreur serveur');
    }
    return j.data;
  }

  /* ---------------- Tableau de bord ---------------- */
  async function charger(silencieux) {
    try {
      const t = await api('tableau');
      etat.tableau = t;
      $('#who-nom').textContent = 'Bonjour ' + (t.utilisateur.prenom || '') + ' 👋';
      rendreKpis(t); rendreConsigne(t); rendreListe(); rendreLiens(t);
    } catch (e) {
      if (!silencieux && e.message !== 'AUTH' && e.message !== 'BLOQUE') toast('⚠️ ' + e.message);
    }
  }
  setInterval(() => { if (etat.token && !etat.formOuvert && !document.hidden) charger(true); }, 60000);

  function rendreKpis(t) {
    const s = t.stats;
    const urg = t.nouvelles.filter(x => Date.now() - x.recu > 3600e3).length;
    const k = [
      [t.nouvelles.length, 'nouvelles demandes à appeler', urg > 0],
      [t.rappels.length, 'rappels prévus aujourd\'hui', false],
      [s.appelsJour + ' / ' + s.devisJour, 'appels / devis aujourd\'hui', false],
      [s.devisSemaine + ' / ' + s.appelsSemaine, 'devis / appels cette semaine', false],
      [s.prospectsSemaine + ' · ' + s.prospectsInteresses + ' ✓', 'appels pros · intéressés (semaine)', false]
    ];
    $('#kpis').innerHTML = k.map(x => '<div class="kpi' + (x[2] ? ' alerte' : '') + '"><div class="v">' + esc(x[0]) + '</div><div class="l">' + esc(x[1]) + '</div></div>').join('');
  }
  function rendreConsigne(t) {
    const c = $('#consigne');
    if (t.consigne && t.consigne.texte) { c.hidden = false; c.innerHTML = '📢 <b>Consigne d\'Akram</b> <span class="muted small">(' + esc(t.consigne.date) + ')</span><br>' + esc(t.consigne.texte); }
    else c.hidden = true;
  }
  function rendreLiens(t) {
    const L = t.liens || {};
    const noms = { scriptClientGuide: 'Script client (guidé)', scriptClientCourt: 'Script client (court)', scriptProGuide: 'Script pros (guidé)', scriptProCourt: 'Script pros (court)', tarifs: 'Tarifs, FAQ, lexique' };
    $('#liens').innerHTML = Object.keys(noms).filter(k => L[k]).map(k => '<a href="' + esc(L[k]) + '" target="_blank" rel="noopener">📄 ' + esc(noms[k]) + '</a>').join('');
  }

  $$('.tab').forEach(b => b.addEventListener('click', () => {
    etat.onglet = b.dataset.tab;
    $$('.tab').forEach(x => x.classList.toggle('active', x === b));
    rendreListe();
  }));

  function rendreListe() {
    const t = etat.tableau; if (!t) return;
    $('#n-nouvelles').textContent = t.nouvelles.length;
    $('#n-rappels').textContent = t.rappels.length;
    $('#n-prospects').textContent = t.prospects.length;
    $('#btn-ajout-prospect').hidden = etat.onglet !== 'prospects';
    let html = '';
    if (etat.onglet === 'nouvelles') {
      html = t.nouvelles.map(x => {
        const h = (Date.now() - x.recu) / 3600e3;
        const p = h > 1 ? '<span class="pastille p-urgent">' + depuis(x.recu) + '</span>' : '<span class="pastille p-ok">' + depuis(x.recu) + '</span>';
        return item('c', x.row, x.ts, esc(x.nom), p, esc(x.ville) + ' · ' + esc(x.prestation) + (x.tentatives ? ' · essai n°' + (x.tentatives + 1) : ''));
      }).join('') || vide('Aucune nouvelle demande. Passe aux rappels ou à la prospection 💪');
    } else if (etat.onglet === 'rappels') {
      html = t.rappels.map(x => {
        const late = x.rappel && x.rappel < Date.now();
        const p = '<span class="pastille ' + (late ? 'p-urgent' : 'p-warn') + '">' + (x.rappel ? fmtParis(x.rappel, { hour: '2-digit', minute: '2-digit' }) : '–') + '</span>';
        return item('c', x.row, x.ts, esc(x.nom), p, esc(x.ville) + ' · ' + esc(x.prestation));
      }).join('') || vide('Aucun rappel prévu aujourd\'hui.');
    } else {
      html = t.prospects.map(x => {
        const p = x.statut === 'Rappeler' ? '<span class="pastille p-warn">rappel</span>' : (x.appels ? '<span class="pastille p-ok">' + x.appels + ' appel(s)</span>' : '');
        return item('p', x.row, '', esc(x.structure), p, esc(x.categorie) + ' · ' + esc(x.ville));
      }).join('') || vide('Pas de prospect à appeler. Ajoute-en avec le bouton ci-dessous.');
    }
    $('#liste').innerHTML = html;
    $$('#liste .item').forEach(b => b.addEventListener('click', () => ouvrir(b.dataset.k, b.dataset.row, b.dataset.ts)));
  }
  const item = (k, row, ts, titre, pastille, sous) =>
    '<button type="button" class="item' + (etat.sel === k + row ? ' sel' : '') + '" data-k="' + k + '" data-row="' + row + '" data-ts="' + ts + '"><div class="t"><span>' + titre + '</span>' + pastille + '</div><div class="s">' + sous + '</div></button>';
  const vide = msg => '<div class="vide-liste">' + esc(msg) + '</div>';

  async function ouvrir(k, row, ts) {
    etat.sel = k + row; rendreListe();
    $('#detail').innerHTML = '<p class="muted">Chargement…</p>';
    try {
      if (k === 'c') ficheClient(await api('fiche', { row: Number(row), ts: Number(ts) }));
      else ficheProspect(await api('prospect', { row: Number(row) }));
      if (window.innerWidth < 900) $('#detail').scrollIntoView({ behavior: 'smooth' });
    } catch (e) { $('#detail').innerHTML = '<p class="erreur">' + esc(e.message) + '</p>'; }
  }

  /* ---------------- Fiche client ---------------- */
  const TARIFS = { prixM3: 50, diviseur: { leger: 4, moyen: 2, charge: 1 }, parEtage: 0.10, loin: 0.10, insalubre: 0.50,
    netM2: { apres_debarras: 5, finbail: 8, travaux: 13 }, tresSale: 0.50, bas: 0.85, haut: 1.25 };
  function estimation(c) {
    const surface = parseFloat(String(c.surface || '').replace(',', '.'));
    if (!(surface >= 1 && surface <= 2000)) return null;
    const deb = c.service !== 'net', net = c.service !== 'debarras';
    let total = 0;
    if (deb) {
      if (!TARIFS.diviseur[c.encombrement]) return null;
      const base = surface / TARIFS.diviseur[c.encombrement] * TARIFS.prixM3;
      let pct = 0; const et = parseInt(c.etage, 10) || 0;
      if (et > 0 && c.ascenseur !== 'oui') pct += et * TARIFS.parEtage;
      if (c.stationnement === 'difficile') pct += TARIFS.loin;
      if (c.insalubre === 'oui') pct += TARIFS.insalubre;
      total += base * (1 + pct);
    }
    if (net) {
      const t = TARIFS.netM2[c.nettoyage];
      if (t) total += surface * t * (c.tresSale === 'oui' ? 1 + TARIFS.tresSale : 1);
      else if (!deb) return null;
    }
    const r10 = n => Math.round(n / 10) * 10;
    const min = r10(total * TARIFS.bas);
    return { min: min, max: Math.max(min, r10(total * TARIFS.haut)) };
  }

  const radios = (name, opts, val) => '<div class="choix">' + opts.map(o => '<label><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (String(val) === o[0] ? ' checked' : '') + '> ' + esc(o[1]) + '</label>').join('') + '</div>';
  const champ = (lbl, html) => '<label class="champ">' + esc(lbl) + html + '</label>';
  const txt = (name, val, ph, type) => '<input type="' + (type || 'text') + '" name="' + name + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '">';

  function ficheClient(f) {
    etat.formOuvert = true;
    const c = f.champs || {};
    const presta = f.prestation.toLowerCase().indexOf('nettoyage') >= 0 && f.prestation.toLowerCase().indexOf('débarras') < 0 ? 'un nettoyage' : 'un débarras';
    $('#detail').innerHTML =
      '<div class="entete"><div><h2>' + esc(f.nom) + '</h2><div class="muted small">Demande reçue ' + esc(depuis(f.recu)) + ' · ' + esc(f.prestation) + (f.tentatives ? ' · ' + f.tentatives + ' essai(s) déjà' : '') + '</div></div>' +
      '<a class="tel" href="tel:' + esc(f.tel.replace(/[^\d+]/g, '')) + '">📞 ' + esc(f.tel) + '</a></div>' +
      '<div class="infos"><div><b>Ville</b><br>' + esc(f.ville) + '</div><div><b>Région</b><br>' + esc(f.region || '–') + '</div><div><b>Surface indiquée</b><br>' + esc(c.surface || '–') + ' m²</div><div><b>Photos envoyées</b><br>' + f.nbPhotos + '</div></div>' +
      (f.message ? '<div class="message"><b>Message du client :</b>\n' + esc(f.message) + '</div>' : '') +
      (f.notes ? '<h3>Historique</h3><div class="historique">' + esc(f.notes) + '</div>' : '') +
      '<div class="dire">Bonjour, je suis bien avec ' + esc(f.nom) + ' ? Je suis ' + esc(etat.tableau.utilisateur.prenom || '[ton prénom]') + ', de la société Net &amp; Net. Je vous appelle suite à votre demande de devis pour ' + presta + '. Vous avez cinq minutes pour que je prépare votre devis ?</div>' +
      '<div class="manque" id="manque"></div>' +
      '<form id="form-fiche" novalidate>' +
      '<div class="bloc"><h3>1. Le besoin</h3><div class="grille">' +
        champ('Prestation', radios('service', [['debarras', 'Débarras'], ['deb_net', 'Débarras + nettoyage'], ['net', 'Nettoyage seul']], c.service)) +
        champ('Adresse exacte du lieu', txt('adresse', c.adresse, 'n°, rue, code postal, ville')) +
        champ('Type de lieu', '<select name="type"><option value="">–</option>' + [['appartement', 'Appartement'], ['maison', 'Maison'], ['cave', 'Cave / grenier'], ['garage', 'Garage / box'], ['local', 'Local professionnel']].map(o => '<option value="' + o[0] + '"' + (c.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') +
        champ('Surface (m²) – 1 pièce ≈ 15 m²', txt('surface', c.surface, 'ex. 60', 'number')) +
      '</div></div>' +
      '<div class="bloc" id="bloc-deb"><h3>2. Le débarras</h3><div class="grille">' +
        champ('Encombrement', radios('encombrement', [['leger', 'Peu rempli'], ['moyen', 'Normal (habité)'], ['charge', 'Très chargé']], c.encombrement)) +
        champ('Étage', '<select name="etage">' + [0, 1, 2, 3, 4, 5, 6, 7].map(n => '<option value="' + n + '"' + (String(c.etage) === String(n) ? ' selected' : '') + '>' + (n === 0 ? 'Rez-de-chaussée' : n + (n === 1 ? 'er' : 'e') + ' étage' + (n === 7 ? ' ou plus' : '')) + '</option>').join('') + '</select>') +
        champ('Ascenseur', radios('ascenseur', [['non', 'Non'], ['oui', 'Oui']], c.ascenseur || '')) +
        champ('Camion à moins de 20 m ?', radios('stationnement', [['facile', 'Oui, facile'], ['difficile', 'Non, difficile']], c.stationnement || '')) +
        champ('Lieu insalubre (très sale, odeurs, nuisibles) ?', radios('insalubre', [['non', 'Non'], ['oui', 'Oui']], c.insalubre || '')) +
        champ('Objets particuliers (piano, coffre, gaz, peinture…)', txt('objets', c.objets, 'rien / à préciser')) +
        champ('Objets à garder ou de valeur', txt('garder', c.garder, 'rien / à préciser')) +
      '</div></div>' +
      '<div class="bloc" id="bloc-net"><h3>3. Le nettoyage</h3><div class="grille">' +
        champ('Type de nettoyage', '<select name="nettoyage"><option value="">–</option>' + [['apres_debarras', 'Après débarras (5 €/m²)'], ['finbail', 'Fin de bail (8 €/m²)'], ['travaux', 'Après travaux (13 €/m²)'], ['regulier', 'Régulier (sur devis)']].map(o => '<option value="' + o[0] + '"' + (c.nettoyage === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') +
        champ('Très sale ?', radios('tresSale', [['non', 'Non'], ['oui', 'Oui']], c.tresSale || '')) +
      '</div></div>' +
      '<div class="bloc"><h3>4. Organisation</h3><div class="grille">' +
        champ('Date souhaitée', txt('date', c.date, 'ex. fin décembre, flexible')) +
        champ('Accès le jour J', txt('acces', c.acces, 'présent / gardien / clés…')) +
        champ('Qui décide ?', txt('decideur', c.decideur, 'lui-même / famille / agence…')) +
        champ('E-mail pour le devis', txt('email', c.email, 'à confirmer', 'email')) +
        champ('Photos', '<div class="choix"><label><input type="checkbox" name="photos" value="oui"' + (c.photos === 'oui' ? ' checked' : '') + '> Photos demandées par WhatsApp</label></div>') +
      '</div></div>' +
      '<div class="estim"><div><div class="muted small">Estimation indicative à annoncer</div><div class="prix" id="prix">–</div></div><div class="small muted" id="prix-aide">Remplis surface et encombrement.</div></div>' +
      '<div class="dire" id="dire-prix" hidden></div>' +
      '<div class="bloc"><h3>5. Résultat de l\'appel</h3>' +
        '<div class="choix resultats">' + [['Devis à préparer', '✅ Intéressé → devis'], ['Rappel prévu', '⏰ Rappeler'], ['Pas de réponse', '📵 Pas de réponse'], ['Pas intéressé', '❌ Pas intéressé']].map(o => '<label><input type="radio" name="resultat" value="' + o[0] + '"> ' + o[1] + '</label>').join('') + '</div>' +
        '<div class="grille" style="margin-top:.7rem">' +
          '<label class="champ" id="zone-rappel" hidden>Date et heure du rappel (heure de France)<input type="datetime-local" name="rappel"></label>' +
          '<label class="champ" id="zone-motif" hidden>Pourquoi ? (obligatoire)<select name="motif"><option value="">–</option>' + etat.tableau.motifs.map(m => '<option>' + esc(m) + '</option>').join('') + '</select></label>' +
        '</div>' +
        '<label class="champ" style="margin-top:.7rem">Notes (ce que le client a dit d\'important)<textarea name="notes" placeholder="ex. succession, veut garder la commode, disponible le samedi…"></textarea></label>' +
      '</div>' +
      '<p class="erreur" id="err"></p>' +
      '<div class="actions"><button type="button" class="btn-ghost" id="annuler">Fermer</button><button type="submit" class="btn" id="enregistrer">Enregistrer la fiche</button></div>' +
      '</form>';

    const form = $('#form-fiche');
    const val = n => { const el = form.elements[n]; if (!el) return ''; if (el instanceof RadioNodeList) return el.value; if (el.type === 'checkbox') return el.checked ? el.value : ''; return el.value.trim(); };
    const lire = () => ({ service: val('service') || 'debarras', adresse: val('adresse'), type: val('type'), surface: val('surface'), encombrement: val('encombrement'),
      etage: val('etage'), ascenseur: val('ascenseur'), stationnement: val('stationnement'), insalubre: val('insalubre'), objets: val('objets'),
      garder: val('garder'), nettoyage: val('nettoyage'), tresSale: val('tresSale'), date: val('date'), acces: val('acces'), decideur: val('decideur'),
      email: val('email'), photos: val('photos') });

    function maj() {
      const d = lire();
      $('#bloc-deb').hidden = d.service === 'net';
      $('#bloc-net').hidden = d.service === 'debarras';
      const e = estimation(d);
      $('#prix').textContent = e ? euros(e.min) + ' – ' + euros(e.max) : (d.service === 'net' && d.nettoyage === 'regulier' ? 'Sur devis' : '–');
      $('#prix-aide').textContent = e ? 'Toujours dire « estimation », le devis exact suit sous 24 h.' : 'Remplis la surface' + (d.service !== 'net' ? ' et l\'encombrement' : ' et le type de nettoyage') + '.';
      $('#dire-prix').hidden = !e;
      if (e) $('#dire-prix').textContent = 'D\'après ce que vous me dites, le prix serait entre ' + euros(e.min) + ' et ' + euros(e.max) + '. C\'est une estimation : notre responsable vérifie avec les photos et vous envoie le devis exact par e-mail sous 24 heures. Le devis est gratuit et sans engagement.';
      const manque = [];
      if (!d.adresse) manque.push('adresse exacte');
      if (!d.type) manque.push('type de lieu');
      if (!d.surface) manque.push('surface');
      if (d.service !== 'net') {
        if (!d.encombrement) manque.push('encombrement');
        if (d.etage !== '0' && !d.ascenseur) manque.push('ascenseur');
        if (!d.stationnement) manque.push('stationnement');
      }
      if (d.service !== 'debarras' && !d.nettoyage) manque.push('type de nettoyage');
      if (!d.date) manque.push('date souhaitée');
      if (!d.email) manque.push('e-mail');
      if (!d.photos) manque.push('demander les photos');
      $('#manque').hidden = !manque.length;
      $('#manque').textContent = '⚠️ À demander : ' + manque.join(', ');
      const r = val('resultat');
      $('#zone-rappel').hidden = r !== 'Rappel prévu';
      $('#zone-motif').hidden = r !== 'Pas intéressé';
    }
    form.addEventListener('input', maj); form.addEventListener('change', maj); maj();
    $('#annuler').onclick = fermer;

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const r = val('resultat'), err = $('#err');
      err.textContent = '';
      if (!r) { err.textContent = 'Choisis le résultat de l\'appel.'; return; }
      const rappel = r === 'Rappel prévu' ? parisVersMs(val('rappel')) : null;
      if (r === 'Rappel prévu' && !rappel) { err.textContent = 'Indique la date et l\'heure du rappel.'; return; }
      if (r === 'Pas intéressé' && !val('motif')) { err.textContent = 'Choisis le motif du refus.'; return; }
      if (r === 'Devis à préparer' && !estimation(lire()) && lire().nettoyage !== 'regulier') { err.textContent = 'Pour un devis, il faut au moins la surface et l\'encombrement.'; return; }
      const b = $('#enregistrer'); b.disabled = true; b.textContent = 'Enregistrement…';
      try {
        const out = await api('enregistrerFiche', { row: f.row, ts: f.ts, champs: lire(), resultat: r, rappel: rappel, motif: val('motif'), notes: val('notes') });
        toast({ 'Devis à préparer': '✅ Transmis à Akram pour le devis', 'Rappel prévu': '⏰ Rappel enregistré', 'Injoignable': '📵 Classé injoignable (3 essais)', 'À appeler': '📵 Essai noté, à rappeler plus tard', 'Pas intéressé': '❌ Refus enregistré' }[out.statut] || 'Enregistré');
        fermer(); charger(true);
      } catch (e) { err.textContent = e.message; b.disabled = false; b.textContent = 'Enregistrer la fiche'; }
    });
  }

  function fermer() {
    etat.formOuvert = false; etat.sel = null; rendreListe();
    $('#detail').innerHTML = '<div class="vide"><p class="big">📋</p><p>Choisis le suivant dans la liste.</p></div>';
  }

  /* ---------------- Fiche prospect ---------------- */
  const ACCROCHES = {
    'Notaire': 'pour les logements à vider dans le cadre de successions',
    'Agence immobilière': 'quand un locataire laisse un logement encombré, ou pour les nettoyages de fin de bail',
    'Syndic': 'pour vider les caves et les parties communes encombrées',
    'Bailleur social': 'pour remettre rapidement en état les logements entre deux locataires',
    'EHPAD / résidence seniors': 'pour aider les familles à vider une chambre ou un logement',
    'Commissaire de justice / mandataire': 'pour vider des locaux après une liquidation ou une procédure',
    'Déménageur': 'pour prendre en charge la partie débarras de vos déménagements'
  };
  function ficheProspect(p) {
    etat.formOuvert = true;
    const acc = ACCROCHES[p.categorie] || 'pour vos besoins de débarras et de nettoyage';
    $('#detail').innerHTML =
      '<div class="entete"><div><h2>' + esc(p.structure) + '</h2><div class="muted small">' + esc(p.categorie) + ' · ' + esc(p.ville) + (p.appels ? ' · ' + p.appels + ' appel(s)' : '') + '</div></div>' +
      '<a class="tel" href="tel:' + esc(p.tel.replace(/[^\d+]/g, '')) + '">📞 ' + esc(p.tel) + '</a></div>' +
      '<p class="muted small">Appels pros : du lundi au vendredi, 9h30–12h et 14h–17h30 (heure de France).</p>' +
      (p.notes ? '<h3>Historique</h3><div class="historique">' + esc(p.notes) + '</div>' : '') +
      '<div class="dire">Bonjour, ' + esc(etat.tableau.utilisateur.prenom || '[ton prénom]') + ' de la société Net &amp; Net. Nous sommes une entreprise de débarras et de nettoyage. Nous travaillons avec des professionnels comme vous ' + esc(acc) + '. Est-ce que ce genre de situation vous arrive ?</div>' +
      '<form id="form-pro" novalidate><div class="bloc"><div class="grille">' +
        champ('Interlocuteur', txt('interlocuteur', p.interlocuteur, 'Nom')) +
        champ('Fonction', txt('fonction', p.fonction, 'ex. clerc, gestionnaire')) +
        champ('E-mail (pour la présentation)', txt('email', p.email, '', 'email')) +
      '</div></div>' +
      '<div class="bloc"><h3>Résultat</h3><div class="choix resultats">' +
        etat.tableau.resultatsPro.map(o => '<label><input type="radio" name="resultat" value="' + esc(o) + '"> ' + esc(o) + '</label>').join('') + '</div>' +
        '<label class="champ" id="zone-rappel-pro" hidden style="margin-top:.7rem">Date du rappel (heure de France)<input type="datetime-local" name="rappel"></label>' +
        '<label class="champ" style="margin-top:.7rem">Notes<textarea name="notes" placeholder="besoins, fréquence, prestataire actuel, dossier en cours…"></textarea></label>' +
      '</div><p class="erreur" id="err"></p>' +
      '<div class="actions"><button type="button" class="btn-ghost" id="annuler">Fermer</button><button type="submit" class="btn" id="enregistrer">Enregistrer</button></div></form>';
    const form = $('#form-pro');
    const v = n => (form.elements[n] instanceof RadioNodeList ? form.elements[n].value : form.elements[n].value.trim());
    form.addEventListener('change', () => { $('#zone-rappel-pro').hidden = v('resultat') !== 'Rappeler'; });
    $('#annuler').onclick = fermer;
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const r = v('resultat'), err = $('#err'); err.textContent = '';
      if (!r) { err.textContent = 'Choisis le résultat.'; return; }
      const rappel = r === 'Rappeler' ? parisVersMs(v('rappel')) : null;
      if (r === 'Rappeler' && !rappel) { err.textContent = 'Indique la date du rappel.'; return; }
      if (r === 'Ne plus appeler' && !confirm('Confirmer : ce numéro ne sera plus jamais appelé ?')) return;
      const b = $('#enregistrer'); b.disabled = true;
      try {
        await api('enregistrerProspect', { row: p.row, resultat: r, rappel: rappel, notes: v('notes'), interlocuteur: v('interlocuteur'), fonction: v('fonction'), email: v('email') });
        toast(r.indexOf('Intéressé') === 0 ? '🤝 Transmis à Akram' : 'Enregistré'); fermer(); charger(true);
      } catch (e) { err.textContent = e.message; b.disabled = false; }
    });
  }

  $('#btn-ajout-prospect').onclick = () => {
    etat.formOuvert = true;
    const cats = (etat.tableau && etat.tableau.categories) || [];
    $('#detail').innerHTML = '<h2>Ajouter un prospect</h2><p class="muted small">Uniquement des professionnels. Le numéro est vérifié : pas de doublon, et jamais un numéro de la liste « ne plus appeler ».</p>' +
      '<form id="form-ajout" novalidate><div class="grille">' +
      champ('Catégorie', '<select name="categorie">' + cats.map(c => '<option>' + esc(c) + '</option>').join('') + '</select>') +
      champ('Nom de la structure *', txt('structure', '', 'ex. Étude Me Durand')) +
      champ('Téléphone *', txt('tel', '', '01 23 45 67 89', 'tel')) +
      champ('Ville', txt('ville', '')) + champ('Interlocuteur', txt('interlocuteur', '')) + champ('Fonction', txt('fonction', '')) +
      champ('E-mail', txt('email', '', '', 'email')) + champ('Source', txt('source', '', 'ex. Pages Jaunes, site web')) +
      '</div><p class="erreur" id="err"></p><div class="actions"><button type="button" class="btn-ghost" id="annuler">Fermer</button><button type="submit" class="btn">Ajouter</button></div></form>';
    const form = $('#form-ajout');
    $('#annuler').onclick = fermer;
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const d = {}; ['categorie', 'structure', 'tel', 'ville', 'interlocuteur', 'fonction', 'email', 'source'].forEach(k => { d[k] = form.elements[k].value.trim(); });
      try { await api('ajouterProspect', d); toast('➕ Prospect ajouté'); fermer(); charger(true); }
      catch (e) { $('#err').textContent = e.message; }
    });
  };

  /* ---------------- Démo locale (127.0.0.1/?demo) ---------------- */
  function demoApi(action) {
    const now = Date.now();
    const T = {
      utilisateur: { prenom: 'Karim', role: 'agent' },
      nouvelles: [
        { row: 2, ts: now - 2.5 * 3600e3, recu: now - 2.5 * 3600e3, nom: 'Sophie Martin', ville: '92100 Boulogne', prestation: 'Débarras appartement', tentatives: 1 },
        { row: 3, ts: now - 12 * 60e3, recu: now - 12 * 60e3, nom: 'Jean Dupont', ville: '75011 Paris', prestation: 'Débarras cave / grenier', tentatives: 0 }],
      rappels: [{ row: 4, ts: now - 864e5, recu: now - 864e5, rappel: now + 2 * 3600e3, nom: 'Leila Benali', ville: '94000 Créteil', prestation: 'Nettoyage fin de bail' }],
      prospects: [
        { row: 2, structure: 'Étude Me Durand', categorie: 'Notaire', ville: 'Vincennes', statut: 'À appeler', appels: 0 },
        { row: 3, structure: 'Agence Immo Est', categorie: 'Agence immobilière', ville: 'Saint-Mandé', statut: 'Rappeler', appels: 1 }],
      stats: { appelsSemaine: 18, devisSemaine: 6, refusSemaine: 4, appelsJour: 5, devisJour: 2, prospectsSemaine: 42, prospectsInteresses: 3 },
      consigne: { texte: 'Priorité aux caves ce mois-ci, et rappelle toutes les nouvelles demandes dans l\'heure 💪', date: '28/11/2026 09:00' },
      liens: { scriptClientGuide: '#', scriptClientCourt: '#', scriptProGuide: '#', scriptProCourt: '#', tarifs: '#' },
      motifs: ['Prix trop élevé', 'A trouvé une autre entreprise', 'Projet reporté', 'Voulait seulement une idée du prix', 'Hors zone / prestation non proposée', 'Le fera lui-même', 'Autre'],
      categories: ['Notaire', 'Agence immobilière', 'Syndic', 'Bailleur social', 'EHPAD / résidence seniors', 'Commissaire de justice / mandataire', 'Déménageur', 'Autre'],
      resultatsPro: ['Intéressé – dossier en cours', 'Intéressé – présentation', 'Rappeler', 'Pas intéressé', 'Ne plus appeler', 'Pas de réponse']
    };
    if (action === 'tableau') return Promise.resolve(T);
    if (action === 'fiche') return Promise.resolve({ row: 2, ts: now - 2.5 * 3600e3, recu: now - 2.5 * 3600e3, nom: 'Sophie Martin', tel: '06 12 34 56 78', ville: '92100 Boulogne', region: 'Hauts-de-Seine (92)',
      prestation: 'Débarras appartement', message: 'Appartement de ma mère à vider avant la vente, beaucoup de meubles et de cartons.\n\nDate souhaitée : 20/12/2026 (flexible)', nbPhotos: 2, tentatives: 1,
      notes: '[28/11 10:05] Pas de réponse.', champs: { service: 'debarras', type: 'appartement', surface: '60', email: 'sophie.m@example.com', etage: '3' } });
    if (action === 'prospect') return Promise.resolve({ row: 2, structure: 'Étude Me Durand', categorie: 'Notaire', interlocuteur: '', fonction: '', tel: '01 43 00 00 00', email: '', ville: 'Vincennes', statut: 'À appeler', appels: 0, notes: '' });
    return new Promise(r => setTimeout(() => r({ statut: 'Devis à préparer' }), 400));
  }

  /* ---------------- Démarrage ---------------- */
  const t = lireToken();
  if (t) connecte(t); else ecranConnexion();
})();
