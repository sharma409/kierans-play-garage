'use strict';
/* A portrait camera moves through one registered room photograph. */
window.createGaragePhoneTour=function({content,scene,items,create,svg,objectButton,openItem,openIdeas,mobile,reduced,lockDialogs,setLastFocus}){
  const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const chapterSteps=content.chapters.flatMap(ch=>ch.items.map(id=>({item:items.get(id),chapter:ch,region:content.hotspots.find(p=>p.id===ch.targets[id])})));
  const byItem=new Map(chapterSteps.map(step=>[step.item.id,step]));
  const route=[...new Set([...(scene.mobileRoute||[]),...chapterSteps.map(step=>step.item.id)])];
  const objectSteps=route.filter(id=>byItem.has(id)).map(id=>byItem.get(id));
  const total=objectSteps.length,steps=[{intro:true,overview:true},...objectSteps,{overview:true}],lastIndex=steps.length-1;
  const stage=$('phone-stage'),room=$('phone-room-window'),camera=$('phone-room-camera'),card=$('phone-focus-card'),mapDialog=$('phone-map-dialog');
  const markers=[],mapButtons=[];let active=-1,tops=[],leaderUntil=0,leaderRunning=false,viewWidth=0,viewHeight=0,cardAnimation=null,titleAnimation=null;
  content.hotspots.forEach((point,i)=>{const button=objectButton(point,i,true);button.setAttribute('aria-hidden','true');$('phone-objects').append(button);});
  steps.forEach((step,i)=>{
    const stop=create('div','phone-stop');stop.id=step.intro?'mobile-room-introduction':step.overview?'mobile-the-whole-idea':'phone-idea-'+step.item.id;
    if(!step.overview)for(const chapter of content.chapters.filter(ch=>ch.items[0]===step.item.id)){const anchor=create('span','phone-group-anchor');anchor.id='mobile-'+chapter.anchor;stop.append(anchor);}
    $('phone-stops').append(stop);markers.push(stop);
    if(!step.overview){
      const button=create('button','phone-map-item');button.type='button';button.append(create('span','phone-map-number',String(i).padStart(2,'0')),create('span','',step.item.name),create('span','phone-map-arrow','↗'));
      button.addEventListener('click',()=>{mapDialog.close();go(i);});$('phone-map-items').append(button);mapButtons.push({button,index:i});
    }
  });
  function chooseMapView(front){
    const selected=front?$('phone-garage-tab'):$('phone-wall-tab'),other=front?$('phone-wall-tab'):$('phone-garage-tab');
    selected.setAttribute('aria-selected','true');selected.tabIndex=0;other.setAttribute('aria-selected','false');other.tabIndex=-1;
    $('phone-map-panel').setAttribute('aria-labelledby',selected.id);$('phone-map-large').src=front?scene.frontOpen:scene.image;
    $('phone-map-large').alt=front?'The garage, with beds on tile at left and the play area on blue mats at right':'The complete play wall and its equipment';
  }
  for(const [id,front] of [['phone-wall-tab',false],['phone-garage-tab',true]]){
    $(id).addEventListener('click',()=>chooseMapView(front));
    $(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?false:e.key==='End'?true:!front;chooseMapView(next);$(next?'phone-garage-tab':'phone-wall-tab').focus();}});
  }
  $('phone-map-button').addEventListener('click',()=>{setLastFocus(document.activeElement);chooseMapView(false);mapDialog.showModal();lockDialogs();});
  $('phone-previous').addEventListener('click',()=>go(Math.max(0,active-1)));
  $('phone-next').addEventListener('click',()=>active>=lastIndex?$('all-ideas').scrollIntoView({behavior:reduced.matches?'instant':'smooth'}):go(active+1));
  $('phone-detail').addEventListener('click',()=>{const step=steps[active];if(step?.intro)go(1);else if(step?.overview)openIdeas();else if(step)openItem(step.item.id,step.region.id);});
  function go(index){
    measure();const top=tops[clamp(index,0,lastIndex)]-64+2;
    window.scrollTo({top,behavior:reduced.matches?'instant':'smooth'});
  }
  function frame(snap=false){
    if(!mobile.matches||active<0)return;
    const step=steps[active],w=room.clientWidth,h=room.clientHeight,bh=w*scene.height/scene.width;
    if(!w||!h)return;
    let scale,tx,ty;
    if(step.overview){
      // Layout coordinates ignore the temporary caption FLIP transform.
      const visibleHeight=Math.min(h,card.offsetTop-room.offsetTop);
      scale=Math.min(.94,visibleHeight/bh*.94);tx=(w-w*scale)/2;ty=(visibleHeight-bh*scale)/2;
    }
    else{
      const [x,y,bw,bhNorm]=step.region.bounds;
      const cover=Math.max(1,h/bh);
      scale=clamp(Math.min(.83/bw,h*.68/(bhNorm*bh)),cover,Math.max(4.8,cover));
      tx=clamp(w*.5-(x+bw*.5)*w*scale,w-w*scale,0);
      ty=clamp(h*.46-(y+bhNorm*.5)*bh*scale,h-bh*scale,0);
    }
    if(snap)camera.style.transition='none';
    camera.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
    if(snap){camera.getBoundingClientRect();camera.style.removeProperty('transition');}
    refreshLeader();
  }
  function cancelCaptionMotion(){
    cardAnimation?.cancel();cardAnimation=null;
    titleAnimation?.cancel();titleAnimation=null;
  }
  function setStep(index){
    if(index===active)return;
    const animate=active>=0&&mobile.matches&&!reduced.matches&&viewWidth===innerWidth&&viewHeight===stage.clientHeight;
    // Capture the actual current positions, including any interrupted motion.
    const previousCamera=animate?camera.getBoundingClientRect():null,previousCard=animate?card.getBoundingClientRect():null;
    cancelCaptionMotion();active=index;const step=steps[index];
    stage.dataset.step=step.intro?'intro':step.overview?'overview':step.item.id;stage.classList.toggle('phone-intro',!!step.intro);stage.classList.toggle('phone-overview',!!step.overview);camera.classList.toggle('is-focused',!step.overview);
    $('phone-count').textContent=step.overview?'The playroom':`${String(index).padStart(2,'0')} / ${total}`;
    $('phone-item-title').textContent=step.intro?'Come on in.':step.overview?'All together.':step.item.name;
    const arrow=create('span','','↗');arrow.setAttribute('aria-hidden','true');
    $('phone-detail').replaceChildren(document.createTextNode(step.intro?'Start exploring ':step.overview?`All ${content.items.length} gift ideas `:'View this idea '),arrow);
    $('phone-detail').setAttribute('aria-label',step.intro?'Start exploring the gift ideas':step.overview?'See all gift ideas':'View '+step.item.name);
    $('phone-previous').disabled=index===0;$('phone-previous').setAttribute('aria-label',index===1?'Back to the whole room':'Previous item');$('phone-next').setAttribute('aria-label',step.intro?'Start exploring':step.overview?'Continue to the thank-you note':'Next item');
    $('phone-scroll-cue').hidden=!step.overview;$('phone-scroll-cue').textContent=step.intro?'Scroll to explore, or tap an arrow ↓':step.overview?'Secondhand finds are very welcome.':'';
    $('phone-objects').querySelectorAll('.object-piece').forEach(button=>{const on=!step.overview&&button.dataset.item===step.item.id;button.hidden=!(step.overview||on);button.classList.toggle('is-active',on);});
    camera.querySelector('.side-base').alt=step.overview?'The complete imagined play wall':'The garage, focused on '+step.item.name.toLowerCase();
    mapButtons.forEach(({button,index:i})=>button.setAttribute('aria-current',String(i===index)));
    if(animate&&previousCamera.width&&camera.offsetWidth){
      const nextRoom=room.getBoundingClientRect(),nextCard=card.getBoundingClientRect();
      // Keep the photograph in its old screen position as its layout box moves,
      // then let the shared camera transition carry it to the new framing.
      camera.style.transition='none';
      camera.style.transform=`translate(${previousCamera.left-nextRoom.left}px,${previousCamera.top-nextRoom.top}px) scale(${previousCamera.width/camera.offsetWidth})`;
      camera.getBoundingClientRect();
      camera.style.removeProperty('transition');
      frame();
      const shift=previousCard.top-nextCard.top;
      if(Math.abs(shift)>.5)cardAnimation=card.animate([{transform:`translateY(${shift}px)`},{transform:'translateY(0)'}],{duration:700,easing:'cubic-bezier(.22,.72,.12,1)'});
      titleAnimation=$('phone-item-title').animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:170,easing:'ease-out'});
    }else frame(true);
  }
  function drawLeader(){
    const layer=$('phone-leader');layer.replaceChildren();const step=steps[active];if(!mobile.matches||!step||step.overview)return;
    const s=stage.getBoundingClientRect(),a=camera.getBoundingClientRect(),label=$('phone-item-title').getBoundingClientRect(),photo=room.getBoundingClientRect();
    const [anchorX,anchorY]=step.region.mobileAnchor||[step.region.x,step.region.y];
    const x1=label.left-s.left-12,y1=label.top-s.top+14,x2=a.left+a.width*anchorX-s.left,y2=a.top+a.height*anchorY-s.top,turnY=photo.bottom-s.top-34;
    if(x2<3||x2>s.width-3||y2<3||y2>photo.bottom-s.top)return;
    layer.setAttribute('viewBox',`0 0 ${s.width} ${s.height}`);
    const path=svg('path');path.setAttribute('d',`M ${x1} ${y1} L ${x1} ${turnY+30} Q ${x1} ${turnY} ${x1+24} ${turnY-8} L ${x2} ${y2}`);layer.append(path);
    const dot=svg('circle');dot.setAttribute('cx',x2);dot.setAttribute('cy',y2);dot.setAttribute('r','3.5');layer.append(dot);
    const start=svg('circle');start.setAttribute('cx',x1);start.setAttribute('cy',y1);start.setAttribute('r','3');start.classList.add('phone-label-dot');layer.append(start);
  }
  function animateLeader(){drawLeader();if(performance.now()<leaderUntil)requestAnimationFrame(animateLeader);else leaderRunning=false;}
  function refreshLeader(){leaderUntil=performance.now()+850;if(!leaderRunning){leaderRunning=true;requestAnimationFrame(animateLeader);}}
  function measure(){
    if(!mobile.matches)return;
    const resized=viewWidth&&(viewWidth!==innerWidth||viewHeight!==stage.clientHeight);
    const keepItem=resized&&tops.length&&scrollY>=tops[0]-65&&scrollY<=tops.at(-1)+stage.clientHeight;
    if(resized||reduced.matches)cancelCaptionMotion();
    tops=markers.map(el=>el.getBoundingClientRect().top+scrollY);
    if(keepItem&&active>=0)window.scrollTo({top:tops[active]-64+2,behavior:'instant'});
    viewWidth=innerWidth;viewHeight=stage.clientHeight;frame(!!resized||reduced.matches);
  }
  mobile.addEventListener('change',()=>{if(!mobile.matches){viewWidth=0;viewHeight=0;cancelCaptionMotion();}});
  function render(){
    if(!mobile.matches)return;if(!tops.length)measure();let index=0;
    for(let i=0;i<tops.length;i++){if(scrollY+65>=tops[i])index=i;else break;}
    setStep(index);drawLeader();
  }
  const layoutObserver=new ResizeObserver(()=>{if(mobile.matches){measure();render();}});layoutObserver.observe(stage);layoutObserver.observe(document.querySelector('.opening-note'));
  setStep(0);return {measure,render};
};
