const explorerCharts = [];
const explorerFilterIds = ['directionFilter', 'fastenerFilter', 'setupFilter', 'basisFilter', 'productFilter', 'speciesFilter', 'woodGroupFilter'];
const explorerDefaults = {direction: 'PARALLEL', fastener: 'ALL', setup: 'ALL', basis: 'ALL', product: 'ALL', species: 'ALL', woodGroup: 'SOFTWOOD'};
const explorerPalette = ['#3182f6', '#e58a20', '#16a68a', '#9a67d7', '#e65e83', '#639d26', '#19a5c4', '#b57853'];
// Display names only; filtering uses the original species_scientific CSV value.
const explorerSpeciesNames = new Map([
    ['Betula spp.', '자작나무속·종 미상'],
    ['Chamaecyparis obtusa', '편백'],
    ['Cryptomeria japonica', '삼나무'],
    ['Eucalyptus saligna', '유칼립투스 살리그나'],
    ['Fagus sylvatica', '유럽너도밤나무'],
    ['Larix kaempferi', '낙엽송'],
    ['Picea abies', '독일가문비'],
    ['Picea spp.', '가문비나무속·종 미상'],
    ['Picea spp.; Pinus spp.; Abies spp. (SPF)', 'SPF 혼합 수종군'],
    ['Pinus caribaea x Pinus elliottii', '카리브소나무 × 슬래시소나무 교잡종'],
    ['Pinus elliottii', '슬래시소나무'],
    ['Pinus koraiensis', '잣나무'],
    ['Pinus radiata', '라디아타소나무'],
    ['Pinus sylvestris', '구주소나무'],
    ['Pinus sylvestris var. mongolica', '백두산소나무'],
    ['Pinus taeda', '테다소나무'],
    ['Populus x euroamericana', '이태리포플러'],
    ['Pseudotsuga menziesii', '더글러스퍼'],
    ['Quercus spp.', '참나무속·종 미상']
]);

function woodGroup(point) {
    return point.category.includes('침엽수') ? 'SOFTWOOD' : point.category.includes('활엽수') ? 'HARDWOOD' : 'UNKNOWN';
}
function productForm(point) {
    return /직교|CLT/.test(point.category) ? 'CLT' : /집성재|GLT|Glulam/.test(point.category) ? 'GLT' : 'SOLID';
}
function selectExplorerPoints(points, filters) {
    return points.filter(p =>
        (!filters.woodGroup || woodGroup(p) === filters.woodGroup) &&
        (filters.direction === 'ALL' || (filters.direction === 'PERP_ALL' ? p.direction !== 'PARALLEL' : p.direction === filters.direction)) &&
        (filters.fastener === 'ALL' || p.fastenerType === filters.fastener) &&
        (filters.setup === 'ALL' || p.testSetup === filters.setup) &&
        (filters.basis === 'ALL' || p.strengthBasis === filters.basis) &&
        (filters.product === 'ALL' || productForm(p) === filters.product) &&
        (!filters.species || filters.species === 'ALL' || speciesName(p) === filters.species));
}
function strengthDistribution(points) {
    const count = Math.max(1, Math.floor(Math.max(0, ...points.map(p => p.y)) / 10) + 1);
    const softwood = Array(count).fill(0), hardwood = Array(count).fill(0);
    for (const point of points) {
        const series = woodGroup(point) === 'SOFTWOOD' ? softwood : woodGroup(point) === 'HARDWOOD' ? hardwood : null;
        if (series) series[Math.floor(point.y / 10)]++;
    }
    return {labels: Array.from({length: count}, (_, i) => `${i * 10}–${(i + 1) * 10}`), softwood, hardwood};
}
function explorerStats(points) {
    return {points: points.length, trials: new Set(points.map(p => p.cardId)).size,
        sources: new Set(points.map(p => p.sourceId)).size, missingDensity: points.filter(p => p.density == null).length};
}
function explorerAxisBounds(points) {
    const maxDiameter = Math.max(0, ...points.map(point => point.x));
    const maxStrength = Math.max(0, ...points.map(point => point.y));
    // Keep the largest diameter inside the plot, including when it is exactly 12/16/24 mm.
    const diameterPadding = Math.max(1, maxDiameter * 0.06);
    return {
        xMax: Math.max(8, Math.ceil((maxDiameter + diameterPadding) / 4) * 4),
        yMax: Math.max(10, Math.ceil(maxStrength * 1.12 / 10) * 10)
    };
}
function speciesName(point) { return point.speciesScientific || point.scientificName.replace(/\s*\(.+$/, ''); }
function speciesLabel(name) {
    const scientific = name === 'Picea spp.; Pinus spp.; Abies spp. (SPF)'
        ? 'Picea spp. / Pinus spp. / Abies spp.' : name.replace(/ x /g, ' × ');
    return `${scientific}(${explorerSpeciesNames.get(name) || '한글명 미등록'})`;
}
function explorerSpeciesOptions(points, group) {
    return [...new Set(points.filter(p => woodGroup(p) === group).map(speciesName))]
        .sort((a, b) => a.localeCompare(b, 'en'))
        .map(value => ({value, label: speciesLabel(value)}));
}
function refreshSpeciesFilter(points, group) {
    const select = document.getElementById('speciesFilter'), previous = select.value;
    const options = explorerSpeciesOptions(points, group);
    select.replaceChildren();
    const all = appendText(select, 'option', '전체 수종'); all.value = 'ALL';
    for (const {value, label} of options) {
        const option = appendText(select, 'option', label); option.value = value;
    }
    select.value = options.some(option => option.value === previous) ? previous : 'ALL';
    select.title = select.options[select.selectedIndex].text;
}
function explorerWrap(text, width = 48) { return String(text || '').match(new RegExp(`.{1,${width}}`, 'g')) || []; }
function explorerMaterialLabel(point) {
    const density = point.density == null ? '밀도 미기재' : `밀도 ${point.density} kg/m³`;
    return point.specificGravity == null ? density : `비중 G=${point.specificGravity} · ${density}`;
}
function readExplorerFilters() {
    const names = Object.keys(explorerDefaults);
    return Object.fromEntries(names.map((name, i) => [name, document.getElementById(explorerFilterIds[i]).value]));
}
function appendText(parent, tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
}
function paperLink(parent, point, text) {
    const link = appendText(parent, 'a', text);
    link.href = point.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    return link;
}
function showExplorerDetails(points) {
    const target = document.getElementById('pointDetails');
    target.replaceChildren();
    for (const p of points) {
        const article = document.createElement('article'); target.appendChild(article);
        appendText(article, 'h4', speciesLabel(speciesName(p)));
        appendText(article, 'p', `원문 시험군: ${p.scientificName}`, 'text-muted');
        appendText(article, 'p', `${p.category} · ${p.fastenerType === 'SCREW' ? '스크류' : '다월·볼트 평활부'} · ${p.measurement}`);
        appendText(article, 'p', `직경 ${p.x} mm · 강도 ${p.y} MPa`, 'fw-bold');
        appendText(article, 'p', explorerMaterialLabel(p), 'fw-bold');
        appendText(article, 'p', `${p.testSetupLabel} · ${p.strengthBasisLabel}`);
        appendText(article, 'p', p.standard, 'text-muted');
        appendText(article, 'p', p.testConditions);
        paperLink(article, p, p.sourceTitle + ' ↗');
        appendText(article, 'p', p.sourceLocation, 'text-muted');
    }
}
function renderExplorerTable(points) {
    const body = document.getElementById('pointTableBody'); body.replaceChildren();
    if (!points.length) {
        const row = document.createElement('tr'), cell = appendText(row, 'td', '현재 필터에 맞는 값이 없습니다.');
        cell.colSpan = 8; body.appendChild(row); return;
    }
    for (const p of points) {
        const row = document.createElement('tr'); body.appendChild(row);
        const choose = document.createElement('td'); row.appendChild(choose);
        const button = appendText(choose, 'button', '상세', 'btn btn-outline-primary btn-sm');
        button.type = 'button'; button.setAttribute('aria-label', `${p.scientificName} ${p.measurement} ${p.y} MPa 상세`);
        button.addEventListener('click', () => {
            showExplorerDetails([p]); document.getElementById('pointDetails').scrollIntoView({behavior: 'smooth', block: 'center'});
        });
        const species = appendText(row, 'td', speciesLabel(speciesName(p)));
        appendText(species, 'div', `${p.scientificName} · ${p.category}`, 'small text-muted');
        appendText(row, 'td', p.measurement); appendText(row, 'td', `${p.x} mm`); appendText(row, 'td', `${p.y} MPa`);
        appendText(row, 'td', explorerMaterialLabel(p));
        appendText(row, 'td', `${p.testSetupLabel} · ${p.strengthBasisLabel}`);
        const source = document.createElement('td'); row.appendChild(source); paperLink(source, p, p.sourceTitle);
    }
}
function renderExplorer() {
    const data = window.woodExplorerData;
    if (!data) return;
    refreshSpeciesFilter(data.points, document.getElementById('woodGroupFilter').value);
    const filters = readExplorerFilters();
    const points = selectExplorerPoints(data.points, filters);
    const group = filters.woodGroup;
    const groupLabel = group === 'SOFTWOOD' ? '침엽수' : '활엽수';
    const stats = explorerStats(points);
    for (const [id, value] of Object.entries({visiblePointCount: stats.points, visibleTrialCount: stats.trials,
        visibleSourceCount: stats.sources, missingDensityCount: stats.missingDensity, tablePointCount: `(${stats.points}개)`})) {
        document.getElementById(id).textContent = value;
    }
    const direction = document.getElementById('directionFilter');
    const selectedSpecies = filters.species === 'ALL' ? groupLabel : speciesLabel(filters.species);
    document.getElementById('activeDirection').textContent = `현재: ${selectedSpecies} · ${direction.options[direction.selectedIndex].text} · 직경 mm / 강도 MPa · 시험군 값`;
    document.getElementById('selectedWoodName').textContent = groupLabel;
    document.getElementById('selectedWoodCount').textContent = `· ${points.length}개 값`;
    document.getElementById('woodEmpty').textContent = `현재 필터에 맞는 ${groupLabel} 데이터가 없습니다.`;
    document.getElementById('woodEmpty').hidden = points.length > 0;
    document.getElementById('woodScatter').setAttribute('aria-label', `${groupLabel} 직경별 지압강도 산점도`);
    document.getElementById('woodLegend').setAttribute('aria-label', `${groupLabel} 수종 범례`);
    document.getElementById('strengthHistogram').setAttribute('aria-label', `${groupLabel} 강도값 구간별 개수`);
    renderExplorerTable(points);
    document.getElementById('pointDetails').replaceChildren();
    appendText(document.getElementById('pointDetails'), 'p', points.length ? '점을 누르거나 데이터 표의 ‘상세’를 선택하면 시험 조건과 원문이 표시됩니다.' : '현재 필터에 맞는 데이터가 없습니다.', 'small text-muted mb-0');
    document.getElementById('mixedBasisNotice').hidden = new Set(points.map(p => p.strengthBasis)).size <= 1 && new Set(points.map(p => p.testSetup)).size <= 1;
    for (const chart of explorerCharts) chart.destroy(); explorerCharts.length = 0;
    if (typeof Chart === 'undefined') { document.getElementById('chartLoadError').hidden = false; return; }
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const text = dark ? '#e4e4e7' : '#4b5563', grid = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)';
    Chart.defaults.color = text; Chart.defaults.font.family = "'Pretendard', sans-serif";
    const allSpecies = [...new Set(data.points.map(speciesName))].sort();
    const {xMax, yMax} = explorerAxisBounds(points);
    const sets = new Map();
    for (const p of points) {
        const name = speciesName(p), key = name + '|' + p.testSetup;
        if (!sets.has(key)) {
            const color = explorerPalette[allSpecies.indexOf(name) % explorerPalette.length];
            sets.set(key, {label: `${speciesLabel(name)} · ${p.testSetup === 'FULL_HOLE' ? 'FH' : p.testSetup === 'HALF_HOLE' ? 'HH' : '?'}`,
                data: [], showLine: false, pointRadius: 6, pointHoverRadius: 9, pointHitRadius: 3,
                pointStyle: p.testSetup === 'FULL_HOLE' ? 'circle' : p.testSetup === 'HALF_HOLE' ? 'triangle' : 'rectRot',
                borderColor: color, backgroundColor: color + '88', borderWidth: 1.5, clip: false});
        }
        sets.get(key).data.push(p);
    }
    const legend = document.getElementById('woodLegend'); legend.replaceChildren();
    for (const series of sets.values()) {
        const item = document.createElement('span'); legend.appendChild(item);
        const symbol = appendText(item, 'span', series.pointStyle === 'circle' ? '●' : series.pointStyle === 'triangle' ? '△' : '◆', 'legend-marker');
        symbol.style.color = series.borderColor;
        appendText(item, 'span', series.label);
    }
    explorerCharts.push(new Chart(document.getElementById('woodScatter'), {
        type: 'scatter', data: {datasets: [...sets.values()]}, options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: {mode: 'point', intersect: true}, layout: {padding: {top: 8, right: 10}},
            onClick: (event, hits, chart) => {
                if (hits.length) showExplorerDetails(hits.map(hit => chart.data.datasets[hit.datasetIndex].data[hit.index]));
            },
            plugins: {
                legend: {display: false},
                tooltip: {callbacks: {
                    title: items => speciesLabel(speciesName(items[0].raw)),
                    label: item => `${item.raw.measurement}: ${item.raw.y} MPa · ${item.raw.x} mm`,
                    afterLabel: item => [item.raw.scientificName, item.raw.testSetupLabel, ...explorerWrap(item.raw.strengthBasisLabel),
                        explorerMaterialLabel(item.raw),
                        ...explorerWrap(item.raw.sourceTitle), item.raw.sourceLocation, '클릭하면 아래 상세 정보 표시']
                }}
            },
            scales: {
                x: {type: 'linear', min: 0, max: xMax, title: {display: true, text: '파스너 직경 d (mm)'}, ticks: {stepSize: 4, color: text}, grid: {color: grid}},
                y: {min: 0, max: yMax, title: {display: true, text: '지압강도 (MPa)'}, ticks: {color: text}, grid: {color: grid}}
            }
        }
    }));
    const distribution = strengthDistribution(points);
    explorerCharts.push(new Chart(document.getElementById('strengthHistogram'), {
        type: 'bar', data: {labels: distribution.labels, datasets: [
            {label: groupLabel, data: group === 'SOFTWOOD' ? distribution.softwood : distribution.hardwood,
                backgroundColor: group === 'SOFTWOOD' ? '#3182f6bb' : '#e58a20bb'}
        ]}, options: {responsive: true, maintainAspectRatio: false, animation: false,
            scales: {x: {title: {display: true, text: '강도 구간 (MPa) · 하한 포함 / 상한 미만'}, grid: {color: grid}},
                y: {beginAtZero: true, ticks: {precision: 0}, title: {display: true, text: '보고된 강도값 개수'}, grid: {color: grid}}}}
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    const data = window.woodExplorerData;
    if (!data) return;
    for (const id of explorerFilterIds) document.getElementById(id).addEventListener('change', renderExplorer);
    document.getElementById('resetFilters').addEventListener('click', () => {
        Object.values(explorerDefaults).forEach((value, i) => document.getElementById(explorerFilterIds[i]).value = value);
        renderExplorer();
    });
    window.addEventListener('themechange', renderExplorer);
    renderExplorer();
});
