-- Widen what the recordings bucket will accept.
--
-- It allowed only video/webm and video/mp4, which is exactly what a browser
-- records — and nothing else. Two things now need to get in:
--
--   * video/quicktime — what an iPhone's own camera app produces. People record
--     there precisely because Apple lets that keep running with the screen off,
--     which Safari does not, so the phone's own file is the reliable path.
--   * the audio types — sound-only recordings are far smaller and much less
--     likely to be cut short on a phone.
--
-- The 500MB per-file limit is unchanged, and the bucket stays private.

update storage.buckets
set allowed_mime_types = array[
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg'
]
where id = 'meeting-recordings';
