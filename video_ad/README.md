Video ad build instructions

Overview
- This folder contains `build_ad.ps1`, a PowerShell script that assembles a 20s, 9:16 mobile ad and a 16:9 desktop export using FFmpeg and the logo images in `public/logos/`.

Quick steps
1. Ensure `ffmpeg` is installed and available in PATH.
2. From the repository root run:

```powershell
powershell -ExecutionPolicy Bypass -File .\video_ad\build_ad.ps1
```

3. Outputs will be produced at `video_ad/ad_mobile_9x16.mp4` and `video_ad/ad_desktop_16x9.mp4`.

Notes & next steps
- The script uses a synthesized placeholder music track. Replace `video_ad/tmp/music.wav` with your preferred `music.mp3`/`wav` and re-run the final ffmpeg merge step if you want a licensed track.
- To use your real footage, replace the segment creation commands in `build_ad.ps1` with your clip filenames (for example, `closeup_bat.mp4`, `slowmo_hit1.mp4`) and adapt durations in the script.
- If you want me to run the build here, confirm and I will attempt to run `build_ad.ps1` (ffmpeg required).