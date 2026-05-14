@echo off
echo [1/3] Frontend bouwen...
cd frontend
call npm run build
if errorlevel 1 (
    echo FOUT: frontend build mislukt.
    exit /b 1
)
cd ..

echo [2/3] PyInstaller exe bouwen...
pyinstaller tidal_organizer.spec --clean --noconfirm
if errorlevel 1 (
    echo FOUT: PyInstaller build mislukt.
    exit /b 1
)

echo [3/3] Klaar!
echo De exe staat in: dist\TidalOrganizer.exe
echo.
pause
