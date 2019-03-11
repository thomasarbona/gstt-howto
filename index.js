const speech = require('@google-cloud/speech');
const util = require('util');
const { spawn } = require('child_process');
const fs = require('fs');
const exec = util.promisify(require('child_process').exec);

const client = new speech.SpeechClient();

async function convertWAVtoFLAC(filename) {
  const inter = filename.replace('.wav', '.flac');
  const out = filename.replace('.wav', '_mono.flac');

  await exec(`flac -8 -f ${filename} --endian=little --sign=signed --channels=1 --bps=16 --sample-rate=48000 --force-raw-format`);
  await exec(`ffmpeg -i ${inter} -ac 1 ${out} -y`);
  return out;
}

async function convertSTTFromFile(filename) {
  const file = fs.readFileSync(filename);
  const audioBytes = file.toString('base64');

  return new Promise((resolve, reject) => {
    client.recognize({
      audio: {
        content: audioBytes,
      },
      config: {
        languageCode: 'fr-FR', // en-US
      },
    })
    .then(data => {
      const response = data[0];
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
      resolve(transcription);
    })
    .catch(err => {
      console.log(err);
      reject(err);
    });
  });
}

function record(dest, duration) {
  const recorder = spawn('arecord', ['-c', 1, '-f', 'S16_LE', '-d', duration, '-r', 48000, '--vumeter=mono', dest]);
  console.log('Recording...');
  return new Promise(resolve => {
    recorder.on('close', () => {
      console.log('Done.');
      resolve();
    });
  });
}

(async function() {
  await record('./record.wav', 5);
  const out = await convertWAVtoFLAC('./record.wav');
  const transcription = await convertSTTFromFile(out);

  console.log(transcription);
})();
