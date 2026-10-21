import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 경과 시간을 재는 타이머 훅.
 * start()는 여러 번 불러도 처음 한 번만 시작한다.
 */
export default function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startedAt = useRef(null);
  const intervalId = useRef(null);

  const start = useCallback(() => {
    if (startedAt.current !== null) return;
    startedAt.current = Date.now();
    setIsRunning(true);
    intervalId.current = setInterval(() => {
      setElapsed(Date.now() - startedAt.current);
    }, 100);
  }, []);

  /** 타이머를 멈추고 최종 경과 시간(ms)을 돌려준다. */
  const stop = useCallback(() => {
    clearInterval(intervalId.current);
    setIsRunning(false);
    if (startedAt.current === null) return 0;
    const final = Date.now() - startedAt.current;
    setElapsed(final);
    return final;
  }, []);

  const reset = useCallback(() => {
    clearInterval(intervalId.current);
    startedAt.current = null;
    setIsRunning(false);
    setElapsed(0);
  }, []);

  useEffect(() => () => clearInterval(intervalId.current), []);

  return { elapsed, isRunning, start, stop, reset };
}
