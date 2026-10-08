/**
 * Shared looping theme track via Web Audio (no mp3 file, no data:/blob: media URL).
 * Payload is window.THEME_AUDIO_PACK from theme-audio-data.js (JSON object + base64).
 */
'use strict';

(function () {
    var playing = false;
    var ctx = null;
    var decoded = null;
    var source = null;
    var decoding = false;

    function buttons() {
        return document.querySelectorAll('.theme-audio-toggle');
    }

    function sync() {
        var nodes = buttons();
        var label = playing
            ? '停止播放 A Face A Fleet A War A Man'
            : '播放 A Face A Fleet A War A Man';
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].setAttribute('aria-pressed', playing ? 'true' : 'false');
            nodes[i].setAttribute('aria-label', label);
            if (playing) nodes[i].classList.add('is-playing');
            else nodes[i].classList.remove('is-playing');
        }
    }

    function pack() {
        return window.THEME_AUDIO_PACK;
    }

    function ensureCtx() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!ctx) ctx = new AC();
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        return ctx;
    }

    function b64ToBytes(b64) {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    function decodeOnce(done, fail) {
        if (decoded) {
            done(decoded);
            return;
        }
        var data = pack();
        var audioCtx = ensureCtx();
        if (!data || !data.b64 || !audioCtx) {
            fail();
            return;
        }
        if (decoding) return;
        decoding = true;
        var bytes = b64ToBytes(data.b64);
        var copy = bytes.buffer.slice(0);
        var settled = false;
        function ok(buffer) {
            if (settled) return;
            settled = true;
            decoding = false;
            decoded = buffer;
            done(buffer);
        }
        function err() {
            if (settled) return;
            settled = true;
            decoding = false;
            fail();
        }
        try {
            var ret = audioCtx.decodeAudioData(copy, ok, err);
            if (ret && ret.then) ret.then(ok, err);
        } catch (e) {
            err();
        }
    }

    function stopSource() {
        if (!source) return;
        try { source.onended = null; } catch (e1) {}
        try { source.stop(0); } catch (e2) {}
        try { source.disconnect(); } catch (e3) {}
        source = null;
    }

    function startSource(buffer) {
        var audioCtx = ensureCtx();
        if (!audioCtx || !buffer) return;
        stopSource();
        source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(audioCtx.destination);
        source.start(0);
    }

    function playFromStart() {
        playing = true;
        sync();
        decodeOnce(function (buffer) {
            if (!playing) return;
            startSource(buffer);
        }, function () {
            playing = false;
            sync();
        });
    }

    function stop() {
        playing = false;
        stopSource();
        sync();
    }

    function toggle() {
        if (playing) stop();
        else playFromStart();
    }

    function closestToggle(el) {
        while (el && el !== document) {
            if (el.classList && el.classList.contains('theme-audio-toggle')) return el;
            el = el.parentNode;
        }
        return null;
    }

    function init() {
        document.addEventListener('click', function (e) {
            if (!closestToggle(e.target)) return;
            e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            toggle();
        });
        sync();
    }

    window.ThemeAudio = {
        sync: sync,
        isPlaying: function () {
            return playing;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
