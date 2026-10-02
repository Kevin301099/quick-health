import { useEffect, useRef } from 'react';

/*
  A quiet route board behind the hero: a graticule, five airports, and brass arcs from Dubai.
  Drawn on a canvas so it stays light. It pauses off screen and draws once when motion is reduced.
*/

const DXB = { code: 'DXB', lon: 55.36, lat: 25.25 };
const DEST = [
  { code: 'LHR', lon: -0.45, lat: 51.47 },
  { code: 'CDG', lon: 2.55, lat: 49.0 },
  { code: 'YYZ', lon: -79.63, lat: 43.68 },
  { code: 'JFK', lon: -73.78, lat: 40.64 },
];

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function RouteCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    let w = 0;
    let h = 0;
    let colors = { line: '', brass: '', hi: '', faint: '' };

    const readColors = () => {
      colors = { line: cssVar('--line'), brass: cssVar('--brass'), hi: cssVar('--brass-hi'), faint: cssVar('--fg-faint') };
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const proj = (lon: number, lat: number) => ({
      x: ((lon + 100) / 172) * w,
      y: h * (0.9 - ((lat - 8) / 52) * 0.7),
    });

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      // graticule
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.line;
      for (let lon = -100; lon <= 75; lon += 10) {
        const a = proj(lon, 8);
        ctx.beginPath();
        ctx.moveTo(a.x, 0);
        ctx.lineTo(a.x, h);
        ctx.stroke();
      }
      for (let lat = 10; lat <= 60; lat += 10) {
        const a = proj(-100, lat);
        ctx.beginPath();
        ctx.moveTo(0, a.y);
        ctx.lineTo(w, a.y);
        ctx.stroke();
      }
      const o = proj(DXB.lon, DXB.lat);
      DEST.forEach((d, i) => {
        const p = proj(d.lon, d.lat);
        const mx = (o.x + p.x) / 2;
        const lift = Math.min(h * 0.3, Math.abs(o.x - p.x) * 0.25);
        const cx = mx;
        const cy = Math.min(o.y, p.y) - lift;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.quadraticCurveTo(cx, cy, p.x, p.y);
        ctx.strokeStyle = colors.brass;
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([2, 5]);
        ctx.lineDashOffset = -(t / 60) % 14;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        // traveller dot
        const u = ((t / 5200 + i * 0.23) % 1) as number;
        const bx = (1 - u) * (1 - u) * o.x + 2 * (1 - u) * u * cx + u * u * p.x;
        const by = (1 - u) * (1 - u) * o.y + 2 * (1 - u) * u * cy + u * u * p.y;
        ctx.fillStyle = colors.hi;
        ctx.beginPath();
        ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
        ctx.fill();
        // destination node
        ctx.strokeStyle = colors.brass;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = colors.faint;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.fillText(d.code, p.x + 9, p.y + 3.5);
      });
      // origin
      ctx.fillStyle = colors.hi;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.faint;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.fillText(DXB.code, o.x + 10, o.y + 3.5);
    };

    const loop = (t: number) => {
      if (visible && !document.hidden) draw(t);
      raf = requestAnimationFrame(loop);
    };

    readColors();
    resize();
    if (reduce) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    const mo = new MutationObserver(() => {
      readColors();
      if (reduce) draw(0);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // Fonts load after first paint; redraw labels once they are ready.
    void document.fonts?.ready.then(() => reduce && draw(0));

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
