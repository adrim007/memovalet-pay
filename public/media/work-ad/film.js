/* Deterministic 60-second editorial film. Browser preview and offline render share this timeline. */
(function (root) {
  const W=1280,H=720,DURATION=60;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>1-Math.pow(1-clamp(n),3);
  const mix=(a,b,n)=>a+(b-a)*n;
  function createFilm(ctx,images) {
    const ink='#17152a',paper='#f2eff9',violet='#7748ed',lime='#d5fa85';
    function box(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
    function text(s,x,y,size=30,color=ink,weight=500){ctx.font=`${weight} ${size}px "Inter", "DejaVu Sans", sans-serif`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(s,x,y);}
    function lines(arr,x,y,size,color,leading=1.08){arr.forEach((s,i)=>text(s,x,y+i*size*leading,size,color,800));}
    function pill(s,x,y,fill=lime,color=ink){ctx.font='600 16px "Inter",sans-serif';const w=ctx.measureText(s).width+34;box(x,y,w,36,18,fill);text(s,x+17,y+9,16,color,600);return w;}
    function brand(dark=false){ctx.drawImage(images.logo,48,31,42,42);text('MemoValet',101,39,23,dark?'#fff':ink,750);}
    function background(t,dark=false){
      ctx.fillStyle=dark?'#17112d':paper;ctx.fillRect(0,0,W,H);
      const g=ctx.createRadialGradient(1020+Math.sin(t/5)*45,290,10,1010,300,680);
      g.addColorStop(0,dark?'#45316f':'#ded2fa');g.addColorStop(1,dark?'#17112d':paper);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      ctx.fillStyle=dark?'#ffffff17':'#53328b19';
      for(let x=40;x<W;x+=38)for(let y=100;y<H;y+=38){ctx.beginPath();ctx.arc(x,y,0.8,0,Math.PI*2);ctx.fill();}
      brand(dark);text('WORK, WITH ROOM TO BREATHE.',940,44,12,dark?'#bcb0d7':'#726584',600);
    }
    function footer(index,dark=false){
      const labels=['HOME','PROJECTS','WORK','FILES','HISTORY'];
      labels.forEach((s,i)=>{const x=48+i*145;box(x,667,130,3,1,i<=index?violet:(dark?'#ffffff26':'#dcd5e8'));text(s,x,680,10,dark?'#c3b9d7':'#71657f',600);});
      text('Product preview · example data',1002,677,11,dark?'#c3b9d7':'#71657f',500);
    }
    function shot(key,crop,x,y,w,h,local=0){
      const entrance=ease(local/.6);y+=24*(1-entrance);ctx.save();ctx.globalAlpha=entrance;
      ctx.shadowColor='#30145025';ctx.shadowBlur=35;ctx.shadowOffsetY=18;box(x,y,w,h+30,16,'#fff');ctx.shadowColor='transparent';
      box(x,y,w,30,16,'#faf8ff');ctx.fillStyle='#faf8ff';ctx.fillRect(x,y+15,w,15);
      ['#d5cbe5','#e6dff1','#e6dff1'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+16+i*14,y+15,3.5,0,Math.PI*2);ctx.fill();});
      text('memovalet.com',x+w/2-42,y+8,11,'#877a98',500);
      ctx.beginPath();ctx.roundRect(x,y+30,w,h,[0,0,16,16]);ctx.clip();
      const ratio=w/h, c=[...crop];
      if(c[2]/c[3]>ratio){const nw=c[3]*ratio;c[0]+=(c[2]-nw)/2;c[2]=nw;}else {const nh=c[2]/ratio;c[1]+=(c[3]-nh)/2;c[3]=nh;}
      ctx.drawImage(images[key],...c,x,y+30,w,h);ctx.restore();
    }
    function intro(t){
      background(t,true);
      const k=ease(t/.65);ctx.save();ctx.translate(0,28*(1-k));ctx.globalAlpha=k;
      if(t<3){
        text('Your work.',64,166,100,'#fff',800);
        if(t>.65)text('Not everywhere.',64,276,100,lime,800);
        const tags=[['That file?',780,474],['The deadline?',126,520],['Who’s on it?',438,458]];
        tags.forEach(([s,x,y],i)=>{const a=ease((t-.8-i*.22)/.5);ctx.save();ctx.globalAlpha=a;ctx.translate(x,y+35*(1-a));ctx.rotate((i-1)*.045);box(0,0,250,72,16,'#ffffff0e','#ffffff26');text(s,23,22,24,'#ddd5ed');ctx.restore();});
      }else{
        lines(['Less chasing.','More done.'],64,153,112,'#fff');
        box(850,230,270,180,34,lime);text('→',919,230,135,ink,500);
        text('One place to get your work moving.',71,442,28,'#c9beda');
      }
      ctx.restore();
    }
    function home(t){background(t);pill('01 / YOUR STARTING POINT',48,117);lines(['Start with','what needs','you.'],48,182,62,ink);text('A clear view of today.',50,412,22,'#6e637e');text('A place to find what’s next.',50,445,22,'#6e637e');
      const z=ease((t-4)/1.2),crop=[mix(255,290,z),mix(0,122,z),mix(1180,1110,z),mix(737,693,z)];
      shot('dashboard',crop,456,124,778,486,t);
      if(t>3.3)pill('Search. Ask. Get going.',750,603,lime);
      footer(0);
    }
    function project(t){background(t,true);pill('02 / THE BIGGER PICTURE',48,117,lime);lines(['Keep the','job together.'],48,185,65,'#fff');text('The context. The decisions.',50,369,22,'#c9beda');text('The next step.',50,402,22,'#c9beda');
      shot('project-detail',[446,44,800,548],507,129,712,488,t);
      if(t>3)pill('Pick up where you left off.',590,604,lime);
      footer(1,true);
    }
    function work(t){background(t);pill('03 / LESS FOLLOW-UP',48,115);lines(['Send the job. Skip the chase.'],48,175,59,ink);text('An owner, a deadline, and a link they can act on.',51,247,23,'#6e637e');
      const crop=t<3.8?[324,115,1050,574]:[324,330,1050,369];
      shot('tasks',crop,80,314,1120,297,t);
      if(t>4.4)pill('Add a location. Attach a photo.',777,600,lime);
      footer(2);
    }
    function files(t){background(t,true);pill('04 / READY TO SHARE',48,117);lines(['Find it.','Share it.'],48,182,82,'#fff');text('Photos, files and folders.',50,399,23,'#c9beda');text('Choose what leaves your workspace.',50,435,20,'#c9beda');
      const crop=t<4?[322,30,1050,640]:[325,113,1050,535];
      shot('files',crop,510,145,713,440,t);
      if(t>3.2)pill('Private until you share.',703,598,lime);
      footer(3,true);
    }
    function history(t){background(t);pill('05 / NOTHING LEFT BEHIND',48,117);lines(['Keep the','decisions.'],48,183,67,ink);text('Come back to the notes,',50,385,22,'#6e637e');text('transcripts and next steps.',50,421,22,'#6e637e');
      shot('history',[315,24,1055,768],500,128,727,492,t);footer(4);
    }
    function together(t){background(t,true);text('More than meetings.',50,115,64,'#fff',800);text('Your work, together.',50,192,64,lime,800);
      const shots=[['dashboard',[294,125,1105,642]],['project-detail',[450,45,795,625]],['tasks',[325,332,1045,360]]];
      shots.forEach(([key,crop],i)=>shot(key,crop,50+i*402,319,377,249,t-i*.15));
      ['Notes + files','Projects + decisions','People + next steps'].forEach((s,i)=>text(s,52+i*402,623,20,'#e4daef',600));
    }
    function end(t){background(t);const a=ease(t/.7);ctx.save();ctx.globalAlpha=a;ctx.translate(0,30*(1-a));
      lines(['Make room for','the actual work.'],63,159,93,ink);
      text('Less chasing. More done.',70,403,29,'#746382');
      box(70,490,323,75,37,violet);text('memovalet.com',101,512,29,'#fff',700);text('↗',348,509,31,'#fff');
      shot('dashboard',[289,120,1115,660],847,221,365,280,t);
      ctx.restore();text('MEMOVALET',73,663,13,'#87729c',700);
    }
    const scenes=[{start:0,end:6,draw:intro},{start:6,end:14,draw:home},{start:14,end:22,draw:project},{start:22,end:30,draw:work},{start:30,end:38,draw:files},{start:38,end:46,draw:history},{start:46,end:53,draw:together},{start:53,end:60,draw:end}];
    return function frame(time){const t=Math.min(DURATION-.001,Math.max(0,time));const s=scenes.find(s=>t>=s.start&&t<s.end);ctx.save();s.draw(t-s.start);
      // Short directional reveal; holds are intentionally quiet enough to read.
      const transition=(t-s.start)/.24;if(s.start&&transition<1){ctx.fillStyle=violet;ctx.fillRect(W*ease(transition),0,W,H);}
      ctx.restore();};
  }
  root.MemoValetFilm={createFilm,width:W,height:H,duration:DURATION,assets:['dashboard','project-detail','tasks','files','history','logo']};
})(typeof module!=='undefined'?module.exports:window);
