import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken, getToken, clearToken } from "./api.js";

const AuthContext = createContext(null);
const USER_STORAGE_KEY = "auth_user";

function getStorage() {
  return window.sessionStorage;
}

function readStoredUser() {
  try {
    const storage = getStorage();
    const raw = storage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  const storage = getStorage();
  if (user) {
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    storage.removeItem(USER_STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const setUser = (nextUser) => {
    setUserState((prevUser) => {
      const resolvedUser = typeof nextUser === "function" ? nextUser(prevUser) : nextUser;
      writeStoredUser(resolvedUser);
      return resolvedUser;
    });
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    api
      .me()
      .then((u) => setUser(u))
      .catch((err) => {
        if (err?.status === 401) {
          clearToken();
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ user, setUser, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function handleLogin(payload) {
  const { access_token } = await api.login(payload);
  setToken(access_token);
  return api.me();
}

export async function handleOtpVerify(payload) {
  const { access_token } = await api.verifyOtp(payload);
  setToken(access_token);
  return api.me();
}

export function logout(setUser) {
  clearToken();
  setUser(null);
}
