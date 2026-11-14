// Made by <skill>/scripts/cues.py from the starter's sample words. Times are seconds of the whole video.
// Rebuild it after any narration change: python "<skill>/scripts/cues.py" build ...
window.KHAAM_WORDS = [{"text": "اكتب", "start": 4.4, "end": 4.75}, {"text": "فكرتك", "start": 4.8, "end": 5.25}, {"text": "بسطر", "start": 5.3, "end": 5.7}, {"text": "وكلود", "start": 6.0, "end": 6.4}, {"text": "يسوي", "start": 6.45, "end": 6.8}, {"text": "الباقي", "start": 6.85, "end": 7.4}];
window.KHAAM_CUES = {};
window.KHAAM_CUE_ENDS = {};
(function () {
  var HARAKAT = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  var MAP = {"أ":"ا","إ":"ا","آ":"ا","ٱ":"ا","ى":"ي","ة":"ه","ؤ":"و","ئ":"ي","ء":""};
  function norm(w) {
    return String(w).normalize("NFC").replace(HARAKAT, "").replace(/[أإآٱىةؤئء]/g, function (c) { return MAP[c]; })
      .toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  }
  // cue("يسقي"), cue("يسقي#2"), cue("يسقي:end"), cue("ليلة مطر"), cue("يسقي+0.2"), or a name from cues.json or
  // beats.json, also with an ending: cue("dawn:end"), cue("dawn+0.2"), cue("dawn:end-0.1")
  window.cue = function (name) {
    var C = window.KHAAM_CUES, E = window.KHAAM_CUE_ENDS || {}, own = Object.prototype.hasOwnProperty;
    if (own.call(C, name)) return C[name];
    var m = /^(.+?)(?:#(\d+))?(?::(start|end))?([+-]\d+(?:\.\d+)?)?$/.exec(String(name).trim());
    if (!m) throw new Error('cue: cannot read "' + name + '"');
    if (own.call(C, m[1]) && (!m[2] || +m[2] === 1)) {
      if (m[3] === "end" && !own.call(E, m[1]))
        throw new Error('cue: «' + m[1] + '» has no end in timing.js (give it an "end" in plan/beats.json)');
      var v = (m[3] === "end" ? E[m[1]] : C[m[1]]) + (m[4] ? parseFloat(m[4]) : 0);
      return Math.round(Math.max(0, v) * 1000) / 1000;
    }
    var want = m[1].split(/\s+/).map(norm).filter(Boolean), W = window.KHAAM_WORDS, nth = +(m[2] || 1), seen = 0;
    for (var i = 0; i + want.length <= W.length; i++) {
      var ok = true;
      for (var k = 0; k < want.length; k++) if (norm(W[i + k].text) !== want[k]) { ok = false; break; }
      if (ok && ++seen === nth) {
        var t = m[3] === "end" ? W[i + want.length - 1].end : W[i].start;
        return Math.max(0, t + (m[4] ? parseFloat(m[4]) : 0));
      }
    }
    if (!W.length) throw new Error('cue: «' + m[1] + '» is not a name in timing.js, and this video has no ' +
                                   'narration words (name it in plan/beats.json, then run cues.py build --beats).');
    throw new Error('cue: the word «' + m[1] + '» is not in the narration timings (timing.js). ' +
                    'Write it as it is in the script, or run cues.py words to list them.');
  };
  // words between two times, for a word-lit block: wordsBetween(cue("المطر"), cue("أرضك:end"))
  window.wordsBetween = function (t0, t1) {
    return window.KHAAM_WORDS.filter(function (w) { return w.start >= t0 - 0.001 && w.end <= t1 + 0.001; });
  };
})();
