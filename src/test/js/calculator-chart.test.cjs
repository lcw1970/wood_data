const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function charts(commonDirection, diameter = 12.5, measurements = {}, peak = 31.27, withGap = false) {
    const rendered = [];
    const server = {
        density: 560, diameter, commonDirection, measurements,
        models: Array.from({length: commonDirection ? 1 : 3}, (_, i) => ({
            label: `server model ${i}`, color: '#2563eb',
            parallel: [{x: 6, y: peak}, {x: diameter, y: 23.45 + i}, {x: 24, y: 18.13}],
            perpendicular: [{x: 6, y: 21.11}, {x: diameter, y: 12.34 + i}, {x: 24, y: 8.12}]
        }))
    };
    if (withGap) server.models[1].parallel.splice(1, 0, {x: 6.34995, y: null});
    function Chart(canvas, config) { rendered.push(config); this.destroy = () => {}; }
    Chart.defaults = {font: {}};
    const document = {
        documentElement: {getAttribute: () => 'dark'}, addEventListener: () => {},
        getElementById: id => commonDirection && id === 'chartPerpendicular' ? null : {getContext: () => ({})}
    };
    const context = vm.createContext({document, Chart, window: {woodChartData: server}});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/static/js/calculator.js'), 'utf8'), context);
    vm.runInContext('buildCharts()', context);
    return {rendered, server, fromZero: () => vm.runInContext('chartFromZero = true; buildCharts()', context)};
}

test('three standards render two directional charts for the server comparison payload', () => {
    assert.equal(charts(false).rendered.length, 2);
    assert.equal(charts(false).rendered[0].data.datasets.length, 3);
    assert.equal(charts(false).rendered[1].data.datasets.length, 3);
});

test('equation boundary gaps stay disconnected and are not treated as zero strength', () => {
    const {rendered, server} = charts(false, 12, {}, 31.27, true);
    const nds = rendered[0].data.datasets[1];
    assert.equal(nds.data, server.models[1].parallel);
    assert.equal(nds.data[1].y, null);
    assert.equal(nds.spanGaps, false);
    assert.ok(rendered[0].options.scales.y.min > 0);
    for (const chart of rendered) {
        assert.equal(chart.options.scales.x.min, 6);
        assert.equal(chart.options.scales.x.max, 24);
        assert.equal(chart.options.scales.x.ticks.stepSize, 2);
        assert.ok(chart.data.datasets.every(series => series.clip === false));
    }
});

test('browser uses server predictions verbatim without a second formula', () => {
    for (const common of [true, false]) {
        const {rendered, server} = charts(common);
        rendered.forEach((chart, direction) => {
            assert.equal(chart.data.datasets.length, server.models.length);
            chart.data.datasets.forEach((series, i) => {
                assert.equal(series.data, server.models[i][direction ? 'perpendicular' : 'parallel']);
                assert.equal(series.errorBars, undefined);
                assert.ok(chart.options.scales.y.max > Math.max(...series.data.map(p => p.y)));
            });
        });
    }
});

test('auto scale leaves room above values over 50 MPa and allows a zero baseline', () => {
    const {rendered, fromZero} = charts(false, 12, {}, 53.8);
    assert.ok(rendered[0].options.scales.y.max > 53.8);
    assert.ok(rendered[0].options.scales.y.min > 0);
    fromZero();
    assert.equal(rendered[2].options.scales.y.min, 0);
    assert.ok(rendered[2].options.scales.y.max > 53.8);
});

test('paper values remain separate scatter points with original density, R/T and source', () => {
    const base = {x: 12, scientificName: 'Larix', density: null, close: false,
        conditionLabel: '밀도 미기재', standard: 'KS F 2156', sourceTitle: 'Paper title',
        sourceLocation: 'Table 5', sourceUrl: 'https://doi.org/example', cardId: 'trial'};
    const parallel = [{...base, y: 30.66, measurement: '평행'},
        {...base, x: 25, y: 68.5, close: true, density: 555, cardId: 'near'}];
    const perpendicular = [{...base, y: 12.4, measurement: 'R'}, {...base, y: 13.9, measurement: 'T'}];
    const {rendered} = charts(false, 12, {parallel, perpendicular});
    const paper = rendered[0].data.datasets.filter(s => s.type === 'scatter');
    assert.equal(paper.length, 2);
    assert.equal(paper[0].data[0], parallel[1]);
    assert.equal(paper[1].data[0], parallel[0]);
    assert.equal(paper[0].showLine, false);
    assert.equal(paper[1].pointStyle, 'triangle');
    assert.ok(rendered[0].options.scales.y.max > 68.5);
    assert.ok(rendered[0].options.scales.x.max > 25);
    const perp = rendered[1].data.datasets.find(s => s.type === 'scatter');
    assert.deepEqual(perp.data.map(p => p.y), [12.4, 13.9]);
    const tip = rendered[0].options.plugins.tooltip.callbacks;
    const lines = tip.afterLabel({raw: parallel[0]});
    assert.ok(lines.some(line => line.includes('밀도 미기재')));
    assert.ok(lines.includes('Table 5'));
    assert.ok(lines.includes('https://doi.org/example'));
    assert.ok(!lines.some(line => line.includes('560')));
});

test('selected decimal and boundary diameters remain visible and highlighted', () => {
    for (const diameter of [3.5, 12.5, 30]) {
        for (const chart of charts(false, diameter).rendered) {
            assert.equal(chart.options.scales.x.type, 'linear');
            assert.ok(chart.options.scales.x.min <= diameter && chart.options.scales.x.max >= diameter);
            for (const series of chart.data.datasets) {
                assert.equal(series.pointRadius({raw: {x: diameter}}), 6);
            }
        }
    }
});
