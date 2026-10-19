/* Test sondy adresu - bez telewizora i bez panelu.

   Zgloszony blad: kanal konczyl sie na "kod 4" (natywnie) i "NetworkError /
   Exception" (mpegts), a komunikat nie mowil, czy winny jest panel, czy
   telewizor. Teraz po wyczerpaniu kolejki aplikacja pyta serwer o ten sam
   adres (Range: dwa bajty, odpowiedz po naglowkach) i dopisuje wynik do bledu:
   HTTP 2xx -> obrazu nie pobiera telewizor, HTTP 4xx/5xx -> odmowil panel,
   cisza -> zly adres, port albo schemat.

   Test sprawdza:
     1. sonda przez serwis (Luna) - status i typ tresci, blad uslugi,
     2. sonda bez serwisu (HEAD przez przegladarke) - status i brak dostepu,
     3. zdanie dla uzytkownika (probeVerdict) w trzech przypadkach,
     4. podpiecie sondy: komunikat po wyczerpaniu kolejki, panel diagnostyki,
        wpisy w serwisie (metoda probe + jedno "respond" na wywolanie).

   Uruchomienie: npm run test:probe */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "www", "app.js"), "utf8").replace(/\r\n/g, "\n");
const service = fs.readFileSync(path.join(ROOT, "webos-service", "service", "main.js"), "utf8")
  .replace(/\r\n/g, "\n");

let fails = 0;
function check(name, cond, extra) {
  if (cond) { console.log("  OK   " + name); }
  else { fails++; console.log("  FAIL " + name + (extra ? "   -> " + extra : "")); }
}

/* Wyciagamy dokladnie te funkcje z app.js, ktore robia sonde - test nie kopiuje
   logiki, wiec nie rozjedzie sie z aplikacja. */
function slice(from, to) {
  const start = src.indexOf(from);
  const end = start < 0 ? -1 : src.indexOf(to, start + from.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Nie znalazlem bloku w app.js: " + from + " .. " + to);
  }
  let block = src.slice(start, end);
  const stray = block.lastIndexOf("/*");
  if (stray > 0 && block.indexOf("*/", stray) < 0) block = block.slice(0, stray);
  return block;
}

const codeProbe = slice("function webosServiceAvailable(", "function httpGet(");
const codeVerdict = slice("function probeVerdict(", "/* Komunikat o nieudanym kanale");
/* Podpiecie sondy pod komunikat i pod panel diagnostyki - wyciete z app.js, zeby
   test sprawdzal prawdziwe funkcje, a nie ich kopie. */
const codeFailed = slice("function probeFailedStream(", "/* ----------  sesja multimediów");
const codeServer = slice("function diagServerUrl(", "function diagServerLines(");
/* Adres panelu liczy prawdziwy xtreamEndpoint (schemat z portu), wiec test widzi
   dokladnie ten adres, o ktory aplikacja pyta serwer. */
const codeEndpoint = slice("function serverScheme(", "/* =============================  AKTUALIZACJE");

console.log("Sonda adresu: co odpowiedzial serwer, gdy kanal nie wstal");

/* --- 1-2. sonda: serwis i przegladarka ---------------------------------- */

function harness(options) {
  const opts = options || {};
  const calls = [];
  const xhr = [];
  const notes = [];
  const errors = [];
  const sandbox = {
    /* napis zamiast tlumaczenia: widac, ktory klucz i z jakimi danymi poszedl */
    t: function (key, params) {
      let out = key;
      if (params) for (const name in params) out += "|" + name + "=" + params[name];
      return out;
    },
    /* limit czasu bez czekania - sonda ma odpowiedziec od razu */
    withTimeout: function (promise) { return promise; },
    /* dziennik panelu i komunikat na ekranie: tu tylko notujemy, co dostaly */
    diagNote: function (note) { notes.push(note); },
    showPlayerError: function (message) { errors.push(message); },
    XMLHttpRequest: function () {
      const self = this;
      this.open = function (method, url) { self.method = method; self.url = url; };
      this.send = function () {
        xhr.push({ method: self.method, url: self.url });
        const answer = opts.head ? opts.head() : { error: true };
        if (answer && answer.error) self.onerror();
        else { self.status = answer.status; self.onload(); }
      };
    }
  };
  if (opts.state) sandbox.state = opts.state;
  if (opts.sandbox) for (const name in opts.sandbox) sandbox[name] = opts.sandbox[name];
  if (opts.service !== false) {
    sandbox.webOS = {
      service: {
        request: function (uri, payload, onSuccess, onError) {
          calls.push({ uri: uri, url: payload && payload.url });
          const answer = opts.service();
          if (answer.error) onError({ errorText: answer.error });
          else onSuccess(answer.result);
        }
      }
    };
  }
  vm.createContext(sandbox);
  /* panel diagnostyki trzyma wynik sondy w tych trzech zmiennych (patrz app.js) */
  vm.runInContext("var diagServer = \"\", diagServerFor = \"\", diagServerBusy = false;\n" +
    codeProbe + codeVerdict + (opts.code || ""), sandbox);
  return { api: sandbox, calls: calls, xhr: xhr, notes: notes, errors: errors };
}

/* Sonda odpowiada przez Promise, wiec jej skutki widac dopiero po mikrozdaniu. */
function tick() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

(async function () {
  /* --- 1. sonda przez serwis ------------------------------------------- */

  let h = harness({
    service: function () { return { result: { returnValue: true, status: 200, contentType: "video/mp2t" } }; }
  });
  let result = await h.api.serverProbe("http://panel:8080/live/u/p/1.ts");
  check("serwis: adres pytany metoda probe (nie pobiera strumienia)",
    h.calls.length === 1 && h.calls[0].uri === "luna://pl.openiptv.player.service.fetch/probe" &&
    h.calls[0].url === "http://panel:8080/live/u/p/1.ts", JSON.stringify(h.calls));
  check("serwis: status i typ tresci wracaja do aplikacji",
    !!result && result.status === 200 && result.contentType === "video/mp2t", JSON.stringify(result));

  h = harness({ service: function () { return { result: { returnValue: false, status: 403, errorText: "HTTP 403" } }; } });
  result = await h.api.serverProbe("http://panel:8080/live/u/p/1.ts");
  check("serwis: odmowa panelu (HTTP 403) trafia do sondy jako blad",
    !!result && result.error === "HTTP 403", JSON.stringify(result));

  h = harness({ service: function () { return { error: "timeout" }; } });
  result = await h.api.serverProbe("http://panel:8080/live/u/p/1.ts");
  check("serwis: brak odpowiedzi uslugi tez jest wynikiem sondy (bez wyjatku)",
    !!result && result.error === "timeout", JSON.stringify(result));

  /* --- 2. sonda bez serwisu (przegladarka) ----------------------------- */

  h = harness({ service: false, head: function () { return { status: 200 }; } });
  result = await h.api.serverProbe("http://panel:8080/live/u/p/1.ts");
  check("bez serwisu: sonda idzie metody HEAD (ciala strumienia nie pobiera)",
    h.xhr.length === 1 && h.xhr[0].method === "HEAD" && h.xhr[0].url === "http://panel:8080/live/u/p/1.ts",
    JSON.stringify(h.xhr));
  check("bez serwisu: status odpowiedzi wraca do aplikacji",
    !!result && result.status === 200 && !result.error, JSON.stringify(result));

  h = harness({ service: false, head: function () { return { error: true }; } });
  result = await h.api.serverProbe("http://panel:8080/live/u/p/1.ts");
  check("bez serwisu: zablokowane zapytanie (CORS) tez jest wynikiem sondy",
    !!result && /err_network/.test(result.error), JSON.stringify(result));

  h = harness({});
  result = await h.api.serverProbe("");
  check("pusty adres: sonda nic nie robi", result === null && h.calls.length === 0);

  /* --- 3. zdanie dla uzytkownika --------------------------------------- */

  h = harness({});
  check("HTTP 2xx: adres dobry, winny telewizor",
    /^err_probe_ok\|status=200\|type=video\/mp2t$/.test(h.api.probeVerdict({ status: 200, contentType: "video/mp2t" })),
    h.api.probeVerdict({ status: 200, contentType: "video/mp2t" }));
  check("HTTP 2xx bez typu tresci: w zdaniu jest 'brak', a nie puste nawiasy",
    /type=diag_none$/.test(h.api.probeVerdict({ status: 200, contentType: "" })),
    h.api.probeVerdict({ status: 200, contentType: "" }));
  check("HTTP 4xx: polaczenie odrzucil panel",
    /^err_probe_http\|status=403$/.test(h.api.probeVerdict({ status: 403 })),
    h.api.probeVerdict({ status: 403 }));
  check("brak odpowiedzi: zly adres albo port",
    /^err_probe_net\|error=ECONNREFUSED$/.test(h.api.probeVerdict({ error: "ECONNREFUSED" })),
    h.api.probeVerdict({ error: "ECONNREFUSED" }));
  check("brak wyniku: bez zdania", h.api.probeVerdict(null) === "");

  /* --- 4. podpiecie sondy --------------------------------------------- */

  /* Wyczerpana kolejka: komunikat mowi, co odpowiedzial serwer — ale tylko
     wtedy, gdy na ekranie wciaz wisi ten sam kanal (ten sam adres). */
  const liveState = function (source) {
    return { watchChannel: { name: "TVN" }, currentSource: source };
  };

  h = harness({
    service: function () { return { result: { returnValue: true, status: 403, contentType: "" } }; },
    state: liveState("http://panel/live/u/p/1.ts"),
    code: codeFailed
  });
  h.api.probeFailedStream("kanal nie dziala", "http://panel/live/u/p/1.ts");
  check("nieudany kanal: sonda rusza od razu, a komunikat czeka na odpowiedz",
    h.calls.length === 1 && h.errors.length === 0, JSON.stringify({ calls: h.calls, errors: h.errors }));
  await tick();
  check("nieudany kanal: do komunikatu dopisuje sie odpowiedz serwera (HTTP 403 -> panel)",
    h.errors.length === 1 && h.errors[0] === "kanal nie dziala\nerr_probe_http|status=403",
    JSON.stringify(h.errors));
  check("nieudany kanal: to samo zdanie trafia do dziennika panelu",
    h.notes.length === 1 && /^diag_server_note\|result=err_probe_http/.test(h.notes[0]),
    JSON.stringify(h.notes));

  h = harness({
    service: function () { return { result: { returnValue: true, status: 200, contentType: "video/mp2t" } }; },
    state: liveState("http://panel/live/u/p/1.ts"),
    code: codeFailed
  });
  h.api.probeFailedStream("kanal nie dziala", "http://panel/live/u/p/1.ts");
  await tick();
  check("nieudany kanal: HTTP 200 mowi wprost, ze adres jest dobry",
    h.errors.length === 1 && /err_probe_ok\|status=200\|\w+=video\/mp2t$/.test(h.errors[0]),
    JSON.stringify(h.errors));

  /* Uzytkownik zdazyl przelaczyc kanal: nowy blad jest juz na ekranie i stary
     zdania nie dopisze, ale do dziennika panelu sonda trafia zawsze. */
  h = harness({
    service: function () { return { result: { returnValue: true, status: 403, contentType: "" } }; },
    state: liveState("http://panel/live/u/p/2.ts"),
    code: codeFailed
  });
  h.api.probeFailedStream("kanal nie dziala", "http://panel/live/u/p/1.ts");
  await tick();
  check("inny kanal juz gra: odpowiedz nie wraca na ekran", h.errors.length === 0,
    JSON.stringify(h.errors));
  check("inny kanal juz gra: dziennik panelu i tak notuje sonde",
    h.notes.length === 1, JSON.stringify(h.notes));

  h = harness({
    service: function () { return { result: { returnValue: true, status: 403, contentType: "" } }; },
    state: { watchChannel: null, currentSource: "http://panel/live/u/p/1.ts" },
    code: codeFailed
  });
  h.api.probeFailedStream("kanal nie dziala", "http://panel/live/u/p/1.ts");
  await tick();
  check("wyjscie z odtwarzacza: sonda nie pisze po ekranie", h.errors.length === 0,
    JSON.stringify(h.errors));

  h = harness({ service: function () { return { result: { returnValue: true, status: 200 } }; },
    state: liveState(""), code: codeFailed });
  h.api.probeFailedStream("kanal nie dziala", "");
  await tick();
  check("brak adresu: sonda nie pyta o nic", h.calls.length === 0 && h.notes.length === 0,
    JSON.stringify({ calls: h.calls, notes: h.notes }));

  /* Panel diagnostyki: przy otwarciu pyta endpoint panelu (player_api.php albo
     adres playlisty), a nie strumien — inaczej sonda zajelaby drugie polaczenie
     na koncie z limitem i mogla zatrzymac obraz, ktory wlasnie leci. */
  let renders = 0;
  h = harness({
    service: function () { return { result: { returnValue: true, status: 200, contentType: "application/json" } }; },
    sandbox: {
      activeProfile: function () {
        return { sourceType: "xtream", xtreamServer: "panel.tv:443", xtreamUser: "u", xtreamPass: "p" };
      },
      /* panel otwarty: po odpowiedzi ma sie odswiezyc na ekranie */
      diagVisible: function () { return true; },
      renderDiagnostics: function () { renders++; }
    },
    code: codeEndpoint + codeServer
  });
  h.api.diagProbeServer();
  check("panel: pyta endpoint panelu, nie strumien",
    h.calls.length === 1 && h.calls[0].url === "https://panel.tv:443/player_api.php?username=u&password=p",
    JSON.stringify(h.calls));
  check("panel: zanim przyjdzie odpowiedz, widac 'sondowanie'",
    h.api.diagServer === "diag_probing", String(h.api.diagServer));
  await tick();
  check("panel: po odpowiedzi widac jej wynik",
    h.api.diagServer === "err_probe_ok|status=200|type=application/json", String(h.api.diagServer));
  check("panel: otwarty panel odswieza sie sam, gdy wynik przyjdzie",
    renders === 1, String(renders));
  h.api.diagProbeServer();
  await tick();
  check("panel: to samo pytanie nie leci drugi raz (otwarcie panelu w trakcie)",
    h.calls.length === 1, JSON.stringify(h.calls));

  h = harness({
    service: function () { return { result: { returnValue: true, status: 404, contentType: "" } }; },
    sandbox: {
      activeProfile: function () { return { sourceType: "m3u-file", playlistUrl: "http://panel/list.m3u" }; },
      diagVisible: function () { return false; },
      renderDiagnostics: function () {}
    },
    code: codeEndpoint + codeServer
  });
  h.api.diagProbeServer();
  await tick();
  check("panel: playlista tez jest pytana o naglowki (HTTP 404 -> zly adres)",
    h.calls.length === 1 && h.calls[0].url === "http://panel/list.m3u" &&
    h.api.diagServer === "err_probe_http|status=404",
    JSON.stringify({ calls: h.calls, server: h.api.diagServer }));

  h = harness({
    sandbox: {
      activeProfile: function () { return { sourceType: "m3u-file" }; },
      $: function () { return null; },
      renderDiagnostics: function () {}
    },
    code: codeEndpoint + codeServer
  });
  h.api.diagProbeServer();
  check("panel: bez adresu nie pyta o nic (i nie zostawia 'sondowanie')",
    h.calls.length === 0 && h.api.diagServer === "diag_none", String(h.api.diagServer));

  check("app.js: po wyczerpaniu kolejki komunikat przechodzi przez sonde",
    /showPlayerError\(failure\);[\s\S]{0,400}probeFailedStream\(failure, state\.currentSource\)/.test(src));
  check("app.js: zdanie z sondy dopisuje sie tylko do tego samego kanalu i adresu",
    /function probeFailedStream[\s\S]{0,600}state\.currentSource !== token/.test(src));
  check("app.js: wynik sondy trafia tez do dziennika panelu",
    /function probeFailedStream[\s\S]{0,400}diagNote\(t\("diag_server_note"/.test(src));
  check("app.js: panel diagnostyki pyta o adres panelu przy otwarciu",
    /function openDiagnostics[\s\S]{0,300}diagProbeServer\(\)/.test(src));
  check("app.js: panel diagnostyki pokazuje sekcje SERWER",
    /function diagText[\s\S]{0,600}diagServerLines\(\)/.test(src));
  check("app.js: sonda w panelu pyta endpoint panelu, nie strumien (limit polaczen)",
    /function diagServerUrl[\s\S]{0,400}xtreamEndpoint\(profile, ""\)/.test(src) &&
    !/function diagServerUrl[\s\S]{0,400}(xtreamStreamUrl|buildCatchupUrl)/.test(src));

  check("serwis: metoda probe zarejestrowana",
    /service\.register\("probe"/.test(service));
  check("serwis: sonda prosi o dwa bajty i zamyka polaczenie",
    /Range": "bytes=0-1"/.test(service) &&
    /probeUrl[\s\S]{0,1200}res\.destroy\(\)/.test(service) &&
    /probeUrl[\s\S]{0,1400}req\.destroy\(\)/.test(service));
  check("serwis: odpowiedz po naglowkach, bez czekania na koniec strumienia",
    /probeUrl[\s\S]{0,1600}reply\(\{[\s\S]{0,200}contentType/.test(service));
  check("serwis: jedno 'respond' na wywolanie (error i end nie odpowiedza dwa razy)",
    /function responder\(message\)/.test(service) &&
    /res\.on\("error"/.test(service) &&
    /if \(done\) return;/.test(service));

  const plPart = src.slice(src.indexOf("var I18N_PL"), src.indexOf("var I18N_EN"));
  const enPart = src.slice(src.indexOf("var I18N_EN"), src.indexOf("var I18N = {"));
  ["err_probe_ok", "err_probe_http", "err_probe_net", "diag_server", "diag_server_note"].forEach(function (key) {
    check("app.js: napis " + key + " jest po polsku i po angielsku",
      plPart.indexOf(key + ":") > 0 && enPart.indexOf(key + ":") > 0);
  });

  if (fails > 0) {
    console.log("\n" + fails + " sprawdzen nie przeszlo.");
    process.exit(1);
  }
  console.log("\nWszystkie sprawdzenia przeszly.");
})();
