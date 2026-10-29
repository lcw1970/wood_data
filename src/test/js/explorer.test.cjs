const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({document: {addEventListener: () => {}}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/static/js/explorer.js'), 'utf8'), context);
const base = {category: '침엽수', direction: 'PARALLEL', fastenerType: 'SCREW', testSetup: 'HALF_HOLE',
    strengthBasis: 'OFFSET_5_PERCENT', sourceId: 'paper-72', cardId: 'screw', x: 12, y: 30.66, density: null};
const points = [base, {...base, direction: 'R', y: 12.4}, {...base, direction: 'T', y: 13.9},
    {...base, category: '침엽수 집성재', fastenerType: 'DOWEL', testSetup: 'FULL_HOLE', sourceId: 'paper-30', cardId: 'glt', y: 35.9, density: 466},
    {...base, category: '활엽수', fastenerType: 'DOWEL', testSetup: 'FULL_HOLE', strengthBasis: 'EN383_MAX_5MM', sourceId: 'paper-9', cardId: 'hardwood', y: 62.9, density: 678}];
const defaults = {direction: 'ALL', fastener: 'ALL', setup: 'ALL', basis: 'ALL', product: 'ALL', source: 'ALL'};
const select = (filters) => context.selectExplorerPoints(points, {...defaults, ...filters});

test('filters keep direction, R/T, setup, definition and product distinctions', () => {
    assert.equal(select({direction: 'PARALLEL'}).length, 3);
    assert.deepEqual(Array.from(select({direction: 'PERP_ALL'}), p => p.direction), ['R', 'T']);
    assert.equal(select({direction: 'R'})[0].y, 12.4);
    assert.equal(select({direction: 'T'})[0].y, 13.9);
    assert.equal(select({setup: 'HALF_HOLE'}).length, 3);
    assert.equal(select({setup: 'FULL_HOLE', basis: 'OFFSET_5_PERCENT'})[0].cardId, 'glt');
    assert.equal(select({basis: 'EN383_MAX_5MM'}).length, 1);
    assert.equal(select({product: 'SOLID'}).length, 4);
    assert.equal(select({product: 'GLT'}).length, 1);
    assert.equal(select({source: 'paper-9'})[0].y, 62.9);
    assert.equal(select({product: 'CLT'}).length, 0);
    assert.equal(base.density, null);
});

test('point count differs from trial count and histogram totals preserve every reported value', () => {
    const stats = context.explorerStats(points);
    assert.deepEqual(JSON.parse(JSON.stringify(stats)), {points: 5, trials: 3, sources: 3, missingDensity: 3});
    const distribution = context.strengthDistribution(points);
    assert.equal(distribution.softwood.reduce((a,b) => a+b, 0), 4);
    assert.equal(distribution.hardwood.reduce((a,b) => a+b, 0), 1);
    assert.equal(distribution.softwood[1], 2);
    assert.equal(distribution.hardwood[6], 1);
    assert.equal(context.strengthDistribution([{...base, y: 30}]).softwood[3], 1);
    assert.equal(context.strengthDistribution([]).softwood.reduce((a,b) => a+b, 0), 0);
});

test('largest diameters stay inside the plot with marker and hover room', () => {
    for (const diameter of [3.5, 8, 12, 16, 24, 25.3, 30]) {
        const bounds = context.explorerAxisBounds([{...base, x: diameter, y: 53.8}]);
        assert.ok(bounds.xMax - diameter >= 1, `no right margin at ${diameter} mm`);
        assert.ok(bounds.yMax > 53.8);
        assert.equal(bounds.xMax % 4, 0);
    }
    assert.equal(context.explorerAxisBounds([{...base, x: 12}]).xMax, 16);
    assert.ok(context.explorerAxisBounds([]).xMax > 0);
    assert.ok(context.explorerAxisBounds([]).yMax > 0);
});
