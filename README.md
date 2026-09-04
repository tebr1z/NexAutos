# Auto Nex

Premium avtomobil idxalı və göndəriş izləmə — ABŞ, Koreya və Çin. Copart, IAAI, Manheim.

## Stack

- **Web:** Next.js 16, React 19, Tailwind CSS 4
- **API:** NestJS 11, Prisma, PostgreSQL, Redis, JWT
- **Deploy:** Docker, Nginx

## Local development

```bash
cp .env.example .env
# apps/api/.env və apps/web/.env.local-ə eyni açarları yazın
docker compose up -d postgres redis
cd apps/api
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

```bash
cd apps/web
npm run dev
```

Web: http://localhost:3000  
API: http://localhost:4000/api/v1/health

Admin üçün `ADMIN_EMAIL` və `ADMIN_PASSWORD` seed-də yazılmalıdır. Demo giriş yoxdur.

## Production

1. `.env` doldurun. Mütləq:
   - `JWT_SECRET` və `JWT_REFRESH_SECRET` (uzun, təsadüfi)
   - `POSTGRES_PASSWORD`
   - `NEXT_PUBLIC_SITE_URL=https://nex.autos`
   - `CORS_ORIGIN=https://nex.autos`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (ilk admin)
   - `VEXIRA_WHATSAPP_KEY`
2. `CONTRACT_REVEAL_OTP=false` saxlayın.
3. Build zamanı sayt ünvanı image-ə yazılır:

```bash
docker compose --profile production up -d --build
```

Plesk / Nginx: domeni konteyner Nginx (port 80) üzərinə yönəldin, və ya `/` → `web:3000`, `/api/v1` → `api:4000`.

WhatsApp keçidləri `NEXT_PUBLIC_SITE_URL` üzərindən gedir — `localhost` olmamalıdır.
