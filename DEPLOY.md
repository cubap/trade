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

## Step 2: Deploy to Railway (5 minutes)

This deploys the full multiplayer server.

1. Go to [railway.app](https://railway.app/)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `cubap/trade` repository
4. Click on your deployed service
5. Go to "Variables" tab and add:

   | Variable | Value (from your .env) |
   |----------|----------------------|
   | `MONGO_URI` | `mongodb+srv://patrickmcuba_db_user:ZaXy2IjZndRkcYqS@tiggles.7cxvkvh.mongodb.net/game?retryWrites=true&w=majority` |
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` |
   | `TEST_PAWN` | `670df72d7c18731aceacb1a0` |

6. Click "Deploy" (Railway auto-detects Node.js and uses `npm run serve`)
7. Done! Your server is live at `https://trade-production.up.railway.app` (URL varies)

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
✅ **Railway** - Full multiplayer server at `https://[your-app].up.railway.app`  
✅ **Both auto-deploy** on every push to `main`  
✅ **MongoDB Atlas** - Shared database for both local and production

## Costs

- **Netlify**: Free (100GB bandwidth, 300 build minutes/month)
- **Railway**: $5/month free credit (~500 hours runtime)
- **MongoDB Atlas**: Free M0 tier (512MB storage)

Total: **$0/month** for small projects within free tier limits

## Testing

### Solo Game (Netlify)
Open your Netlify URL in a browser - the game runs entirely client-side.

### Multiplayer Server (Railway)
```bash
# Test the health endpoint
curl https://your-app.up.railway.app/

# Connect client to your Railway server
# Edit client.js to use your Railway URL
node client.js
```

## Troubleshooting

### Railway deployment fails
- Check logs in Railway dashboard
- Verify `MONGO_URI` environment variable is set
- Ensure multiplayer features are uncommented in `server.js`

### MongoDB connection fails
- Verify Network Access in Atlas (allow `0.0.0.0/0`)
- Check connection string format
- Test connection string locally first

### Need help?
- Netlify: [NETLIFY_DEPLOY.md](NETLIFY_DEPLOY.md)
- Railway: [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)

## Monitoring

- **Netlify logs**: Site dashboard → Deploys
- **Railway logs**: Project dashboard → Deployments
- **MongoDB metrics**: Atlas dashboard → Metrics

## Next Steps

1. ✅ Push to GitHub to trigger deployments
2. ⏱️ Wait 2-3 minutes for builds
3. 🎮 Open your Netlify URL to play solo
4. 🔗 Connect client to Railway URL for multiplayer
5. 📊 Monitor usage in dashboards

---

**Time to deploy: ~15 minutes total**
