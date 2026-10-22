# Rumbo

PWA mobile-first para organizar escapadas en grupo. React + Vite + TS + Tailwind, Supabase (Auth, Postgres, Realtime, RLS), deploy en Vercel.

## 1. Crear el proyecto en Supabase
1. Entrá a [supabase.com](https://supabase.com), creá un proyecto nuevo y anotá la contraseña de la base.
2. Andá a **SQL Editor**, pegá todo `supabase/migrations/001_init.sql` y ejecutalo.
3. (Opcional) Pegá y ejecutá `supabase/seed.sql` para cargar el viaje de ejemplo a Mendoza. Después de loguearte por primera vez, corré la última línea comentada del seed (con tu mail) para ver ese viaje.
4. En **Project Settings → API** copiá la `Project URL` y la `anon public key`.

## 2. Login
En **Authentication → Providers**:
- **Email**: ya viene activado (magic link). Si querés evitar la confirmación extra, dejá "Confirm email" como prefieras.
- **Google**: creá credenciales OAuth en Google Cloud Console (tipo "Web application"). En *Authorized redirect URIs* pegá `https://TU-PROYECTO.supabase.co/auth/v1/callback`. Copiá Client ID y Secret en Supabase y activá el proveedor.

En **Authentication → URL Configuration**: poné tu URL de Vercel en *Site URL* y agregá `http://localhost:5173/**` y `https://TU-APP.vercel.app/**` en *Redirect URLs*.

## 3. Correr local
```bash
cp .env.example .env   # completá URL y anon key
npm install
npm run dev
```

## 4. Deploy en Vercel
1. Subí el repo a GitHub e importalo en Vercel (framework: Vite).
2. En **Settings → Environment Variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` ya redirige todas las rutas (incluida `/invite/:token`) al `index.html`.
4. Abrila en el celu y usá "Agregar a pantalla de inicio" para instalarla.

## Notas
- Los invitados se suman con el link de **Compartir viaje** (vale 7 días).
- Offline: la app y el último viaje abierto se pueden ver sin conexión. Los cambios hechos sin conexión **todavía no se encolan** (ver TODO).
- TODO: cola de cambios offline, íconos PNG 192/512 para iOS/Android.
