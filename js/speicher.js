/*
 * speicher.js — die EINE Stelle, die weiß, wo Daten liegen: die REST-Schnittstelle der
 * UPCrew-Datenbank (Firebase Realtime Database, kein SDK, keine Bibliothek).
 *
 * `SpeicherGemeinsam` ist die Basisklasse. Der Studio-Baustein js\speicher-konten.js
 * (Klasse `SpeicherKonten`, Rückwand der UPCrew-Konten) erbt davon und wird NACH dieser
 * Datei geladen. Er erwartet von hier (aus seinem Kopf abgelesen, 09.10.2026):
 *     constructor(basis, pfad, aufbereiten)   → this.basis, this.pfad, this.aufbereiten
 *     static MARKEN_FELD                      → "geaendertAm" (die Stand-Marke eines Bereichs)
 *     static ZEITLIMIT_LADEN_MS
 *     _rufen(optionen, zeitlimitMs, bezeichnung, ziel?)  → die fetch-Antwort (ok, status, json())
 *                                               ohne `ziel`: der ganze Bereich `<basis>/<pfad>.json`
 *     teilSchreiben(aenderungen)              → Mehrpfad-Änderung (PATCH) unter dem Bereich
 * Ein Test prüft diesen Vertrag gegen die Kopie des Bausteins,
 * sobald sie verteilt ist.
 *
 * Jeder Aufruf hat ein Zeitlimit (eiserne Regel). Läuft es ab, wirft `_rufen` einen Fehler
 * mit `name === "TimeoutError"` — den erkennt `UPCREW_OFFLINE.istNetzFehler` als „kein Netz".
 * Ein Anmelde-Schlüssel (`KONTO.token()`) wird an jede Adresse gehängt, wenn ein Konto
 * angemeldet ist; ohne Konto fragt die App ohne Schlüssel (die Regel entscheidet).
 *
 * Für die Tests: `this.netz` kann eine Attrappe von fetch sein — dann geht nichts ins Netz.
 */

class SpeicherGemeinsam {

    static get MARKEN_FELD() {
        return "geaendertAm";
    }

    static get ZEITLIMIT_LADEN_MS() {
        return (typeof KONFIG !== "undefined" && KONFIG.zeitlimit && KONFIG.zeitlimit.ladenMs) || 12000;
    }

    static get ZEITLIMIT_SCHREIBEN_MS() {
        return (typeof KONFIG !== "undefined" && KONFIG.zeitlimit && KONFIG.zeitlimit.schreibenMs) || 12000;
    }

    /* `aufbereiten(roh)` macht aus der rohen Antwort den Stand der App (die Nachrüst-Stelle des
       jeweiligen Modells); fehlt es, kommt die Antwort unverändert. */
    constructor(basis, pfad, aufbereiten) {
        this.basis = String(basis || "").replace(/\/+$/, "");
        this.pfad = String(pfad || "").replace(/^\/+|\/+$/g, "");
        this.aufbereiten = (typeof aufbereiten === "function") ? aufbereiten : ((roh) => roh);
        /* Attrappe für Tests; im Browser bleibt es bei fetch. */
        this.netz = null;
    }

    /* Die Adresse eines Unterknotens (leer = der ganze Bereich). */
    ziel(unterpfad) {
        const teile = [this.pfad].concat(String(unterpfad || "").split("/"))
            .filter((teil) => teil !== "").map((teil) => encodeURIComponent(teil));
        return this.basis + "/" + teile.join("/") + ".json";
    }

    async _token() {
        if (typeof KONTO === "undefined" || typeof KONTO.token !== "function") {
            return null;
        }
        try {
            return await KONTO.token();
        } catch (fehler) {
            return null;
        }
    }

    /*
     * Ein Aufruf mit Zeitlimit. `optionen` sind die fetch-Einstellungen (method, body, cache …),
     * `bezeichnung` steht in der Fehlermeldung („Das Laden hat zu lange gedauert"). Liefert die
     * Antwort — ob sie ok ist, prüft der Aufrufer (SpeicherKonten tut das selbst).
     */
    async _rufen(optionen, zeitlimitMs, bezeichnung, ziel) {
        let adresse = ziel || this.ziel("");
        const token = await this._token();
        if (token) {
            adresse += (adresse.indexOf("?") === -1 ? "?" : "&") + "auth=" + encodeURIComponent(token);
        }
        const holen = this.netz || ((a, e) => fetch(a, e));
        const einstellungen = Object.assign({}, optionen || {});
        const frist = Number(zeitlimitMs) > 0 ? Number(zeitlimitMs) : SpeicherGemeinsam.ZEITLIMIT_LADEN_MS;
        if (typeof AbortController === "undefined") {
            return holen(adresse, einstellungen);
        }
        const abbruch = new AbortController();
        einstellungen.signal = abbruch.signal;
        const uhr = setTimeout(() => abbruch.abort(), frist);
        try {
            return await holen(adresse, einstellungen);
        } catch (fehler) {
            if (fehler && fehler.name === "AbortError") {
                const zuLange = new Error((bezeichnung || "Der Aufruf") + " hat zu lange gedauert");
                zuLange.name = "TimeoutError";
                throw zuLange;
            }
            throw fehler;
        } finally {
            clearTimeout(uhr);
        }
    }

    static _fehler(text, status) {
        const fehler = new Error(text + " (HTTP " + status + ")");
        fehler.status = status;
        return fehler;
    }

    /* Den ganzen Bereich laden und aufbereiten. */
    async laden() {
        const antwort = await this._rufen({ cache: "no-store" },
            SpeicherGemeinsam.ZEITLIMIT_LADEN_MS, "Das Laden");
        if (!antwort.ok) {
            throw SpeicherGemeinsam._fehler("Laden fehlgeschlagen", antwort.status);
        }
        return this.aufbereiten(await antwort.json());
    }

    /* Einen Unterknoten laden — null, wenn es ihn nicht gibt. */
    async teilLaden(unterpfad) {
        const antwort = await this._rufen({ cache: "no-store" },
            SpeicherGemeinsam.ZEITLIMIT_LADEN_MS, "Das Laden", this.ziel(unterpfad));
        if (!antwort.ok) {
            throw SpeicherGemeinsam._fehler("Laden fehlgeschlagen", antwort.status);
        }
        return antwort.json();
    }

    /*
     * Mehrere Knoten in EINEM Schritt ändern (Firebase PATCH mit Pfaden relativ zum Bereich):
     *     { "konten/abc": {...}, "geaendertAm": 1750000000000, "alt/knoten": null }
     * Entweder alles oder nichts — lehnt die Regel einen Pfad ab, bleibt der ganze Schritt aus.
     */
    async teilSchreiben(aenderungen) {
        const antwort = await this._rufen({
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aenderungen || {})
        }, SpeicherGemeinsam.ZEITLIMIT_SCHREIBEN_MS, "Das Speichern");
        if (!antwort.ok) {
            throw SpeicherGemeinsam._fehler("Speichern fehlgeschlagen", antwort.status);
        }
        return true;
    }

    /* Einen Unterknoten ganz setzen (PUT); `wert` null löscht ihn. */
    async teilSetzen(unterpfad, wert) {
        const antwort = await this._rufen({
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(wert === undefined ? null : wert)
        }, SpeicherGemeinsam.ZEITLIMIT_SCHREIBEN_MS, "Das Speichern", this.ziel(unterpfad));
        if (!antwort.ok) {
            throw SpeicherGemeinsam._fehler("Speichern fehlgeschlagen", antwort.status);
        }
        return true;
    }
}

/*
 * Rückwand 2 (Stufe 2): der Bereich `kaffekasse` — Kassen, Produkte, Einträge, dazu das
 * Code-Verzeichnis zum Beitreten.
 *
 *     kaffekasse/
 *         codes/<CODE> = <kasseId>              (lesbar für Angemeldete, einmal schreibbar)
 *         kassen/<kasseId>/ { name, code, erstelltVon, erstelltAm, geaendertAm,
 *                             mitglieder/<uid>, produkte/<id>, eintraege/<id> }
 *
 * Geschrieben wird nur als Mehrpfad-Änderung der eigenen Knoten (KASSE liefert die Pfade
 * relativ zur Kasse, `praefix` setzt `kassen/<id>/` davor). Die ganze Kasse schreibt nur
 * `kasseAnlegen` — zusammen mit dem Code-Eintrag in EINEM Schritt (alles oder nichts).
 * Der Regel-Vorschlag dazu liegt in der Doku des Projekts (Regel-Vorschlag kaffekasse).
 */
class SpeicherKasse extends SpeicherGemeinsam {

    static praefix(kasseId, aenderungen) {
        const ergebnis = {};
        const id = String(kasseId || "");
        for (const pfad of Object.keys(aenderungen || {})) {
            ergebnis["kassen/" + id + "/" + pfad] = aenderungen[pfad];
        }
        return ergebnis;
    }

    /* Die Kasse in Form (über `aufbereiten` = KASSE.normalisieren) — null, wenn es sie nicht gibt. */
    async kasseLaden(kasseId) {
        const roh = await this.teilLaden("kassen/" + encodeURIComponent(String(kasseId || "")));
        return roh ? this.aufbereiten(roh) : null;
    }

    /* Nur die Stand-Marke — für den Takt, in dem andere Geräte nach Änderungen fragen. */
    async marke(kasseId) {
        const wert = await this.teilLaden("kassen/" + encodeURIComponent(String(kasseId || "")) + "/" + SpeicherGemeinsam.MARKEN_FELD);
        return Number(wert) > 0 ? Number(wert) : 0;
    }

    async kasseAnlegen(kasseId, stand) {
        const aenderungen = {};
        aenderungen["kassen/" + String(kasseId)] = stand;
        aenderungen["codes/" + String(stand && stand.code)] = String(kasseId);
        return this.teilSchreiben(aenderungen);
    }

    /* Beitrittscode → Kennung der Kasse oder null. */
    async kasseFinden(code) {
        const id = await this.teilLaden("codes/" + encodeURIComponent(String(code || "")));
        return (typeof id === "string" && id) ? id : null;
    }

    async aendern(kasseId, aenderungen) {
        return this.teilSchreiben(SpeicherKasse.praefix(kasseId, aenderungen));
    }
}

/*
 * Die Rückwände der App — gerufen in APP.starten, wenn alle Dateien geladen sind.
 *     konten   die UPCrew-Konten (Baustein SpeicherKonten); Kaffekasse legt dort keine eigenen
 *              Felder an und liest nur, wer da ist
 *     kasse    der Bereich `kaffekasse` (Rückwand 2, Nachrüstung KASSE.normalisieren)
 */
function speicherErzeugen() {
    const s = KONFIG.speicher;
    return {
        konten: new SpeicherKonten(s.firebaseBasis, s.pfad, SPIELER.normalisieren, () => KONTO.uid()),
        kasse: new SpeicherKasse(s.firebaseBasis, s.bereich, KASSE.normalisieren)
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SpeicherGemeinsam, SpeicherKasse, speicherErzeugen };
}
