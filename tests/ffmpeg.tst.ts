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
});

export default {};
