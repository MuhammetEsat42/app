import { createContext, useContext, useEffect, useState, useCallback } from "react";
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
    } catch (e) {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (TOKENS.access) await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    TOKENS.set(data.access_token, data.refresh_token);
    return await refreshUser();
  };

  const setTokens = async (data) => {
    TOKENS.set(data.access_token, data.refresh_token);
    return await refreshUser();
  };

  const logout = async () => {
    try { await api.post("/auth/logout", { refresh_token: TOKENS.refresh }); } catch (_) {}
    TOKENS.clear();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setTokens, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
