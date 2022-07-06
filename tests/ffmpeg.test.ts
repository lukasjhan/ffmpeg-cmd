import * as ffmpeg from '../src/ffmpeg';

describe('FFMPEG COMMAND GENERATION TEST', function() {
  it('Filter #1', () => {
    const input = ffmpeg.input('input.mp4');
    const filter = input.filter('hflip', {x: '10', y: '20'});
    const output = filter.output('output.mp4');
    expect(output.compile().join(' ')).toEqual('ffmpeg -hide_banner -i input.mp4 -filter_complex [0]hflip=x=10:y=20[s0] -map [s0] output.mp4 -y');
  });

  it('Filter #2', () => {
    const input = ffmpeg.input('hi.mp4');
    const image = ffmpeg.input('hi.png');
    const filter = ffmpeg.filter([input, image], 'overlay');
    const output = filter.output('output.mp4');
    expect(output.compile().join(' ')).toEqual('ffmpeg -hide_banner -i hi.mp4 -i hi.png -filter_complex [0][1]overlay[s0] -map [s0] output.mp4 -y');
  });

  it('CONCAT #1', () => {
    const concat = ffmpeg.input('list.txt', {f: 'concat', safe: '0', c: 'copy'});
    const output = concat.output('output.mp4');
    expect(output.compile('./ffmpeg', false).join(' ')).toEqual('./ffmpeg -hide_banner -f concat -safe 0 -c copy -i list.txt output.mp4');
  });

  it('TEST', () => {
    const concat = ffmpeg.input('list.txt', {f: 'concat', safe: '0'});
    const filter = ffmpeg.filter(concat.audio(), 'aresample', {'async': '1000'});
    const output = filter.output('output.mp4', {'c:v': 'copy'});
    expect(output.compile().join(' ')).toEqual('');
  })
});

/*
concat
-hide_banner
        -y
        -f concat
        -safe 0
        -i /tmp/concat-af77134d-1724-4033-be5b-8063e54e6ee5.txt
        -c:v copy
        -af aresample=async=1000
        -map 0:V
        -map 0:a? /home/unknown/Downloads/2.mp4

image
-hide_banner
        -y
        -max_error_rate 1
        -ss 0.000
        -i /tmp/656a1746-16d9-4ba9-9a54-c96d1efc0fbb.mp4
        -i /tmp/8526798d-32bf-449f-8253-4d90dfcb5c9c.png
        -ss 0.000
        -t 2.130
        -filter_complex [0] fps=fps=23.98:start_time=0, scale=w=960:h=540, pad=w=960:h=540:x=(ow-iw)/2:y=(oh-ih)/2, tpad=stop=-1 [node0];
  [1] scale=w=110:h=72 [node1];
  [node0][node1] overlay=x=71-w/2:y=53-h/2, subtitles=filename=/tmp/s0-898530f6-f437-4e31-ba47-0778d0faaf75.ass:fontsdir=/home/unknown/.config/Electron/fonts_2 [node_out]
        -c:v h264
        -crf 18
        -pix_fmt yuv420p
        -preset fast
        -an
        -map [node_out] /tmp/v0-1f1d24f8-e817-4a75-b299-02b617b9c311.mov

bgm
-hide_banner
        -y
        -max_error_rate 1
        -ss 3.850
        -i /tmp/b8fa8b48-d1c3-4621-a96c-1e35de803062.mp4
        -ss 1.000
        -t 2.086
        -vn
        -ar 48000
        -c:a pcm_s16le
        -map 0:a /tmp/a0-71ff3fce-7488-4cd0-a254-1ec3e28e2d34.mov

-hide_banner
        -y
        -i /tmp/v0-9d88a467-5324-4140-a773-81a4db755350.mov
        -i /tmp/a0-71ff3fce-7488-4cd0-a254-1ec3e28e2d34.mov
        -c:v copy
        -c:a pcm_s16le
        -af afade=d=0.001, areverse, afade=d=0.001, areverse
        -map 0:v:0
        -map 1:a? /tmp/va0-f8bcd563-9505-4ded-9d8f-1b763044056b.mov

-hide_banner
        -y
        -max_error_rate 1
        -ss 3.850
        -i /tmp/b8fa8b48-d1c3-4621-a96c-1e35de803062.mp4
        -ss 1.000
        -t 2.100
        -filter_complex [0] fps=fps=23.98:start_time=0, scale=w=960:h=540, pad=w=960:h=540:x=(ow-iw)/2:y=(oh-ih)/2, tpad=stop=-1, subtitles=filename=/tmp/s0-6ddc72d1-6b4d-400f-aaf2-d75f6fcef75f.ass:fontsdir=/home/unknown/.config/Electron/fonts_2 [node_out]
        -c:v h264
        -crf 18
        -pix_fmt yuv420p
        -preset fast
        -an
        -map [node_out] /tmp/v0-9d88a467-5324-4140-a773-81a4db755350.mov

audio volume
-hide_banner
        -y
        -max_error_rate 1
        -ss 4.850
        -i /tmp/9a91eb8c-408a-4569-9bbc-9484bb004907.mp4
        -t 2.086
        -filter:a volume=0.410
        -vn
        -ar 48000
        -c:a pcm_s16le
        -map 0:a /tmp/a0-2e975b36-8a12-40b6-8a96-e8382c106f35.mov

playback
-hide_banner
        -y
        -max_error_rate 1
        -ss 9.120
        -i /tmp/4e3cf9ec-fd3b-4e47-8aff-701250e70ee6.mp4
        -t 0.126
        -filter:a atempo=1.5
        -vn
        -ar 48000
        -c:a pcm_s16le
        -map 0:a /tmp/a6-7c1bd302-2ca5-49b1-bdc4-63b9635bab10.mov


-hide_banner
        -y
        -max_error_rate 1
        -ss 9.120
        -i /tmp/4e3cf9ec-fd3b-4e47-8aff-701250e70ee6.mp4
        -t 0.104
        -filter_complex [0] fps=fps=23.98:start_time=0, scale=w=960:h=540, pad=w=960:h=540:x=(ow-iw)/2:y=(oh-ih)/2, tpad=stop=-1, setpts=expr=0.667*PTS, subtitles=filename=/tmp/s6-42d08ef0-c1ea-4e63-b787-3c377e67a10d.ass:fontsdir=/home/unknown/.config/Electron/fonts_2 [node_out]
        -c:v h264
        -crf 18
        -pix_fmt yuv420p
        -preset fast
        -an
        -map [node_out] /tmp/v6-a44603bd-d5a1-445a-9eed-813630bb207d.mov

zoom
 -hide_banner
        -y
        -max_error_rate 1
        -ss 11.770
        -i /tmp/99bb7603-de67-43e9-b259-2078c59ad585.mp4
        -ss 1.000
        -t 2.790
        -filter_complex [0] fps=fps=23.98:start_time=0, rotate=angle=0.15707963267948966:ow=rotw(0.15707963267948966):oh=roth(0.15707963267948966), scale=w=1325.7963109710859:h=877.5627695589628, crop=w=959:h=540:x=220.0594458081236:y=197.42654606980395, pad=w=960:h=540:x=(ow-iw)/2:y=(oh-ih)/2, tpad=stop=-1, subtitles=filename=/tmp/s0-11770922-6683-4c7a-b208-48e806f729ae.ass:fontsdir=/home/unknown/.config/Electron/fonts_2 [node_out]
        -c:v h264
        -crf 18
        -pix_fmt yuv420p
        -preset fast
        -an
        -map [node_out] /tmp/v0-44662017-5081-427f-8245-b7c54855e810.mov


*/

export default {};
