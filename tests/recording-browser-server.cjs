// Local, synthetic-media QA only. No credentials, microphone, or live meetings.
const http = require('node:http');
const fs = require('node:fs');
const ts = require('typescript');
const modules = ['room-recorder', 'recorder-lifecycle', 'recording-format', 'call-timeout', 'recording-limits', 'webm-duration', 'server-captions', 'speech-segments'];
const page = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local recording check</title>
<h1>Synthetic recording check</h1><p>No camera, microphone, or live service is used.</p>
<button id="start">Start recording</button><button id="stop" disabled>Stop recording</button>
<p id="status" role="status">Ready</p><video id="result" controls playsinline width="400"></video>
<script type="module">
import {startRoomRecording} from '/room-recorder.js';
const status=document.querySelector('#status'), start=document.querySelector('#start'), stop=document.querySelector('#stop'), result=document.querySelector('#result');
let recorder, timer, source, audio, oscillator, count=0;
start.onclick=async()=>{start.disabled=true; status.textContent='Starting'; try {
const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360; const ctx=canvas.getContext('2d');
let frame=0;const draw=()=>{ctx.fillStyle=frame++%2?'#4338ca':'#0f766e';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='32px sans-serif';ctx.fillText('Synthetic frame '+frame,30,180)}; draw();timer=setInterval(draw,100);
source=canvas.captureStream(10);audio=new AudioContext();await audio.resume();const dst=audio.createMediaStreamDestination();oscillator=audio.createOscillator();oscillator.connect(dst);oscillator.start();
const person={identity:'local-qa',name:'Synthetic participant',videoTrackPublications:new Map([['video',{track:{mediaStreamTrack:source.getVideoTracks()[0]},source:'camera',isMuted:false}]]),audioTrackPublications:new Map([['audio',{track:{mediaStreamTrack:dst.stream.getAudioTracks()[0]},isMuted:false}]])};
recorder=await startRoomRecording({localParticipant:person,remoteParticipants:new Map()},()=>{});status.textContent='Recording '+(++count);stop.disabled=false;
} catch(e){status.textContent='FAIL: '+e.message;start.disabled=false;}};
stop.onclick=async()=>{stop.disabled=true;status.textContent='Finalizing';try{const data=await recorder.stop();await fetch('/save',{method:'POST',body:data.blob});result.src=URL.createObjectURL(data.blob);result.onloadedmetadata=()=>{const d=result.duration, seekable=result.seekable.length?result.seekable.end(0):0; const ok=Number.isFinite(d)&&d>0&&seekable>0; status.textContent=(ok?'PASS':'FAIL')+': recording '+count+' decodes, '+data.blob.size+' bytes, '+data.blob.type+', length '+(Number.isFinite(d)?d.toFixed(1)+'s':String(d))+', seekable to '+seekable.toFixed(1)+'s'+(data.warning?' WARNING: '+data.warning:'')};}catch(e){status.textContent='FAIL: '+e.message}finally{clearInterval(timer);source?.getTracks().forEach(t=>t.stop());oscillator?.stop();await audio?.close();start.disabled=false;}};
</script>`;
// MemoValet's own captions: a spoken clip (set SPEECH_WAV to a WAV file) is
// played silently into the microphone listener, which should hand back one
// piece per sentence. Nothing is sent anywhere.
const speechPage = `<!doctype html><title>Local speech check</title><h1>Synthetic speech check</h1>
<button id="go">Listen to the clip</button><p id="status" role="status">Ready</p><ol id="pieces"></ol>
<script type="module">
import {listenToMicrophone,canListenToMicrophone} from '/server-captions.js';
const status=document.querySelector('#status'), list=document.querySelector('#pieces');
document.querySelector('#go').onclick=async()=>{ try {
  if(!canListenToMicrophone()) throw new Error('cannot listen');
  const ctx=new AudioContext(); await ctx.resume();
  const buffer=await ctx.decodeAudioData(await (await fetch('/speech.wav')).arrayBuffer());
  const player=ctx.createBufferSource(); player.buffer=buffer; const out=ctx.createMediaStreamDestination(); player.connect(out);
  const pieces=[]; const began=Date.now();
  const listener=listenToMicrophone({track:out.stream.getAudioTracks()[0],mode:'transcribe',transcribe:async(wav,startedAt)=>{
    const bytes=new Uint8Array(await wav.arrayBuffer()); const view=new DataView(bytes.buffer);
    const seconds=view.getUint32(40,true)/view.getUint32(28,true);
    pieces.push({seconds,at:(startedAt-began)/1000,type:wav.type,riff:String.fromCharCode(...bytes.slice(0,4))});
    const li=document.createElement('li'); li.textContent=wav.type+' '+seconds.toFixed(2)+'s starting '+((startedAt-began)/1000).toFixed(2)+'s'; list.append(li);
  }});
  status.textContent='Listening'; player.start();
  await new Promise(r=>player.onended=r); await listener.finish(3000);
  window.pieces=pieces; status.textContent='DONE: '+pieces.length+' pieces';
} catch(e){ status.textContent='FAIL: '+e.message; } };
</script>`;
http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(page);return;}
  if(req.url==='/speech'){res.setHeader('Content-Type','text/html');res.end(speechPage);return;}
  if(req.url==='/save'&&req.method==='POST'){const parts=[];req.on('data',c=>parts.push(c));req.on('end',()=>{const file=process.env.SAVE_TO||'/tmp/synthetic-recording.webm';fs.writeFileSync(file,Buffer.concat(parts));console.log('saved',file,fs.statSync(file).size,'bytes');res.end('ok')});return;}
  if(req.url==='/speech.wav'){ if(!process.env.SPEECH_WAV){res.writeHead(404);res.end();return;} res.setHeader('Content-Type','audio/wav');res.end(fs.readFileSync(process.env.SPEECH_WAV));return;}
  const name=req.url?.slice(1).replace(/\.js$/,'');
  // The duration fixer is a plain script that hangs itself on window outside
  // a module system; hand it over as a module.
  if(name==='fix-webm-duration'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('node_modules/fix-webm-duration/fix-webm-duration.js','utf8')+'\nexport default window.ysFixWebmDuration;');return;}
  if(!modules.includes(name)){res.writeHead(404);res.end();return;}
  let code=ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  code=code.replace(/import \{ Track \} from "livekit-client";/,'const Track = {Source:{ScreenShare:"screen_share"}};').replace(/from "fix-webm-duration"/,'from "/fix-webm-duration.js"').replace(/from "\.\/([^"]+)"/g,'from "/$1.js"');
  res.setHeader('Content-Type','text/javascript');res.end(code);
}).listen(3032,'127.0.0.1',()=>console.log('Synthetic recording check: http://127.0.0.1:3032'));
