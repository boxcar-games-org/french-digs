# French Digs

## 1. Local Development

```sh
npm install
npm run dev
```

## 2. Build and Push

You must build on your computer and push the `build/` folder.

```sh
npm run build
git add .
git commit -m "update build"
git push
```

## 3. Deploy Settings

Go to the **infrastructure** repo on GitHub and run the **Manual App Deploy** action. Use these exact values:

**App Name:**

```text
french-digs
```

**Repo URL:**

```text
https://github.com/boxcar-games-org/french-digs.git
```

## How it works

- **Dockerfile:** Instead of building on the server, it just copies your local `build/` folder. This is fast and matches your computer exactly.
- **Docker Compose:** Connects the app to the `web` network so Caddy can see it.
- **Routing:** Configured to run at `boxcar-games.com/french-digs`.
