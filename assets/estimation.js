/* Net & Net – estimateur de prix indicatif (calcul 100 % dans le navigateur, aucune donnée envoyée) */
(function () {
  'use strict';

  /* ==========================================================================
     TARIFS — tout se règle ici.
     Chaque liste = [surface maximale de la tranche (m²), prix au m²].
     Le tarif de la tranche s'applique à TOUTE la surface saisie.
     ========================================================================== */
  const TARIFS = {
    debarras: {
      appartement: [[50, 40], [100, 37], [200, 35], [Infinity, 33]],
      maison:      [[50, 40], [100, 37], [200, 35], [Infinity, 33]],
      cave:        [[10, 35], [Infinity, 40]],
      garage:      [[20, 35], [Infinity, 40]],
      local:       [[Infinity, 50]],
      entrepot:    [[50, 60], [100, 50], [200, 40], [Infinity, 30]]
    },
    nettoyage: {
      appartement: [[50, 10], [100, 8], [200, 6], [Infinity, 4]],
      maison:      [[50, 12], [100, 10], [200, 8], [Infinity, 6]],
      cave:        [[Infinity, 15]],
      garage:      [[Infinity, 10]],
      local:       [[Infinity, 10]],
      entrepot:    [[Infinity, 10]]
    },
    encombrement: { leger: 0, moyen: 0.12, charge: 0.25 },   // % du prix du débarras
    proprete: { propre: 0, encrasse: 0.20, tres: 0.50 },     // % du prix du nettoyage
    insalubre: 0.50,               // % du prix de base (pas cumulé avec « très encrassé »)
    parEtageSansAscenseur: 50,     // € par étage sans ascenseur (sous-sol −1 = 1 étage)
    accesCave: 50,                 // € : cave / grenier = accès par escalier, compté d'office
    stationnementLoin: 100,        // € si le camion se gare loin
    vitres: { parM2: 1, min: 30, max: 300 },  // option vitres : € par m² nettoyé, borné
    surDevisEntrepot: 500,         // m² : au-delà, entrepôt « sur devis »
    marge: { bas: 0.85, haut: 1.25 }
  };

  const LABELS = {
    type: { appartement: 'Appartement', maison: 'Maison', cave: 'Cave / grenier', garage: 'Garage / box', local: 'Local commercial', entrepot: 'Entrepôt' },
    niveau: { leger: 'peu encombré', moyen: 'moyennement encombré', charge: 'très chargé' },
    proprete: { propre: 'entretenu', encrasse: 'encrassé', tres: 'très encrassé' },
    service: { debarras: 'Débarras', nettoyage: 'Nettoyage', both: 'Débarras + nettoyage' }
  };
  const TYPE_FORM_DEBARRAS = {
    appartement: 'Débarras appartement', maison: 'Débarras maison', cave: 'Débarras cave / grenier',
    garage: 'Débarras garage', local: 'Débarras locaux professionnels', entrepot: 'Débarras locaux professionnels'
  };

  const fmt = n => Math.round(n / 10) * 10;
  const euros = n => fmt(n).toLocaleString('fr-FR') + ' €';
  const nombre = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
  const pct = n => Math.round(n * 100);
  const tarif = (table, surface) => { for (const t of table) if (surface <= t[0]) return t[1]; return table[table.length - 1][1]; };

  /* Calcul pur (testable) : renvoie { surDevis } ou { lignes, total, min, max } */
  function estimer(p) {
    const doD = p.service === 'debarras' || p.service === 'both';
    const doN = p.service === 'nettoyage' || p.service === 'both';

    if (p.type === 'entrepot' && ((doD && p.surfD > TARIFS.surDevisEntrepot) || (doN && p.surfN > TARIFS.surDevisEntrepot))) {
      return { surDevis: true };
    }

    const lignes = [];

    if (doD) {
      const prix = tarif(TARIFS.debarras[p.type], p.surfD);
      const base = p.surfD * prix;
      lignes.push(['Débarras : ' + nombre(p.surfD) + ' m² × ' + prix + ' €', base]);
      const e = TARIFS.encombrement[p.niveau];
      if (e > 0) lignes.push(['Encombrement : ' + LABELS.niveau[p.niveau] + ' (+' + pct(e) + ' %)', base * e]);
      if (p.insalubre) lignes.push(['Lieu insalubre' + (p.service === 'both' ? ' (débarras)' : '') + ' (+' + pct(TARIFS.insalubre) + ' %)', base * TARIFS.insalubre]);
    }

    if (doN) {
      const prix = tarif(TARIFS.nettoyage[p.type], p.surfN);
      const base = p.surfN * prix;
      lignes.push(['Nettoyage : ' + nombre(p.surfN) + ' m² × ' + prix + ' €', base]);
      let pr = TARIFS.proprete[p.proprete];
      let lib = 'État de propreté : ' + LABELS.proprete[p.proprete];
      if (p.insalubre && pr < TARIFS.insalubre) { pr = TARIFS.insalubre; lib = 'Lieu insalubre' + (p.service === 'both' ? ' (nettoyage)' : ''); }   // pas de double majoration
      if (pr > 0) lignes.push([lib + ' (+' + pct(pr) + ' %)', base * pr]);
      if (p.vitres) {
        const v = Math.min(TARIFS.vitres.max, Math.max(TARIFS.vitres.min, p.surfN * TARIFS.vitres.parM2));
        lignes.push(['Nettoyage des vitres (option)', v]);
      }
    }

    if (p.type === 'cave') {
      lignes.push(['Accès cave / grenier (escalier)', TARIFS.accesCave]);
    } else if (!p.ascenseur && p.etage !== 0) {
      const n = Math.abs(p.etage);
      lignes.push([p.etage < 0 ? 'Sans ascenseur : sous-sol' : 'Sans ascenseur : ' + n + ' étage' + (n > 1 ? 's' : ''), n * TARIFS.parEtageSansAscenseur]);
    }
    if (p.loin) lignes.push(['Stationnement éloigné', TARIFS.stationnementLoin]);

    const total = lignes.reduce((s, l) => s + l[1], 0);
    return { lignes, total, min: fmt(total * TARIFS.marge.bas), max: fmt(total * TARIFS.marge.haut) };
  }

  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = { estimer, TARIFS }; return; }

  const $ = id => document.getElementById(id);
  const form = $('est-form');
  if (!form) return;
  const radio = name => { const r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; };
  const num = id => { const v = parseFloat(String($(id).value).replace(',', '.')); return (isFinite(v) && v >= 1 && v <= 2000) ? v : 0; };

  function updateVisibility() {
    const s = radio('service');
    const doD = s !== 'nettoyage';          // tant que rien n'est choisi, on montre la surface unique
    const doN = s === 'nettoyage' || s === 'both';
    $('w-surf-d').hidden = !doD;
    $('w-surf-n').hidden = !doN;
    $('b-debarras').hidden = !(s === 'debarras' || s === 'both');
    $('b-nettoyage').hidden = !doN;
    $('l-surf-d').textContent = s === 'both' ? 'Surface à débarrasser (m²)' : 'Surface (m²)';
    $('l-surf-n').textContent = s === 'both' ? 'Surface à nettoyer (m²)' : 'Surface (m²)';
    const cave = radio('type') === 'cave';
    $('b-etage').hidden = cave;
    $('b-cave-note').hidden = !cave;
  }

  function lire() {
    const service = radio('service'), type = radio('type');
    if (!service || !type) return null;
    const doD = service === 'debarras' || service === 'both';
    const doN = service === 'nettoyage' || service === 'both';
    const surfD = doD ? num('e-surface-d') : 0;
    const surfN = doN ? num('e-surface-n') : 0;
    const niveau = radio('niveau'), proprete = radio('proprete');
    if (doD && !(surfD && niveau)) return null;
    if (doN && !(surfN && proprete)) return null;
    return {
      service, type, surfD, surfN, niveau, proprete,
      vitres: doN && $('e-vitres').checked,
      etage: parseInt($('e-etage').value, 10) || 0,
      ascenseur: radio('ascenseur') === 'oui',
      loin: radio('stationnement') === 'difficile',
      insalubre: radio('insalubre') === 'oui',
      ville: $('e-ville').value.trim().slice(0, 80)
    };
  }

  function summaryText(p, r) {
    const parts = [LABELS.service[p.service] + ' : ' + LABELS.type[p.type]];
    if (p.surfD) parts.push('débarras ' + p.surfD + ' m² (' + LABELS.niveau[p.niveau] + ')');
    if (p.surfN) parts.push('nettoyage ' + p.surfN + ' m² (' + LABELS.proprete[p.proprete] + (p.vitres ? ', vitres' : '') + ')');
    if (p.type !== 'cave') parts.push(p.etage === 0 ? 'rez-de-chaussée' : (p.etage < 0 ? 'sous-sol' : 'étage ' + p.etage) + (p.ascenseur ? ' avec ascenseur' : ' sans ascenseur'));
    parts.push(p.loin ? 'stationnement éloigné' : 'stationnement facile');
    if (p.insalubre) parts.push('lieu insalubre');
    const prix = r.surDevis ? 'sur devis' : euros(r.min) + ' à ' + euros(r.max);
    return ('Estimation en ligne (indicative) : ' + prix + '. ' + parts.join(' ; ') + '.').slice(0, 400);
  }

  function render() {
    updateVisibility();
    const p = lire();
    const box = $('est-result'), empty = $('est-empty'), cta = $('est-cta');
    if (!p) { box.hidden = true; empty.hidden = false; cta.setAttribute('aria-disabled', 'true'); cta.setAttribute('href', '/devis/'); return; }
    const r = estimer(p);
    empty.hidden = true; box.hidden = false;

    const ul = $('est-lines'); ul.textContent = '';
    $('est-sur-devis').hidden = !r.surDevis;
    if (r.surDevis) {
      $('est-range').textContent = 'Sur devis';
    } else {
      $('est-range').textContent = 'Entre ' + euros(r.min) + ' et ' + euros(r.max);
      r.lignes.forEach(l => {
        const li = document.createElement('li');
        const a = document.createElement('span'); a.textContent = l[0];
        const b = document.createElement('span'); b.textContent = '≈ ' + euros(l[1]);
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
    }

    const q = new URLSearchParams();
    q.set('type', p.service === 'nettoyage'
      ? ((p.type === 'local' || p.type === 'entrepot') ? 'Nettoyage professionnel' : 'Nettoyage particulier')
      : TYPE_FORM_DEBARRAS[p.type]);
    q.set('surface', String(p.surfD || p.surfN));
    if (p.ville) q.set('ville', p.ville);
    q.set('note', summaryText(p, r));
    cta.setAttribute('href', '/devis/?' + q.toString());
    cta.removeAttribute('aria-disabled');
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', e => e.preventDefault());
  render();
})();
