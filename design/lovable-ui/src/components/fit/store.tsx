import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gas, getToken, isSessionError, setToken } from "@/lib/fit/api";
import { todayISO } from "@/lib/fit/format";
import type { Boot } from "@/lib/fit/types";
import {clearOfflinePack,sessionPartition} from '@/lib/fit/offline';
import {OfflineFallback} from './OfflinePlans';

type Ctx = {
  token: string;
  boot: Boot;
  patch: (f: (b: Boot) => Boot) => void;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
};
const BootCtx = createContext<Ctx | null>(null);

export function useFit() {
  const c = useContext(BootCtx);
  if (!c) throw new Error("useFit outside provider");
  return c;
}

export function useSession() {
  const qc=useQueryClient();
  const [token, setTok] = useState<string>(() => getToken());
  const signIn = useCallback((t: string) => { void clearOfflinePack();qc.clear();setToken(t); setTok(t); }, [qc]);
  const signOut = useCallback(() => { void clearOfflinePack();qc.clear();setToken(""); setTok(""); }, [qc]);
  return { token, signIn, signOut };
}

export function BootProvider({ token, onSignedOut, children, fallback, errorView }: {
  token: string;
  onSignedOut: () => void;
  children: ReactNode;
  fallback: ReactNode;
  errorView: (retry: () => void, message: string) => ReactNode;
}) {
  const qc = useQueryClient();
  const [partition]=useState(sessionPartition);
  const [day,setDay]=useState(todayISO);
  useEffect(()=>{const id=setInterval(()=>setDay(todayISO()),30_000);return ()=>clearInterval(id);},[]);
  const key = useMemo(() => ["fit-boot", token, partition, day] as const, [token,partition,day]);
  const q = useQuery({
    queryKey: key,
    queryFn: () => gas<Boot>("getBootstrap", token, day),
    staleTime: 60_000,
    retry: (n, e) => !isSessionError(e) && n < 1,
  });

  useEffect(() => { if (q.error && isSessionError(q.error)) onSignedOut(); }, [q.error, onSignedOut]);

  const patch = useCallback((f: (b: Boot) => Boot) => {
    qc.setQueryData<Boot>(key, (old) => (old ? f(old) : old));
  }, [qc, key]);

  const logout = useCallback(async () => {
    try { await gas("logout", token); } catch { /* ignore */ }
    qc.clear();
    onSignedOut();
  }, [qc, token, onSignedOut]);

  if(q.fetchStatus==='paused'||(q.error instanceof Error&&'network' in q.error&&q.error.network===true))return <OfflineFallback retry={()=>void q.refetch()} logout={()=>void logout()}/>;
  if (q.isPending) return <>{fallback}</>;
  if (q.error || !q.data) return <>{errorView(() => void q.refetch(), q.error?.message || "")}</>;
  return (
    <BootCtx.Provider value={{ token, boot: q.data, patch, refresh: q.refetch, logout }}>
      {children}
    </BootCtx.Provider>
  );
}

