// 차트 인스턴스 전역 보관
let chartParallelInstance = null;
let chartPerpendicularInstance = null;

/* ============================================================
   테마별 차트 색상
   ============================================================ */
function getChartTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        dark,
        text: dark ? '#e4e4e7' : '#333d4b',
        grid: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
    };
}

// Predictions and paper measurements both come from the server; no strength formulas here.
let chartFromZero = false;

function strengthAxisBounds(datasets, fromZero) {
    const values = datasets.flatMap(series => series.data.map(point => point.y)).filter(Number.isFinite);
    if (!values.length) return {min: 0, max: 10};
    const low = Math.min(...values), high = Math.max(...values);
    const padding = Math.max((high - low) * 0.15, Math.abs(high) * 0.08, 2);
    const bottom = fromZero ? 0 : Math.max(0, low - padding);
    const top = high + padding;
    const rough = (top - bottom) / 6;
    const unit = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].find(factor => factor * unit >= rough) * unit;
    return {min: Math.floor(bottom / step) * step, max: Math.ceil(top / step) * step};
}

function tooltipLines(text, width = 55) {
    return (text || '').match(new RegExp(`.{1,${width}}(?:\\s|$)|.{1,${width}}`, 'g')) || [];
}

function paperMaterialLabel(point) {
    const density = point.density == null ? '밀도 미기재' : `밀도 ${point.density} kg/m³`;
    return point.specificGravity == null ? density : `비중 G=${point.specificGravity} · ${density}`;
}

function buildCharts() {
    const parallelCanvas = document.getElementById('chartParallel');
    const perpendicularCanvas = document.getElementById('chartPerpendicular');
    const data = window.woodChartData;
    if (!parallelCanvas || !data || typeof Chart === 'undefined') return;
    if (chartParallelInstance) chartParallelInstance.destroy();
    if (chartPerpendicularInstance) { chartPerpendicularInstance.destroy(); chartPerpendicularInstance = null; }

    const theme = getChartTheme();
    Chart.defaults.color = theme.text;
    Chart.defaults.borderColor = theme.grid;
    Chart.defaults.font.family = "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    const config = (direction, yTitle) => {
        const datasets = data.models.map((model, index) => ({
            label: model.label,
            data: model[direction],
            borderColor: model.color,
            backgroundColor: model.color,
            borderWidth: 2,
            spanGaps: false,
            clip: false,
            borderDash: [[], [5, 5], [8, 3, 2, 3]][index] || [],
            pointRadius: context => context.raw?.x === data.diameter ? 6 : 0,
            pointHoverRadius: 7,
            order: 1
        }));
        const measured = data.measurements?.[direction] || [];
        for (const close of [true, false]) {
            const points = measured.filter(point => point.close === close);
            if (!points.length) continue;
            const color = theme.dark ? '#fbbf24' : '#b45309';
            datasets.push({
                type: 'scatter',
                label: close ? '논문 실측 · 근접 조건' : '논문 실측 · 다른/미상 밀도',
                data: points,
                showLine: false,
                pointStyle: close ? 'rectRot' : 'triangle',
                pointRadius: 7, pointHoverRadius: 10, pointHitRadius: 6,
                borderColor: color, backgroundColor: close ? color : (theme.dark ? '#27272a' : '#ffffff'),
                borderWidth: 2, order: 0, clip: false
            });
        }
        const xValues = datasets.flatMap(series => series.data.map(point => point.x)).filter(Number.isFinite);
        return {
            type: 'line',
            data: {datasets},
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'nearest', intersect: false },
                layout: {padding: {top: 12, right: 14}},
                onClick: (event, elements, chart) => {
                    const point = elements.map(hit => chart.data.datasets[hit.datasetIndex].data[hit.index])
                        .find(value => value.cardId);
                    if (!point) return;
                    const card = document.getElementById(point.cardId);
                    if (card) {
                        card.setAttribute('tabindex', '-1');
                        card.focus({preventScroll: true});
                        card.scrollIntoView({behavior: 'smooth', block: 'center'});
                    }
                },
                onHover: (event, elements, chart) => {
                    const paper = elements.some(hit => chart.data.datasets[hit.datasetIndex].data[hit.index].cardId);
                    if (event.native?.target) event.native.target.style.cursor = paper ? 'pointer' : 'default';
                },
                plugins: {
                    legend: { labels: { color: theme.text, usePointStyle: true, boxWidth: 12, padding: 16, font: { size: 12 } } },
                    tooltip: {callbacks: {
                        title: items => items[0].raw.cardId ? items[0].raw.scientificName
                            : `직경 ${items[0].parsed.x} mm · 입력 밀도 ${data.density} kg/m³`,
                        label: item => item.raw.cardId
                            ? `논문 실측 · ${item.raw.measurement}: ${item.parsed.y.toFixed(2)} MPa`
                            : `${item.dataset.label}: ${item.parsed.y.toFixed(2)} MPa`,
                        afterLabel: item => item.raw.cardId ? [
                            `논문 직경 ${item.raw.x} mm`, paperMaterialLabel(item.raw),
                            item.raw.conditionLabel, ...tooltipLines(item.raw.standard),
                            item.raw.testSetupLabel, ...tooltipLines(item.raw.strengthBasisLabel),
                            ...tooltipLines(item.raw.sourceTitle), item.raw.sourceLocation,
                            ...tooltipLines(item.raw.sourceUrl), '클릭하면 해당 논문 카드로 이동'
                        ].filter(Boolean) : []
                    }}
                },
                scales: {
                    x: {
                        type: 'linear', min: Math.floor(Math.min(6, data.diameter, ...xValues) / 2) * 2,
                        max: Math.ceil(Math.max(24, data.diameter, ...xValues) / 2) * 2,
                        title: { display: true, text: '파스너 직경 d (mm)', color: theme.text },
                        ticks: { color: theme.text, stepSize: 2, maxTicksLimit: 10 }, grid: { color: theme.grid }, border: { color: theme.grid }
                    },
                    y: {
                        ...strengthAxisBounds(datasets, chartFromZero),
                        title: { display: true, text: yTitle, color: theme.text },
                        ticks: { color: theme.text, maxTicksLimit: 8 }, grid: { color: theme.grid }, border: { color: theme.grid }
                    }
                }
            }
        };
    };
    chartParallelInstance = new Chart(parallelCanvas.getContext('2d'), config('parallel', '평행방향 강도 (MPa)'));
    if (!data.commonDirection && perpendicularCanvas) {
        chartPerpendicularInstance = new Chart(perpendicularCanvas.getContext('2d'), config('perpendicular', '직각방향 강도 (MPa)'));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    initEventListeners();
    toggleCalcMode();

    const resultCard = document.getElementById('resultCard');
    if (resultCard) {
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 최초 차트 생성
    buildCharts();

    // data-theme 속성 변화를 직접 감시 → 차트 완전 재생성
    const themeObserver = new MutationObserver(function (mutations) {
        for (const m of mutations) {
            if (m.attributeName === 'data-theme') {
                buildCharts();
                break;
            }
        }
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
});

function initEventListeners() {
    const calcModeRadios = document.querySelectorAll('input[name="calcMode"]');
    calcModeRadios.forEach(radio => radio.addEventListener('change', toggleCalcMode));

    const scaleToggle = document.getElementById('chartScaleToggle');
    if (scaleToggle) scaleToggle.addEventListener('click', () => {
        chartFromZero = !chartFromZero;
        scaleToggle.setAttribute('aria-pressed', String(chartFromZero));
        scaleToggle.textContent = chartFromZero ? '세로축 자동 확대' : '세로축 0부터 보기';
        document.getElementById('chartScaleDescription').textContent = chartFromZero
            ? '세로축 0부터 표시 · 위쪽 여백을 유지합니다.'
            : '세로축 자동 확대 · 표시된 값 위아래에 여백을 둡니다.';
        buildCharts();
    });

}

function toggleCalcMode() {
    const modeCompressive = document.getElementById('modeCompressive');
    const thicknessCol = document.getElementById('thicknessCol');
    const thicknessInput = document.getElementById('thickness');
    const submitBtn = document.getElementById('submitBtn');

    if (!modeCompressive || !thicknessCol || !thicknessInput || !submitBtn) return;

    if (modeCompressive.checked) {
        thicknessCol.style.display = 'block';
        thicknessInput.disabled = false;
        submitBtn.textContent = '계산하기';
    } else {
        thicknessCol.style.display = 'none';
        thicknessInput.disabled = true;
        thicknessInput.value = '';
        submitBtn.textContent = '계산하기';
    }
}
