const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({document: {addEventListener: () => {}}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/static/js/explorer.js'), 'utf8'), context);
const base = {scientificName: 'Larix kaempferi (STS 12T)', speciesScientific: 'Larix kaempferi', category: '침엽수', direction: 'PARALLEL', fastenerType: 'SCREW', testSetup: 'HALF_HOLE',
    strengthBasis: 'OFFSET_5_PERCENT', sourceId: 'paper-72', cardId: 'screw', x: 12, y: 30.66, density: null};
const points = [base, {...base, direction: 'R', y: 12.4}, {...base, direction: 'T', y: 13.9},
    {...base, speciesScientific: 'Pseudotsuga menziesii', category: '침엽수 집성재', fastenerType: 'DOWEL', testSetup: 'FULL_HOLE', sourceId: 'paper-30', cardId: 'glt', y: 35.9, density: 466},
    {...base, speciesScientific: 'Fagus sylvatica', category: '활엽수', fastenerType: 'DOWEL', testSetup: 'FULL_HOLE', strengthBasis: 'EN383_MAX_5MM', sourceId: 'paper-9', cardId: 'hardwood', y: 62.9, density: 678}];
const defaults = {direction: 'ALL', fastener: 'ALL', setup: 'ALL', basis: 'ALL', product: 'ALL', species: 'ALL'};
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
    assert.equal(select({species: 'Fagus sylvatica'})[0].y, 62.9);
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

test('checkbox selection combines exactly the selected species without duplicating reported points', () => {
    assert.equal(select({species: []}).length, 0);
    assert.deepEqual(Array.from(select({species: ['Larix kaempferi']}), p => p.direction), ['PARALLEL', 'R', 'T']);
    const selected = select({species: ['Larix kaempferi', 'Fagus sylvatica']});
    assert.equal(selected.length, 4);
    assert.ok(selected.every(p => ['Larix kaempferi', 'Fagus sylvatica'].includes(p.speciesScientific)));
    assert.deepEqual(JSON.parse(JSON.stringify(context.explorerStats(selected))), {points: 4, trials: 2, sources: 2, missingDensity: 3});
    const histogram = context.strengthDistribution(selected);
    assert.equal(histogram.softwood.reduce((a, b) => a + b, 0), 3);
    assert.equal(histogram.hardwood.reduce((a, b) => a + b, 0), 1);
    assert.equal(select({species: ['Larix kaempferi', 'Fagus sylvatica'], direction: 'R'}).length, 1);
    assert.equal(select({species: ['Fagus sylvatica'], setup: 'HALF_HOLE'}).length, 0);
    assert.equal(select({species: ['Larix kaempferi', 'Larix kaempferi']}).length, 3);
    assert.equal(select({species: ['unlisted species']}).length, 0);
    const allSpecies = Array.from(context.explorerSpeciesOptions(points, 'ALL'), option => option.value);
    assert.equal(allSpecies.length, 3);
    assert.equal(select({species: allSpecies}).length, points.length);
});

test('multi-selection joins every paper for a species while keeping variants and mixed taxa separate', () => {
    const related = [base, {...base, sourceId: 'paper-other', cardId: 'other-trial'},
        {...base, speciesScientific: 'Pinus sylvestris'},
        {...base, speciesScientific: 'Pinus sylvestris var. mongolica'},
        {...base, speciesScientific: 'Picea spp.; Pinus spp.; Abies spp. (SPF)'}];
    const selected = context.selectExplorerPoints(related, {...defaults, species: ['Larix kaempferi', 'Pinus sylvestris']});
    assert.equal(selected.length, 3);
    assert.equal(new Set(selected.map(p => p.sourceId)).size, 2);
    assert.ok(!selected.some(p => p.speciesScientific.includes('mongolica') || p.speciesScientific.includes('SPF')));
});

test('wood selection scopes the chart, statistics and histogram while keeping other filters', () => {
    const softwood = select({woodGroup: 'SOFTWOOD'});
    const hardwood = select({woodGroup: 'HARDWOOD'});
    assert.equal(softwood.length, 4);
    assert.equal(hardwood.length, 1);
    assert.equal(context.explorerStats(softwood).trials, 2);
    assert.equal(context.explorerStats(hardwood).trials, 1);
    assert.equal(context.strengthDistribution(softwood).hardwood.reduce((a,b) => a+b, 0), 0);
    assert.equal(context.strengthDistribution(hardwood).softwood.reduce((a,b) => a+b, 0), 0);
    assert.equal(select({woodGroup: 'HARDWOOD', species: 'Larix kaempferi'}).length, 0);
    assert.equal(select({woodGroup: 'SOFTWOOD', direction: 'R'})[0].y, 12.4);
    assert.equal(select({woodGroup: 'SOFTWOOD', product: 'GLT'})[0].cardId, 'glt');
    assert.equal(select({woodGroup: 'HARDWOOD', setup: 'FULL_HOLE', basis: 'EN383_MAX_5MM'})[0].y, 62.9);
});

test('species selection joins papers by CSV species while preserving trial labels and source metadata', () => {
    const related = [base, {...base, sourceId: 'paper-other', scientificName: 'Japanese larch (FH group A)'},
        {...base, speciesScientific: 'Pinus sylvestris'},
        {...base, speciesScientific: 'Pinus sylvestris var. mongolica'},
        {...base, speciesScientific: 'Picea spp.'}];
    const selected = context.selectExplorerPoints(related, {...defaults, species: 'Larix kaempferi'});
    assert.equal(selected.length, 2);
    assert.equal(new Set(selected.map(p => p.sourceId)).size, 2);
    assert.equal(selected[1].scientificName, 'Japanese larch (FH group A)');
    assert.equal(context.selectExplorerPoints(related, {...defaults, species: 'Pinus sylvestris'}).length, 1);
    assert.equal(context.speciesName({scientificName: 'Larix kaempferi (legacy group)'}), 'Larix kaempferi');
});

test('species choices follow wood group and retain mixed or unspecified taxa explicitly', () => {
    const options = context.explorerSpeciesOptions(points, 'SOFTWOOD');
    assert.deepEqual(Array.from(options, o => o.value), ['Larix kaempferi', 'Pseudotsuga menziesii']);
    assert.equal(options[0].label, 'Larix kaempferi(낙엽송)');
    assert.equal(context.explorerSpeciesOptions(points, 'HARDWOOD')[0].label, 'Fagus sylvatica(유럽너도밤나무)');
    assert.equal(context.speciesLabel('Picea spp.'), 'Picea spp.(가문비나무속·종 미상)');
    assert.equal(context.speciesLabel('Picea spp.; Pinus spp.; Abies spp. (SPF)'), 'Picea spp. / Pinus spp. / Abies spp.(SPF 혼합 수종군)');
    assert.equal(context.speciesLabel('New species'), 'New species(한글명 미등록)');
});

test('genus sections isolate wood groups and do not merge SPF, species variants or hybrids', () => {
    const taxa = [base, points[4],
        {...base, speciesScientific: 'Pinus koraiensis'},
        {...base, speciesScientific: 'Pinus radiata'},
        {...base, speciesScientific: 'Pinus sylvestris var. mongolica'},
        {...base, speciesScientific: 'Pinus caribaea x Pinus elliottii'},
        {...base, speciesScientific: 'Picea abies'},
        {...base, speciesScientific: 'Picea spp.'},
        {...base, speciesScientific: 'Picea spp.; Pinus spp.; Abies spp. (SPF)'}];
    const soft = context.explorerGenusGroups(taxa, 'SOFTWOOD');
    assert.deepEqual(Array.from(soft, g => g.genus), ['Larix', 'Picea', 'Pinus', '혼합 수종군']);
    assert.deepEqual(Array.from(soft.find(g => g.genus === 'Picea').species, s => s.value), ['Picea abies', 'Picea spp.']);
    assert.equal(soft.find(g => g.genus === 'Pinus').species.length, 4);
    assert.equal(soft.at(-1).species[0].value, 'Picea spp.; Pinus spp.; Abies spp. (SPF)');
    const hard = context.explorerGenusGroups(taxa, 'HARDWOOD');
    assert.deepEqual(Array.from(hard, g => g.genus), ['Fagus']);
    const allVisible = soft.flatMap(g => Array.from(g.species, s => s.value));
    assert.equal(context.selectExplorerPoints(taxa, {...defaults, species: allVisible, woodGroup: 'SOFTWOOD'}).length, 8);
    assert.equal(context.selectExplorerPoints(taxa, {...defaults, species: allVisible, woodGroup: 'HARDWOOD'}).length, 0);
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

test('reported gravity is visible independently of density and never converted to kg/m³', () => {
    assert.equal(context.explorerMaterialLabel({...base, specificGravity: 0.51}), '비중 G=0.51 · 밀도 미기재');
    assert.equal(context.explorerMaterialLabel({...base, density: 466}), '밀도 466 kg/m³');
    assert.equal(context.explorerMaterialLabel({...base, density: 466, specificGravity: 0.51}), '비중 G=0.51 · 밀도 466 kg/m³');
    assert.equal(context.explorerMaterialLabel(base), '밀도 미기재');
});
