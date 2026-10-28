import { forwardRef } from "react";

const StitchViewport = forwardRef<HTMLIFrameElement, { screen: string; section?: string; ready: boolean; onLoad: () => void }>(function StitchViewport({ screen, section, ready, onLoad }, ref) {
  return <main className="stitch-viewport"><iframe ref={ref} className={`stitch-frame ${ready ? "stitch-frame-ready" : ""}`} src={`/stitch/${screen}.html${section ? `?section=${encodeURIComponent(section)}` : ""}`} title={`NAVY — ${screen}`} loading="eager" onLoad={onLoad} /></main>;
});

export default StitchViewport;
