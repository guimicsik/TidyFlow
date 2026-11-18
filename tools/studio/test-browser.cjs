/* Verificação local via Edge headless em localhost:9333; não salva alterações. */
const fs = require('fs');
(async function () {
  const target = await (await fetch('http://localhost:9333/json/new?about:blank', {method:'PUT'})).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, {once:true}));
  let serial = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  function call(method, params = {}) { return new Promise(resolve => {const id=++serial; pending.set(id,resolve); ws.send(JSON.stringify({id,method,params}));}); }
  try {
    await verify(call, errors);
  } finally {
    ws.close();
    await fetch('http://localhost:9333/json/close/' + target.id);
  }
})().catch(e=>{console.error(e);process.exit(1);});


async function verify(call, errors) {
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1290,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:process.env.STUDIO_TEST_URL || 'http://localhost:5173/studio'});
  const deadline = Date.now() + 15000;
  while (true) {
    const ready = await call('Runtime.evaluate', {expression: `
      !!document.getElementById('canvasPanel') && ['frameMain','frameEditor','frameCollect','frameOverlays'].every(id =>
        document.getElementById(id)?.contentDocument?.getElementById('studio-helper-style'))
    `});
    if (ready.result?.result.value) break;
    if (Date.now() >= deadline) throw new Error('O Studio e suas quatro prévias não inicializaram em 15 segundos.');
    await new Promise(resolve => setTimeout(resolve,100));
  }
  const check = await call('Runtime.evaluate',{expression:`(async () => {
    document.getElementById('chkAutoSave').checked=false;
    const p=document.getElementById('canvasPanel'); p.value='editor'; p.dispatchEvent(new Event('change'));
    const w=document.getElementById('canvasWidth'); w.value=1000; w.dispatchEvent(new Event('change'));
    document.getElementById('btnToggleEditMode').click();
    const doc=document.getElementById('frameEditor').contentDocument;
    const tag=doc.querySelector('.rule-pill');
    tag.click();
    const tagStaticByDefault=!document.querySelector('#individualDesign .st-hover-motion-setting input').checked;
    const tagMotion=document.querySelector('#individualDesign .st-hover-motion-setting input');
    tagMotion.checked=true; tagMotion.dispatchEvent(new Event('change'));
    const tagMotionRule=doc.getElementById('studio-individual-design').textContent.includes('transform: translate(-2px, -2px)');
    const field=document.querySelector('#individualDesign .st-individual-colors input[type="text"]');
    field.value='#ff0000'; field.dispatchEvent(new Event('change'));
    const firstRow=doc.querySelector('.tree-row'); firstRow.click();
    const rowField=document.querySelector('#individualDesign .st-individual-colors input[type="text"]');
    rowField.value='#123456'; rowField.dispatchEvent(new Event('change'));
    doc.querySelector('.prefix-preview').click();
    const prefixEditable=!!document.querySelector('#individualDesign .st-individual-colors') && document.querySelector('#individualDesign strong').textContent.includes('01_');
    await Promise.all(Array.from(doc.querySelectorAll('.tree-row')).flatMap(row => {
      doc.defaultView.getComputedStyle(row).backgroundColor;
      return row.getAnimations().map(animation => animation.finished.catch(() => {}));
    }));
    const rowColors=Array.from(doc.querySelectorAll('.tree-row')).map(r=>doc.defaultView.getComputedStyle(r).backgroundColor);
    const overlays=document.getElementById('frameOverlays').contentDocument;
    const collect=document.getElementById('frameCollect').contentDocument;
    const main=document.getElementById('frameMain').contentDocument;
    main.querySelector('[data-tf-design="main-organize-label"]').click();
    const mainEditable=!!document.querySelector('#individualDesign .st-individual-colors') && document.querySelector('#individualDesign strong').textContent.includes('Organizar Projeto');
    const mainTextColor=document.querySelectorAll('#individualDesign .st-individual-colors input[type="text"]')[3];
    mainTextColor.value='#aabbcc'; mainTextColor.dispatchEvent(new Event('change'));
    const mainColorApplied=main.defaultView.getComputedStyle(main.querySelector('[data-tf-design="main-organize-label"]')).color==='rgb(170, 187, 204)';
    main.querySelector('[data-tf-design="main-preset-bar"]').click();
    const structureEditable=!!document.querySelector('#individualDesign .st-individual-colors') && getComputedStyle(document.getElementById('inspSecText')).display==='none';
    collect.querySelector('[data-tf-design="collect-disk-available-label"]').click();
    const collectEditable=!!document.querySelector('#individualDesign .st-individual-colors') && document.querySelector('#individualDesign strong').textContent.includes('Espaço em disco');
    const collectTextColor=document.querySelectorAll('#individualDesign .st-individual-colors input[type="text"]')[3];
    collectTextColor.value='#bbccdd'; collectTextColor.dispatchEvent(new Event('change'));
    const collectColorApplied=collect.defaultView.getComputedStyle(collect.querySelector('[data-tf-design="collect-disk-available-label"]')).color==='rgb(187, 204, 221)';
    const missingIdentity={};
    for (const [name,page] of [['main',main],['editor',doc],['collect',collect],['overlays',overlays]]) {
      missingIdentity[name]=Array.from(page.querySelectorAll('button, label, .st-text-box, .rule-pill, .tree-row, input, select, legend, p'))
        .filter(el=>!el.id&&!el.getAttribute('data-tf-design')&&!el.closest('.overlay-topbar')&&!(el.matches('input')&&el.closest('label'))&&page.defaultView.getComputedStyle(el).display!=='none')
        .slice(0,20).map(el=>el.tagName.toLowerCase()+'.'+el.className.toString().trim().replace(/\s+/g,'.')+':'+el.textContent.trim().slice(0,28));
    }
    const folderKeys=['.drag-handle','.collapse-btn','.label-swatch-btn','.prefix-preview','.folder-name-input','.rules-summary-btn'].map(selector=>doc.querySelector('.tree-row '+selector)?.getAttribute('data-tf-design'));
    const galleryCards=document.querySelectorAll('.st-gallery-card').length;
    const galleryList=document.getElementById('screenGalleryList');
    const galleryFits=galleryList.scrollWidth<=galleryList.clientWidth+1 && Array.from(galleryList.querySelectorAll('.st-gallery-card, .st-gallery-thumb')).every(item=>item.getBoundingClientRect().right<=galleryList.getBoundingClientRect().right+1);
    const galleryTiles=Array.from(galleryList.querySelectorAll('.st-gallery-card'));
    const galleryCardsKeepSize=galleryTiles.every((item,index)=>item.getBoundingClientRect().height>=120 && (!index || galleryTiles[index-1].getBoundingClientRect().bottom<=item.getBoundingClientRect().top));
    document.querySelector('[data-gallery-screen="ov-reduce"]').click();
    const visibleOverlays=Array.from(overlays.querySelectorAll('.st-overlay-item')).filter(item=>overlays.defaultView.getComputedStyle(item).display!=='none').map(item=>item.id);
    overlays.getElementById('btnReduceCancel').click();
    const overlayEditable=!!document.querySelector('#individualDesign .st-individual-colors');
    document.querySelectorAll('#individualDesign .st-design-state-btn')[1].click();
    const statePreviewWorks=overlays.body.classList.contains('tf-force-hover');
    const shadowProperty=Array.from(document.querySelectorAll('#individualDesign .st-design-property')).find(item=>item.textContent.includes('Sombra (X Y'));
    const shadowAxes=shadowProperty.querySelectorAll('.st-design-shadow-axis input[type="range"]').length===4;
    const shadowAxisRows=shadowProperty.querySelectorAll('.st-design-shadow-axis');
    const effectsStacked=Array.from(shadowAxisRows).every((item,index)=>!index || shadowAxisRows[index-1].getBoundingClientRect().bottom<=item.getBoundingClientRect().top);
    const shadowSlider=shadowProperty.querySelector('input[type="range"]');
    shadowSlider.value='7'; shadowSlider.dispatchEvent(new Event('input'));
    const sliderApplied=overlays.getElementById('studio-individual-design').textContent.includes('7px 0px 0px 0px');
    const preciseShadow=shadowProperty.querySelector('.st-design-shadow-number');
    preciseShadow.value='7.25'; preciseShadow.dispatchEvent(new Event('change'));
    const preciseShadowApplied=overlays.getElementById('studio-individual-design').textContent.includes('7.25px 0px 0px 0px');
    const opacityProperty=Array.from(document.querySelectorAll('#individualDesign .st-design-property')).find(item=>item.querySelector('.st-design-property-heading > span')?.textContent==='Opacidade');
    const preciseOpacity=opacityProperty.querySelector('.st-design-precise');
    preciseOpacity.value='0.347'; preciseOpacity.dispatchEvent(new Event('change'));
    const preciseOpacityApplied=overlays.getElementById('studio-individual-design').textContent.includes('opacity: 0.347');
    shadowProperty.querySelector('.st-design-manual summary').click();
    const manualOpens=shadowProperty.querySelector('.st-design-manual').open;
    const shadowField=shadowProperty.querySelector('.st-design-manual input');
    shadowField.value='7px 7px 0 #123456'; shadowField.dispatchEvent(new Event('change'));
    const effectApplied=overlays.getElementById('studio-individual-design').textContent.includes('7px 7px 0 #123456');
    document.querySelector('#individualDesign .st-design-reset-bar button').click();
    const resetKeepsState=document.querySelectorAll('#individualDesign .st-design-state-btn')[1].classList.contains('active') && !overlays.getElementById('studio-individual-design').textContent.includes('7px 7px 0 #123456');
    const zoomBefore=Number(document.getElementById('canvasZoom').value);
    document.getElementById('canvasZoomIn').click();
    const zoomWorks=Number(document.getElementById('canvasZoom').value)===Math.min(200,zoomBefore+10);
    document.getElementById('canvasFit').click();
    const fitWorks=Number(document.getElementById('canvasZoom').value)>=25 && Number(document.getElementById('canvasZoom').value)<=150;
    const zoomBeforeWheel=Number(document.getElementById('canvasZoom').value);
    overlays.body.dispatchEvent(new overlays.defaultView.WheelEvent('wheel',{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true}));
    const wheelWorks=Number(document.getElementById('canvasZoom').value)===Math.min(200,zoomBeforeWheel+10);
    document.getElementById('canvasPan').click();
    const panWorks=document.getElementById('framesStage').classList.contains('st-canvas-pan-active');
    document.getElementById('canvasPan').click();
    return {
      tagStaticByDefault, tagMotionRule, mainEditable, mainColorApplied, prefixEditable,
      structureEditable, collectEditable, collectColorApplied, missingIdentity, folderKeys,
      galleryCards, galleryFits, galleryCardsKeepSize, visibleOverlays, overlayEditable, statePreviewWorks,
      shadowAxes, effectsStacked, sliderApplied, preciseShadowApplied, preciseOpacityApplied,
      manualOpens, effectApplied, resetKeepsState, zoomWorks, fitWorks, wheelWorks, panWorks,
      rowColors: [...new Set(rowColors)]
    };
  })()`,awaitPromise:true,returnByValue:true});
  if (check.result.exceptionDetails) throw new Error(check.result.exceptionDetails.exception.description);
  const value = check.result.result && check.result.result.value;
  const manifest = fs.readFileSync(require('path').join(__dirname, '../../CSXS/manifest.xml'), 'utf8');
  const actionCheck = await call('Runtime.evaluate',{expression:`(() => {
    const editButton=document.getElementById('btnToggleEditMode');
    if (/ON/.test(editButton.textContent)) editButton.click();
    const main=document.getElementById('frameMain').contentDocument;
    main.getElementById('btnOrganize').click();
    const rollback=main.getElementById('btnRollback');
    const label=rollback.querySelector('.btn-tile-label');
    const panel=document.getElementById('canvasPanel');
    panel.value='main';
    panel.dispatchEvent(new Event('change'));
    const width=document.getElementById('canvasWidth');
    const xml = new DOMParser().parseFromString(${JSON.stringify(manifest)}, 'application/xml');
    width.value=xml.querySelector('DispatchInfoList > Extension[Id="com.tidyflow"] Geometry > Size > Width').textContent;
    width.dispatchEvent(new Event('change'));
    function measureRollback() {
      const button=rollback.getBoundingClientRect();
      const range=main.createRange();
      range.selectNodeContents(label);
      const text=range.getBoundingClientRect();
      return {left:button.left, fits:text.width>0 && text.left>=button.left-0.5 && text.right<=button.right+0.5};
    }
    const rest=measureRollback();
    main.body.classList.add('tf-force-active');
    const active=measureRollback();
    main.body.classList.remove('tf-force-active');
    return {status:main.getElementById('statusMsg').textContent.trim(),disabled:main.getElementById('btnOrganize').disabled,rollbackShift:Math.abs(active.left-rest.left),rollbackOverflow:!rest.fits || !active.fits};
  })()`,returnByValue:true});
  const actionValue = actionCheck.result.result && actionCheck.result.result.value;
  if (!actionValue || actionValue.status || actionValue.disabled || actionValue.rollbackShift > 0.5 || actionValue.rollbackOverflow) throw new Error('Ação operacional ou rollback inválido no preview: ' + JSON.stringify(actionValue));
  if (!value || value.rowColors.length !== 1 || value.rowColors[0] !== 'rgb(18, 52, 86)' || !value.tagStaticByDefault || !value.tagMotionRule || !value.mainEditable || !value.mainColorApplied || !value.prefixEditable || !value.structureEditable || !value.collectEditable || !value.collectColorApplied || Object.values(value.missingIdentity).some(items=>items.length) || value.folderKeys.some(key=>!key) || value.galleryCards !== 10 || !value.galleryFits || !value.galleryCardsKeepSize || JSON.stringify(value.visibleOverlays) !== '["ov-reduce"]' || !value.overlayEditable || !value.statePreviewWorks || !value.shadowAxes || !value.effectsStacked || !value.sliderApplied || !value.preciseShadowApplied || !value.preciseOpacityApplied || !value.manualOpens || !value.effectApplied || !value.resetKeepsState || !value.zoomWorks || !value.fitWorks || !value.wheelWorks || !value.panWorks || errors.length) throw new Error('Prévia visual não corresponde ao esperado: ' + JSON.stringify({value,errors}));
  console.log(JSON.stringify({check:value,errors},null,2));
  const shot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(require('path').join(__dirname, 'preview-test.png'),Buffer.from(shot.result.data,'base64'));
  const multi = await call('Runtime.evaluate', {returnByValue:true, expression:`(() => {
    document.getElementById('chkAutoSave').checked=false;
    const edit=document.getElementById('btnToggleEditMode');
    if (!/ON/.test(edit.textContent)) edit.click();
    const main=document.getElementById('frameMain').contentDocument;
    const first=main.getElementById('btnOrganize'), second=main.getElementById('btnRollback');
    first.click();
    second.dispatchEvent(new main.defaultView.MouseEvent('click',{bubbles:true,shiftKey:true}));
    const chips=document.querySelectorAll('.st-multi-target-chip');
    const palette=document.querySelector('.st-color-preset-chip');
    palette.click();
    const css=main.getElementById('studio-individual-design').sheet;
    const color=document.querySelector('.st-individual-colors input[type="color"]').value;
    const picker=document.createElement('span');
    picker.style.backgroundColor=color;
    return chips.length===2 && [first,second].every(button=>Array.from(css.cssRules).some(rule=>
      rule.selectorText && button.matches(rule.selectorText) && rule.style.backgroundColor===picker.style.backgroundColor));
  })()`});
  if (multi.result.result.value !== true) throw new Error('Paleta na seleção múltipla: ' + JSON.stringify(multi.result));
}
