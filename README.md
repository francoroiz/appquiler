# 🏢 Appquiler

Plataforma de gestión de alquileres con actualización automática por IPC INDEC.

## Stack
- **Next.js 14** · **Supabase** · **Vercel** · **Recharts**

---

## 🚀 Setup en 5 pasos

### 1. Configurar Supabase
1. Entrá a supabase.com → nuevo proyecto (región: South America - São Paulo)
2. Andá a **SQL Editor** y ejecutá todo el contenido de `supabase-schema.sql`
3. Andá a **Authentication → Users** y creá los usuarios (tu email + el de tu socia)
4. Copiá desde **Settings → API**: `Project URL` y `anon public key`

### 2. Variables de entorno
Editá `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. Subir a GitHub
```bash
git init
git add .
git commit -m "Appquiler v1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/appquiler.git
git push -u origin main
```

### 4. Deploy en Vercel
1. vercel.com → Add New Project → importar repo
2. Agregar las 2 variables de entorno
3. Deploy → tu URL quedará tipo `appquiler.vercel.app`

### 5. Listo 🎉

---

## 🆕 Agregar usuarios
Supabase Dashboard → Authentication → Users → Invite user
