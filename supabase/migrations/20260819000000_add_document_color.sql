-- Lets someone tag a file with one of a small, fixed set of colors, purely
-- for their own visual organization (e.g. marking which ones matter most).
-- No forced meaning is attached to any color, that's left up to whoever's
-- using it.

alter table documents add column if not exists color text;

alter table documents add constraint documents_color_check
  check (color is null or color in ('yellow', 'blue', 'green', 'orange'));
