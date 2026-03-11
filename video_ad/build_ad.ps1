# Build script for short cricket bat ad (9:16 and 16:9)
# Usage: Run in PowerShell from repository root. Requires ffmpeg in PATH.

$Duration = 20
$FPS = 25
$MobileW = 1080
$MobileH = 1920
$DesktopW = 1920
$DesktopH = 1080

$logo = "public/logos/spartan_logo_2.png"
if (-Not (Test-Path $logo)) { $logo = "public/logos/Spartan_white-removebg-preview.png" }
if (-Not (Test-Path $logo)) { Write-Error "Logo not found in public/logos. Please place a PNG logo at public/logos/*.png"; exit 1 }

# Prepare temp dir
$temp = "video_ad/tmp"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# 1) Create animated logo segment with "Unleash Your Power" (3s)
$seg1 = "$temp/seg1.mp4"
ffmpeg -y -loop 1 -t 3 -i $logo -vf "scale=$MobileW:-1,format=yuv420p,zoompan=z='if(eq(on,0),1.0,zoom+0.0008)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=75" -r $FPS -c:v libx264 -pix_fmt yuv420p $seg1

# 2) Precision text over logo (4s)
$seg2 = "$temp/seg2.mp4"
ffmpeg -y -loop 1 -t 4 -i $logo -vf "scale=$MobileW:-1,format=yuv420p,drawtext=fontfile=/Windows/Fonts/arial.ttf:text='Precision in Every Shot':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=160,fade=t=in:st=0:d=0.5,fade=t=out:st=3.5:d=0.5" -r $FPS -c:v libx264 -pix_fmt yuv420p $seg2

# 3) Grip detail (3s)
$seg3 = "$temp/seg3.mp4"
ffmpeg -y -loop 1 -t 3 -i $logo -vf "scale=600:-1,pad=$MobileW:$MobileH:(ow-iw)/2:(oh-ih)/2,format=yuv420p,drawtext=fontfile=/Windows/Fonts/arial.ttf:text='Durability':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=160" -r $FPS -c:v libx264 -pix_fmt yuv420p $seg3

# 4) Simulated slow-motion hit (4s) — using logo with radial blur-like zoom
$seg4 = "$temp/seg4.mp4"
ffmpeg -y -loop 1 -t 4 -i $logo -vf "scale=$MobileW:-1,format=yuv420p,zoompan=z='if(eq(on,0),1.0,zoom+0.004)':d=100,drawtext=fontfile=/Windows/Fonts/arial.ttf:text='Enhanced Power':fontcolor=white:fontsize=68:x=(w-text_w)/2:y=160" -r $FPS -c:v libx264 -pix_fmt yuv420p $seg4

# 5) Quick montage flashes (3s)
$seg5 = "$temp/seg5.mp4"
ffmpeg -y -loop 1 -t 3 -i $logo -vf "scale=$MobileW:-1,format=yuv420p,eq=brightness=0.06:saturation=1.2,boxblur=2,drawtext=fontfile=/Windows/Fonts/arial.ttf:text='Power':fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2" -r $FPS -c:v libx264 -pix_fmt yuv420p $seg5

# 6) End frame with CTA (3s)
$seg6 = "$temp/seg6.mp4"
ffmpeg -y -loop 1 -t 3 -i $logo -vf "scale=900:-1,pad=$MobileW:$MobileH:(ow-iw)/2:(oh-ih)/2,format=yuv420p,drawtext=fontfile=/Windows/Fonts/arial.ttf:text='Grab Your Bat Today - Play Like a Pro!':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h-220" -r $FPS -c:v libx264 -pix_fmt yuv420p $seg6

# Create concat list
$list = "$temp/list.txt"
@"
file '$seg1'
file '$seg2'
file '$seg3'
file '$seg4'
file '$seg5'
file '$seg6'
"@ | Out-File -Encoding ascii $list

# Synthesize simple placeholder music (20s) — replace with your own track for production
$music = "$temp/music.wav"
ffmpeg -y -f lavfi -i "sine=frequency=110:duration=20" -f lavfi -i "sine=frequency=220:duration=20" -filter_complex "[0:a][1:a]amix=inputs=2:dropout_transition=0,volume=0.5" $music

# Concatenate segments to a single mobile 9:16 video
$mobile_out = "video_ad/ad_mobile_9x16.mp4"
ffmpeg -y -f concat -safe 0 -i $list -c copy "$temp/concat.mp4"
# Add music and encode final mobile output
ffmpeg -y -i "$temp/concat.mp4" -i $music -c:v libx264 -c:a aac -shortest -vf "scale=$MobileW:$MobileH" -movflags +faststart $mobile_out

# Create desktop 16:9 version by scaling and center-cropping from the mobile source
$desktop_out = "video_ad/ad_desktop_16x9.mp4"
ffmpeg -y -i $mobile_out -vf "scale=$DesktopW:-1, crop=$DesktopW:$DesktopH" -c:v libx264 -c:a aac -movflags +faststart $desktop_out

Write-Host "Build complete. Outputs:" $mobile_out $desktop_out
Write-Host "Temp files in:" $temp
Write-Host "Note: Replace the synthesized music at $music with your preferred track for production."