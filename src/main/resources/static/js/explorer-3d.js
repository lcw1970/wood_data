const explorerDirectionLayers = [
    {direction: 'PARALLEL', label: '섬유 평행', short: '평행'},
    {direction: 'PERPENDICULAR', label: '직각(R·T 미구분)', short: '직각 미구분'},
    {direction: 'R', label: '직각 R(방사)', short: 'R(방사)'},
    {direction: 'T', label: '직각 T(접선)', short: 'T(접선)'}
];
const explorerInitial3DView = {yaw: -0.48, elevation: 0.3, zoom: 1};

function explorerDirectionIndex(point) {
    return explorerDirectionLayers.findIndex(layer => layer.direction === point.direction);
}
function explorer3DCoordinate(point, bounds) {
    const layer = explorerDirectionIndex(point);
    if (layer < 0) throw new Error(`Unknown load direction: ${point.direction}`);
    return [point.x / bounds.xMax * 2 - 1, point.y / bounds.yMax * 1.6 - 0.8, layer / 3 * 2.4 - 1.2];
}
function explorer3DProjection([x, y, z], view) {
    const side = x * Math.cos(view.yaw) - y * Math.sin(view.yaw);
    const back = x * Math.sin(view.yaw) + y * Math.cos(view.yaw);
    return {x: side, y: -back * Math.sin(view.elevation) - z * Math.cos(view.elevation),
        depth: back * Math.cos(view.elevation) - z * Math.sin(view.elevation)};
}
function explorerClamp3DView(view) {
    view.yaw = Math.atan2(Math.sin(view.yaw), Math.cos(view.yaw));
    view.elevation = Math.max(-0.8, Math.min(1.1, view.elevation));
    view.zoom = Math.max(0.65, Math.min(2.2, view.zoom));
    return view;
}
function explorer3DHits(projected, x, y, radius = 11) {
    // Keep coincident observations instead of choosing a single paper at that coordinate.
    return projected.filter(p => Math.hypot(p.x - x, p.y - y) <= radius)
        .sort((a, b) => a.depth - b.depth).map(p => p.point);
}

/** Orthographic 3D scatter renderer. Rotation changes projection only, never measured coordinates. */
class Explorer3DChart {
    constructor(canvas, {points, bounds, view, dark, colorFor, labelFor, onSelect}) {
        Object.assign(this, {canvas, points, bounds, view, dark, colorFor, labelFor, onSelect});
        this.context = canvas.getContext('2d');
        this.listeners = [];
        this.projected = [];
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'explorer-3d-tooltip';
        this.tooltip.hidden = true;
        canvas.parentElement.appendChild(this.tooltip);
        canvas.tabIndex = 0;
        canvas.setAttribute('aria-describedby', 'threeDHelp');
        this.bind('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0) return;
            canvas.focus({preventScroll: true});
            this.drag = {id: event.pointerId, x: event.clientX, y: event.clientY,
                yaw: view.yaw, elevation: view.elevation};
            canvas.setPointerCapture(event.pointerId);
        });
        this.bind('pointermove', event => {
            if (this.drag && event.pointerId === this.drag.id) {
                const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
                if (Math.hypot(dx, dy) > 4) this.drag.moved = true;
                if (this.drag.moved) {
                    canvas.classList.add('is-dragging');
                    view.yaw = this.drag.yaw + dx * 0.008;
                    view.elevation = this.drag.elevation + dy * 0.006;
                    explorerClamp3DView(view); this.tooltip.hidden = true; this.draw();
                }
            } else this.hover(event);
        });
        this.bind('pointerup', event => {
            if (!this.drag || event.pointerId !== this.drag.id) return;
            const clicked = !this.drag.moved;
            this.endDrag();
            if (clicked) {
                const position = this.pointerPosition(event);
                const hits = explorer3DHits(this.projected, position.x, position.y);
                if (hits.length) onSelect(hits);
            }
        });
        this.bind('pointercancel', () => this.endDrag());
        this.bind('lostpointercapture', () => this.endDrag());
        this.bind('pointerleave', () => { this.tooltip.hidden = true; });
        this.bind('keydown', event => {
            const turns = {ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1]};
            if (turns[event.key]) this.rotate(...turns[event.key]);
            else if (event.key === '+' || event.key === '=') this.zoomBy(1.15);
            else if (event.key === '-') this.zoomBy(1 / 1.15);
            else if (event.key === 'Home') this.reset();
            else return;
            event.preventDefault();
        });
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
        this.resize();
    }
    bind(type, listener) {
        this.canvas.addEventListener(type, listener);
        this.listeners.push([type, listener]);
    }
    endDrag() {
        const id = this.drag?.id;
        this.drag = null;
        if (id != null && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
        this.canvas.classList.remove('is-dragging');
    }
    pointerPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {x: event.clientX - rect.left, y: event.clientY - rect.top};
    }
    hover(event) {
        const {x, y} = this.pointerPosition(event), hits = explorer3DHits(this.projected, x, y);
        if (!hits.length) { this.tooltip.hidden = true; return; }
        const p = hits[0];
        this.tooltip.textContent = `${this.labelFor(p)}\n${p.measurement} · ${p.x} mm · ${p.y} MPa\n${p.testSetupLabel}\n${hits.length > 1 ? `${hits.length}개 값이 겹침 · ` : ''}클릭하면 원문 상세 표시`;
        this.tooltip.hidden = false;
        this.tooltip.style.left = `${Math.max(4, Math.min(x + 14, this.width - this.tooltip.offsetWidth - 4))}px`;
        this.tooltip.style.top = `${Math.max(4, Math.min(y + 14, this.height - this.tooltip.offsetHeight - 4))}px`;
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width; this.height = rect.height;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * ratio);
        this.canvas.height = Math.round(this.height * ratio);
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.draw();
    }
    rotate(yaw, elevation = 0) {
        this.view.yaw += yaw; this.view.elevation += elevation;
        explorerClamp3DView(this.view); this.tooltip.hidden = true; this.draw();
    }
    zoomBy(factor) {
        this.view.zoom *= factor; explorerClamp3DView(this.view);
        this.tooltip.hidden = true; this.draw();
    }
    reset() { Object.assign(this.view, explorerInitial3DView); this.tooltip.hidden = true; this.draw(); }
    draw() {
        if (!this.width || !this.height) return;
        const ctx = this.context, {xMax, yMax} = this.bounds;
        const text = this.dark ? '#e4e4e7' : '#374151', muted = this.dark ? '#b4bdcc' : '#59677b';
        const grid = this.dark ? '#ffffff18' : '#14243e18', edge = this.dark ? '#8fa2c366' : '#50648566';
        ctx.clearRect(0, 0, this.width, this.height);
        const corners = [];
        for (const x of [-1, 1]) for (const y of [-0.8, 0.8]) for (const z of [-1.2, 1.2]) corners.push(explorer3DProjection([x, y, z], this.view));
        const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
        const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
        const compact = this.width < 500, left = compact ? 32 : 46, right = compact ? 82 : 112;
        const scale = Math.min((this.width - left - right) / (maxX - minX), (this.height - 105) / (maxY - minY)) * this.view.zoom;
        const centerX = (this.width + left - right) / 2, centerY = (this.height - 30) / 2;
        const project = coordinate => {
            const p = explorer3DProjection(coordinate, this.view);
            return {...p, x: centerX + p.x * scale, y: centerY + p.y * scale};
        };
        const xyz = (x, y, layer) => [x / xMax * 2 - 1, y / yMax * 1.6 - 0.8, layer / 3 * 2.4 - 1.2];
        const line = (a, b, color, width = 1) => {
            const p = project(a), q = project(b);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
        };
        const label = (coordinate, value, dx = 0, dy = 0, align = 'center', color = muted) => {
            const p = project(coordinate); ctx.fillStyle = color; ctx.textAlign = align;
            ctx.fillText(value, p.x + dx, p.y + dy);
        };
        ctx.font = `${compact ? 10 : 12}px Pretendard, sans-serif`;
        const layers = [0, 1, 2, 3].sort((a, b) => project(xyz(0, 0, b)).depth - project(xyz(0, 0, a)).depth);
        for (const layer of layers) {
            for (let x = 0; x <= xMax; x += 4) line(xyz(x, 0, layer), xyz(x, yMax, layer), grid);
            const stepY = Math.max(10, Math.ceil(yMax / 6 / 10) * 10);
            for (let y = 0; y <= yMax; y += stepY) line(xyz(0, y, layer), xyz(xMax, y, layer), grid);
            for (const [a, b] of [[[0, 0], [xMax, 0]], [[xMax, 0], [xMax, yMax]], [[xMax, yMax], [0, yMax]], [[0, yMax], [0, 0]]]) {
                line(xyz(...a, layer), xyz(...b, layer), edge);
            }
        }
        line(xyz(xMax, 0, 0), xyz(xMax, 0, 3), edge, 1.3);
        for (let layer = 0; layer < 4; layer++) label(xyz(xMax, 0, layer), explorerDirectionLayers[layer].short, 9, 4, 'left', text);
        label(xyz(xMax, 0, 3), '하중 방향 Z', 9, -19, 'left', text);
        for (let x = 0; x <= xMax; x += 4) label(xyz(x, 0, 0), String(x), 0, 18);
        const stepY = Math.max(10, Math.ceil(yMax / 6 / 10) * 10);
        for (let y = stepY; y <= yMax; y += stepY) label(xyz(0, y, 0), String(y), -9, 4, 'right');
        label(xyz(xMax / 2, 0, 0), '직경 d (mm) · X', 0, 43, 'center', text);
        label(xyz(0, yMax, 0), '강도 (MPa) · Y', -8, -12, 'left', text);
        this.projected = this.points.map(point => ({...project(explorer3DCoordinate(point, this.bounds)), point}));
        for (const p of [...this.projected].sort((a, b) => b.depth - a.depth)) {
            const radius = compact ? 4.5 : 5.5;
            ctx.beginPath();
            if (p.point.testSetup === 'FULL_HOLE') ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            else if (p.point.testSetup === 'HALF_HOLE') {
                ctx.moveTo(p.x, p.y - radius - 1); ctx.lineTo(p.x + radius, p.y + radius); ctx.lineTo(p.x - radius, p.y + radius); ctx.closePath();
            } else {
                ctx.moveTo(p.x, p.y - radius); ctx.lineTo(p.x + radius, p.y); ctx.lineTo(p.x, p.y + radius); ctx.lineTo(p.x - radius, p.y); ctx.closePath();
            }
            const color = this.colorFor(p.point);
            ctx.fillStyle = color + 'aa'; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
        }
    }
    destroy() {
        this.endDrag();
        for (const [type, listener] of this.listeners) this.canvas.removeEventListener(type, listener);
        this.resizeObserver.disconnect(); this.tooltip.remove();
        this.canvas.removeAttribute('tabindex'); this.canvas.removeAttribute('aria-describedby');
        this.context.clearRect(0, 0, this.width, this.height);
    }
}
