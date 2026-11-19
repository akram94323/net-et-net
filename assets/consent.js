/* Gestion du consentement — Net & Net
   - Aucun appel à Google tant que le visiteur n'a pas donné son accord.
   - Google Tag Manager n'est chargé qu'après acceptation d'au moins une catégorie.
   - Google Consent Mode v2 : tout est « denied » par défaut, mis à jour selon le choix.
   - Le choix est conservé 6 mois (cookie technique « nn_consent »), puis redemandé. */
(function () {
  "use strict";

  var GTM_ID = "GTM-5J5P8R6D";
  var COOKIE = "nn_consent";
  var VERSION = 1;               // à incrémenter si les catégories changent : le bandeau est alors redemandé
  var MAX_AGE = 15552000;        // 180 jours (~6 mois)

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  // 1. État par défaut : tout refusé (avant toute interaction)
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  });

  var gtmLoaded = false;
  var current = null;            // consentement en vigueur { v, a, p, t }
  var box = null;

  /* ---------- Stockage du choix ---------- */
  function readCookie() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    if (!m) return null;
    try {
      var c = JSON.parse(decodeURIComponent(m[1]));
      if (c && c.v === VERSION && typeof c.t === "number" && Date.now() - c.t < MAX_AGE * 1000) return c;
    } catch (e) {}
    return null;
  }
  function writeCookie(c) {
    document.cookie = COOKIE + "=" + encodeURIComponent(JSON.stringify(c)) +
      "; Max-Age=" + MAX_AGE + "; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  }

  /* ---------- Suppression des cookies Google déjà déposés ---------- */
  function purge(re) {
    var host = location.hostname, parts = host.split("."), domains = [host, "." + host];
    if (parts.length > 2) domains.push("." + parts.slice(-2).join("."));
    else domains.push("." + host);
    document.cookie.split(";").forEach(function (raw) {
      var name = raw.split("=")[0].trim();
      if (!re.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + "=; Max-Age=0; Path=/; Domain=" + d;
      });
      document.cookie = name + "=; Max-Age=0; Path=/";
    });
  }
  var RE_ANALYTICS = /^(_ga|_gid|_gat|_gac_)/;
  var RE_ADS = /^(_gcl_|_gac_|_gads|_gpi|IDE|test_cookie)/;

  /* ---------- Chargement de Google Tag Manager (après accord uniquement) ---------- */
  function loadGTM() {
    if (gtmLoaded) return;
    gtmLoaded = true;
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + GTM_ID;
    document.head.appendChild(s);
  }

  /* ---------- Application du choix ---------- */
  function apply(c, previous) {
    var a = c.a ? "granted" : "denied", p = c.p ? "granted" : "denied";
    gtag("consent", "update", {
      analytics_storage: a,
      ad_storage: p,
      ad_user_data: p,
      ad_personalization: p
    });
    window.dataLayer.push({ event: "cookie_consent_update", consent_analytics: !!c.a, consent_ads: !!c.p });

    if (previous) {                                  // retrait d'un consentement donné
      if (previous.a && !c.a) purge(RE_ANALYTICS);
      if (previous.p && !c.p) purge(RE_ADS);
      if (gtmLoaded && !c.a && !c.p) { location.reload(); return; } // décharge complètement Google
    }
    if ((c.a || c.p) && !gtmLoaded) loadGTM();
  }

  function save(a, p) {
    var previous = current;
    current = { v: VERSION, a: !!a, p: !!p, t: Date.now() };
    writeCookie(current);
    close();
    apply(current, previous);
  }

  /* ---------- Interface ---------- */
  function build() {
    box = document.createElement("div");
    box.id = "nn-cookie";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "false");
    box.setAttribute("aria-labelledby", "nn-ck-title");
    box.setAttribute("aria-describedby", "nn-ck-desc");
    box.hidden = true;
    box.innerHTML =
      '<h2 id="nn-ck-title" tabindex="-1">Vos choix sur les cookies</h2>' +
      '<p id="nn-ck-desc">Avec votre accord, nous utilisons des cookies pour mesurer l\'audience du site et, le cas échéant, pour mesurer et personnaliser nos publicités. ' +
      'Vous pouvez tout accepter, tout refuser ou choisir catégorie par catégorie. Refuser n\'empêche pas d\'utiliser le site. ' +
      'Votre choix est conservé 6 mois et modifiable à tout moment via « Gérer mes cookies » en bas de page. ' +
      '<a href="/confidentialite/">En savoir plus</a></p>' +
      '<div class="nn-panel" id="nn-ck-panel" hidden>' +
        '<div class="nn-row"><div><strong>Cookies nécessaires</strong><span>Mémorisent votre choix sur les cookies. Indispensables, ils ne collectent aucune donnée de suivi.</span></div>' +
          '<label class="nn-sw"><input type="checkbox" checked disabled aria-label="Cookies nécessaires (toujours actifs)"><i></i></label></div>' +
        '<div class="nn-row"><div><strong>Mesure d\'audience</strong><span>Google Analytics : pages vues, provenance des visites, appareils. Nous aide à améliorer le site.</span></div>' +
          '<label class="nn-sw"><input type="checkbox" id="nn-ck-a" aria-label="Mesure d\'audience"><i></i></label></div>' +
        '<div class="nn-row"><div><strong>Publicité</strong><span>Google Ads : mesure de l\'efficacité de nos annonces et affichage de publicités adaptées à votre navigation.</span></div>' +
          '<label class="nn-sw"><input type="checkbox" id="nn-ck-p" aria-label="Publicité"><i></i></label></div>' +
        '<button type="button" class="nn-btn nn-btn-main" data-nn="save">Enregistrer mes choix</button>' +
      '</div>' +
      '<div class="nn-actions">' +
        '<button type="button" class="nn-btn nn-btn-main" data-nn="refuse">Tout refuser</button>' +
        '<button type="button" class="nn-btn nn-btn-ghost" data-nn="custom" aria-expanded="false" aria-controls="nn-ck-panel">Personnaliser</button>' +
        '<button type="button" class="nn-btn nn-btn-main" data-nn="accept">Tout accepter</button>' +
      '</div>';
    document.body.appendChild(box);

    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-nn]");
      if (!b) return;
      var act = b.getAttribute("data-nn");
      if (act === "accept") save(true, true);
      else if (act === "refuse") save(false, false);
      else if (act === "save") save(box.querySelector("#nn-ck-a").checked, box.querySelector("#nn-ck-p").checked);
      else if (act === "custom") togglePanel();
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && current) close();   // fermeture possible seulement si un choix existe déjà
    });
  }

  function togglePanel(force) {
    var panel = box.querySelector("#nn-ck-panel");
    var show = typeof force === "boolean" ? force : panel.hidden;
    panel.hidden = !show;
    box.querySelector('[data-nn="custom"]').setAttribute("aria-expanded", String(show));
  }

  function open(withPanel) {
    if (!box) build();
    box.querySelector("#nn-ck-a").checked = !!(current && current.a);
    box.querySelector("#nn-ck-p").checked = !!(current && current.p);
    togglePanel(!!withPanel);
    box.hidden = false;
    if (withPanel) box.querySelector("#nn-ck-title").focus();
  }
  function close() { if (box) box.hidden = true; }

  /* ---------- Démarrage ---------- */
  function start() {
    current = readCookie();
    if (current) apply(current, null);   // choix déjà fait : on le réapplique, sans rien redemander
    else open(false);                    // première visite (ou choix expiré) : on demande

    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-cookie-settings]");
      if (t) { e.preventDefault(); open(true); }
    });
  }

  window.nnCookieConsent = { open: function () { open(true); } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
