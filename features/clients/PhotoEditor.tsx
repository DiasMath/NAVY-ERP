"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  name: string;
  kind: "avatar" | "gallery";
  onSave: (file: File) => Promise<void>;
  onCancel: () => void;
};

function render(canvas: HTMLCanvasElement, image: ImageBitmap, kind: Props["kind"], rotation: number, zoom: number, x: number, y: number, maxSide: number) {
  const turned = rotation % 180 !== 0;
  const rotatedWidth = turned ? image.height : image.width;
  const rotatedHeight = turned ? image.width : image.height;
  const ratio = kind === "avatar" ? 1 : Math.min(1, maxSide / Math.max(rotatedWidth, rotatedHeight));
  const width = kind === "avatar" ? maxSide : Math.max(1, Math.round(rotatedWidth * ratio));
  const height = kind === "avatar" ? maxSide : Math.max(1, Math.round(rotatedHeight * ratio));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não conseguiu editar a imagem.");
  context.fillStyle = "#e3eef5";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  const scale = Math.min(width / rotatedWidth, height / rotatedHeight) * zoom;
  context.translate(width / 2 + x / 100 * width / 2, height / 2 + y / 100 * height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
}

export default function PhotoEditor({ src, name, kind, onSave, onCancel }: Props) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const [ready, setReady] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    fetch(src).then(response => response.blob()).then(createImageBitmap).then(bitmap => {
      if (!active) { bitmap.close(); return; }
      bitmapRef.current = bitmap;
      setReady(true);
    }).catch(() => { if (active) setError("Não foi possível abrir esta imagem para edição."); });
    return () => { active = false; bitmapRef.current?.close(); bitmapRef.current = null; };
  }, [src]);

  useEffect(() => {
    if (!ready || !bitmapRef.current || !previewRef.current) return;
    render(previewRef.current, bitmapRef.current, kind, rotation, zoom, x, y, kind === "avatar" ? 512 : 520);
  }, [ready, kind, rotation, zoom, x, y]);

  const save = async () => {
    if (!bitmapRef.current || saving) return;
    setSaving(true); setError("");
    try {
      const output = document.createElement("canvas");
      render(output, bitmapRef.current, kind, rotation, zoom, x, y, kind === "avatar" ? 512 : Math.min(1800, Math.max(bitmapRef.current.width, bitmapRef.current.height)));
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Não foi possível salvar a imagem editada.");
      await onSave(new File([blob], `${name.replace(/\.[^.]+$/, "")}-editada.jpg`, { type: "image/jpeg" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a imagem."); }
    finally { setSaving(false); }
  };

  return <div className="nc-photo-editor">
    <p>Ajuste a foto antes de salvar. O enquadramento abaixo será o mesmo visto na ficha.</p>
    <div className={`nc-editor-preview ${kind === "avatar" ? "nc-editor-avatar" : ""}`}>{ready ? <canvas ref={previewRef} aria-label="Prévia da foto editada" role="img" /> : <span>Preparando imagem...</span>}</div>
    <div className="nc-editor-controls"><button type="button" className="nc-btn nc-btn-soft" onClick={() => setRotation(value => (value + 90) % 360)} disabled={!ready || saving}>Girar 90°</button><button type="button" className="nc-btn nc-btn-quiet" onClick={() => { setRotation(0); setZoom(1); setX(0); setY(0); }} disabled={!ready || saving}>Restaurar enquadramento</button></div>
    <label>Zoom <output>{Math.round(zoom * 100)}%</output><input type="range" min="0.5" max="2.5" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} disabled={!ready || saving} /></label>
    <label>Posição horizontal<input type="range" min="-100" max="100" value={x} onChange={event => setX(Number(event.target.value))} disabled={!ready || saving} /></label>
    <label>Posição vertical<input type="range" min="-100" max="100" value={y} onChange={event => setY(Number(event.target.value))} disabled={!ready || saving} /></label>
    {error && <p className="nc-photo-error" role="alert">{error}</p>}
    <div className="nc-dialog-actions"><button type="button" className="nc-btn nc-btn-quiet" onClick={onCancel} disabled={saving}>Cancelar</button><button type="button" className="nc-btn nc-btn-primary" onClick={() => void save()} disabled={!ready || saving}>{saving ? "Salvando..." : "Salvar foto"}</button></div>
  </div>;
}
