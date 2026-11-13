/* El Umbral - pieza de creditos independiente (NO esta enganchada a ninguna pantalla).
   Pensada para abrirse desde un boton pequeno del MENU PRINCIPAL. Uso:
     window.umbralCreditsHTML()  -> cadena HTML (titulo + atribuciones) para meter en un overlay;
     window.umbralShowCredits()  -> crea/abre un overlay propio (#creditsOverlay); clase .hidden/.show gestionada aqui.
   Estilos minimos incluidos (se inyectan una vez), usan variables CSS del juego si existen. */
(function (w) {
  "use strict";
  var BODY = "<h3>Lorc <small>CC BY 3.0</small></h3><p>Icons made by Lorc (<a href=\"http://lorcblog.blogspot.com\">http://lorcblog.blogspot.com</a>) from game-icons.net.</p><p class=\"cr-list\">ankh, anvil, backstab, bandage-roll, bandaged, bleeding-wound, bolt-shield, book-cover, brain, broken-bone, broken-heart, burning-book, burning-embers, campfire, candle-holder, circle-sparks, coffin, cog, compass, conversation, cross-mark, crossed-chains, crossed-swords, crown, crystal-ball, cursed-star, curvy-knife, domino-mask, dread-skull, dripping-knife, droplets, eclipse-flare, evil-moon, eyeball, feather, fire-ring, fire-zone, folded-paper, fountain, gavel, gem-pendant, ghost, hand, haunting, heart-drop, hidden, holy-grail, holy-symbol, hood, hospital-cross, hourglass, hunting-horn, key, lantern-flame, laurel-crown, life-tap, lightning-helix, lightning-shout, lightning-storm, lotus-flower, magic-gate, magic-palm, magic-swirl, magnifying-glass, meditation, mirror-mirror, muscle-up, open-book, padlock, papers, plain-dagger, pointing, poison-bottle, poison-gas, potion-ball, powder, prayer, quill, quill-ink, relic-blade, ringing-bell, round-bottom-flask, rune-stone, salt-shaker, scroll-unfurled, shadow-follower, shield-reflect, shieldcomb, silence, skull-crack, sleepy, small-fire, snowflake-1, snowflake-2, spiked-mace, stopwatch, sun, swap-bag, temptation, third-eye, tombstone, tooth, treasure-map, uncertainty, virus, voodoo-doll, vortex, wax-seal, wheat, wolf-howl, wolf-trap</p><h3>Delapouite <small>CC BY 3.0</small></h3><p>Icons made by Delapouite (<a href=\"http://delapouite.com\">http://delapouite.com</a>) from game-icons.net.</p><p class=\"cr-list\">angry-eyes, archive-research, arm-bandage, baby-face, backpack, biceps, bread, bread-slice, cape, card-exchange, cardboard-box, carnival-mask, check-mark, chest, chest-armor, contract, crystal-shrine, devil-mask, dice-fire, dice-six-faces-five, dice-twenty-faces-twenty, exit-door, eye-target, first-aid-kit, fog, guards, healing, health-potion, heart-armor, herbs-bundle, holy-water, leg-armor, lockpicks, meeple-group, megaphone, monk-face, notebook, periscope, person, pilgrim-hat, player-next, robber-mask, rope-coil, save-arrow, shaking-hands, share, shop, shopping-bag, sitting-dog, sound-off, sound-on, sparkles, spartan-helmet, spell-book, star-altar, sunrise, thermometer-hot, torch, upgrade, vibrating-smartphone, village, watchtower, weight-lifting-up, well, wood-club</p><h3>Skoll <small>CC BY 3.0</small></h3><p>Icons made by Skoll from game-icons.net.</p><p class=\"cr-list\">blood, footsteps, open-treasure-chest, raise-zombie</p><h3>Zeromancer <small>CC0 1.0 (dominio público)</small></h3><p>Icons made by Zeromancer from game-icons.net.</p><p class=\"cr-list\">heart-plus</p><h3>DarkZaitzev <small>CC BY 3.0</small></h3><p>Icons made by DarkZaitzev (<a href=\"http://darkzaitzev.deviantart.com\">http://darkzaitzev.deviantart.com</a>) from game-icons.net.</p><p class=\"cr-list\">robber-hand</p><h3>Sbed <small>CC BY 3.0</small></h3><p>Icons made by Sbed (<a href=\"http://opengameart.org/content/95-game-icons\">http://opengameart.org/content/95-game-icons</a>) from game-icons.net.</p><p class=\"cr-list\">cancel</p><h3>Lucas <small>CC BY 3.0</small></h3><p>Icons made by Lucas from game-icons.net.</p><p class=\"cr-list\">cloak</p>";
  w.umbralCreditsHTML = function () {
    return '<h2>Créditos</h2><p><b>El Umbral</b> usa iconos de <a href="https://game-icons.net">game-icons.net</a>, con licencia '
      + '<a href="https://creativecommons.org/licenses/by/3.0/">Creative Commons Attribution 3.0 (CC BY 3.0)</a>. '
      + 'Los iconos de Zeromancer son CC0. Se ha cambiado su color y se ha quitado el fondo; no hay otras modificaciones.</p>' + BODY;
  };
  w.umbralShowCredits = function () {
    var o = document.getElementById("creditsOverlay");
    if (!o) {
      var st = document.createElement("style");
      st.textContent = "#creditsOverlay{position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.85);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}"
        + "#creditsOverlay .cr-card{max-width:560px;width:100%;background:var(--panel,#1b1722);color:var(--ink,#e8e2d6);border-radius:12px;padding:16px;font-size:14px;line-height:1.4}"
        + "#creditsOverlay h3{margin:14px 0 2px;font-size:15px}#creditsOverlay small{opacity:.7;font-weight:normal}"
        + "#creditsOverlay .cr-list{opacity:.65;font-size:12px;margin:2px 0}#creditsOverlay a{color:inherit;text-decoration:underline;word-break:break-all}"
        + "#creditsOverlay button{margin-top:14px;width:100%;padding:12px;font-size:15px}#creditsOverlay.hidden{display:none}";
      document.head.appendChild(st);
      o = document.createElement("div"); o.id = "creditsOverlay";
      o.innerHTML = '<div class="cr-card">' + w.umbralCreditsHTML() + '<button type="button" id="btnCreditsClose">Cerrar</button></div>';
      document.body.appendChild(o);
      o.querySelector("#btnCreditsClose").onclick = function () { o.classList.add("hidden"); };
    }
    o.classList.remove("hidden");
  };
})(window);
