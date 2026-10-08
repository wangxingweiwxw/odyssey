/**
 * Render a wellplay-style layer tree from window.MUSEUM_PACK.
 */
'use strict';

(function (global) {
    function childrenOf(nodes, parentId) {
        var kids = [];
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].parentId === parentId) kids.push(nodes[i]);
        }
        return kids;
    }

    function walk(nodes, parentId, prefix, lines, hrefFor, story) {
        var kids = childrenOf(nodes, parentId);
        for (var i = 0; i < kids.length; i++) {
            var last = i === kids.length - 1;
            var branch = last ? '└─ ' : '├─ ';
            var nextPrefix = prefix + (last ? '   ' : '│  ');
            lines.push({
                prefix: prefix + branch,
                node: kids[i],
                story: story,
                href: hrefFor ? hrefFor(story, kids[i]) : ''
            });
            walk(nodes, kids[i].id, nextPrefix, lines, hrefFor, story);
        }
    }

    function renderStoryTree(mount, options) {
        if (!mount) return;
        options = options || {};
        var pack = global.MUSEUM_PACK;
        mount.textContent = '';
        if (!pack || !pack.museums || !pack.museums.length) return;

        if (options.cards) {
            mount.className = 'museum-grid museum-case-grid';
            pack.museums.forEach(function (story) {
                var card = document.createElement('a');
                card.className = 'museum-card';
                card.href = './pages/exhibit.html?id=' + encodeURIComponent(story.id);
                var cover = document.createElement('img');
                cover.src = story.cover;
                cover.alt = story.name;
                var body = document.createElement('div');
                body.className = 'museum-card-body';
                var year = document.createElement('p');
                year.className = 'museum-card-year';
                year.textContent = story.city || '';
                var title = document.createElement('h3');
                title.textContent = story.name;
                var blurb = document.createElement('p');
                blurb.textContent = story.blurb || '';
                body.appendChild(year);
                body.appendChild(title);
                body.appendChild(blurb);
                card.appendChild(cover);
                card.appendChild(body);
                mount.appendChild(card);
            });
            return;
        }

        var story = pack.museums[0];
        var root = null;
        for (var i = 0; i < story.nodes.length; i++) {
            if (story.nodes[i].id === story.rootId) {
                root = story.nodes[i];
                break;
            }
        }
        if (!root) return;

        var hrefFor = options.hrefFor;
        var onSelect = options.onSelect;

        var count = document.createElement('p');
        count.className = 'story-tree-count';
        count.textContent = '(' + story.nodes.length + ')';
        mount.appendChild(count);

        var rootLine = document.createElement('p');
        rootLine.className = 'story-tree-root';
        var rootLink = document.createElement(hrefFor || onSelect ? 'a' : 'span');
        if (hrefFor) {
            rootLink.href = hrefFor(story, root);
        } else {
            rootLink.href = '#';
        }
        rootLink.textContent = root.title;
        if (onSelect) {
            rootLink.addEventListener('click', function (e) {
                e.preventDefault();
                onSelect(story, root);
            });
        }
        rootLine.appendChild(rootLink);
        mount.appendChild(rootLine);

        var lines = [];
        walk(story.nodes, root.id, '', lines, hrefFor, story);

        var pre = document.createElement('div');
        pre.className = 'story-tree-body';
        lines.forEach(function (line) {
            var row = document.createElement('div');
            row.className = 'story-tree-row';
            var gutter = document.createElement('span');
            gutter.className = 'story-tree-branch';
            gutter.textContent = line.prefix;
            row.appendChild(gutter);
            var link = document.createElement('a');
            if (line.href) link.href = line.href;
            else link.href = '#';
            link.textContent = line.node.title;
            if (onSelect) {
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    onSelect(line.story, line.node);
                });
            }
            row.appendChild(link);
            pre.appendChild(row);
        });
        mount.appendChild(pre);
    }

    global.renderStoryTree = renderStoryTree;

    document.addEventListener('DOMContentLoaded', function () {
        var mount = document.getElementById('story-tree');
        if (!mount || mount.getAttribute('data-manual') === 'true') return;
        renderStoryTree(mount, {
            hrefFor: function (story, node) {
                var url = './pages/exhibit.html?id=' + encodeURIComponent(story.id);
                if (node && node.id !== story.rootId) {
                    url += '&node=' + encodeURIComponent(node.id);
                }
                return url;
            }
        });
    });
})(window);
