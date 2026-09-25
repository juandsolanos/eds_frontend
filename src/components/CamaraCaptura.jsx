import { useRef, useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

function mensajeError(error) {
  if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
    return "Permiso de cámara denegado. No se puede registrar la evidencia sin autorizar la cámara.";
  }
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "No se encontró una cámara en este dispositivo. No se puede registrar la evidencia.";
  }
  if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
    return "La cámara está en uso por otra aplicación. Ciérrala e inténtalo de nuevo.";
  }
  if (error?.name === "AbortError") {
    return "Se canceló la solicitud de cámara. Inténtalo de nuevo.";
  }
  if (/^https?:/.test(window.location.protocol) === false && !Capacitor.isNativePlatform()) {
    return "La cámara solo funciona sobre una conexión segura (HTTPS).";
  }
  return `No se pudo abrir la cámara: ${error?.message || "error desconocido"}`;
}

// Convierte el base64 que devuelve @capacitor/camera en un File, el mismo
// tipo de archivo que genera el flujo web (getUserMedia + canvas), de modo
// que el resto del formulario (subida a Supabase) no cambia.
function base64AFile(base64, mimeType) {
  const bstr = atob(base64);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], "foto-evidencia.jpg", { type: mimeType || "image/jpeg" });
}

function canvasABlob(canvas, cb) {
  if (canvas.toBlob) {
    canvas.toBlob(cb, "image/jpeg", 0.92);
  } else {
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const bstr = atob(dataUrl.split(",")[1]);
      const mime = dataUrl.substring(5, dataUrl.indexOf(";base64,"));
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
      cb(new Blob([u8arr], { type: mime }));
    } catch {
      cb(null);
    }
  }
}

export default function CamaraCaptura({ abierta, onCapturar, onCerrar }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlRef = useRef(null);
  const [estado, setEstado] = useState("idle");
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState(null);
  const [foto, setFoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  function fijarPreviewUrl(url) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function limpiarPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }

  const detenerStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!abierta) {
      detenerStream();
      setEstado("idle");
      setFoto(null);
      limpiarPreview();
      setError(null);
      setIniciando(false);
    }
  }, [abierta, detenerStream]);

  useEffect(() => () => detenerStream(), [detenerStream]);
  useEffect(() => () => limpiarPreview(), []);

  useEffect(() => {
    if (estado === "activa" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      if (videoRef.current.play) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [estado]);

  async function abrirCamara() {
    setError(null);
    setFoto(null);
    setPreviewUrl(null);
    setIniciando(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // App nativa (Android): cámara nativa vía plugin, más confiable que
        // getUserMedia dentro del WebView.
        const resultado = await Camera.getPhoto({
          quality: 92,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          correctOrientation: true,
        });
        const archivo = base64AFile(resultado.base64String, resultado.mimeType);
        setFoto(archivo);
        fijarPreviewUrl(URL.createObjectURL(archivo));
        setEstado("capturada");
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        setEstado("activa");
      }
    } catch (err) {
      if (Capacitor.isNativePlatform() && /cancel/i.test(err?.message || "")) {
        onCerrar();
      } else {
        setError(Capacitor.isNativePlatform() ? `No se pudo abrir la cámara: ${err?.message || "error desconocido"}` : mensajeError(err));
      }
      setEstado("idle");
    } finally {
      setIniciando(false);
    }
  }

  function tomarFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ancho = video.videoWidth;
    const alto = video.videoHeight;
    if (!ancho || !alto) return;
    canvas.width = ancho;
    canvas.height = alto;
    canvas.getContext("2d").drawImage(video, 0, 0, ancho, alto);
    canvasABlob(canvas, (blob) => {
      if (!blob) {
        setError("No se pudo capturar la foto. Inténtalo de nuevo.");
        return;
      }
      const archivo = new File([blob], "foto-evidencia.jpg", { type: "image/jpeg" });
      setFoto(archivo);
      fijarPreviewUrl(URL.createObjectURL(archivo));
      setEstado("capturada");
      detenerStream();
    });
  }

  function retomar() {
    abrirCamara();
  }

  function usarFoto() {
    if (foto) {
      onCapturar(foto);
      onCerrar();
    }
  }

  if (!abierta) return null;

  return (
    <div className="camara-overlay">
      <div className="camara-modal">
        {error && (
          <div className="camara-error">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setError(null);
                abrirCamara();
              }}
            >
              Reintentar
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        )}

        {!error && estado === "idle" && (
          <div className="camara-inicio">
            <button type="button" className="btn btn--primary" onClick={abrirCamara} disabled={iniciando}>
              {iniciando ? "Abriendo cámara..." : "Abrir cámara"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCerrar}>
              Cancelar
            </button>
          </div>
        )}

        {!error && estado !== "idle" && (
          <>
            <div className="camara-vista">
              <video
                ref={videoRef}
                className="camara-video"
                autoPlay
                playsInline
                muted
                style={{ display: estado === "activa" ? "block" : "none" }}
              />
              {estado === "capturada" && previewUrl && (
                <img src={previewUrl} className="camara-foto" alt="Evidencia capturada" />
              )}
            </div>

            {estado === "activa" ? (
              <div className="camara-activa">
                <div className="camara-controles-centro">
                  <button type="button" className="camara-disparo" onClick={tomarFoto} aria-label="Tomar foto" />
                </div>
                <button type="button" className="btn btn--ghost" onClick={onCerrar}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="camara-controles">
                <button type="button" className="btn btn--ghost" onClick={retomar}>
                  Retomar
                </button>
                <button type="button" className="btn btn--primary" onClick={usarFoto}>
                  Usar esta foto
                </button>
              </div>
            )}
          </>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}