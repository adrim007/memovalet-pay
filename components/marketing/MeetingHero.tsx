import OverviewScene from "./OverviewScene";
import CursorConstellation from "./CursorConstellation";

export default function MeetingHero() {
  return (
    <div className="memo-overview-starlight">
      <CursorConstellation scopeSelector=".memo-overview-starlight" parallax={false} cursorLight={false} />
      <OverviewScene />

    </div>
  );
}
