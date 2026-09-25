import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api, setOnUnauthorized } from "../api/client";

const AuthContext = createContext(null);

const STORAGE_KEY = "eds_token";

function decodificarPayload(token) {
  // El JWT tiene 3 partes separadas por "." — la del medio es el payload
  // en base64url (sin padding). Lo decodificamos manualmente aquí (sin
  // librería externa) para saber quién es el usuario sin tener que
  // consultar al backend, y validamos que no esté vencido.
  try {
    let payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return null;
    payloadBase64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const sobrante = payloadBase64.length % 4;
    if (sobrante === 1) return null;
    if (sobrante) payloadBase64 += "=".repeat(4 - sobrante);
    const json = atob(payloadBase64);
    const payload = JSON.parse(json);
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return guardado && decodificarPayload(guardado) ? guardado : null;
  });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const payload = token ? decodificarPayload(token) : null;

  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado && !decodificarPayload(guardado)) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  // Registrar el logout como callback global para errores 401
  useEffect(() => {
    setOnUnauthorized(logout);
    return () => setOnUnauthorized(null);
  }, [logout]);

  const login = useCallback(async (username, password) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.login(username, password);
      localStorage.setItem(STORAGE_KEY, respuesta.access_token);
      setToken(respuesta.access_token);
    } catch (err) {
      setError(err.detail || "No se pudo iniciar sesión.");
      throw err;
    } finally {
      setCargando(false);
    }
  }, []);

  const value = {
    token,
    usuario: payload
      ? {
          id: payload.sub,
          username: payload.username,
          rol: payload.rol,
          operarioId: payload.operario_id,
        }
      : null,
    login,
    logout,
    error,
    cargando,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
