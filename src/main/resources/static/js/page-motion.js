(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

    // This file runs in <head>, before any cards can be painted.
    root.classList.add('page-motion-enabled');
    let observer;
    const finish = target => {
        target.classList.add('page-reveal-ready');
        target.classList.remove('page-reveal-enter');
        target.style.removeProperty('--reveal-delay');
    };
    const showEverything = () => {
        root.classList.remove('page-motion-enabled');
        observer?.disconnect();
        document.querySelectorAll('[data-page-reveal]').forEach(finish);
    };
    // A stalled dependency or initialization error must never hide the content indefinitely.
    const fallback = window.setTimeout(showEverything, 2500);

    document.addEventListener('DOMContentLoaded', () => {
        if (!root.classList.contains('page-motion-enabled')) return;
        if (reducedMotion.matches) { window.clearTimeout(fallback); showEverything(); return; }
        try {
            const targets = [...document.querySelectorAll('[data-page-reveal]')];
            const pending = new Set(targets);
            observer = new IntersectionObserver(entries => {
                let order = 0;
                for (const entry of entries) {
                    if (!entry.isIntersecting || !pending.has(entry.target)) continue;
                    const target = entry.target;
                    pending.delete(target);
                    observer.unobserve(target);
                    target.style.setProperty('--reveal-delay', `${Math.min(order++, 2) * 100}ms`);
                    target.classList.add('page-reveal-ready', 'page-reveal-enter');
                    const onEnd = event => {
                        if (event.target !== target) return;
                        finish(target);
                        target.removeEventListener('animationend', onEnd);
                    };
                    target.addEventListener('animationend', onEnd);
                }
                if (!pending.size) observer.disconnect();
            }, {rootMargin:'0px 0px -24px 0px', threshold:0});

            targets.forEach(target => observer.observe(target));
            if (!targets.length) observer.disconnect();
            document.addEventListener('focusin', event => {
                const target = event.target.closest('[data-page-reveal]');
                if (!target) return;
                pending.delete(target); observer.unobserve(target); finish(target);
                if (!pending.size) observer.disconnect();
            });
            reducedMotion.addEventListener('change', event => {
                if (!event.matches) return;
                pending.clear(); showEverything();
            });
            window.clearTimeout(fallback);
        } catch (_) {
            window.clearTimeout(fallback); showEverything();
        }
    });
})();
