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

  it('Filter #3', () => {
    const input = ffmpeg.input('hi.mp4', { ss: '0', t: '10'});
    const image = ffmpeg.input('hi.png');
    const filter = ffmpeg.filter([input, image], 'overlay');
    const output = filter.output('output.mp4');
    expect(output.compile().join(' ')).toEqual('ffmpeg -hide_banner -ss 0 -t 10 -i hi.mp4 -i hi.png -filter_complex [0][1]overlay[s0] -map [s0] output.mp4 -y');
  });

  it('CONCAT #1', () => {
    const concat = ffmpeg.input('list.txt', {f: 'concat', safe: '0', c: 'copy'});
    const output = concat.output('output.mp4');
    expect(output.compile('./ffmpeg', false).join(' ')).toEqual('./ffmpeg -hide_banner -f concat -safe 0 -c copy -i list.txt output.mp4');
  });

  it('CONCAT #2', () => {
    const concat = ffmpeg.input('list.txt', {f: 'concat', safe: '0'});
    const output = concat.output('output.mp4', ['-c:v', 'copy', '-af', 'aresample=async=1000', '-map', '0:V', '-map', '0:a?']);
    expect(output.compile('./ffmpeg').join(' ')).toEqual('./ffmpeg -hide_banner -f concat -safe 0 -i list.txt -c:v copy -af aresample=async=1000 -map 0:V -map 0:a? output.mp4 -y');
  })

  it('VIDEO FILTER #1', () => {
    const input = ffmpeg.input('input.mp4');
    const filter = ffmpeg.filter(input.video(), 'hflip', {x: '10', y: '20'});
    const output = filter.output('output.mp4');
    expect(output.compile().join(' ')).toEqual('ffmpeg -hide_banner -i input.mp4 -filter_complex [0:v]hflip=x=10:y=20[s0] -map [s0] output.mp4 -y');
  });

  it('AUDIO FILTER #1', () => {
    const input = ffmpeg.input('input.mp4');
    const filter = ffmpeg.filter(input.audio(), 'afade', {t: 'in', st: '2', d: '3'});
    const output = filter.output('output.mp4');
    expect(output.compile().join(' ')).toEqual('ffmpeg -hide_banner -i input.mp4 -filter_complex [0:a]afade=t=in:st=2:d=3[s0] -map [s0] output.mp4 -y');
  });

  it('COMBINED SEEK #1', () => {
    const input = ffmpeg.input('input.mp4', { ss: '01:29' });
    const filter = input.filter('hflip');
    const output = filter.output('output.mp4', { ss: '00:01', t: '00:10', map: '0:a' });
    expect(output.compile().join(' ')).toEqual('ffmpeg -hide_banner -ss 01:29 -i input.mp4 -filter_complex [0]hflip[s0] -map [s0] -ss 00:01 -t 00:10 -map 0:a output.mp4 -y');
  });
});

export default {};
