/* Net & Net – estimateur de prix indicatif (calcul 100 % dans le navigateur, aucune donnée envoyée) */
(function () {
  'use strict';

  /* ==========================================================================
     TARIFS — formule de Net & Net. Tout se règle ici.
     Débarras : volume (m³) = surface ÷ diviseur ; prix = volume × prixM3, puis majorations en %.
     Nettoyage : surface × tarif au m² selon le type ; « très sale » = + 50 % sur le nettoyage.
     ========================================================================== */
  const TARIFS = {
    prixM3: 50,
    diviseur: { leger: 4, moyen: 2, charge: 1 },
    parEtageSansAscenseur: 0.10,
    stationnementDifficile: 0.10,
    insalubre: 0.50,
    nettoyageM2: { apres_debarras: 5, finbail: 8, travaux: 13 },   // « regulier » = sur devis
    nettoyageTresSale: 0.50,
    marge: { bas: 0.85, haut: 1.25 }
  };

  const LABELS = {
    type: { appartement: 'Appartement', maison: 'Maison', cave: 'Cave / grenier', garage: 'Garage / box', local: 'Local professionnel' },
    niveau: { leger: 'peu encombré', moyen: 'moyennement encombré', charge: 'très chargé' },
    net: { apres_debarras: 'nettoyage après débarras', finbail: 'nettoyage de fin de bail', travaux: 'nettoyage après travaux', regulier: 'nettoyage régulier' }
  };
  const TYPE_FORM = {
    appartement: 'Débarras appartement', maison: 'Débarras maison', cave: 'Débarras cave / grenier',
    garage: 'Débarras garage', local: 'Débarras locaux professionnels'
  };

  const $ = id => document.getElementById(id);
  const form = $('est-form');
  if (!form) return;

  const fmt = n => Math.round(n / 10) * 10;
  const euros = n => fmt(n).toLocaleString('fr-FR') + ' €';
  const nombre = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
  const radio = name => { const r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; };
  const check = (name, value) => { const r = form.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (r) r.checked = true; };

  // Date minimale = aujourd'hui
  (function () {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $('e-date').min = d.toISOString().slice(0, 10);
  })();

  // Affiche / masque les blocs selon la prestation choisie
  function syncVisibility() {
    const service = radio('service');
    const withDebarras = service === 'debarras' || service === 'deb_net';
    const withNet = service === 'deb_net' || service === 'net';
    $('grp-debarras').hidden = !withDebarras;
    $('grp-nettoyage').hidden = !withNet;
    // « après débarras » n'a de sens qu'avec un débarras
    $('opt-apres-debarras').hidden = service !== 'deb_net';
    if (withNet) {
      if (service === 'net' && radio('nettoyage') === 'apres_debarras') check('nettoyage', 'finbail');
      if (!radio('nettoyage')) check('nettoyage', service === 'deb_net' ? 'apres_debarras' : 'finbail');
      $('grp-proprete').hidden = radio('nettoyage') === 'regulier';
    }
    return { service, withDebarras, withNet };
  }

  function compute() {
    const { service, withDebarras, withNet } = syncVisibility();
    const type = radio('type');
    const niveau = radio('niveau');
    const surface = parseFloat(String($('e-surface').value).replace(',', '.'));
    if (!(service && type && isFinite(surface) && surface >= 1 && surface <= 2000)) return null;
    if (withDebarras && !niveau) return null;

    const r = { service, type, niveau, surface, lignes: [], total: 0, surDevis: false,
                ville: $('e-ville').value.trim().slice(0, 80), date: $('e-date').value, flex: $('e-flex').checked };

    if (withDebarras) {
      r.etage = parseInt($('e-etage').value, 10) || 0;
      r.ascenseur = radio('ascenseur') === 'oui';
      r.loin = radio('stationnement') === 'difficile';
      r.insalubre = radio('insalubre') === 'oui';
      r.volume = surface / TARIFS.diviseur[niveau];
      const base = r.volume * TARIFS.prixM3;
      r.lignes.push(['Débarras : ≈ ' + nombre(r.volume) + ' m³ × ' + TARIFS.prixM3 + ' €', base]);
      let pct = 0;
      if (r.etage > 0 && !r.ascenseur) {
        const p = r.etage * TARIFS.parEtageSansAscenseur; pct += p;
        r.lignes.push(['Sans ascenseur : ' + r.etage + ' étage' + (r.etage > 1 ? 's' : '') + ' (+' + Math.round(p * 100) + ' %)', base * p]);
      }
      if (r.loin) { pct += TARIFS.stationnementDifficile; r.lignes.push(['Stationnement éloigné (+' + Math.round(TARIFS.stationnementDifficile * 100) + ' %)', base * TARIFS.stationnementDifficile]); }
      if (r.insalubre) { pct += TARIFS.insalubre; r.lignes.push(['Lieu insalubre (+' + Math.round(TARIFS.insalubre * 100) + ' %)', base * TARIFS.insalubre]); }
      r.total += base * (1 + pct);
    }

    if (withNet) {
      r.net = radio('nettoyage');
      r.tresSale = radio('proprete') === 'tres_sale';
      if (r.net === 'regulier') {
        r.surDevis = true;
      } else {
        const tarif = TARIFS.nettoyageM2[r.net];
        const base = surface * tarif;
        r.lignes.push([nombre(surface) + ' m² × ' + tarif + ' € (' + LABELS.net[r.net] + ')', base]);
        let t = base;
        if (r.tresSale) { const s = base * TARIFS.nettoyageTresSale; t += s; r.lignes.push(['Très sale (+' + Math.round(TARIFS.nettoyageTresSale * 100) + ' %)', s]); }
        r.total += t;
      }
    }

    // Nettoyage régulier seul : aucun prix à afficher
    if (r.surDevis && !withDebarras) return r;

    let total = r.total;
    r.min = fmt(total * TARIFS.marge.bas);
    r.max = Math.max(r.min, fmt(total * TARIFS.marge.haut));
    return r;
  }

  function summaryText(r) {
    const parts = [LABELS.type[r.type] + ', ' + r.surface + ' m²'];
    if (r.service !== 'net') {
      parts.push(LABELS.niveau[r.niveau] + ' (≈ ' + nombre(r.volume) + ' m³)');
      parts.push(r.etage > 0 ? ('étage ' + r.etage + (r.ascenseur ? ' avec ascenseur' : ' sans ascenseur')) : 'rez-de-chaussée');
      parts.push(r.loin ? 'stationnement éloigné' : 'stationnement facile');
      if (r.insalubre) parts.push('lieu insalubre');
    }
    if (r.service !== 'debarras') {
      parts.push(LABELS.net[r.net] + (r.net !== 'regulier' && r.tresSale ? ' (très sale)' : ''));
    }
    const prix = r.surDevis && r.service === 'net' ? 'prix sur devis' : (euros(r.min) + ' à ' + euros(r.max));
    return 'Estimation en ligne (indicative) : ' + prix + '. ' + parts.join(' ; ') + '.';
  }

  function render() {
    const r = compute();
    const box = $('est-result'), empty = $('est-empty'), surdevis = $('est-surdevis'), cta = $('est-cta');
    box.hidden = true; surdevis.hidden = true; empty.hidden = true;
    if (!r) { empty.hidden = false; cta.setAttribute('aria-disabled', 'true'); cta.setAttribute('href', '/devis/'); return; }

    if (r.surDevis && r.service === 'net') {
      surdevis.hidden = false;
    } else {
      box.hidden = false;
      $('est-range').textContent = 'Entre ' + euros(r.min) + ' et ' + euros(r.max);
      const ul = $('est-lines'); ul.textContent = '';
      r.lignes.forEach(l => {
        const li = document.createElement('li');
        const a = document.createElement('span'); a.textContent = l[0];
        const b = document.createElement('span'); b.textContent = '≈ ' + euros(l[1]);
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
      $('est-clean').hidden = !(r.surDevis && r.service === 'deb_net');
    }

    const q = new URLSearchParams();
    q.set('type', r.service === 'debarras' ? TYPE_FORM[r.type] : (r.service === 'deb_net' ? 'Débarras + Nettoyage' : (r.type === 'local' ? 'Nettoyage professionnel' : 'Nettoyage particulier')));
    q.set('surface', String(r.surface));
    if (r.ville) q.set('ville', r.ville);
    if (r.date) q.set('date', r.date);
    if (r.flex) q.set('flex', '1');
    q.set('note', summaryText(r));
    cta.setAttribute('href', '/devis/?' + q.toString());
    cta.removeAttribute('aria-disabled');
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', e => e.preventDefault());
  render();
})();
