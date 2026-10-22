import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 경과 시간을 재는 타이머 훅.
 * start()는 여러 번 불러도 처음 한 번만 시작한다.
 * pause()/resume()으로 잠시 멈출 수 있다 (입력창에서 벗어나 있는 동안 등).
 */
export default function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false); // 시작했고 아직 끝나지 않음 (일시정지 중에도 true)
  const status = useRef('idle'); // idle | running | paused | stopped
  const startedAt = useRef(null); // 지금 흐르고 있는 구간의 시작 시각
  const accumulated = useRef(0); // 이전 구간들에서 흐른 시간
  const intervalId = useRef(null);

  const now = () => accumulated.current + (startedAt.current === null ? 0 : Date.now() - startedAt.current);

  const run = useCallback(() => {
    status.current = 'running';
    startedAt.current = Date.now();
    intervalId.current = setInterval(() => setElapsed(now()), 100);
  }, []);

  /** 흐르던 구간을 누적 시간에 더하고 멈춘다 */
  const halt = useCallback(() => {
    clearInterval(intervalId.current);
    accumulated.current = now();
    startedAt.current = null;
    setElapsed(accumulated.current);
  }, []);

  const start = useCallback(() => {
    if (status.current !== 'idle') return;
    setIsRunning(true);
    run();
  }, [run]);

  const pause = useCallback(() => {
    if (status.current !== 'running') return;
    halt();
    status.current = 'paused';
  }, [halt]);

  const resume = useCallback(() => {
    if (status.current === 'paused') run();
  }, [run]);

  /** 타이머를 멈추고 최종 경과 시간(ms)을 돌려준다. */
  const stop = useCallback(() => {
    if (status.current === 'idle') return 0;
    halt();
    status.current = 'stopped';
    setIsRunning(false);
    return accumulated.current;
  }, [halt]);

  const reset = useCallback(() => {
    clearInterval(intervalId.current);
    status.current = 'idle';
    startedAt.current = null;
    accumulated.current = 0;
    setIsRunning(false);
    setElapsed(0);
  }, []);

  useEffect(() => () => clearInterval(intervalId.current), []);

  return { elapsed, isRunning, start, stop, pause, resume, reset };
}
