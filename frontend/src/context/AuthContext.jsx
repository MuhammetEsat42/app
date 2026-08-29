import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api, TOKENS } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch (err) {
      const status = err?.response?.status;
      // Only treat a real auth failure as logged-out. 429/5xx/network are transient
      // and must NOT boot a user who still holds valid tokens.
      if (status === 401 || status === 403) {
        setUser(null);
        return null;
      }
      console.warn("refreshUser transient error, keeping session:", status || err?.message);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (TOKENS.access) await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    TOKENS.set(data.access_token, data.refresh_token);
    return await refreshUser();
  }, [refreshUser]);

  const setTokens = useCallback(async (data) => {
    TOKENS.set(data.access_token, data.refresh_token);
    return await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout", { refresh_token: TOKENS.refresh }); }
    catch (err) { console.debug("Logout request failed (token likely already invalid):", err); }
    TOKENS.clear();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, setTokens, refreshUser, setUser }),
    [user, loading, login, logout, setTokens, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

