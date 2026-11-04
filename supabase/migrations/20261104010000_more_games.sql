-- 게임 3종 추가 — 초성 퀴즈(chosung) · 고스트 레이스(ghost, 점수 = 타수) · 타닥이 달리기(runner)
-- 초성 퀴즈는 한글 전용이라 mode가 늘 'ko'로 들어온다.
alter table public.game_scores drop constraint game_scores_game_check;
alter table public.game_scores
  add constraint game_scores_game_check check (game in ('speed', 'rain', 'tug', 'chosung', 'ghost', 'runner'));
