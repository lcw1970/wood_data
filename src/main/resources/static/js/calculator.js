// 차트 인스턴스 전역 보관
let chartParallelInstance = null;
let chartPerpendicularInstance = null;

// 로딩 타이머 관리
const loadingTimers = {};

/* ============================================================
   테마별 차트 색상
   ============================================================ */
function getChartTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        dark: dark,
        text: dark ? '#e4e4e7' : '#333d4b',
        grid: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        expLine: dark ? '#e4e4e7' : '#1e293b',
        expFill: dark ? '#1f1f23' : '#ffffff'
    };
}

/* ============================================================
   차트 생성 (테마 변경 시 재호출하여 완전히 다시 그림)
   ============================================================ */
function buildCharts() {
    const chartParallelEl = document.getElementById('chartParallel');
    const chartPerpendicularEl = document.getElementById('chartPerpendicular');
    if (!chartParallelEl || !chartPerpendicularEl || typeof Chart === 'undefined') return;

    // 기존 차트 제거
    if (chartParallelInstance) { chartParallelInstance.destroy(); chartParallelInstance = null; }
    if (chartPerpendicularInstance) { chartPerpendicularInstance.destroy(); chartPerpendicularInstance = null; }

    const resultCard = document.getElementById('resultCard');
    const density = parseFloat(resultCard?.dataset.density) || 0;
    const userDiameter = parseFloat(resultCard?.dataset.diameter) || 0;
    const userFhAvg_0 = parseFloat(resultCard?.dataset.fhavg0) || 0;
    const userFhAvg_90 = parseFloat(resultCard?.dataset.fhavg90) || 0;
    const specGravity = density / 1000.0;

    const t = getChartTheme();

    // Chart.js 전역 기본값
    Chart.defaults.color = t.text;
    Chart.defaults.borderColor = t.grid;
    Chart.defaults.font.family = "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

    const diameters = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

    const ec5_0 = diameters.map(d => Math.round((0.082 * (1 - 0.01 * d) * density) * 100) / 100);
    const nds_0 = diameters.map(d => Math.round((77.2 * specGravity) * 100) / 100);
    const kds_0 = diameters.map(d => Math.round((68.3 * specGravity) * 100) / 100);

    const ec5_90 = diameters.map(d => Math.round(((0.082 * (1 - 0.01 * d) * density) / (1.35 + 0.015 * d)) * 100) / 100);
    const nds_90 = diameters.map(d => Math.round((212.0 * Math.pow(specGravity, 1.45) * Math.pow(d, -0.5)) * 100) / 100);
    const kds_90 = diameters.map(d => Math.round((180.0 * Math.pow(specGravity, 1.45) * Math.pow(d, -0.5)) * 100) / 100);

    const expMean_0 = [null, 46.8, null, 42.5, null, 40.3, null, 39.7, null, 36.9];
    const expError_0 = [
        null, { min: 41.5, max: 51.8 }, null, { min: 37.8, max: 47.2 },
        null, { min: 35.9, max: 44.8 }, null, { min: 35.3, max: 44.1 },
        null, { min: 32.8, max: 41.0 }
    ];

    const expMean_90 = [null, 32.8, null, 28.8, null, 27.8, null, 23.8, null, 22.7];
    const expError_90 = [
        null, { min: 28.2, max: 37.3 }, null, { min: 24.8, max: 32.9 },
        null, { min: 24.0, max: 31.8 }, null, { min: 19.5, max: 25.8 }
    ];

    const userPoint_0 = diameters.map(d => d === userDiameter ? userFhAvg_0 : null);
    const userPoint_90 = diameters.map(d => d === userDiameter ? userFhAvg_90 : null);

    const errorBarPlugin = {
        id: 'errorBarPlugin',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const color = getChartTheme().expLine;
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                if (dataset.errorBars) {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    meta.data.forEach((element, index) => {
                        const err = dataset.errorBars[index];
                        if (err && element) {
                            const x = element.x;
                            const yMin = chart.scales.y.getPixelForValue(err.min);
                            const yMax = chart.scales.y.getPixelForValue(err.max);

                            ctx.save();
                            ctx.beginPath();
                            ctx.strokeStyle = color;
                            ctx.lineWidth = 1.5;

                            ctx.moveTo(x, yMin); ctx.lineTo(x, yMax);
                            ctx.moveTo(x - 4, yMin); ctx.lineTo(x + 4, yMin);
                            ctx.moveTo(x - 4, yMax); ctx.lineTo(x + 4, yMax);

                            ctx.stroke();
                            ctx.restore();
                        }
                    });
                }
            });
        }
    };

    const makeOptions = function (yTitle, yMax) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: { color: t.text, font: { size: 12 } }
                },
                tooltip: {
                    titleColor: t.dark ? '#f4f4f5' : '#ffffff',
                    bodyColor: t.dark ? '#e4e4e7' : '#ffffff'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: '파스너 직경 d (mm)', color: t.text, font: { weight: 'bold' } },
                    ticks: { color: t.text },
                    grid: { color: t.grid },
                    border: { color: t.grid }
                },
                y: {
                    title: { display: true, text: yTitle, color: t.text, font: { weight: 'bold' } },
                    ticks: { color: t.text },
                    grid: { color: t.grid },
                    border: { color: t.grid },
                    min: 0,
                    max: yMax
                }
            }
        };
    };

    chartParallelInstance = new Chart(chartParallelEl.getContext('2d'), {
        type: 'line',
        data: {
            labels: diameters.map(d => d + 'mm'),
            datasets: [
                { label: 'EC5 (EN 1995-1-1)', data: ec5_0, borderColor: '#1d4ed8', borderWidth: 2, pointRadius: 0 },
                { label: 'NDS 2018', data: nds_0, borderColor: '#b91c1c', borderWidth: 2, borderDash: [5, 5], pointRadius: 0 },
                { label: 'KDS 41 50', data: kds_0, borderColor: '#15803d', borderWidth: 2, borderDash: [8, 3, 2, 3], pointRadius: 0 },
                {
                    label: '실험값 (Mean ± SD)', data: expMean_0, errorBars: expError_0,
                    borderColor: t.expLine, backgroundColor: t.expFill, pointStyle: 'circle',
                    pointRadius: 5, pointBorderWidth: 2, showLine: false
                },
                { label: '현재 입력점', data: userPoint_0, borderColor: '#f97316', backgroundColor: '#f97316', pointRadius: 7, showLine: false }
            ]
        },
        options: makeOptions('지압강도 f_h,0 (MPa)', 55),
        plugins: [errorBarPlugin]
    });

    chartPerpendicularInstance = new Chart(chartPerpendicularEl.getContext('2d'), {
        type: 'line',
        data: {
            labels: diameters.map(d => d + 'mm'),
            datasets: [
                { label: 'EC5 (EN 1995-1-1)', data: ec5_90, borderColor: '#1d4ed8', borderWidth: 2, pointRadius: 0 },
                { label: 'NDS 2018', data: nds_90, borderColor: '#b91c1c', borderWidth: 2, borderDash: [5, 5], pointRadius: 0 },
                { label: 'KDS 41 50', data: kds_90, borderColor: '#15803d', borderWidth: 2, borderDash: [8, 3, 2, 3], pointRadius: 0 },
                {
                    label: '실험값 (Mean ± SD)', data: expMean_90, errorBars: expError_90,
                    borderColor: t.expLine, backgroundColor: t.expFill, pointStyle: 'circle',
                    pointRadius: 5, pointBorderWidth: 2, showLine: false
                },
                { label: '현재 입력점', data: userPoint_90, borderColor: '#f97316', backgroundColor: '#f97316', pointRadius: 7, showLine: false }
            ]
        },
        options: makeOptions('지압강도 f_h,90 (MPa)', 40),
        plugins: [errorBarPlugin]
    });
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

    const recBtns = document.querySelectorAll('.rec-btn');
    recBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const inputEl = document.getElementById('chat-input');
            if (inputEl) {
                inputEl.value = this.innerText;
                sendMessage();
            }
        });
    });

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
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

async function sendMessage() {
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    if (!inputEl) return;

    const question = inputEl.value.trim();
    if (!question) return;

    const density = document.getElementById('density')?.value || '';
    const diameter = document.getElementById('diameter')?.value || '';
    const woodType = document.getElementById('woodType')?.value || '';

    appendMessage('user', question);
    inputEl.value = '';

    inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    const startTime = performance.now();
    const loadingId = appendLoading();

    try {
        const response = await fetch('/api/llm/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                context: `밀도: ${density}, 직경: ${diameter}, 수종: ${woodType}`
            })
        });

        const rawText = await response.text();
        const elapsed = Math.round((performance.now() - startTime) / 1000);
        removeMessage(loadingId);

        let answerText = '';
        let sources = [];

        try {
            const data = JSON.parse(rawText);
            answerText = data.answer || data.result || data.response || data.output || data.content || data.text || data.message || (typeof data === 'string' ? data : null);
            if (data.sources && Array.isArray(data.sources)) {
                sources = data.sources;
            }
        } catch (e) {
            answerText = rawText;
        }

        if (answerText) {
            if (sources.length > 0) {
                answerText += '\n\n📌 출처:\n' + sources.map(s => `- ${s}`).join('\n');
            }
            appendMessage('ai', answerText, elapsed);
        } else {
            appendMessage('ai', '답변 내용을 표시할 수 없습니다.', elapsed);
        }

    } catch (err) {
        const elapsed = Math.round((performance.now() - startTime) / 1000);
        removeMessage(loadingId);
        console.error('Fetch Error:', err);
        appendMessage('ai', '서버 통신 중 에러가 발생했습니다.', elapsed);
    } finally {
        inputEl.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        inputEl.focus();
    }
}

function appendMessage(sender, text, elapsedSec) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    const textSpan = document.createElement('span');
    textSpan.innerText = text;
    msgDiv.appendChild(textSpan);

    if (sender === 'ai' && (elapsedSec || elapsedSec === 0)) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'msg-elapsed';
        timeDiv.innerText = `⏱ ${elapsedSec}초 소요`;
        msgDiv.appendChild(timeDiv);
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function appendLoading() {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const id = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = id;
    loadingDiv.className = 'message ai loading-message';
    loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <span class="loading-text">답변 생성 중...</span>
        <span class="loading-timer" id="${id}-timer">0초</span>
    `;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;

    // 1초 단위(정수)로 경과 시간 갱신
    const started = performance.now();
    loadingTimers[id] = setInterval(function () {
        const timerEl = document.getElementById(id + '-timer');
        if (!timerEl) {
            clearInterval(loadingTimers[id]);
            delete loadingTimers[id];
            return;
        }
        const sec = Math.floor((performance.now() - started) / 1000);
        timerEl.innerText = sec + '초';

        if (sec >= 30) {
            timerEl.classList.add('timer-slow');
            timerEl.classList.remove('timer-warn');
        } else if (sec >= 10) {
            timerEl.classList.add('timer-warn');
        }
    }, 250);

    return id;
}

function removeMessage(id) {
    if (!id) return;
    if (loadingTimers[id]) {
        clearInterval(loadingTimers[id]);
        delete loadingTimers[id];
    }
    const el = document.getElementById(id);
    if (el) el.remove();
}
