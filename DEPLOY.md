# Deployment guide

This app has three pieces:

1. **Supabase** — your cloud database + login (free tier).
2. **Web app** (`/web`) — the dashboard/journal you open on PC and phone, deployed free on **Vercel**.
3. **Scanner** (`/scanner`) — the Python service that watches the market and sends Telegram alerts, running on your **Raspberry Pi**.

Do them in this order — each step depends on the one before it.

## 1. Supabase (cloud database)

1. Go to supabase.com, sign up free, click **New project**. Pick any name/region/password (save the DB password somewhere).
2. Once it's ready, open **SQL Editor** → **New query**, paste in the entire contents of `db/schema.sql` from this project, and run it. This creates all the tables, indexes, and security policies.
3. Go to **Project Settings → API**. You'll need three values later:
   - `Project URL` → this is `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → this is `SUPABASE_SERVICE_KEY` (keep this one secret — never put it in the web app, only the Pi scanner uses it)
4. Go to **Authentication → Providers** and make sure Email is enabled (it is by default). You can turn off "Confirm email" under Authentication → Settings if you want to log in immediately without checking an inbox.

You'll create your actual login (email/password) in step 2 below, from inside the web app itself.

## 2. Web app → Vercel

1. Push this project to a GitHub repo (or just the `web/` folder if you prefer two repos).
2. Go to vercel.com, sign up free with GitHub, click **Add New → Project**, import the repo. Set the **Root Directory** to `web` if your repo contains the whole monorepo.
3. Add Environment Variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Deploy. Vercel gives you a free `https://your-app.vercel.app` URL that works identically on PC and phone — on your phone, open it in the browser and use "Add to Home Screen" to make it behave like an installed app.
5. Open the deployed URL, click **Sign up**, create your login. Then in Supabase, go to **Authentication → Users**, copy your new user's UUID — you'll need it for the scanner's `.env` (`SUPABASE_USER_ID`) and for seeding your watchlist.
6. Back in Supabase SQL Editor, run (replacing the placeholder):
   ```sql
   insert into account_settings (user_id) values ('YOUR_USER_ID');
   insert into watchlist (user_id, symbol) values
     ('YOUR_USER_ID', 'SOLUSDT'),
     ('YOUR_USER_ID', 'BNBUSDT'),
     ('YOUR_USER_ID', 'HYPEUSDT');
   ```
   (You can also just add symbols from the app's Settings page instead — this SQL is just a shortcut.)

> Local dev: if you want to run the web app on your own machine first, `cd web`, copy `.env.local.example` to `.env.local` and fill it in, then `npm install && npm run dev`.

## 3. Telegram bot (alerts)

1. In Telegram, message **@BotFather**, send `/newbot`, give it a name. It replies with a **bot token** — that's `TELEGRAM_BOT_TOKEN`.
2. Message your new bot anything (e.g. "hi") so it has a chat with you.
3. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser — find `"chat":{"id":...}` in the response. That number is your `TELEGRAM_CHAT_ID`.

## 4. Scanner → Raspberry Pi

1. Make sure Docker is installed on the Pi (`curl -fsSL https://get.docker.com | sh` if not, then `sudo usermod -aG docker $USER` and re-login).
2. Copy this whole project onto the Pi (`git clone` your repo, or `scp` the folder over).
3. `cd scanner`, copy `.env.example` to `.env`, and fill in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the service_role key, not anon)
   - `SUPABASE_USER_ID` (your user UUID from step 2.5 above)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
   - `SCAN_INTERVAL_MINUTES` (15 is a reasonable default)
4. From the project root (one level up, where `docker-compose.yml` lives): `docker compose up -d --build`
5. Check it's working: `docker logs -f trading-scanner` — you should see it fetch data and log a score for each symbol every cycle. It restarts automatically on crash or Pi reboot (`restart: unless-stopped`).
6. Open the web app's Settings page any time to tune thresholds — the scanner reads them fresh every cycle, no redeploy needed.

### Without Docker (plain Python, if you'd rather not use Docker on the Pi)

```bash
cd scanner
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill it in
python main.py
```
To keep it running after you close the terminal, set it up as a systemd service or run it inside `tmux`/`screen`.

## Notes on the HYPE symbol

The scanner defaults to Binance USDT-M Futures (`fapi.binance.com`), which doesn't always list every new token. If `HYPEUSDT` isn't found there, the scanner will log a fetch error for it each cycle and simply skip it — SOL and BNB will keep working. If that happens, the cleanest fix is swapping the data source in `scanner/app/data.py` for an exchange that does list it (e.g. Bybit or Hyperliquid's own API) — the rest of the scoring logic doesn't change, only `fetch_klines()` needs a new implementation pointed at a different REST endpoint.

## Ongoing costs

Everything above is free at this trade volume: Supabase free tier, Vercel free tier, Telegram bot, and your own Pi's electricity. If you ever outgrow Supabase's free tier (500MB DB, fine for years of trade logs) or Vercel's free tier, both have cheap paid tiers, but you're extremely unlikely to need them for a personal journal + screener.
