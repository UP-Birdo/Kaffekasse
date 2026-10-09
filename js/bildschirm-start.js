/*
 * bildschirm-start.js — die Startseite: Kopf mit Name#Nummer, rechts der Anker des
 * Offline-Zeichens; darunter die Kasse (Stufe 2): Name und Code, je Produkt eine Karte mit
 * Bild, „Dran: <Name>", den Zählern und der EINEN Hauptaktion „+".
 *
 * Der Bildschirm rechnet nichts — Zahlen und Regeln kommen aus dem Modell (js\kasse.js),
 * geschrieben wird über die Steuerung (js\steuerung.js). Er zeichnet neu, wenn die
 * Steuerung meldet (`beobachten`). Ohne Kasse: der Zustand „Leer" mit dem Knopf „Kasse".
 *
 * Kein Profil-Kreis (kein Profil-Baustein, Entscheidung vom 08.10.2026); das
 * Offline-Zeichen sitzt deshalb rechts im Kopf (EINBAU-OFFLINE.md, Anker „rechts").
 */

const START = {

    offlineGriff: null,
    nameEl: null,
    loesen: null,

    zeichnen(ort) {
        ort.textContent = "";

        const kopf = document.createElement("header");
        kopf.className = "kopf";
        kopf.setAttribute("data-up-bl-kopf", "");
        const name = document.createElement("div");
        name.className = "kopf-name";
        name.textContent = APP.anzeigeName();
        const rechts = document.createElement("div");
        rechts.className = "kopf-rechts";
        kopf.appendChild(name);
        kopf.appendChild(rechts);
        ort.appendChild(kopf);
        START.nameEl = name;

        if (START.offlineGriff) {
            START.offlineGriff.aus();
            START.offlineGriff = null;
        }
        if (typeof UPCREW_OFFLINE !== "undefined") {
            /* Eigene Texte: hier wird nichts gespielt, es warten Einträge. */
            START.offlineGriff = UPCREW_OFFLINE.an(rechts, { ecke: "rechts",
                texte: { name: "Offline", blaseTitel: "Offline", blaseText: "Einträge warten aufs Netz", hochgeladen: "Gesendet" } });
        }

        const inhalt = document.createElement("div");
        inhalt.className = "start-inhalt";
        ort.appendChild(inhalt);
        START._inhalt(inhalt);

        if (!START.loesen) {
            START.loesen = STEUERUNG.beobachten(() => NAVIGATION.veralten("start"));
        }
    },

    _inhalt(ort) {
        const S = STEUERUNG;
        if (!S.hatKasse()) {
            const karte = START._karte(ort, "Kasse");
            karte.appendChild(ZUSTAND.leer({ zeichen: "tasse", text: "Noch keine Kasse", aktion: { text: "Kasse", bei: () => KASSE_BLATT.kasse() } }));
            return;
        }
        if (!S.stand) {
            const karte = START._karte(ort, "Kasse");
            if (S.zustand === "fehler") {
                karte.appendChild(ZUSTAND.fehler({ text: S.technik === "Kein Netz" ? "Kein Netz" : "Kasse nicht da", nochmal: () => S.laden(), technik: S.technik }));
            } else {
                karte.appendChild(ZUSTAND.laden({ zeilen: 3, nochmal: () => S.laden() }));
            }
            return;
        }
        START._kasseKopf(ort, S.stand);
        const produkte = KASSE.produkteAktiv(S.stand);
        if (produkte.length === 0) {
            const karte = START._karte(ort, "Produkte");
            karte.appendChild(ZUSTAND.leer({ zeichen: "plus", text: "Noch kein Produkt", aktion: { text: "Produkt", bei: () => KASSE_BLATT.produkt() } }));
            return;
        }
        for (const produkt of produkte) {
            ort.appendChild(START._produktKarte(S.stand, produkt));
        }
        const fuss = document.createElement("div");
        fuss.className = "start-fuss";
        fuss.appendChild(DIALOG.knopf("Produkt", "still", () => KASSE_BLATT.produkt()));
        ort.appendChild(fuss);
    },

    _karte(ort, name) {
        const karte = document.createElement("section");
        karte.className = "karte";
        karte.setAttribute("aria-label", name);
        ort.appendChild(karte);
        return karte;
    },

    /* Name der Kasse, Mitgliederzahl, Code (Tipp zeigt ihn groß). */
    _kasseKopf(ort, stand) {
        const zeile = document.createElement("button");
        zeile.type = "button";
        zeile.className = "kasse-kopf";
        zeile.setAttribute("aria-label", "Code zeigen");
        const links = document.createElement("div");
        links.className = "kasse-kopf-text";
        const name = document.createElement("b");
        name.textContent = stand.name;
        const unter = document.createElement("small");
        const anzahl = Object.keys(stand.mitglieder).length;
        unter.textContent = anzahl + (anzahl === 1 ? " Mitglied" : " Mitglieder");
        links.appendChild(name);
        links.appendChild(unter);
        const code = document.createElement("span");
        code.className = "kasse-code";
        code.textContent = stand.code;
        zeile.appendChild(links);
        zeile.appendChild(code);
        zeile.addEventListener("click", () => KASSE_BLATT.code());
        ort.appendChild(zeile);
    },

    _produktKarte(stand, produkt) {
        const S = STEUERUNG;
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        const zaehler = KASSE.zaehler(stand, produkt.id);
        const gesamt = Object.keys(zaehler).reduce((a, k) => a + zaehler[k], 0);
        const dran = KASSE.naechsterDran(stand, produkt.id);

        const karte = document.createElement("section");
        karte.className = "produkt" + (dran === uid ? " produkt-dran" : "");
        karte.setAttribute("aria-label", produkt.name);

        karte.appendChild(START._produktBild(produkt));

        const text = document.createElement("div");
        text.className = "produkt-text";
        const name = document.createElement("b");
        name.className = "produkt-name";
        name.textContent = produkt.name;
        text.appendChild(name);
        const dranZeile = document.createElement("span");
        dranZeile.className = "produkt-dran-zeile";
        dranZeile.textContent = dran ? (dran === uid ? "Dran: Du" : "Dran: " + KASSE.mitgliedName(stand, dran)) : "";
        text.appendChild(dranZeile);
        const zahlen = document.createElement("span");
        zahlen.className = "produkt-zahlen";
        zahlen.textContent = "Du " + (zaehler[uid] || 0) + " · Alle " + gesamt;
        text.appendChild(zahlen);
        karte.appendChild(text);

        const plus = DIALOG.knopf("+", "haupt", async () => {
            plus.disabled = true;
            await S.kaufen(produkt.id, 1);
        });
        plus.classList.add("produkt-plus", "up-rund");
        plus.setAttribute("aria-label", produkt.name + " eintragen");
        karte.appendChild(plus);

        const eben = S.eigenerLetzter(produkt.id);
        if (eben) {
            const zeile = document.createElement("div");
            zeile.className = "produkt-eben";
            const wann = document.createElement("span");
            wann.textContent = "Eben · " + KASSE.uhrzeit(eben.wann);
            zeile.appendChild(wann);
            const zurueck = DIALOG.knopf("Zurück", "still", async () => {
                const ja = await DIALOG.zweiSchritt({ titel: produkt.name, text: "Eintrag zurücknehmen?", erst: "Zurücknehmen", dann: "Wirklich" });
                if (ja) {
                    await S.zuruecknehmen(eben.id);
                }
            });
            zurueck.classList.add("produkt-zurueck");
            zeile.appendChild(zurueck);
            karte.appendChild(zeile);
        }
        return karte;
    },

    /* Bild aus der Strichcode-Datenbank, sonst ein Platz mit dem Anfangsbuchstaben. */
    _produktBild(produkt) {
        const huelle = document.createElement("div");
        huelle.className = "produkt-bild";
        if (produkt.bild && /^https:\/\//.test(produkt.bild)) {
            const bild = document.createElement("img");
            bild.src = produkt.bild;
            bild.alt = "";
            bild.loading = "lazy";
            bild.referrerPolicy = "no-referrer";
            huelle.appendChild(bild);
            return huelle;
        }
        const kuerzel = document.createElement("span");
        kuerzel.className = "produkt-kuerzel";
        kuerzel.textContent = (produkt.name || "?").charAt(0).toUpperCase();
        if (typeof UPCREW_PLATZ !== "undefined") {
            huelle.appendChild(UPCREW_PLATZ.bauen("produkt/" + (produkt.ean || "ohne-code"), "96x96", { inhalt: kuerzel, klasse: "produkt-platz" }));
        } else {
            huelle.appendChild(kuerzel);
        }
        return huelle;
    },

    /* Nur den Namen nachziehen (nach dem Laden der Konten), ohne alles neu zu bauen. */
    kopfAktualisieren() {
        if (START.nameEl) {
            START.nameEl.textContent = APP.anzeigeName();
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = START;
}
