import { useEffect, useRef } from 'react';

/**
 * running이 true인 동안 매 프레임 tick(dt)을 부른다 (dt: 지난 프레임부터 흐른 초).
 * 탭이 숨겨졌다 돌아오면 dt가 크게 튀지 않도록 한 프레임에 최대 0.1초로 자른다.
 */
export default function useGameLoop(tick, running) {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!running) return undefined;
    let frame;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      tickRef.current(dt);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}
