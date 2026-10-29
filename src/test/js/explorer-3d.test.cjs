const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../main/resources/static/js/explorer-3d.js'), 'utf8');
const pure = vm.createContext({});
vm.runInContext(source, pure);
const point = {x: 12, y: 30, direction: 'PARALLEL', testSetup: 'FULL_HOLE', measurement: '섬유 평행', testSetupLabel: 'Full-hole'};

test('four exclusive layers preserve diameter and strength without duplicating R/T in general perpendicular', () => {
    const directions = ['PARALLEL', 'PERPENDICULAR', 'R', 'T'];
    const positions = directions.map(direction => pure.explorer3DCoordinate({...point, direction}, {xMax: 24, yMax: 60}));
    assert.deepEqual(positions.map(p => [p[0], p[1]]), [[0, 0], [0, 0], [0, 0], [0, 0]]);
    assert.equal(new Set(positions.map(p => p[2])).size, 4);
    assert.throws(() => pure.explorer3DCoordinate({...point, direction: 'UNKNOWN'}, {xMax: 24, yMax: 60}), /Unknown load direction/);
    assert.equal(point.x, 12); assert.equal(point.y, 30);
});

test('camera rotation preserves 3D geometry and remains finite within zoom and elevation limits', () => {
    for (const yaw of [-4, 0, 1, 3]) for (const elevation of [-0.8, 0.3, 1.1]) {
        const p = pure.explorer3DProjection([0.5, -0.7, 1.2], {yaw, elevation});
        assert.ok(Math.abs(p.x ** 2 + p.y ** 2 + p.depth ** 2 - (0.5 ** 2 + 0.7 ** 2 + 1.2 ** 2)) < 1e-10);
    }
    const clamped = pure.explorerClamp3DView({yaw: 100, elevation: 4, zoom: 100});
    assert.ok(Math.abs(clamped.yaw) <= Math.PI);
    assert.equal(clamped.elevation, 1.1); assert.equal(clamped.zoom, 2.2);
    assert.equal(pure.explorerClamp3DView({yaw: 0, elevation: -5, zoom: 0}).zoom, 0.65);
});

test('point picking returns every overlapping paper, with the nearest first', () => {
    const a = {...point, sourceId: 'a'}, b = {...point, sourceId: 'b'};
    const hits = pure.explorer3DHits([{x: 50, y: 60, depth: 1, point: a}, {x: 50, y: 60, depth: -1, point: b},
        {x: 100, y: 100, depth: 0, point}], 51, 60);
    assert.deepEqual(Array.from(hits, p => p.sourceId), ['b', 'a']);
    assert.equal(pure.explorer3DHits([], 0, 0).length, 0);
});

test('drag rotates without selecting a point; keyboard, reset, click and renderer cleanup work', () => {
    const listeners = new Map(), captures = new Set();
    const ctx = new Proxy({}, {get: (target, key) => target[key] ?? (() => {})});
    const tooltip = {style: {}, offsetWidth: 160, offsetHeight: 70, remove() { this.removed = true; }};
    const canvas = {width: 0, height: 0, parentElement: {appendChild() {}, getBoundingClientRect: () => ({width: 640, height: 600})},
        classList: {add() {}, remove() {}}, setAttribute() {}, removeAttribute() {}, focus() {},
        getContext: () => ctx, getBoundingClientRect: () => ({left: 0, top: 0}),
        addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type),
        setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id)};
    let observer, selected = [];
    const context = vm.createContext({document: {createElement: () => tooltip}, window: {devicePixelRatio: 2},
        ResizeObserver: class {constructor(cb) { this.callback = cb; observer = this; } observe() {} disconnect() { this.disconnected = true; }}});
    vm.runInContext(source, context);
    const Renderer = vm.runInContext('Explorer3DChart', context);
    const view = {yaw: -0.48, elevation: 0.3, zoom: 1};
    const chart = new Renderer(canvas, {points: [point], bounds: {xMax: 24, yMax: 60}, view, dark: true,
        colorFor: () => '#3182f6', labelFor: () => '수종', onSelect: hits => { selected = hits; }});
    assert.equal(canvas.width, 1280);
    const event = (x, y) => ({clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0});
    listeners.get('pointerdown')(event(50, 50));
    listeners.get('pointermove')(event(90, 70));
    listeners.get('pointerup')(event(90, 70));
    assert.notEqual(view.yaw, -0.48); assert.equal(selected.length, 0); assert.equal(captures.size, 0);
    listeners.get('keydown')({key: '+', preventDefault() {}});
    assert.ok(view.zoom > 1);
    listeners.get('keydown')({key: 'Home', preventDefault() {}});
    assert.equal(view.zoom, 1); assert.equal(view.yaw, -0.48);
    const screen = chart.projected[0];
    listeners.get('pointermove')(event(screen.x, screen.y));
    assert.match(tooltip.textContent, /30 MPa/);
    listeners.get('pointerdown')(event(screen.x, screen.y));
    listeners.get('pointerup')(event(screen.x, screen.y));
    assert.equal(selected[0], point);
    chart.destroy();
    assert.equal(listeners.size, 0); assert.equal(observer.disconnected, true); assert.equal(tooltip.removed, true);
});
