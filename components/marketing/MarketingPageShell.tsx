import type { ReactNode } from "react";
import "./MarketingAtmosphere.css";
import CursorConstellation from "./CursorConstellation";
import MarketingFooter from "./MarketingFooter";
import MarketingNav from "./MarketingNav";

export default function MarketingPageShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="memo-marketing-stage">
      <div className={`memo-marketing-shell mk-dark${["/solutions", "/resources", "/integrations"].includes(active) ? " memo-starlight-shell" : ""}`}>
        <CursorConstellation
          scopeSelector=".memo-marketing-shell"
          className="memo-marketing-constellation"
          parallax={false}
          cursorLight={!["/solutions", "/resources", "/integrations"].includes(active)}
        />
        <MarketingNav active={active} framed />
        <main className="relative z-10">{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}
