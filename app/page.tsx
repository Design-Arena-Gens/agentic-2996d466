'use client';

import { useRef, useState } from 'react';
import { FacadeCanvas, FacadeCanvasHandle } from '../components/FacadeCanvas';
import { ExportButton } from '../components/ExportButton';

export default function Page() {
  const ref = useRef<FacadeCanvasHandle>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");

  const render8k = async () => {
    if (!ref.current) return;
    setBusy(true);
    setMessage("Rendering 8K? this can take a while");
    try {
      const url = await ref.current.renderHighRes({ width: 7680, height: 4320, samples: 1 });
      const link = document.createElement('a');
      link.href = url;
      link.download = `facade-8k-${Date.now()}.png`;
      link.click();
      setMessage("8K render exported");
    } catch (e) {
      console.error(e);
      setMessage("Render failed");
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <>
      <header className="header">
        <div>
          <div className="title">Modern Fa?ade ? Concrete ? Glass ? Wood</div>
          <div className="muted" style={{ fontSize: 12 }}>Clean lines, geometric rhythm, daylight, photo-real mood</div>
        </div>
        <div className="toolbar">
          <ExportButton onClick={render8k} disabled={busy} label={busy ? 'Rendering?' : 'Render 8K'} primary />
        </div>
      </header>

      <main className="main">
        <div className="canvasWrap panel">
          <FacadeCanvas ref={ref} />
        </div>
        <aside className="sidebar">
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Scene Controls</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Drag to orbit. Scroll to zoom. Shift+Drag to pan.
            </div>
            <div style={{ height: 10 }} />
            <ExportButton onClick={() => ref.current?.randomize()} label="Randomize Rhythm" />
            <ExportButton onClick={() => ref.current?.setPreset('daylight')} label="Daylight" />
            <ExportButton onClick={() => ref.current?.setPreset('golden')} label="Golden Hour" />
            <ExportButton onClick={() => ref.current?.setPreset('overcast')} label="Overcast" />
            <div style={{ marginTop: 12 }} className="muted badge">{message || 'Ready'}</div>
          </div>
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>8K Export</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Exports a single high-resolution frame (7680?4320) as PNG.
            </div>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <div className="muted">Physically-based materials, ACES tonemapping, soft shadows</div>
        <div className="badge">8K</div>
      </footer>
    </>
  );
}
