(() => {
  'use strict';
  const content=window.GARAGE_CONTENT;if(!content?.items)return;
  const $=id=>document.getElementById(id);
  const items=new Map(content.items.map(item=>[item.id,item]));
  const chapters=new Map(content.chapters.map(ch=>[ch.id,ch]));
  const mobile=matchMedia('(max-width: 800px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
  const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const scene=content.scene;
  const create=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const svg=(tag)=>document.createElementNS('http://www.w3.org/2000/svg',tag);
  let activeScene='',activeChapter=null,stops=[],tops=[],queued=false,leaderUntil=0;
  let lastFocus=null,selectedItem=null,cropSerial=0;

  function openingParagraph(text){
    const paragraph=create('p');
    if(text.startsWith('There’s no pressure to give a gift')){
      paragraph.className='gift-reassurance';
      paragraph.append(create('strong','',text));
      return paragraph;
    }
    const emphasis='Secondhand finds are very welcome—and so is anything else you think would be a good fit for his playroom.';
    if(text.startsWith(emphasis)){
      paragraph.append(create('strong','secondhand-emphasis',emphasis),document.createTextNode(text.slice(emphasis.length)));
      return paragraph;
    }
    const phrases=['no need to match an exact item', 'spend a lot'];
    let remainder=text;
    for(const phrase of phrases){
      const at=remainder.indexOf(phrase);
      if(at<0)continue;
      paragraph.append(document.createTextNode(remainder.slice(0,at)),create('mark','note-highlight',phrase));
      remainder=remainder.slice(at+phrase.length);
    }
    paragraph.append(document.createTextNode(remainder));
    return paragraph;
  }

  document.querySelectorAll('[data-count]').forEach(el=>el.textContent=content.items.length);
  $('opening-letter').append(create('h1','opening-lead',content.openingNote.lead),...content.openingNote.paragraphs.map(openingParagraph));
  $('gift-note-title').textContent=content.closingNote.title;
  $('closing-letter').append(...content.closingNote.paragraphs.map(text=>create('p','',text)));

  document.querySelectorAll('[data-side-image]').forEach(el=>el.src=scene.image);
  document.querySelectorAll('[data-front-open]').forEach(el=>el.src=scene.frontOpen);
  document.querySelectorAll('[data-front-closed]').forEach(el=>el.src=scene.frontClosed);

  function lockDialogs(){document.body.classList.toggle('dialog-open',!!document.querySelector('dialog[open]'));}
  function paintCrop(container, bounds, alt=''){
    const [x,y,w,h]=bounds;
    container.replaceChildren();container.style.setProperty('--crop-aspect',scene.width/scene.height*w/h);
    const drawing=svg('svg');drawing.setAttribute('viewBox',`${x*scene.width} ${y*scene.height} ${w*scene.width} ${h*scene.height}`);drawing.setAttribute('preserveAspectRatio','xMidYMid meet');drawing.setAttribute('role','img');drawing.setAttribute('aria-label',alt);
    const clip=svg('clipPath'),rect=svg('rect'),id='detail-crop-'+(++cropSerial);clip.id=id;rect.setAttribute('x',x*scene.width);rect.setAttribute('y',y*scene.height);rect.setAttribute('width',w*scene.width);rect.setAttribute('height',h*scene.height);clip.append(rect);drawing.append(clip);const img=svg('image');img.setAttribute('href',scene.image);img.setAttribute('width',scene.width);img.setAttribute('height',scene.height);img.setAttribute('clip-path',`url(#${id})`);drawing.append(img);container.append(drawing);
  }
  function itemPicture(item){
    if(item.imageCrop){const wrap=create('span','idea-picture'),crop=create('span','picture-crop');paintCrop(crop,item.imageCrop,item.name+' — room concept');wrap.append(crop);return wrap;}
    const img=create('img');img.src=item.image;img.alt='';img.loading='lazy';return img;
  }
  function openItem(id, regionId=null){
    const item=items.get(id);if(!item)return false;
    $('item-title').textContent=item.name;$('item-purpose').textContent=item.description;
    $('item-link').textContent='See an example';
    const region=content.hotspots.find(p=>p.id===regionId),bounds=region?.detailBounds||region?.bounds||item.imageCrop;
    $('item-image').hidden=!!bounds;$('item-room-detail').hidden=!bounds;
    if(bounds)paintCrop($('item-room-detail'),bounds,item.name+' in the garage concept');
    $('item-image').src=item.image;$('item-image').alt=item.name+(item.illustration?' — concept illustration':' — one example');
    $('item-link').hidden=!item.exampleURL;if(item.exampleURL)$('item-link').href=item.exampleURL;else $('item-link').removeAttribute('href');
    if(!$('item-dialog').open){lastFocus=document.activeElement;$('item-dialog').showModal();}lockDialogs();return true;
  }
  function openIdeas(){lastFocus=document.activeElement;$('ideas-dialog').showModal();lockDialogs();}
  document.querySelectorAll('[data-open-all]').forEach(el=>el.addEventListener('click',openIdeas));
  document.querySelectorAll('[data-close-dialog]').forEach(el=>el.addEventListener('click',()=>el.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>{lockDialogs();if(!document.querySelector('dialog[open]'))lastFocus?.focus({preventScroll:true});});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  });
  for(const item of content.items){
    const card=create('button','idea-card');card.type='button';card.setAttribute('aria-label','Read about '+item.name);
    const image=itemPicture(item);
    card.append(image,create('span','card-category',item.category),create('h3','',item.name),create('p','',item.description),create('span','card-link','Take a closer look'));
    card.addEventListener('click',()=>openItem(item.id));$('ideas-grid').append(card);
  }

  // Scene objects share one normalized coordinate system on every screen.
  // Every highlight is registered to the single complete room photograph.
  const defs=svg('svg');defs.setAttribute('width','0');defs.setAttribute('height','0');defs.setAttribute('aria-hidden','true');defs.classList.add('clip-defs');document.body.append(defs);
  content.hotspots.forEach((point,index)=>{
    if(!point.polygons?.length)return;
    const clip=svg('clipPath');clip.id='object-clip-'+index;clip.setAttribute('clipPathUnits','objectBoundingBox');
    if(point.holes?.length){const path=svg('path');path.setAttribute('clip-rule','evenodd');path.setAttribute('fill-rule','evenodd');path.setAttribute('d',[...point.polygons,...point.holes].map(poly=>'M '+poly.map(p=>p.join(' ')).join(' L ')+' Z').join(' '));clip.append(path);}
    else for(const vertices of point.polygons){const poly=svg('polygon');poly.setAttribute('points',vertices.map(p=>p.join(',')).join(' '));clip.append(poly);}defs.append(clip);
  });
  function objectButton(point,index,pointerOnly=false){
    const item=items.get(point.item),[x,y,w,h]=point.bounds;
    const el=create(pointerOnly?'div':'button','object-piece');if(!pointerOnly)el.type='button';el.dataset.item=point.item;el.dataset.region=point.id;el.dataset.chapters=point.chapters.join(' ');
    el.setAttribute('aria-label',item.name+' — take a closer look');
    Object.assign(el.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});
    // Position a full scene image within the region rather than using background
    // percentages. This remains well-defined for a region spanning the whole
    // width/height, including the floor (where background offsets divided by 0).
    const photo=create('img','object-photo');photo.src=point.image||scene.image;photo.alt='';photo.draggable=false;
    Object.assign(photo.style,point.image?{left:'0',top:'0',width:'100%',height:'100%'}:{left:-100*x/w+'%',top:-100*y/h+'%',width:100/w+'%',height:100/h+'%'});
    el.append(photo);
    if(point.polygons?.length)el.style.clipPath=`url(#object-clip-${index})`;
    el.style.setProperty('--lift',point.lift||1.055);
    el.addEventListener('click',()=>openItem(item.id,point.id));
    for(const event of ['pointerenter','focus'])el.addEventListener(event,()=>highlight(item.id));
    for(const event of ['pointerleave','blur'])el.addEventListener(event,()=>highlight(null));
    return el;
  }
  content.hotspots.forEach((point,i)=>$('hotspots').append(objectButton(point,i)));
  function highlight(id){
    selectedItem=id;
    document.querySelectorAll('.object-piece,.item-label,.leader-path').forEach(el=>el.classList.toggle('is-selected',el.dataset.item===id));
    refreshLeaders();
  }
  function descriptionCard(item,compact=false,regionId=null){
    const button=create('button',compact?'item-label':'mobile-item');button.type='button';button.dataset.item=item.id;button.setAttribute('aria-label','Read about '+item.name);
    if(!compact){const region=content.hotspots.find(p=>p.id===regionId);button.append(itemPicture(region?{...item,imageCrop:region.detailBounds||region.bounds}:item));}
    const copy=create('span','label-copy');copy.append(create('strong','',item.name));
    if(!compact)copy.append(create('span','card-link','View details'));button.append(copy);
    if(compact)button.append(create('span','line-anchor'));
    button.addEventListener('click',()=>openItem(item.id,compact?regionForItem(item.id)?.id:regionId));
    for(const event of ['pointerenter','focus'])button.addEventListener(event,()=>highlight(item.id));
    for(const event of ['pointerleave','blur'])button.addEventListener(event,()=>highlight(null));return button;
  }

  // Both tours and their navigation are generated from the same chapter data.
  const states=[{id:'welcome',anchor:'welcome'},{id:'open',anchor:'open-the-door'},{id:'inside',anchor:'step-inside'},...content.chapters,{id:'overview',anchor:'the-whole-idea'},{id:'close',anchor:'until-next-time'}];
  for(const state of states){const stop=create('section','scroll-stop');stop.id=state.anchor;stop.dataset.scene=state.id;stop.setAttribute('aria-label',state.short||state.anchor.replaceAll('-',' '));$('scroll-stops').append(stop);}
  stops=[...$('scroll-stops').children];
  for(const chapter of content.chapters){
    const link=create('a');link.href='#'+chapter.anchor;link.dataset.chapter=chapter.id;link.setAttribute('aria-label',chapter.short);link.append(create('span','nav-name',chapter.short),create('span','nav-tick'));$('chapter-nav').append(link);
  }
  const phoneIntro=create('div','phone-introduction');
  phoneIntro.append(create('h1','phone-thanks',content.openingNote.lead));
  const letter=create('div','phone-letter');
  letter.append(...content.openingNote.paragraphs.map(openingParagraph));
  phoneIntro.append(letter);
  const phoneGarage=document.querySelector('.mobile-opening-section');phoneIntro.append(phoneGarage);
  document.querySelector('.opening-note').prepend(phoneIntro);
  const mobileDoor=$('mobile-doorway'),mobileDoorButton=$('mobile-door-button');
  function toggleMobileDoor(open){mobileDoor.classList.toggle('is-open',open);mobileDoorButton.setAttribute('aria-expanded',String(open));mobileDoorButton.textContent=open?'Close the garage':'Open the garage';}
  let mobileAutoOpened=false;
  mobileDoorButton.addEventListener('click',()=>{mobileAutoOpened=true;toggleMobileDoor(!mobileDoor.classList.contains('is-open'));});
  // Preserve the closed first impression, then open on the first deliberate scroll.
  addEventListener('scroll',()=>{if(mobile.matches&&!mobileAutoOpened&&scrollY>100&&mobileDoor.getBoundingClientRect().top<innerHeight*.5){mobileAutoOpened=true;toggleMobileDoor(true);}},{passive:true});


  const phoneTour=window.createGaragePhoneTour({content,scene,items,create,svg,objectButton,openItem,openIdeas,mobile,reduced,lockDialogs,setLastFocus:el=>{lastFocus=el;}});

  const textStates={
    open:{title:'The room.',items:[]},
    inside:{title:'The play wall.',items:[]},
    overview:{title:'All together.',items:[]}
  };
  function setScene(id){
    if(id===activeScene)return;activeScene=id;activeChapter=chapters.get(id)||null;const state=activeChapter||textStates[id];
    $('theater').dataset.scene=id;$('theater').classList.toggle('showing-items',!!activeChapter);
    if(state){$('chapter-kicker').textContent='';$('chapter-title').textContent=activeChapter?'':state.title;$('chapter-description').textContent='';$('chapter-items').replaceChildren(...state.items.map(id=>descriptionCard(items.get(id),true)));}
    $('chapter-hint').textContent='';
    $('hotspots').querySelectorAll('button').forEach(el=>{const active=el.dataset.chapters.split(' ').includes(id);el.hidden=!(id==='overview'||active);el.classList.toggle('is-active',active);el.inert=false;});
    $('side-camera').classList.toggle('is-focused',!!activeChapter);const focus=activeChapter?.focus||[.5,.5];$('side-camera').style.transformOrigin=`${focus[0]*100}% ${focus[1]*100}%`;$('side-camera').style.transform=`scale(${activeChapter?.zoom||1})`;
    $('photo-caption').textContent=['welcome','open','close'].includes(id)?'Our garage, with a little imagination.':'The play wall. Room to keep adding.';
    $('photo-note').textContent=id==='close'?'see you for playtime!':'come on in!';
    $('scene-label').textContent=activeChapter?activeChapter.short:({welcome:'A little possibility',open:'Open the door',inside:'The play wall',overview:'The whole idea',close:'Until the next adventure'})[id];
    $('chapter-nav').querySelectorAll('a').forEach(el=>el.setAttribute('aria-current',String(el.dataset.chapter===id)));
    refreshLeaders();
  }
  function regionForItem(id){
    const target=activeChapter?.targets?.[id];
    return content.hotspots.find(p=>target?p.id===target:p.item===id);
  }
  function drawLeaders(){
    const layer=$('leader-lines');layer.replaceChildren();if(mobile.matches||!activeChapter||$('side-scene').inert)return;
    const stage=$('theater').getBoundingClientRect();layer.setAttribute('viewBox',`0 0 ${stage.width} ${stage.height}`);
    for(const label of $('chapter-items').querySelectorAll('.item-label')){
      const region=regionForItem(label.dataset.item);if(!region)continue;
      const a=$('side-camera').getBoundingClientRect(),b=label.querySelector('.line-anchor').getBoundingClientRect();
      const x1=b.left+b.width/2-stage.left,y1=b.top+b.height/2-stage.top,x2=a.left+a.width*region.x-stage.left,y2=a.top+a.height*region.y-stage.top;
      const path=svg('path');path.classList.add('leader-path');path.dataset.item=label.dataset.item;path.classList.toggle('is-selected',selectedItem===label.dataset.item);path.setAttribute('d',`M ${x1} ${y1} C ${x1+42} ${y1}, ${x2-65} ${y2}, ${x2} ${y2}`);layer.append(path);
      const dot=svg('circle');dot.setAttribute('cx',x1);dot.setAttribute('cy',y1);dot.setAttribute('r','3');layer.append(dot);const end=svg('circle');end.setAttribute('cx',x2);end.setAttribute('cy',y2);end.setAttribute('r','2.5');end.classList.add('leader-end');layer.append(end);
    }
  }
  function tickLeaders(){drawLeaders();if(performance.now()<leaderUntil)requestAnimationFrame(tickLeaders);}
  function refreshLeaders(){if(performance.now()>=leaderUntil)requestAnimationFrame(tickLeaders);leaderUntil=performance.now()+850;}
  function visibility(el,value){el.style.opacity=value;el.inert=value<.7;el.setAttribute('aria-hidden',String(value<.1));}
  function measure(){if(!mobile.matches)tops=stops.map(el=>el.getBoundingClientRect().top+scrollY);else phoneTour.measure();refreshLeaders();schedule();}
  function render(){
    queued=false;
    if(mobile.matches){$('tour').inert=true;$('mobile-story').inert=false;phoneTour.render();return;}
    $('tour').inert=false;$('mobile-story').inert=true;
    if(!tops.length)return;
    const vh=innerHeight,y=scrollY,tourY=Math.max(0,y-tops[0]);let index=0;
    for(let i=0;i<tops.length;i++){if(y>=tops[i]-vh*.12)index=i;else break;}
    const endSpace=Math.max(vh*.3,stops[index].offsetHeight-$('theater').offsetHeight);
    const local=clamp((y-tops[index]+vh*.12)/(index<stops.length-1?tops[index+1]-tops[index]:endSpace));
    const id=states[index].id;setScene(id);
    let door=ease((tourY-vh*.32)/(vh*.88)),side=ease((y-(tops[2]-vh*.4))/(vh*.72));
    const closing=id==='close'?ease(local/.6):0;
    if(id==='close'){side=1-ease(local/.32);door=1-ease((local-.3)/.5);}
    if(reduced.matches){door=index===0||id==='close'?0:1;side=index>=2&&id!=='close'?1:0;}
    visibility($('intro-copy'),1-ease(tourY/(vh*.8)));
    visibility($('story-copy'),['welcome','close'].includes(id)?0:id==='open'?ease(local/.25):1);
    visibility($('exit-copy'),id==='close'?ease(local/.35):0);
    const enter=ease(tourY/(vh*1.25));
    $('scene-shell').style.transform=`translateY(-50%) rotate(${lerp(-2.5,0,enter)+closing*2}deg) scale(${lerp(.91,1,enter)-closing*.15})`;
    $('scene-shell').style.right=lerp(-1,2.2,enter)-closing*3+'%';
    $('front-scene').style.opacity=1-side;$('front-scene').setAttribute('aria-hidden',String(side>.95));$('front-scene').style.transform=reduced.matches?'none':`scale(${1+side*.12})`;
    $('side-scene').style.opacity=side;$('side-scene').inert=side<.95;$('side-scene').setAttribute('aria-hidden',String(side<.1));
    $('door-image').style.transform=`translateY(${-door*101}%)`;
    $('photo-note').style.opacity=['welcome','close'].includes(id)?1:0;
    $('chapter-nav').style.opacity=side>.95?1:0;$('chapter-nav').inert=side<.95;
    $('tour-fraction').textContent=String(index+1).padStart(2,'0')+' / '+states.length;
    $('reading-progress-fill').style.width=clamp((y-tops[0])/(tops.at(-1)-tops[0]+vh*.8))*100+'%';
    drawLeaders();
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(render);}}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);mobile.addEventListener('change',measure);reduced.addEventListener('change',measure);document.fonts.ready.then(measure);addEventListener('load',measure);measure();
  // The chapter anchors are generated above. Resolve incoming links after they
  // exist, including desktop chapter links opened on a phone.
  function restoreIncomingAnchor(){
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch(_){return;}
    if(!id)return;
    if(mobile.matches&&(id==='the-whole-idea'||content.chapters.some(ch=>ch.anchor===id)))id='mobile-'+id;
    document.getElementById(id)?.scrollIntoView({behavior:'instant',block:'start'});
  }
  document.fonts.ready.then(()=>requestAnimationFrame(restoreIncomingAnchor));
  addEventListener('hashchange',()=>{
    if(mobile.matches&&(location.hash==='#the-whole-idea'||content.chapters.some(ch=>'#'+ch.anchor===location.hash)))restoreIncomingAnchor();
  });
  if(navigator.modelContext?.registerTool){
    const tools=[{name:'list_gift_ideas',description:'List the birthday gift concepts and optional example links.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>({content:[{type:'text',text:JSON.stringify(content.items.map(({id,name,description,exampleURL})=>({id,name,description,exampleURL})))}]})},{name:'show_gift_idea',description:'Open the visible detail panel for a gift idea.',inputSchema:{type:'object',properties:{id:{type:'string',enum:content.items.map(x=>x.id)}},required:['id'],additionalProperties:false},execute:async({id})=>({content:[{type:'text',text:openItem(id)?'Gift idea opened.':'Unknown gift idea.'}]})}];
    for(const tool of tools){try{navigator.modelContext.registerTool(tool);}catch(_){}}
  }
})();
