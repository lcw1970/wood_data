document.addEventListener('DOMContentLoaded', function () {
    const checkbox = document.getElementById('theme-toggle-checkbox');
    if (!checkbox) return;

    // 현재 적용된 테마에 맞춰 스위치 초기 상태 동기화
    const currentTheme = document.documentElement.getAttribute('data-theme');
    checkbox.checked = currentTheme === 'dark';

    checkbox.addEventListener('change', function () {
        const next = checkbox.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);

        // 캔버스(Chart.js)처럼 CSS로 제어 안 되는 요소에 알림
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    });
});
