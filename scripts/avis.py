#!/usr/bin/env python3
"""Met à jour la section « Avis Google » de la page d'accueil à partir de scripts/avis.json.

Pour ajouter un avis : le copier dans scripts/avis.json (nom, note, texte, date « AAAA-MM »),
puis lancer `python3 scripts/avis.py`. Le script :
  - calcule la note moyenne et le nombre d'avis à partir de tous les avis du fichier ;
  - n'affiche dans le carrousel que les avis notés au moins `note_min` étoiles (4 par défaut) ;
  - réécrit le bloc compris entre <!-- AVIS:DEBUT --> et <!-- AVIS:FIN --> dans index.html.
Les avis sont écrits en dur dans la page : aucun appel à Google, lisibles par les moteurs de recherche.
"""
import html
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DONNEES = RACINE / "scripts" / "avis.json"
PAGE = RACINE / "index.html"
DEBUT, FIN = "<!-- AVIS:DEBUT -->", "<!-- AVIS:FIN -->"
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]
DEGRADES = [
    ("from-cyber-cyan to-cyber-blue", "text-cyber-bg", "text-cyber-cyan"),
    ("from-cyber-blue to-cyber-coral", "text-white", "text-cyber-blue"),
    ("from-cyber-cyan to-emerald-400", "text-cyber-bg", "text-cyber-cyan"),
    ("from-cyber-coral to-amber-500", "text-white", "text-cyber-coral"),
]
ETOILE = '<svg class="ic " aria-hidden="true" focusable="false"><use href="#i-star"/></svg>'


def nom_court(nom):
    """« marie dupont » → « Marie D. » : on n'affiche pas le nom complet sur le site."""
    morceaux = [m[:1].upper() + m[1:] for m in nom.split()]
    if len(morceaux) < 2:
        return " ".join(morceaux)
    *prenoms, famille = morceaux
    return f"{' '.join(prenoms)} {famille.rstrip('.')[0]}."


def initiales(nom):
    lettres = [m[0] for m in nom.replace(".", "").split() if m]
    return "".join(lettres[:2]).upper() or "?"


def date_fr(aaaa_mm):
    try:
        annee, mois = (int(x) for x in str(aaaa_mm).split("-")[:2])
        return f"{MOIS[mois - 1]} {annee}"
    except (ValueError, IndexError):
        return ""


def carte(avis, i):
    degrade, texte_pastille, couleur = DEGRADES[i % len(DEGRADES)]
    nom = nom_court(avis.get("nom") or "Client Google")
    texte = avis["texte"].strip()
    if len(texte) > 420:
        texte = texte[:420].rsplit(" ", 1)[0] + "…"
    note = int(avis["note"])
    quand = date_fr(avis.get("date", ""))
    e = html.escape
    return f"""                <div class="min-w-full px-2">
                  <figure class="spotlight-card p-8 sm:p-12 text-center">
                    <div class="spotlight-content">
                      <div class="flex justify-center gap-1.5 text-amber-400 text-base mb-6" role="img" aria-label="{note} étoiles sur 5">
                        {ETOILE * note}
                      </div>
                      <blockquote class="text-lg sm:text-xl text-slate-200 italic leading-relaxed mb-8">
                        « {e(texte)} »
                      </blockquote>
                      <figcaption class="inline-flex items-center gap-3.5 text-left">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br {degrade} flex items-center justify-center font-display font-bold {texte_pastille}" aria-hidden="true">{e(initiales(nom))}</div>
                        <div>
                          <div class="font-display font-bold text-white">{e(nom)}</div>
                          <div class="text-xs {couleur}">Avis Google{' · ' + quand if quand else ''}</div>
                        </div>
                      </figcaption>
                    </div>
                  </figure>
                </div>
"""


def section(fiche, avis, note_min, lien_avis):
    """fiche = {rating, userRatingCount, googleMapsUri}."""
    e = html.escape
    note = fiche.get("rating")
    total = fiche.get("userRatingCount", 0)
    lien_fiche = fiche.get("googleMapsUri", lien_avis)
    resume = ""
    if note and total:
        resume = (f'<p class="mt-4 text-slate-300"><span class="text-amber-400" aria-hidden="true">★</span> '
                  f'<strong class="text-white">{str(round(note, 1)).replace(".", ",")}/5</strong> · '
                  f'{total} avis sur Google</p>')
    if avis:
        controles = ""
        if len(avis) > 1:
            controles = """
            <div class="flex items-center justify-center gap-4 mt-8">
              <button onclick="prevTestimonial()" aria-label="Avis précédent" class="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/50 transition-all">
                <svg class="ic text-xs" aria-hidden="true" focusable="false"><use href="#i-chevron-left"/></svg>
              </button>
              <div id="testimonial-dots" class="flex items-center gap-2.5"></div>
              <button onclick="nextTestimonial()" aria-label="Avis suivant" class="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/50 transition-all">
                <svg class="ic text-xs" aria-hidden="true" focusable="false"><use href="#i-chevron-right"/></svg>
              </button>
            </div>"""
        corps = f"""
          <div class="relative scroll-node">
            <div class="overflow-hidden rounded-3xl">
              <div id="testimonial-track" class="flex transition-transform duration-500 ease-out">
{''.join(carte(a, i) for i, a in enumerate(avis))}              </div>
            </div>{controles}
          </div>"""
    else:
        corps = """
          <p class="text-center text-slate-300 scroll-node">Vous avez fait appel à nous ? Votre avis aide d'autres clients à nous choisir.</p>"""
    return f"""{DEBUT}
      <!-- Bloc généré automatiquement par scripts/avis.py : ne pas modifier à la main -->
      <section class="py-24 px-4 sm:px-6" aria-labelledby="avis-titre">
        <div class="max-w-4xl mx-auto">
          <div class="text-center mb-14 scroll-node">
            <span class="inline-block text-xs font-bold uppercase tracking-[0.25em] text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/25 px-4 py-1.5 rounded-full mb-4">
              Avis Google
            </span>
            <h2 id="avis-titre" class="font-display text-3xl sm:text-4xl font-bold text-white">Ce que disent nos clients</h2>
            {resume}
          </div>
{corps}
          <div class="flex flex-wrap items-center justify-center gap-3 mt-8 scroll-node">
            <a href="{e(lien_fiche)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 glass-panel text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:border-cyber-cyan/50 transition-colors">Voir tous les avis sur Google</a>
            <a href="{e(lien_avis)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 btn-neon-coral text-white text-sm font-semibold px-5 py-2.5 rounded-full"><svg class="ic text-xs" aria-hidden="true" focusable="false"><use href="#i-star"/></svg><span>Laisser un avis</span></a>
          </div>
          <p class="mt-6 text-center text-xs text-slate-500">{"Sélection des avis notés " + str(note_min) + " et 5 étoiles publiés sur notre fiche Google, reproduits sans modification. " if avis else ""}L'ensemble de nos avis est consultable sur Google.</p>
        </div>
      </section>
      {FIN}"""


def main():
    donnees = json.loads(DONNEES.read_text(encoding="utf-8"))
    note_min = int(donnees.get("note_min", 4))
    tous = [a for a in donnees.get("avis", []) if a.get("note")]
    fiche = {"googleMapsUri": donnees["lien_fiche"]}
    if tous:
        fiche["rating"] = sum(int(a["note"]) for a in tous) / len(tous)
        fiche["userRatingCount"] = len(tous)
    affiches = [a for a in tous if int(a["note"]) >= note_min and a.get("texte", "").strip()]
    affiches.sort(key=lambda a: str(a.get("date", "")), reverse=True)
    affiches = affiches[: int(donnees.get("max_avis", 6))]

    page = PAGE.read_text(encoding="utf-8")
    motif = re.compile(re.escape(DEBUT) + r".*?" + re.escape(FIN), re.S)
    if not motif.search(page):
        sys.exit("Marqueurs AVIS:DEBUT / AVIS:FIN introuvables dans index.html")
    bloc = section(fiche, affiches, note_min, donnees.get("lien_avis") or donnees["lien_fiche"])
    PAGE.write_text(motif.sub(lambda _: bloc, page, count=1), encoding="utf-8")
    print(f"{len(tous)} avis dans le fichier — {len(affiches)} affiché(s) sur le site.")


if __name__ == "__main__":
    main()
