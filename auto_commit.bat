cd /d "C:\Users\S. ASWIN\Documents\Portfolio\Portfolio git"

git pull origin main --rebase

git add .

git diff --cached --quiet
IF %ERRORLEVEL%==0 (
    echo No changes to commit
) ELSE (
    git commit -m "Auto commit on %date% %time%"
    git push origin main
)