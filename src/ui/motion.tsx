// 演出用の部品: カードの裏面、めくり、シャッフル、紙吹雪
import { useEffect, useRef } from 'react';
import type { Topic } from '../lib/types';
import { TopicCard } from './common';

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** 端末を軽く震わせる（対応していない端末では何もしない） */
export function buzz(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
}

/** トランプのようなカードの裏面 */
export function CardArt(props: { small?: boolean }) {
  return (
    <div className={`card-art ${props.small ? 'card-art--small' : ''}`} aria-hidden="true">
      <div className="card-art__frame">
        <span className="card-art__corner card-art__corner--tl">FT</span>
        <span className="card-art__logo card-art__logo--en">
          Flip
          <br />
          Two
        </span>
        <span className="card-art__sub">次、なにする？</span>
      </div>
    </div>
  );
}

/** 裏 → 表に3Dでめくれるカード */
export function FlipCard(props: { topic: Topic | null; flipped: boolean; leaving?: boolean; stamped?: boolean }) {
  return (
    <div className={`flip ${props.flipped ? 'is-flipped' : ''} ${props.leaving ? 'is-leaving' : ''}`}>
      <div className="flip__inner">
        <div className="flip__face flip__back">
          <CardArt />
        </div>
        <div className="flip__face flip__front">
          {props.topic && <TopicCard topic={props.topic} big />}
          {props.stamped && (
            <span className="stamp-big" aria-hidden="true">
              決定！
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 3枚のカードを切り混ぜるアニメーション */
export function Shuffle() {
  return (
    <div className="shuffle" aria-label="シャッフル中">
      <div className="shuffle__card shuffle__card--1">
        <CardArt small />
      </div>
      <div className="shuffle__card shuffle__card--2">
        <CardArt small />
      </div>
      <div className="shuffle__card shuffle__card--3">
        <CardArt small />
      </div>
    </div>
  );
}

/** 画面いっぱいの紙吹雪（ふたりの色＋金） */
export function Confetti(props: { burst: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (props.burst === 0 || prefersReducedMotion()) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = ['--a', '--b', '--gold'].map((v) => css.getPropertyValue(v).trim() || '#d94c63');
    const parts = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
      const speed = 9 + Math.random() * 9;
      return {
        x: fromLeft ? -10 : w + 10,
        y: h * 0.72,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        size: 6 + Math.random() * 6,
        color: colors[i % colors.length],
        shape: i % 3,
      };
    });
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / 150);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 小さなハート
          const s = p.size / 10;
          ctx.beginPath();
          ctx.moveTo(0, 3 * s);
          ctx.bezierCurveTo(-5 * s, -1 * s, -2 * s, -5 * s, 0, -2 * s);
          ctx.bezierCurveTo(2 * s, -5 * s, 5 * s, -1 * s, 0, 3 * s);
          ctx.fill();
        }
        ctx.restore();
      }
      if (frame < 150) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.burst]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
