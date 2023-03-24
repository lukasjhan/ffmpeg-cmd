# FFmpeg Command Generator

This library provides a simple API for generating FFmpeg commands in TypeScript, Rust, and Go. It is designed to make it easy to create complex FFmpeg commands programmatically, without needing to remember all the command-line options and arguments.

## Usage

```ts
const input = ffmpeg.input('hi.mp4');
const image = ffmpeg.input('hi.png');
const filter = ffmpeg.filter([input, image], 'overlay');
const output = filter.output('output.mp4');
output.compile().join(' ');
// ffmpeg -hide_banner -i hi.mp4 -i hi.png -filter_complex [0][1]overlay[s0] -map [s0] output.mp4 -y
```