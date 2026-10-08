/**
 * 静态展厅：圆点进入已走过的子节点；在画面上左拖/左滑下一页，右拖/右滑上一页。
 * 不请求任何后端接口。
 */
'use strict';

(function () {
    var pack = window.MUSEUM_PACK;
    var toastEl = document.getElementById('exhibit-toast');
    var toastTimer = null;

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toastEl.hidden = true;
        }, 1800);
    }

    function queryParam(name) {
        var q = window.location.search.replace(/^\?/, '');
        var parts = q.split('&');
        for (var i = 0; i < parts.length; i++) {
            var kv = parts[i].split('=');
            if (kv[0] === name) return decodeURIComponent(kv[1] || '');
        }
        return '';
    }

    if (!pack || !pack.museums) {
        toast('故事数据未加载');
        return;
    }

    var museumId = queryParam('id') || (pack.museums[0] && pack.museums[0].id) || '';
    var museum = null;
    for (var i = 0; i < pack.museums.length; i++) {
        if (pack.museums[i].id === museumId) {
            museum = pack.museums[i];
            break;
        }
    }

    var museumEl = document.getElementById('exhibit-museum');
    var titleEl = document.getElementById('exhibit-title');
    var imgEl = document.getElementById('exhibit-image');
    var videoEl = document.getElementById('exhibit-video');
    var originalLink = document.getElementById('exhibit-original');
    var mediaRevision = 0;
    var beaconsEl = document.getElementById('exhibit-beacons');
    var backBtn = document.getElementById('exhibit-back');
    var nextBtn = document.getElementById('exhibit-next');
    var modeBtn = document.getElementById('exhibit-mode');
    var frameEl = document.getElementById('exhibit-frame');
    var hintEl = document.getElementById('exhibit-hint');
    var stageEl = document.getElementById('exhibit-stage');
    var MODE_KEY = 'odyssey-exhibit-mode';
    var exhibitMode = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'static' : 'dynamic';
    try {
        var savedMode = localStorage.getItem(MODE_KEY);
        if (savedMode === 'static' || savedMode === 'dynamic') exhibitMode = savedMode;
    } catch (err) {}

    if (!museum) {
        if (titleEl) titleEl.textContent = '未找到这个故事';
        if (museumEl) museumEl.textContent = '绘本数字图书馆';
        return;
    }

    document.title = museum.name + ' | 绘本数字图书馆';
    if (museumEl) museumEl.textContent = museum.name;
    if (imgEl) imgEl.draggable = false;
    if (modeBtn) {
        var hasMotion = museum.nodes.some(function (n) { return !!n.motion; });
        modeBtn.hidden = !hasMotion;
    }

    var byId = {};
    var childrenOf = {};
    museum.nodes.forEach(function (n) {
        byId[n.id] = n;
        if (n.parentId) {
            if (!childrenOf[n.parentId]) childrenOf[n.parentId] = [];
            childrenOf[n.parentId].push(n);
        }
    });

    var order = [];
    (function walk(id) {
        if (!byId[id]) return;
        order.push(id);
        var kids = childrenOf[id] || [];
        for (var k = 0; k < kids.length; k++) walk(kids[k].id);
    })(museum.rootId);

    var startId = queryParam('node') || museum.rootId;
    if (!byId[startId]) startId = museum.rootId;
    var index = order.indexOf(startId);
    if (index < 0) index = 0;
    var navLockUntil = 0;

    function currentId() {
        return order[index];
    }

    function syncUrl() {
        var id = currentId();
        var search = '?id=' + encodeURIComponent(museum.id);
        if (id && id !== museum.rootId) {
            search += '&node=' + encodeURIComponent(id);
        }
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', search);
        }
    }

    function syncModeBtn() {
        if (!modeBtn) return;
        var dynamic = exhibitMode === 'dynamic';
        modeBtn.textContent = dynamic ? '动态' : '静态';
        modeBtn.setAttribute('aria-pressed', dynamic ? 'true' : 'false');
        if (dynamic) modeBtn.classList.add('is-active');
        else modeBtn.classList.remove('is-active');
    }

    var loadingEl = document.getElementById('exhibit-loading');
    var loadingTitle = document.getElementById('exhibit-loading-title');
    var loadingDetail = document.getElementById('exhibit-loading-detail');
    var retryBtn = document.getElementById('exhibit-retry');
    var mediaNote = document.getElementById('exhibit-media-note');
    var disposeMedia = function () {};
    var warmImages = [];

    function prefetchNext(revision) {
        if (revision !== mediaRevision) return;
        var connection = navigator.connection;
        if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) return;
        var next = byId[order[index + 1]];
        if (!next || warmImages.some(function (item) { return item.path === next.image; })) return;
        var image = new Image();
        image.fetchPriority = 'low';
        image.src = next.image;
        warmImages.push({ path: next.image, image: image });
        if (warmImages.length > 3) warmImages.shift();
    }

    function renderMedia(node) {
        var revision = ++mediaRevision;
        disposeMedia();
        var dynamic = exhibitMode === 'dynamic' && !!node.motion && !!videoEl;
        var imageState = 'loading';
        var videoState = dynamic ? 'loading' : 'off';
        var buffering = false;
        var slow = false;
        var timedOut = false;
        var shown = false;
        var slowTimer, deadlineTimer, videoTimer, prefetchTimer;

        // Fresh elements prevent a previous page's pixels and late events from leaking into this page.
        var image = document.createElement('img');
        image.id = 'exhibit-image';
        image.alt = node.title;
        image.draggable = false;
        image.decoding = 'async';
        image.fetchPriority = 'high';
        imgEl.replaceWith(image);
        imgEl = image;
        var video = null;
        if (videoEl) {
            video = document.createElement('video');
            video.id = 'exhibit-video';
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.setAttribute('aria-hidden', 'true');
            video.hidden = true;
            video.preload = 'none';
            videoEl.replaceWith(video);
            videoEl = video;
        }
        if (originalLink) originalLink.href = node.image;
        if (loadingTitle) loadingTitle.textContent = '正在打开第 ' + (index + 1) + ' / ' + order.length + ' 页';

        function current() { return revision === mediaRevision; }
        function update() {
            if (!current()) return;
            var ready = imageState === 'ready' || videoState === 'playing';
            var failed = !ready && (timedOut || (imageState === 'error' && videoState !== 'loading'));
            frameEl.classList.toggle('is-loading', !ready);
            frameEl.classList.toggle('video-playing', videoState === 'playing');
            frameEl.setAttribute('aria-busy', !ready && !failed ? 'true' : 'false');
            if (loadingEl) {
                loadingEl.hidden = ready;
                loadingEl.classList.toggle('is-error', failed);
            }
            if (loadingDetail) loadingDetail.textContent = node.title + ' · ' +
                (failed ? '加载未完成，请重试或继续翻页' : slow ? '网络较慢，仍在加载…' : '正在加载画面…');
            if (retryBtn) retryBtn.hidden = ready || !(slow || failed);
            if (mediaNote) {
                var note = videoState === 'loading' ? '画面已就绪，动态画面加载中…' :
                    buffering ? '动态画面缓冲中…' : videoState === 'error' ? '动态画面暂不可用，已显示原图' : '';
                mediaNote.textContent = note;
                mediaNote.hidden = !ready || !note;
            }
            if (ready) {
                clearTimeout(slowTimer);
                clearTimeout(deadlineTimer);
                if (!shown) {
                    shown = true;
                    prefetchTimer = setTimeout(function () { prefetchNext(revision); }, 700);
                }
            }
            layoutBeacons();
        }
        function stopVideo() {
            if (!video) return;
            video.onplaying = video.onerror = video.onwaiting = video.onstalled = null;
            video.pause();
            video.hidden = true;
            video.classList.remove('is-playing');
            video.removeAttribute('src');
            video.load();
        }
        function fallback() {
            if (!current()) return;
            clearTimeout(videoTimer);
            videoState = 'error';
            buffering = false;
            stopVideo();
            update();
        }
        function armVideoTimeout() {
            clearTimeout(videoTimer);
            videoTimer = setTimeout(function () {
                if (!current()) return;
                // Browsers defer autoplay in background tabs; that is not a network failure.
                if (document.hidden) armVideoTimeout();
                else fallback();
            }, 12000);
        }
        disposeMedia = function () {
            clearTimeout(slowTimer);
            clearTimeout(deadlineTimer);
            clearTimeout(videoTimer);
            clearTimeout(prefetchTimer);
            image.onload = image.onerror = null;
            image.removeAttribute('src');
            stopVideo();
        };
        update();
        slowTimer = setTimeout(function () { if (current()) { slow = true; update(); } }, 8000);
        deadlineTimer = setTimeout(function () { if (current()) { timedOut = true; update(); } }, 30000);
        image.onload = function () {
            function show() {
                if (!current()) return;
                imageState = 'ready';
                update();
            }
            if (image.decode && !document.hidden) image.decode().then(show, show);
            else show();
        };
        image.onerror = function () {
            if (!current()) return;
            imageState = 'error';
            update();
        };
        image.src = node.image;
        if (image.complete && image.naturalWidth) image.onload();

        if (!dynamic) return;
        video.onplaying = function () {
            if (!current()) return;
            clearTimeout(videoTimer);
            videoState = 'playing';
            buffering = false;
            video.classList.add('is-playing');
            update();
        };
        video.onwaiting = video.onstalled = function () {
            if (!current() || videoState !== 'playing') return;
            buffering = true;
            armVideoTimeout();
            update();
        };
        video.onerror = fallback;
        video.hidden = false;
        video.preload = 'auto';
        video.src = node.motion;
        video.load();
        armVideoTimeout();
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function (error) {
            if (error.name !== 'AbortError') fallback();
        });
    }

    function fillStory(node) {
        var box = document.getElementById('exhibit-story');
        var zhEl = document.getElementById('exhibit-story-zh');
        var enEl = document.getElementById('exhibit-story-en');
        if (!box || !zhEl || !enEl) return;
        var zh = node.storyZh || '';
        var en = node.storyEn || '';
        zhEl.textContent = zh;
        enEl.textContent = en;
        enEl.hidden = !en;
        box.hidden = !(zh || en);
    }

    function layoutBeacons() {
        if (!beaconsEl || !imgEl) return;
        var isVideo = videoEl && videoEl.classList.contains('is-playing');
        var nw = (isVideo ? videoEl.videoWidth : imgEl.naturalWidth) || 0;
        var nh = (isVideo ? videoEl.videoHeight : imgEl.naturalHeight) || 0;
        var w = imgEl.clientWidth || 0;
        var h = imgEl.clientHeight || 0;
        if (!nw || !nh || !w || !h) {
            beaconsEl.style.left = '0';
            beaconsEl.style.top = '0';
            beaconsEl.style.width = '100%';
            beaconsEl.style.height = '100%';
            return;
        }
        var scale = Math.min(w / nw, h / nh);
        var dw = nw * scale;
        var dh = nh * scale;
        beaconsEl.style.left = ((w - dw) / 2) + 'px';
        beaconsEl.style.top = ((h - dh) / 2) + 'px';
        beaconsEl.style.width = dw + 'px';
        beaconsEl.style.height = dh + 'px';
    }

    function bindBeacon(btn, kid) {
        function goBeacon(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            showNode(kid.id);
        }
        btn.addEventListener('pointerdown', function (e) {
            e.stopPropagation();
        });
        btn.addEventListener('mousedown', function (e) {
            e.stopPropagation();
        });
        btn.addEventListener('touchstart', function (e) {
            e.stopPropagation();
        }, { passive: true });
        btn.addEventListener('click', goBeacon);
    }

    function render() {
        var node = byId[currentId()];
        if (!node) return;
        titleEl.textContent = node.title;
        if (museumEl) museumEl.textContent = museum.name + ' · 第 ' + (index + 1) + ' / ' + order.length + ' 页';
        document.title = node.title + ' | 绘本数字图书馆';
        imgEl.alt = node.title;
        renderMedia(node);
        imgEl.draggable = false;
        fillStory(node);
        if (backBtn) backBtn.hidden = index <= 0;
        if (nextBtn) nextBtn.hidden = index >= order.length - 1;
        beaconsEl.innerHTML = '';

        var kids = childrenOf[currentId()] || [];
        kids.forEach(function (kid) {
            if (!kid.click) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'exhibit-beacon';
            btn.style.left = (kid.click.x * 100) + '%';
            btn.style.top = (kid.click.y * 100) + '%';
            btn.title = kid.title;
            btn.setAttribute('aria-label', '进入：' + kid.title);
            bindBeacon(btn, kid);
            beaconsEl.appendChild(btn);
        });
        layoutBeacons();

        if (hintEl) {
            hintEl.textContent = '向左或向上滑动进入下一页，向右或向下滑动回到上一页。白点是已经走过的航线。';
        }
    }

    function showNode(id) {
        var nextIndex = order.indexOf(id);
        if (nextIndex < 0) return;
        index = nextIndex;
        render();
        syncUrl();
    }

    function go(delta) {
        var now = Date.now();
        if (now < navLockUntil) return;
        var next = index + delta;
        if (next < 0) {
            navLockUntil = now + 360;
            toast('已经是第一页');
            return;
        }
        if (next >= order.length) {
            navLockUntil = now + 360;
            toast('已经是最后一页');
            return;
        }
        navLockUntil = now + 360;
        index = next;
        render();
        syncUrl();
    }

    function hasClassWalk(el, className, stopEl) {
        var node = el;
        while (node && node !== stopEl) {
            if (node.classList && node.classList.contains(className)) return true;
            node = node.parentNode;
        }
        return false;
    }

    function bindSwipe(surface) {
        if (!surface) return;
        var drag = null;
        var suppressClick = false;

        function point(e, prop) {
            if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0][prop];
            if (e.touches && e.touches[0]) return e.touches[0][prop];
            return e[prop];
        }

        function threshold() {
            var w = window.innerWidth || 800;
            return Math.max(36, Math.min(72, w * 0.1));
        }

        function swipeDelta(dx, dy) {
            var ax = Math.abs(dx);
            var ay = Math.abs(dy);
            var min = threshold();
            if (ax < min && ay < min) return 0;
            if (ax >= ay) return dx < 0 ? 1 : -1;
            return dy < 0 ? 1 : -1;
        }

        function ignoreStart(el) {
            return hasClassWalk(el, 'exhibit-home', surface)
                || hasClassWalk(el, 'exhibit-pager', surface)
                || hasClassWalk(el, 'exhibit-back', surface)
                || hasClassWalk(el, 'exhibit-beacon', surface)
                || hasClassWalk(el, 'exhibit-loading', surface)
                || hasClassWalk(el, 'exhibit-story', surface)
                || hasClassWalk(el, 'exhibit-hint', surface)
                || hasClassWalk(el, 'theme-audio-toggle', surface);
        }

        function beaconAt(x, y) {
            var nodes = beaconsEl ? beaconsEl.querySelectorAll('.exhibit-beacon') : [];
            for (var i = 0; i < nodes.length; i++) {
                var box = nodes[i].getBoundingClientRect();
                var pad = 8;
                if (x >= box.left - pad && x <= box.right + pad && y >= box.top - pad && y <= box.bottom + pad) {
                    return nodes[i];
                }
            }
            return null;
        }

        function start(e) {
            if (e.touches && e.touches.length > 1) {
                drag = null;
                return;
            }
            if (typeof e.button === 'number' && e.button !== 0) return;
            if (ignoreStart(e.target)) return;
            drag = {
                x: point(e, 'clientX'),
                y: point(e, 'clientY'),
                moved: false,
                pointerId: e.pointerId
            };
        }

        function move(e) {
            if (!drag) return;
            var dx = point(e, 'clientX') - drag.x;
            var dy = point(e, 'clientY') - drag.y;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                drag.moved = true;
                if (surface.classList) surface.classList.add('is-dragging');
                if (drag.pointerId != null && surface.setPointerCapture && !drag.captured) {
                    drag.captured = true;
                    try { surface.setPointerCapture(drag.pointerId); } catch (err) {}
                }
            }
            if (drag.moved && e.cancelable) {
                e.preventDefault();
            }
        }

        function end(e) {
            if (!drag) return;
            var dx = point(e, 'clientX') - drag.x;
            var dy = point(e, 'clientY') - drag.y;
            var moved = drag.moved;
            drag = null;
            if (surface.classList) surface.classList.remove('is-dragging');
            if (e.pointerId != null && surface.releasePointerCapture) {
                try { surface.releasePointerCapture(e.pointerId); } catch (err) {}
            }
            var delta = swipeDelta(dx, dy);
            if (!delta) return;
            suppressClick = true;
            go(delta);
            if (moved && e.cancelable) e.preventDefault();
        }

        function cancel() {
            drag = null;
            if (surface.classList) surface.classList.remove('is-dragging');
        }

        surface.addEventListener('click', function (e) {
            if (suppressClick) {
                suppressClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (hasClassWalk(e.target, 'exhibit-beacon', surface)) return;
            if (hasClassWalk(e.target, 'exhibit-loading', surface)) return;
            if (hasClassWalk(e.target, 'exhibit-story', surface)) return;
            if (hasClassWalk(e.target, 'exhibit-hint', surface)) return;
            if (hasClassWalk(e.target, 'theme-audio-toggle', surface)) return;
            var hit = beaconAt(e.clientX, e.clientY);
            if (hit) {
                e.preventDefault();
                e.stopPropagation();
                hit.click();
                return;
            }
            toast('此处尚未开放。向左或向上滑动进入下一页，点白点可走进对应图层。');
        });

        if (window.PointerEvent) {
            surface.addEventListener('pointerdown', start);
            surface.addEventListener('pointermove', move, { passive: false });
            surface.addEventListener('pointerup', end);
            surface.addEventListener('pointercancel', cancel);
            return;
        }
        surface.addEventListener('touchstart', start, { passive: true });
        surface.addEventListener('touchmove', move, { passive: false });
        surface.addEventListener('touchend', end);
        surface.addEventListener('touchcancel', cancel);
        surface.addEventListener('mousedown', start);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
    }

    if (modeBtn) {
        modeBtn.addEventListener('click', function () {
            exhibitMode = exhibitMode === 'dynamic' ? 'static' : 'dynamic';
            try {
                if (window.localStorage) localStorage.setItem(MODE_KEY, exhibitMode);
            } catch (err) {}
            syncModeBtn();
            render();
        });
    }
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            go(-1);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            go(1);
        });
    }

    if (retryBtn) retryBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        render();
    });

    bindSwipe(stageEl || frameEl);
    syncModeBtn();
    window.addEventListener('resize', layoutBeacons);
    render();
    syncUrl();
})();
