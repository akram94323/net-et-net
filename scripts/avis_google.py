#!/usr/bin/env python3
"""Met à jour la section « Avis Google » de la page d'accueil.

Lancé chaque jour par .github/workflows/avis-google.yml (ou à la main) :
  1. interroge l'API Google Places (New) pour la fiche Net & Net ;
  2. garde les avis notés au moins `note_min` étoiles (4 par défaut) et qui contiennent un texte ;
  3. réécrit le bloc compris entre <!-- AVIS:DEBUT --> et <!-- AVIS:FIN --> dans index.html.

Les avis sont écrits en dur dans la page : le visiteur ne contacte jamais Google
(rien à déclarer côté cookies) et les avis sont lisibles par les moteurs de recherche.

Variables d'environnement :
  GOOGLE_PLACES_API_KEY  clé API Google (secret GitHub du même nom)
Configuration : scripts/avis-config.json
  place_id   identifiant Google de la fiche (trouvé automatiquement au premier lancement si vide)
  note_min   note minimale affichée
  max_avis   nombre maximal d'avis dans le carrousel
"""
import html
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CONFIG = RACINE / "scripts" / "avis-config.json"
PAGE = RACINE / "index.html"
DEBUT, FIN = "<!-- AVIS:DEBUT -->", "<!-- AVIS:FIN -->"
API = "https://places.googleapis.com/v1"
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]
DEGRADES = [
    ("from-cyber-cyan to-cyber-blue", "text-cyber-bg", "text-cyber-cyan"),
    ("from-cyber-blue to-cyber-coral", "text-white", "text-cyber-blue"),
    ("from-cyber-cyan to-emerald-400", "text-cyber-bg", "text-cyber-cyan"),
    ("from-cyber-coral to-amber-500", "text-white", "text-cyber-coral"),
]
ETOILE = '<svg class="ic " aria-hidden="true" focusable="false"><use href="#i-star"/></svg>'


def appel(methode, chemin, cle, champs, corps=None):
    requete = urllib.request.Request(
        API + chemin,
        data=json.dumps(corps).encode() if corps is not None else None,
        method=methode,
        headers={"X-Goog-Api-Key": cle, "X-Goog-FieldMask": champs, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            return json.load(reponse)
    except urllib.error.HTTPError as e:
        sys.exit(f"Erreur API Google ({e.code}) : {e.read().decode(errors='replace')[:500]}")


def normaliser(texte):
    texte = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", texte.replace("&", "et"))


def trouver_fiche(cle):
    """Recherche la fiche Net & Net et vérifie que le nom correspond avant de l'adopter."""
    resultats = appel("POST", "/places:searchText", cle, "places.id,places.displayName,places.formattedAddress",
                      {"textQuery": "Net&Net débarras nettoyage Le Kremlin-Bicêtre", "languageCode": "fr"}).get("places", [])
    for lieu in resultats:
        print(f"  candidat : {lieu['displayName']['text']} — {lieu.get('formattedAddress', '?')} ({lieu['id']})")
    retenus = [l for l in resultats if normaliser(l["displayName"]["text"]) == "netetnet"]
    if len(retenus) != 1:
        sys.exit("Fiche introuvable ou ambiguë : renseignez place_id dans scripts/avis-config.json.")
    return retenus[0]["id"]


def nom_court(nom):
    """« Marie Dupont » → « Marie D. » : on n'affiche pas le nom complet sur le site."""
    morceaux = nom.split()
    if len(morceaux) < 2:
        return nom
    return f"{morceaux[0]} {morceaux[-1][0].upper()}."


def initiales(nom):
    lettres = [m[0] for m in nom.replace(".", "").split() if m]
    return "".join(lettres[:2]).upper() or "?"


def date_fr(iso):
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return ""
    return f"{MOIS[d.month - 1]} {d.year}"


def carte(avis, i):
    degrade, texte_pastille, couleur = DEGRADES[i % len(DEGRADES)]
    nom = nom_court(avis["authorAttribution"].get("displayName", "Client Google"))
    texte = avis["text"]["text"].strip()
    if len(texte) > 420:
        texte = texte[:420].rsplit(" ", 1)[0] + "…"
    note = int(avis["rating"])
    quand = date_fr(avis.get("publishTime", ""))
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
      <!-- Bloc généré automatiquement par scripts/avis_google.py : ne pas modifier à la main -->
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
          <p class="mt-6 text-center text-xs text-slate-500">{"Sélection des avis notés " + str(note_min) + " et 5 étoiles publiés sur notre fiche Google, mise à jour automatiquement. " if avis else ""}Les avis Google ne sont ni modifiés ni vérifiés par Net &amp; Net ; l'ensemble des avis est consultable sur Google.</p>
        </div>
      </section>
      {FIN}"""


def main():
    cle = os.environ.get("GOOGLE_PLACES_API_KEY", "").strip()
    if not cle:
        print("::warning::Secret GOOGLE_PLACES_API_KEY absent : avis non mis à jour.")
        return
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    if not config.get("place_id"):
        print("Recherche de la fiche Google…")
        config["place_id"] = trouver_fiche(cle)
        CONFIG.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Fiche retenue : {config['place_id']}")
    note_min = int(config.get("note_min", 4))

    fiche = appel("GET", f"/places/{config['place_id']}?languageCode=fr", cle,
                  "displayName,rating,userRatingCount,googleMapsUri,reviews")
    avis = [a for a in fiche.get("reviews", [])
            if a.get("rating", 0) >= note_min and a.get("text", {}).get("text", "").strip()]
    avis.sort(key=lambda a: a.get("publishTime", ""), reverse=True)
    avis = avis[: int(config.get("max_avis", 5))]
    lien_avis = f"https://search.google.com/local/writereview?placeid={config['place_id']}"

    page = PAGE.read_text(encoding="utf-8")
    motif = re.compile(re.escape(DEBUT) + r".*?" + re.escape(FIN), re.S)
    if not motif.search(page):
        sys.exit("Marqueurs AVIS:DEBUT / AVIS:FIN introuvables dans index.html")
    PAGE.write_text(motif.sub(lambda _: section(fiche, avis, note_min, lien_avis), page, count=1), encoding="utf-8")
    print(f"{fiche.get('displayName', {}).get('text', '?')} : note {fiche.get('rating')} "
          f"({fiche.get('userRatingCount', 0)} avis) — {len(avis)} avis affiché(s).")


if __name__ == "__main__":
    main()
