@echo off
title Everest Textile Mills Web System
echo ========================================================
echo  Everest Textile Mills - Textile Manufacturing System
echo  Theme: Basic Blue and White + Shades of Blue
echo  Server starting on http://localhost:5000 ...
echo ========================================================
cd /d "%~dp0backend"
python app.py
pause
