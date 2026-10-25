from pathlib import Path
import json, subprocess
import imageio_ffmpeg

root=Path(__file__).resolve().parents[1]
archive=root/'.project-notes'/'senja-backup-2026-10-24'
manifest=json.loads((archive/'media-manifest.json').read_text())
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
output_dir=archive/'media'/'optimized-videos'
output_dir.mkdir(parents=True,exist_ok=True)
large=[item for item in manifest if item['csv_field']=='video_mp4_url' and item['bytes']>48*1024*1024]

for number,item in enumerate(large,1):
    source=archive/item['local_file']; target=output_dir/source.name
    _,duration=imageio_ffmpeg.count_frames_and_secs(str(source))
    valid_existing=False
    if target.exists() and 1024*1024<target.stat().st_size<48*1024*1024:
        try:
            _,target_duration=imageio_ffmpeg.count_frames_and_secs(str(target))
            valid_existing=target_duration/duration>.98
        except Exception:
            valid_existing=False
    if valid_existing:
        print(f'OPTIMIZED {number}/{len(large)} exists {target.name} {target.stat().st_size/1048576:.1f} MB',flush=True);continue
    target_bytes=43*1024*1024
    total_kbps=max(350,int(target_bytes*8/duration/1000))
    audio_kbps=96
    video_kbps=max(250,total_kbps-audio_kbps)
    print(f'OPTIMIZING {number}/{len(large)} {source.name} {source.stat().st_size/1048576:.1f} MB → target 43 MB',flush=True)
    command=[ffmpeg,'-y','-i',str(source),'-c:v','libx264','-preset','veryfast','-b:v',f'{video_kbps}k','-maxrate',f'{video_kbps}k','-bufsize',f'{video_kbps*2}k','-c:a','aac','-b:a',f'{audio_kbps}k','-movflags','+faststart',str(target)]
    result=subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
    if result.returncode: raise SystemExit(result.stderr[-2500:])
    print(f'OPTIMIZED {number}/{len(large)} done {target.name} {target.stat().st_size/1048576:.1f} MB',flush=True)
