# Quick Deployment Setup

This guide provides a streamlined setup for deploying Trade to both Netlify (solo game) and Railway (multiplayer server).

## Prerequisites

- GitHub account with repository pushed
- [Netlify account](https://app.netlify.com/) (free)
- [Railway account](https://railway.app/) (free tier available)
- [MongoDB Atlas account](https://www.mongodb.com/cloud/atlas) (free M0 tier)
- Your MongoDB connection string from `.env`

## Step 1: Deploy to Netlify (5 minutes)

This deploys the static solo game.

1. Go to [app.netlify.com](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Choose GitHub → Select `cubap/trade` repository
4. Settings are auto-detected from `netlify.toml` ✓
5. Click "Deploy site"
6. Done! Your solo game is live at `https://[your-site-name].netlify.app`

**Root URL automatically redirects to the solo game.**

## Step 3: Enable Multiplayer Features (2 minutes)

In `server.js`, uncomment these lines:

```javascript
// MongoDB and game logic - uncomment to enable multiplayer
import setupGameLogic from './gameLogic.js'
import connectDB from './config/db.js'
connectDB()
setupGameLogic(server)
```

Commit and push to `main` - both platforms will auto-deploy!

## Step 4: Configure MongoDB Atlas (one-time)

Ensure your MongoDB cluster allows Railway connections:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your cluster → "Network Access"
3. Click "Add IP Address"
4. Choose "Allow access from anywhere" (`0.0.0.0/0`)
5. Save

## Result

You now have:

✅ **Netlify** - Fast static solo game at `https://[your-name].netlify.app`  
✅ **Both auto-deploy** on every push to `main`  
✅ **MongoDB Atlas** - Shared database for both local and production

## Costs

- **Netlify**: Free (100GB bandwidth, 300 build minutes/month)
- **MongoDB Atlas**: Free M0 tier (512MB storage)

Total: **$0/month** for small projects within free tier limits

## Testing

### Solo Game (Netlify)
Open your Netlify URL in a browser - the game runs entirely client-side.

## Troubleshooting

### MongoDB connection fails
- Verify Network Access in Atlas (allow `0.0.0.0/0`)
- Check connection string format
- Test connection string locally first

### Need help?
- Netlify: [NETLIFY_DEPLOY.md](NETLIFY_DEPLOY.md)
- Railway: [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)

## Monitoring

- **Netlify logs**: Site dashboard → Deploys
- **MongoDB metrics**: Atlas dashboard → Metrics

## Next Steps

1. ✅ Push to GitHub to trigger deployments
2. ⏱️ Wait 2-3 minutes for builds
3. 🎮 Open your Netlify URL to play solo
4. 📊 Monitor usage in dashboards

---

**Time to deploy: ~15 minutes total**
