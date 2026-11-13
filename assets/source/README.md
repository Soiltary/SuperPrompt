# Source assets

Original files kept so the logo and the demo video can be rebuilt without anything else.

| File | What it is | Used by |
|---|---|---|
| `superprompt-logo-source.webp` | The approved SuperPrompt logo artwork (silver prompt caret with a glowing blue underscore, on white) | `node experiments\brand\make-logo.js assets\source\superprompt-logo-source.webp experiments\brand\v3`, then `experiments\brand\make-icons.ps1` |
| `superprompt-demo-en-master.mp4` | High-quality master of the English demo video (1920×1080, 24 fps, 25.5 s, H.264 CRF 16) | Re-encode for the website, for example `ffmpeg -i superprompt-demo-en-master.mp4 -vf scale=1600:900 -c:v libx264 -preset veryslow -crf 27 -tune stillimage -pix_fmt yuv420p -movflags +faststart -an superprompt-demo-en.mp4` |
| `superprompt-demo-ar-master.mp4` | High-quality master of the Arabic demo video (1920×1080, 24 fps, 24.9 s, H.264 CRF 16) | Same as above, into `deploy\landing\assets\video\superprompt-demo-ar.mp4` |

The website copies of the videos are in `deploy/landing/assets/video/`. A new recording can be made at any time with `node experiments\video\record-demo.js <path to ffmpeg.exe> both`.
