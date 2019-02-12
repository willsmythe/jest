REM This script creates links to all of the files in MSBuild/Current/Bin in the MSBuild/15.0/Bin folder so that 
REM node-gyp will continue to work for VS2019 since it's under a folder as the current installation

SET SrcRoot="C:\Program Files (x86)\Microsoft Visual Studio\2019\Preview\MSBuild\Current\Bin\"
SET TargetRoot="C:\Program Files (x86)\Microsoft Visual Studio\2019\Preview\MSBuild\15.0\Bin\"

CALL :DEQUOTE SrcRoot
CALL :DEQUOTE TargetRoot

FOR /D %%A IN ("%SrcRoot%\*") DO (
    MKLINK /D "%TargetRoot%\%%~NA" "%%~A"
    )

FOR %%A IN ("%SrcRoot%\*") DO (
    MKLINK "%TargetRoot%\%%~NXA" "%%~A"
    )
    
ECHO Linked all files and directories from MSBuild\Current\Bin to MSBuild\15.0\Bin
GOTO EOF
    
:DEQUOTE
for /f "delims=" %%A in ('echo %%%1%%') do set %1=%%~A
GOTO :EOF

:EOF
