const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/exhibit-player.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ mode = 'dynamic', saveData = false } = {}) {
    const ids = {}, timers = new Map(), preloads = [];
    let now = 10000, timerId = 0;
    class Element {
        constructor(tag) {
            this.tagName = tag;
            this.style = {}; this.listeners = {}; this.attributes = {}; this.children = [];
            this.hidden = false; this.complete = false; this.naturalWidth = 0;
            this.clientWidth = 1000; this.clientHeight = 563;
            const classes = new Set();
            this.classList = {
                add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
                toggle(c, enabled) { if (enabled) classes.add(c); else classes.delete(c); }
            };
        }
        setAttribute(k, v) { this.attributes[k] = v; }
        removeAttribute(k) { delete this.attributes[k]; if (k === 'src') this.src = ''; }
        addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); }
        emit(k) { for (const fn of this.listeners[k] || []) fn({ stopPropagation() {}, preventDefault() {} }); }
        appendChild(el) { el.parentNode = this; this.children.push(el); }
        replaceWith(el) { ids[this.id] = el; }
        querySelectorAll() { return []; }
        pause() { this.paused = true; }
        load() {}
        play() { this.paused = false; return new Promise((resolve, reject) => { this.rejectPlay = reject; }); }
        decode() { return Promise.resolve(); }
    }
    for (const id of source.matchAll(/getElementById\('([^']+)'\)/g)) {
        const el = new Element('div'); el.id = id[1]; ids[el.id] = el;
    }
    const nodes = ['a', 'b', 'c'].map((id, i) => ({ id, parentId: i ? ['a', 'b'][i-1] : null,
        title: `Page ${id}`, image: `${id}.png`, motion: `${id}.mp4`, click: { x: .4, y: .6 } }));
    const document = { hidden: false, getElementById: id => ids[id], createElement: tag => new Element(tag) };
    const window = { MUSEUM_PACK: { museums: [{ id: 'odyssey', name: 'Odyssey', rootId: 'a', nodes }] },
        location: { search: '' }, history: { replaceState() {} }, matchMedia: () => ({matches:false}),
        addEventListener() {}, PointerEvent: true };
    vm.runInNewContext(source, { window, document, navigator: { connection: {saveData} },
        localStorage: { getItem: () => mode, setItem() {} }, Date: { now: () => now },
        Image: class extends Element { constructor() { super('img'); preloads.push(this); } },
        setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; },
        clearTimeout: id => timers.delete(id) });
    return { ids, document, preloads,
        async imageReady() { const i = ids['exhibit-image']; i.naturalWidth = 1280; i.naturalHeight = 720; i.onload(); await flush(); },
        advance(ms) { const end = now + ms; while (true) {
            const next = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
            if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].fn();
        } now = end; }
    };
}

test('turning a page immediately removes old media and announces the destination', async () => {
    const x = setup(); await x.imageReady();
    const old = x.ids['exhibit-image'];
    x.ids['exhibit-next'].emit('click');
    assert.notEqual(x.ids['exhibit-image'], old);
    assert.equal(old.src, '');
    assert.equal(x.ids['exhibit-frame'].attributes['aria-busy'], 'true');
    assert.equal(x.ids['exhibit-loading'].hidden, false);
    assert.match(x.ids['exhibit-loading-title'].textContent, /2 \/ 3/);
    assert.match(x.ids['exhibit-loading-detail'].textContent, /Page b/);
});

test('late decode, playback and rejection from the previous page cannot reveal stale content', async () => {
    const x = setup(), oldImage = x.ids['exhibit-image'], oldVideo = x.ids['exhibit-video'];
    let finishDecode; oldImage.decode = () => new Promise(r => { finishDecode = r; });
    oldImage.onload(); const oldPlaying = oldVideo.onplaying;
    x.ids['exhibit-next'].emit('click');
    finishDecode(); oldPlaying(); oldVideo.rejectPlay(new Error('old failure')); await flush();
    assert.equal(x.ids['exhibit-loading'].hidden, false);
    assert.equal(x.ids['exhibit-frame'].classList.contains('video-playing'), false);
    assert.equal(x.ids['exhibit-video'].src, 'b.mp4');
});

test('a decoded image is displayed while video loads and remains on video failure', async () => {
    const x = setup(); await x.imageReady();
    assert.equal(x.ids['exhibit-loading'].hidden, true);
    assert.match(x.ids['exhibit-media-note'].textContent, /动态画面加载中/);
    x.ids['exhibit-video'].onerror();
    assert.equal(x.ids['exhibit-loading'].hidden, true);
    assert.equal(x.ids['exhibit-video'].hidden, true);
    assert.match(x.ids['exhibit-media-note'].textContent, /已显示原图/);
});

test('failed media exposes retry and retry creates a fresh request on the same page', async () => {
    const x = setup(); x.ids['exhibit-image'].onerror(); x.ids['exhibit-video'].onerror();
    assert.equal(x.ids['exhibit-retry'].hidden, false);
    assert.equal(x.ids['exhibit-frame'].attributes['aria-busy'], 'false');
    const old = x.ids['exhibit-image']; x.ids['exhibit-retry'].emit('click');
    assert.notEqual(x.ids['exhibit-image'], old); assert.equal(x.ids['exhibit-image'].src, 'a.png');
    await x.imageReady(); assert.equal(x.ids['exhibit-loading'].hidden, true);
});

test('slow loading explains the wait, permits retry, and eventually exits the busy state', () => {
    const x = setup(); x.advance(8000);
    assert.match(x.ids['exhibit-loading-detail'].textContent, /网络较慢/);
    assert.equal(x.ids['exhibit-retry'].hidden, false);
    x.advance(22000); assert.equal(x.ids['exhibit-frame'].attributes['aria-busy'], 'false');
    x.ids['exhibit-next'].emit('click');
    assert.equal(x.ids['exhibit-image'].src, 'b.png');
    assert.equal(x.ids['exhibit-frame'].attributes['aria-busy'], 'true');
});

test('preloads only the next image after readiness and respects data saver', async () => {
    const x = setup(); assert.equal(x.preloads.length, 0); await x.imageReady(); x.advance(700);
    assert.deepEqual(x.preloads.map(i => i.src), ['b.png']);
    assert.equal(x.preloads[0].fetchPriority, 'low');
    const y = setup({saveData:true}); await y.imageReady(); y.advance(700); assert.equal(y.preloads.length, 0);
});

test('static mode makes no video request; video can also finish before the image', async () => {
    const x = setup({mode:'static'}); assert.equal(x.ids['exhibit-video'].src, undefined);
    await x.imageReady(); assert.equal(x.ids['exhibit-media-note'].hidden, true);
    const y = setup(); y.ids['exhibit-video'].onplaying(); y.ids['exhibit-image'].onerror();
    assert.equal(y.ids['exhibit-loading'].hidden, true);
    assert.equal(y.ids['exhibit-frame'].classList.contains('video-playing'), true);
});

test('background autoplay deferral is not treated as a video failure', async () => {
    const x = setup(); x.document.hidden = true; await x.imageReady(); x.advance(12000);
    assert.equal(x.ids['exhibit-video'].src, 'a.mp4');
    x.document.hidden = false; x.advance(12000);
    assert.equal(x.ids['exhibit-video'].hidden, true);
});
