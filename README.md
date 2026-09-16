# Top Ludo - Real Money Ludo

## Deploy on Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repo or upload this zip
3. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Add Environment Variables:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `JWT_SECRET` = any random secret string
   - `ADMIN_EMAIL` = admin@topludo.com
   - `ADMIN_PASSWORD` = your password

## Local Run

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB URI
npm start
```

## URLs

- Frontend: `/`
- Admin Panel: `/admin.html`
- Health: `/health`

## Default Admin
- Email: admin@topludo.com
- Password: admin123
