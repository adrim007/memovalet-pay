(function(root){
  const width=1440,height=810,duration=12,assets=['before-share','share','logo'];
  const clamp=v=>Math.max(0,Math.min(1,v));
  const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};
  const mix=(a,b,p)=>a+(b-a)*p;
  function createFilm(c,img){
    function rect(x,y,w,h,r,fill){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill()}
    function text(s,x,y,size,weight,color){c.font=`${weight} ${size}px Inter, Arial, sans-serif`;c.fillStyle=color;c.fillText(s,x,y)}
    function pointer(x,y,scale){c.save();c.translate(x,y);c.scale(scale,scale);c.shadowColor='#17132366';c.shadowBlur=8;c.beginPath();c.moveTo(0,0);c.lineTo(0,28);c.lineTo(7,22);c.lineTo(13,35);c.lineTo(19,32);c.lineTo(13,20);c.lineTo(23,19);c.closePath();c.fillStyle='#171323';c.fill();c.lineWidth=2;c.strokeStyle='white';c.stroke();c.restore()}
    return function draw(t){
      t=Math.max(0,Math.min(duration,t));c.clearRect(0,0,width,height);
      c.fillStyle='#edeaf6';c.fillRect(0,0,width,height);
      // One continuous move: real example dashboard, job, then its real Share panel.
      const push=ease((t-.55)/2.8), pull=ease((t-4.7)/1.25);
      const z=mix(mix(1.12,2.05,push),1.38,pull);
      const focusX=mix(mix(800,522,push),720,pull);
      const focusY=mix(mix(390,386,push),440,pull);
      c.save();c.translate(720,405);c.scale(z,z);c.translate(-focusX,-focusY);
      c.drawImage(img['before-share'],0,0,1440,900);
      // The real preview has no send confirmation: demonstrate opening, not a fictional delivery.
      if(t>4.68){
        const open=ease((t-4.68)/.62);
        c.fillStyle=`rgba(19,14,40,${.26*open})`;c.fillRect(0,0,1440,900);
        c.save();c.translate(720,450);c.scale(.9+.1*open,.9+.1*open);c.translate(-720,-450);c.globalAlpha=open;
        c.shadowColor='#17102738';c.shadowBlur=32;c.shadowOffsetY=12;
        rect(496,315,448,270,18,'#fff');c.shadowColor='transparent';
        c.drawImage(img.share,496,315,448,270,496,315,448,270);c.restore();
      }
      c.restore();
      if(t>3.3&&t<4.8){
        const p=ease((t-3.3)/.85),px=mix(1130,504,p),py=mix(590,450,p);
        const x=720+(px-focusX)*z,y=405+(py-focusY)*z;
        if(t>4.24){const a=clamp((t-4.24)/.42);c.beginPath();c.arc(x,y,12+a*42,0,Math.PI*2);c.strokeStyle=`rgba(126,76,255,${1-a})`;c.lineWidth=3;c.stroke()}
        pointer(x,y,1.15);
      }
      // Small editorial caption; the product remains the subject.
      if(t<2.8){const a=ease(t/.35)*(1-ease((t-2.1)/.5));c.save();c.globalAlpha=a;rect(46,40,268,46,23,'#161122');text('One job. One place to share.',65,69,16,600,'#fff');c.restore()}
      if(t>6.2&&t<9.6){const a=ease((t-6.2)/.35)*(1-ease((t-9.15)/.35));c.save();c.globalAlpha=a;rect(516,713,408,51,25,'#171222');text('A link for your team. An email when needed.',539,745,17,600,'#fff');c.restore()}
      // A fast, quiet brand sign-off instead of another feature slide.
      if(t>9.7){
        const p=ease((t-9.7)/.65);c.save();c.globalAlpha=p;c.fillStyle='#171321';c.fillRect(0,0,width,height);
        const g=c.createRadialGradient(1180,790,10,1180,790,850);g.addColorStop(0,'#46336c');g.addColorStop(1,'#171321');c.fillStyle=g;c.fillRect(0,0,width,height);
        c.drawImage(img.logo,650,151,140,140);
        c.textAlign='center';text('Your work.',720,400,88,700,'#fff');text('In the right hands.',720,498,88,700,'#c3a4ff');text('MemoValet',720,602,28,600,'#fff');text('memovalet.com',720,647,19,400,'#c9c0d8');c.restore();
      }
      c.save();c.globalAlpha=t<9.7?.6:0;text('Example workspace · product motion study',36,784,12,400,'#352748');c.restore();
    }
  }
  root.MemoValetTeaser={width,height,duration,assets,createFilm};
})(typeof module==='object'?module.exports:window);
