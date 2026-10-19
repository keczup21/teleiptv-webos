/* TeleIPTV — webOS native service: fetches URLs bypassing CORS.
 * Runs under node.js on the TV; the web UI calls it over Luna Bus.
 */
"use strict";

var Service = require("webos-service");
var http = require("http");
var https = require("https");
var url = require("url");

var service = new Service("pl.openiptv.player.service.fetch");

/* Jedna odpowiedź na wywołanie. Luna nie przyjmuje dwóch „respond” z rzędu,
 * a po zerwanym pobraniu zdarzenia „error” i „end” potrafią przyjść oba —
 * drugi „respond” trafiał wtedy do już zamkniętego wywołania i aplikacja
 * dostawała błąd usługi zamiast prawdziwej odpowiedzi serwera. */
function responder(message) {
  var done = false;
  return function reply(payload) {
    if (done) return;
    done = true;
    message.respond(payload);
  };
}

function fetchUrl(target, asBinary, message, redirectsLeft, reply) {
  if (redirectsLeft === undefined) redirectsLeft = 5;
  if (!reply) reply = responder(message);

  var parsed;
  try {
    parsed = url.parse(target);
  } catch (e) {
    reply({ returnValue: false, errorText: "invalid url" });
    return;
  }
  if (!parsed.hostname) {
    reply({ returnValue: false, errorText: "invalid url" });
    return;
  }

  var mod = parsed.protocol === "https:" ? https : http;
  var req = mod.get({
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.path,
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "*/*" }
  }, function (res) {
    var status = res.statusCode || 0;

    if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location && redirectsLeft > 0) {
      res.resume();
      fetchUrl(url.resolve(target, res.headers.location), asBinary, message, redirectsLeft - 1, reply);
      return;
    }

    var chunks = [];
    res.on("data", function (c) { chunks.push(c); });
    /* Przerwane połączenie w połowie pobrania: bez tego obsługi „error” na
     * odpowiedzi wyjątek leciał z serwisu i aplikacja czekała na odpowiedź,
     * której już nie było. */
    res.on("error", function (err) {
      reply({ returnValue: false, status: status, errorText: err && err.message ? err.message : "network error" });
    });
    res.on("end", function () {
      var buf = Buffer.concat(chunks);
      if (status >= 200 && status < 300) {
        if (asBinary) {
          reply({ returnValue: true, status: status, dataBase64: buf.toString("base64") });
        } else {
          reply({ returnValue: true, status: status, data: buf.toString("utf8") });
        }
      } else {
        reply({ returnValue: false, status: status, errorText: "HTTP " + status });
      }
    });
  });

  req.setTimeout(120000, function () {
    req.destroy(new Error("timeout"));
  });

  req.on("error", function (err) {
    reply({ returnValue: false, errorText: err && err.message ? err.message : "network error" });
  });
}

service.register("fetch", function (message) {
  var target = message.payload && message.payload.url;
  if (!target) { message.respond({ returnValue: false, errorText: "no url" }); return; }
  fetchUrl(target, false, message);
});

service.register("fetchBinary", function (message) {
  var target = message.payload && message.payload.url;
  if (!target) { message.respond({ returnValue: false, errorText: "no url" }); return; }
  fetchUrl(target, true, message);
});

/* Ile czekamy na same nagłówki odpowiedzi, gdy pytamy tylko o dwa bajty. */
var PROBE_TIMEOUT = 15000;

/* Sonda adresu: prosimy o dwa pierwsze bajty (Range) i odpowiadamy zaraz po
 * nagłówkach, a połączenie zamykamy. Strumień na żywo leci bez końca, więc
 * czekanie na „end” nigdy by nie przyszło — a samo otwarcie połączenia mówi
 * wszystko, czego szukamy: status i typ treści. Dzięki temu aplikacja wie,
 * czy kanał nie wstał z powodu panelu (HTTP 403, 404), czy telewizora
 * (adres odpowiada, a obrazu nie ma). */
function probeUrl(target, message, redirectsLeft, reply) {
  if (redirectsLeft === undefined) redirectsLeft = 5;
  if (!reply) reply = responder(message);

  var parsed;
  try {
    parsed = url.parse(target);
  } catch (e) {
    reply({ returnValue: false, errorText: "invalid url" });
    return;
  }
  if (!parsed.hostname) {
    reply({ returnValue: false, errorText: "invalid url" });
    return;
  }

  var mod = parsed.protocol === "https:" ? https : http;
  var req = mod.get({
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.path,
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "*/*", "Range": "bytes=0-1" }
  }, function (res) {
    var status = res.statusCode || 0;

    if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location && redirectsLeft > 0) {
      res.resume();
      probeUrl(url.resolve(target, res.headers.location), message, redirectsLeft - 1, reply);
      return;
    }

    reply({
      returnValue: true,
      status: status,
      contentType: res.headers["content-type"] || "",
      finalUrl: target
    });
    /* Strumienia nie pobieramy: wystarczy, że serwer odpowiedział. Starszy Node
       na telewizorze zna tylko jedną z tych dróg zamykania, więc próbujemy obu. */
    if (typeof res.destroy === "function") res.destroy();
    else if (res.socket && typeof res.socket.destroy === "function") res.socket.destroy();
    if (typeof req.destroy === "function") req.destroy();
    else if (typeof req.abort === "function") req.abort();
  });

  req.setTimeout(PROBE_TIMEOUT, function () {
    req.destroy(new Error("timeout"));
  });

  req.on("error", function (err) {
    reply({ returnValue: false, errorText: err && err.message ? err.message : "network error" });
  });
}

service.register("probe", function (message) {
  var target = message.payload && message.payload.url;
  if (!target) { message.respond({ returnValue: false, errorText: "no url" }); return; }
  probeUrl(target, message);
});
