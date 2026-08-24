'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginUser } from '@/lib/auth';
import { setClientToken } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await loginUser(username.trim(), password);
      setClientToken(result.accessToken);
      router.push('/');
      router.refresh(); // fuerza a que el layout (app) vuelva a leer el token del servidor
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-sm">
        <h1 className="font-display italic text-3xl text-text-primary text-center mb-1">
          Synergy<span className="text-accent not-italic">MTG</span>
        </h1>
        <p className="text-sm text-text-muted text-center mb-8">Inicia sesión en tu mesa</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Usuario</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. aldo"
              autoFocus
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {error && <p className="text-xs text-mana-R">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors mt-2"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-accent hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
