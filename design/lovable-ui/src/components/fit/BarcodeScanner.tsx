import { useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight } from "lucide-react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** Live camera barcode reader (EAN/UPC). Uses the browser's detector, or a bundled one on iPhone. */
export function BarcodeScanner({ onCode, active }: { onCode: (code: string) => void; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const [torch, setTorch] = useState<null | boolean>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    if (!active) return;
    let stop = false, raf = 0, stream: MediaStream | null = null;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const track = stream.getVideoTracks()[0] || null;
        trackRef.current = track;
        const caps = (track?.getCapabilities?.() || {}) as { torch?: boolean };
        if (caps.torch) setTorch(false);
        const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
        let det: Detector;
        const Native = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (Native) det = new Native({ formats });
        else { const m = await import("barcode-detector/ponyfill"); det = new m.BarcodeDetector({ formats: formats as never }) as unknown as Detector; }
        let last = 0;
        const tick = async (t: number) => {
          if (stop) return;
          if (t - last > 180 && v.readyState >= 2) {
            last = t;
            try {
              const r = await det.detect(v);
              const code = r.find((x) => /^\d{6,14}$/.test(x.rawValue))?.rawValue;
              if (code && !stop) { navigator.vibrate?.(30); cb.current(code); return; }
            } catch { /* keep scanning */ }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setErr(e instanceof Error && e.name === "NotAllowedError" ? "دسترسی به دوربین داده نشد. از تنظیمات مرورگر اجازه بده یا بارکد را دستی وارد کن." : "دوربین در دسترس نیست. بارکد را دستی وارد کن.");
      }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); trackRef.current = null; };
  }, [active]);

  const toggleTorch = async () => {
    const t = trackRef.current; if (!t) return;
    try { await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { /* unsupported */ }
  };

  if (err) return (
    <div className="grid aspect-[4/3] place-items-center rounded-[22px] border border-line bg-ink/60 p-6 text-center text-sm text-muted-foreground">
      <div><CameraOff className="mx-auto mb-2 size-8 text-faint" />{err}</div>
    </div>
  );
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-volt/30 bg-ink">
      <video ref={video} playsInline muted className="size-full object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-[14%_10%] rounded-2xl border-2 border-volt/80 shadow-[0_0_0_999px_oklch(0_0_0/45%)]">
        <span className="animate-scan absolute inset-x-3 h-0.5 bg-volt shadow-[var(--glow-volt)]" />
      </div>
      <span className="kicker absolute bottom-3 start-0 end-0 text-center text-volt">ALIGN BARCODE</span>
      {torch !== null ? (
        <button type="button" onClick={toggleTorch} aria-label="چراغ قوه" className="glass absolute top-3 end-3 grid size-10 place-items-center rounded-full">
          <Flashlight className={torch ? "size-5 text-volt" : "size-5"} />
        </button>
      ) : null}
    </div>
  );
}

