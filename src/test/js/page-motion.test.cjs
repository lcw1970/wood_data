const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const resources = path.join(__dirname, '../../main/resources');
const source = fs.readFileSync(path.join(resources, 'static/js/page-motion.js'), 'utf8');

function page({reduced = false, supported = true} = {}) {
    const classList = () => {
        const values = new Set();
        return {add: (...names) => names.forEach(n => values.add(n)), remove: (...names) => names.forEach(n => values.delete(n)), contains: name => values.has(name)};
    };
    const events = {}, cardEvents = {}, mediaEvents = {}, timers = new Map(), observations = [];
    const root = {classList: classList()};
    const card = {classList: classList(), style: {setProperty() {}, removeProperty() {}},
        addEventListener: (name, callback) => cardEvents[name] = callback,
        removeEventListener: name => delete cardEvents[name]};
    const media = {matches: reduced, addEventListener: (name, callback) => mediaEvents[name] = callback};
    class Observer {
        constructor(callback) { this.callback = callback; observations.push(this); }
        observe() {} unobserve() {} disconnect() { this.disconnected = true; }
    }
    const window = {matchMedia: () => media, setTimeout: callback => { timers.set(1, callback); return 1; }, clearTimeout: id => timers.delete(id)};
    if (supported) window.IntersectionObserver = Observer;
    vm.runInNewContext(source, {window, IntersectionObserver: Observer, document: {
        documentElement: root, querySelectorAll: () => [card], addEventListener: (name, callback) => events[name] = callback
    }});
    return {root, card, events, cardEvents, media, mediaEvents, timers, observations};
}

test('cards are prepared before DOMContentLoaded and reveal once when entering the viewport', () => {
    const p = page();
    assert.ok(p.root.classList.contains('page-motion-enabled'));
    assert.equal(p.card.classList.contains('page-reveal-ready'), false);
    p.events.DOMContentLoaded();
    assert.equal(p.timers.size, 0);
    const observer = p.observations[0];
    observer.callback([{target: p.card, isIntersecting: false}]);
    assert.equal(p.card.classList.contains('page-reveal-ready'), false);
    observer.callback([{target: p.card, isIntersecting: true}]);
    assert.ok(p.card.classList.contains('page-reveal-enter'));
    p.cardEvents.animationend({target: p.card});
    assert.ok(p.card.classList.contains('page-reveal-ready'));
    assert.equal(p.card.classList.contains('page-reveal-enter'), false);
    observer.callback([{target: p.card, isIntersecting: true}]);
    assert.equal(p.card.classList.contains('page-reveal-enter'), false);
});

test('slow initialization fails open without hiding the cards again later', () => {
    const p = page();
    p.timers.get(1)();
    assert.equal(p.root.classList.contains('page-motion-enabled'), false);
    assert.ok(p.card.classList.contains('page-reveal-ready'));
    p.events.DOMContentLoaded();
    assert.equal(p.observations.length, 0);
});

test('motion preferences and unsupported browsers keep all content visible', () => {
    for (const options of [{reduced: true}, {supported: false}]) {
        const p = page(options);
        assert.equal(p.root.classList.contains('page-motion-enabled'), false);
        assert.equal(p.timers.size, 0);
    }
    const p = page();
    p.events.DOMContentLoaded();
    p.mediaEvents.change({matches: true});
    assert.equal(p.root.classList.contains('page-motion-enabled'), false);
    assert.ok(p.card.classList.contains('page-reveal-ready'));
});

test('every tool page loads the motion initializer synchronously before body content', () => {
    for (const name of ['calculator', 'species', 'explorer']) {
        const html = fs.readFileSync(path.join(resources, `templates/${name}.html`), 'utf8');
        const script = html.match(/<script\s+th:src="[^\"]*\/js\/page-motion\.js[^\"]*"[^>]*><\/script>/g);
        assert.equal(script?.length, 1, name);
        assert.ok(html.indexOf(script[0]) < html.indexOf('<body'), name);
        assert.doesNotMatch(script[0], /\b(async|defer)\b/, name);
    }
});
