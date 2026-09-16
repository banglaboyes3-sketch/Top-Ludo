# Top Ludo - Real Money Ludo (Render Ready)

## Render Settings
- **Root Directory**: (leave EMPTY)
- **Build Command**: `npm install`
- **Start Command**: `npm start`

## Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Any random long text | `mySuperSecretKey123` |
| `ADMIN_EMAIL` | Admin panel login email | `admin@gmail.com` |
| `ADMIN_PASSWORD` | Admin panel password | `yourStrongPassword` |
| `EMAIL_USER` | Your Gmail address | `yourname@gmail.com` |
| `EMAIL_PASS` | Gmail **App Password** (16 characters) | `abcd efgh ijkl mnop` |

### Optional
| Variable | Description |
|----------|-------------|
| `ALLOW_DEV_OTP` | Set to `true` **only** for local testing. Never use in production. |

---

## How to get Gmail App Password (Real OTP)

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** (if not already)
3. Search for **App passwords**
4. Create a new App Password for "Mail"
5. Copy the 16-character password
6. Paste it in Render as `EMAIL_PASS` (spaces are automatically removed)

**Important**:
- Do **NOT** use your normal Gmail password
- Do **NOT** set `ALLOW_DEV_OTP=true` on Render (production)
- After setting variables, **Redeploy** the service

---

## URLs
- Home: `/`
- Login / Register: `/login.html`
- Admin Panel: `/admin.html`
- Health Check: `/health`
