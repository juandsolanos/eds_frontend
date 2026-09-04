import { useRef, useState, useEffect, useCallback } from "react";

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
  if (/https?:/.test(window.location.protocol) === false) {
    return "La cámara solo funciona sobre una conexión segura (HTTPS).";
  }
  return `No se pudo abrir la cámara: ${error?.message || "error desconocido"}`;
}

function escalarYCentrar(imagen, ancho, alto) {
  const aCanvas = document.createElement("canvas");
  aCanvas.width = imagen.width;
  aCanvas.height = imagen.height;
  aCanvas.getContext("2d").drawImage(imagen, 0, 0);
  const ctx = aCanvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, aCanvas.width, aCanvas.height);
  const img = new Image();
  img.width = imageData.width;
}

export default function CamaraCaptura({ abierta, onCapturar, onCerrar }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [estado, setEstado] = useState("idle");
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState(null);
  const [iniciando, setIniciando] = useState(false);
  const canvasRef = useRef(null);

  const detenerStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!abierta) {
      detenerStream();
      setEstado("idle");
      setFoto(null);
      setError(null);
      setIniciando(false);
    }
  }, [abierta, detenerStream]);

  useEffect(() => {
    return () => detenerStream();
  }, [detenerStream]);

  async function abrirCamara() {
    setError(null);
    setIniciando(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setEstado("activa");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError(mensajeError(err));
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
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("No se pudo capturar la foto. Inténtalo de nuevo.");
          return;
        }
        const archivo = new File([blob], "foto-evidencia.jpg", { type: "image/jpeg" });
        setFoto(archivo);
        setEstado("capturada");
        detenerStream();
      },
      "image/jpeg",
      0.92
    );
  }

  function retomar() {
    setFoto(null);
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
            <button type="button" className="btn btn--ghost" onClick={() => { setError(null); abrirCamara(); }}>
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
            <div className="camara-vista" onClick={estado === "activa" ? tomarFoto : undefined}>
              <video
                ref={videoRef}
                className="camara-video"
                autoPlay
                playsInline
                muted
                style={{ display: estado === "activa" ? "block" : "none" }}
              />
              {estado === "capturada" && foto && (
                <img src={URL.createObjectURL(foto)} className="camara-foto" alt="Evidencia capturada" />
              )}
            </div>

            {estado === "activa" && (
              <div className="camara-controles-centro">
                <button type="button" className="camara-disparo" onClick={tomarFoto} aria-label="Tomar foto" />
              </div>
            )}

            {estado === "capturada" ? (
              <div className="camara-controles">
                <button type="button" className="btn btn--ghost" onClick={retomar}>
                  Retomar
                </button>
                <button type="button" className="btn btn--primary" onClick={usarFoto}>
                  Usar esta foto
                </button>
              </div>
            ) : (
              <div className="camara-controles">
                <button type="button" className="btn btn--ghost" onClick={onCerrar}>
                  Cancelar
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