# 🚀 Free 24/7 Cloud Deployment Guide

Deploy **Jake's Bachelor Party Companion App** online for **free** on **Render.com** (via GitHub) so the crew can access it anywhere from their cell phones.

---

## Step 1: Push Code to Your GitHub Account

### Option A: Using the GitHub CLI (`gh`)
In your terminal, run:
```bash
gh auth login
```
Follow the quick browser/code login prompt, then run:
```bash
cd /home/reelsurface/AI_Stuff/companion_app
gh repo create keys-bachelor-party --public --source=. --push
```

### Option B: Using GitHub Web
1. Go to **[github.com/new](https://github.com/new)** and create a new repository named `keys-bachelor-party` (Public or Private).
2. Run these commands in your terminal:
   ```bash
   cd /home/reelsurface/AI_Stuff/companion_app
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/keys-bachelor-party.git
   git push -u origin main
   ```

---

## Step 2: Deploy Free on Render.com (Takes 2 Minutes)

1. Go to **[dashboard.render.com](https://dashboard.render.com)** and sign in with GitHub.
2. Click **New +** &rarr; **Web Service**.
3. Select your repository (`keys-bachelor-party`).
4. Fill in the settings:
   - **Name**: `keys-bachelor-party` (or your choice)
   - **Language**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: **Free** ($0/month)
5. Click **Deploy Web Service**.
6. Within 1–2 minutes, Render gives you a live permanent HTTPS address (e.g. `https://keys-bachelor-party.onrender.com`).

---

## Step 3: Keep the Cloud App Synced with Google Drive Updates

The cloud app includes the latest copy of `Key_West_Bachelor_Party_Planner.xlsx` by default, but you can also configure it to sync live with your Google Drive / Google Sheets:

1. In Google Drive, right-click `Key_West_Bachelor_Party_Planner.xlsx` &rarr; **Share** &rarr; set to **"Anyone with the link can view"** &rarr; copy the link.
2. The file ID is the string in the URL (e.g., `https://drive.google.com/file/d/1A2B3C4D.../view` &rarr; ID is `1A2B3C4D...`).
3. In your Render Dashboard, go to your service &rarr; **Environment** &rarr; **Add Environment Variable**:
   - **Key**: `GOOGLE_DRIVE_FILE_ID`
   - **Value**: `1A2B3C4D...` (your file ID)
4. Save Changes.

Now, whenever you or the guys make updates in the spreadsheet, the cloud app will automatically fetch the latest version whenever someone opens the app or taps **"🔄 Refresh from Excel"**!
