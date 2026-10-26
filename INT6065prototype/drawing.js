export class Drawing {
  constructor(canvas,onChange){
    this.canvas=canvas;canvas.width=1000;canvas.height=750;this.ctx=canvas.getContext('2d');this.color='#304c42';this.size=7;this.erase=false;this.history=[];this.hasContent=false;this.onChange=onChange;this.active=null;
    this.ctx.fillStyle='#fff';this.ctx.fillRect(0,0,1000,750);
    canvas.addEventListener('pointerdown',e=>this.start(e));canvas.addEventListener('pointermove',e=>this.move(e));canvas.addEventListener('pointerup',e=>this.end(e));canvas.addEventListener('pointercancel',e=>this.end(e));canvas.addEventListener('lostpointercapture',e=>this.end(e));
  }
  point(e){const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*1000/r.width,y:(e.clientY-r.top)*750/r.height};}
  remember(){this.history.push({pixels:this.ctx.getImageData(0,0,1000,750),hasContent:this.hasContent});if(this.history.length>15)this.history.shift();}
  start(e){if(this.active!==null||e.button>0)return;e.preventDefault();this.remember();this.active=e.pointerId;this.canvas.setPointerCapture(e.pointerId);this.last=this.point(e);this.ctx.beginPath();this.ctx.fillStyle=this.erase?'#ffffff':this.color;this.ctx.arc(this.last.x,this.last.y,this.size/2,0,Math.PI*2);this.ctx.fill();this.hasContent=true;this.onChange?.();}
  move(e){if(this.active!==e.pointerId)return;const p=this.point(e);this.ctx.beginPath();this.ctx.strokeStyle=this.erase?'#ffffff':this.color;this.ctx.lineWidth=this.size;this.ctx.lineCap='round';this.ctx.lineJoin='round';this.ctx.moveTo(this.last.x,this.last.y);this.ctx.lineTo(p.x,p.y);this.ctx.stroke();this.last=p;}
  end(e){if(this.active!==e.pointerId)return;this.active=null;this.onChange?.();}
  undo(){const old=this.history.pop();if(old){this.ctx.putImageData(old.pixels,0,0);this.hasContent=old.hasContent;this.onChange?.();}}
  clear(){this.remember();this.ctx.fillStyle='#fff';this.ctx.fillRect(0,0,1000,750);this.hasContent=false;this.onChange?.();}
  data(){return this.canvas.toDataURL('image/png');}
  async load(url,remember=true){
    const image=new Image();image.src=url;await image.decode();if(remember)this.remember();this.ctx.fillStyle='#fff';this.ctx.fillRect(0,0,1000,750);const ratio=Math.min(1000/image.width,750/image.height);const w=image.width*ratio,h=image.height*ratio;this.ctx.drawImage(image,(1000-w)/2,(750-h)/2,w,h);this.hasContent=true;this.onChange?.();
  }
  async upload(file){if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw new Error('upload');const url=URL.createObjectURL(file);try{await this.load(url);}finally{URL.revokeObjectURL(url);}}
}
