'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser } from '@/lib/auth';
import { setClientToken } from '@/lib/auth-client';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await registerUser(displayName.trim(), password);
      setClientToken(result.accessToken);
      setCreatedUsername(result.username);
      // Pausa breve para que la persona alcance a ver/anotar su
      // username antes de entrar automaticamente.
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar');
      setLoading(false);
    }
  }

  if (createdUsername) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-text-muted mb-2">Tu usuario para entrar es</p>
          <p className="font-display text-4xl text-accent mb-1">{createdUsername}</p>
          <p className="text-xs text-text-muted mt-4">Guárdalo — lo vas a necesitar la próxima vez. Entrando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-sm">
        <h1 className="font-display italic text-3xl text-text-primary text-center mb-1">
          Synergy<span className="text-accent not-italic">MTG</span>
        </h1>
        <p className="text-sm text-text-muted text-center mb-8">Crea tu cuenta</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Tu nombre</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ej. Aldo Cova"
              autoFocus
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Tu usuario para entrar se genera de tu primer nombre — te lo mostramos al terminar.
            </p>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-[11px] text-text-muted mt-1">Mínimo 6 caracteres.</p>
          </div>

          {error && <p className="text-xs text-mana-R">{error}</p>}

          <button
            type="submit"
            disabled={loading || !displayName.trim() || password.length < 6}
            className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors mt-2"
          >
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
