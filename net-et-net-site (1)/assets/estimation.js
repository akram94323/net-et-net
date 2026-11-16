/* Net & Net – estimateur de prix indicatif (calcul 100 % dans le navigateur, aucune donnée envoyée) */
(function () {
  'use strict';

  /* ==========================================================================
     TARIFS — formule de Net & Net. Tout se règle ici.
     Volume (m³) = surface (m²) ÷ diviseur selon l'encombrement
     Prix de base = volume × prixM3, puis majorations en % de ce prix de base.
     ========================================================================== */
  const TARIFS = {
    prixM3: 35,                                          // € par m³
    diviseur: { leger: 4, moyen: 2, charge: 1 },         // m² ÷ diviseur = m³ estimés
    parEtageSansAscenseur: 0.10,                         // +10 % par étage sans ascenseur
    stationnementDifficile: 0.10,                        // +10 % si le camion se gare plus loin
    insalubre: 0.50,                                     // +50 % si insalubre
    minimum: 0,                                          // prix plancher en € (0 = aucun) — à fixer
    marge: { bas: 0.85, haut: 1.25 }                     // fourchette affichée autour du prix calculé
  };

  const LABELS = {
    type: { appartement: 'Appartement', maison: 'Maison', cave: 'Cave / grenier', garage: 'Garage / box', local: 'Local professionnel' },
    niveau: { leger: 'peu encombré', moyen: 'moyennement encombré', charge: 'très chargé' }
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

  function compute() {
    const type = radio('type');
    const niveau = radio('niveau');
    const surface = parseFloat(String($('e-surface').value).replace(',', '.'));
    if (!(type && niveau && isFinite(surface) && surface >= 1 && surface <= 2000)) return null;

    const etage = parseInt($('e-etage').value, 10) || 0;
    const ascenseur = radio('ascenseur') === 'oui';
    const loin = radio('stationnement') === 'difficile';
    const insalubre = radio('insalubre') === 'oui';
    const nettoyage = $('e-nettoyage').checked;

    const volume = surface / TARIFS.diviseur[niveau];
    const base = volume * TARIFS.prixM3;
    const lignes = [['Débarras : ≈ ' + nombre(volume) + ' m³ × ' + TARIFS.prixM3 + ' €', base]];

    let pct = 0;
    if (etage > 0 && !ascenseur) {
      const p = etage * TARIFS.parEtageSansAscenseur; pct += p;
      lignes.push(['Sans ascenseur : ' + etage + ' étage' + (etage > 1 ? 's' : '') + ' (+' + Math.round(p * 100) + ' %)', base * p]);
    }
    if (loin) { pct += TARIFS.stationnementDifficile; lignes.push(['Stationnement éloigné (+' + Math.round(TARIFS.stationnementDifficile * 100) + ' %)', base * TARIFS.stationnementDifficile]); }
    if (insalubre) { pct += TARIFS.insalubre; lignes.push(['Logement insalubre (+' + Math.round(TARIFS.insalubre * 100) + ' %)', base * TARIFS.insalubre]); }

    let total = base * (1 + pct);
    if (total < TARIFS.minimum) { total = TARIFS.minimum; lignes.push(['Prix minimum d’intervention', TARIFS.minimum]); }

    return {
      type, niveau, surface, volume, etage, ascenseur, loin, insalubre, nettoyage, lignes,
      min: fmt(total * TARIFS.marge.bas), max: fmt(total * TARIFS.marge.haut),
      ville: $('e-ville').value.trim().slice(0, 80)
    };
  }

  function summaryText(r) {
    const parts = [
      LABELS.type[r.type] + ', ' + r.surface + ' m², ' + LABELS.niveau[r.niveau] + ' (≈ ' + nombre(r.volume) + ' m³)',
      r.etage > 0 ? ('étage ' + r.etage + (r.ascenseur ? ' avec ascenseur' : ' sans ascenseur')) : 'rez-de-chaussée',
      r.loin ? 'stationnement éloigné' : 'stationnement facile'
    ];
    if (r.insalubre) parts.push('logement insalubre');
    if (r.nettoyage) parts.push('nettoyage souhaité');
    return 'Estimation en ligne (indicative, hors nettoyage) : ' + euros(r.min) + ' à ' + euros(r.max) + '. ' + parts.join(' ; ') + '.';
  }

  function render() {
    const r = compute();
    const box = $('est-result'), empty = $('est-empty'), cta = $('est-cta');
    if (!r) { box.hidden = true; empty.hidden = false; cta.setAttribute('aria-disabled', 'true'); cta.setAttribute('href', '/devis/'); return; }
    empty.hidden = true; box.hidden = false;
    $('est-range').textContent = 'Entre ' + euros(r.min) + ' et ' + euros(r.max);

    const ul = $('est-lines'); ul.textContent = '';
    r.lignes.forEach(l => {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = l[0];
      const b = document.createElement('span'); b.textContent = '≈ ' + euros(l[1]);
      li.appendChild(a); li.appendChild(b); ul.appendChild(li);
    });
    $('est-clean').hidden = !r.nettoyage;

    const q = new URLSearchParams();
    q.set('type', r.nettoyage ? 'Débarras + Nettoyage' : TYPE_FORM[r.type]);
    q.set('surface', String(r.surface));
    if (r.ville) q.set('ville', r.ville);
    q.set('note', summaryText(r));
    cta.setAttribute('href', '/devis/?' + q.toString());
    cta.removeAttribute('aria-disabled');
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', e => e.preventDefault());
  render();
})();
