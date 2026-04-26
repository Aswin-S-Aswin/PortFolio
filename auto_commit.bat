cd /d "C:\Users\S. ASWIN\Documents\Portfolio\Portfolio git"

:: Pull latest changes
git pull origin main --rebase

:: Update streak file with timestamp
echo Auto update on %date% %time% >> daily_log.txt

:: Add changes
git add .

:: Commit
git commit -m "Daily streak commit on %date% %time%"

:: Push to GitHub
git push origin main

exit
exit