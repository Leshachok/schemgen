/* UI wiring: catalogue tab, builder tab, palette, inspector, export, preview tab. */
"use strict";

function init(){
  function $(id){ return document.getElementById(id); }
  var mode="builder";

  function toast(msg){
    var t=$("toast"); t.textContent=msg; t.classList.add("on");
    clearTimeout(t._h); t._h=setTimeout(function(){ t.classList.remove("on"); }, 1700);
  }
  function activeScheme(){ return mode==="catalogue" ? pstate.scheme : bstate.scheme; }

  $("btnCopy").addEventListener("click", function(){
    var txt=JSON.stringify(activeScheme(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){ toast("JSON copied to clipboard"); },
        function(){ fallbackCopy(txt); });
    } else fallbackCopy(txt);
  });
  function fallbackCopy(txt){
    var ta=document.createElement("textarea");
    ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("JSON copied to clipboard"); }
    catch(e){ toast("Copy failed — select the JSON manually"); }
    ta.remove();
  }
  $("btnDownload").addEventListener("click", function(){
    var s=activeScheme();
    var blob=new Blob([JSON.stringify(s,null,2)], {type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url; a.download=(s.key||"scheme")+".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    toast("Downloaded "+a.download);
  });
  $("btnTemplate").addEventListener("click", function(){
    var src=JSON.parse(JSON.stringify(pstate.scheme));
    src.key=(src.key||"SCHEME")+"-COPY";
    src.rev=1;
    bstate.scheme=src; bstate.sel=null; bstate.deckIndex=0;
    setMode("builder");
    toast("Loaded as template — edit freely");
  });

  $("toggleJsonP").addEventListener("click", function(){
    var open = $("jsonWrapP").hidden;
    $("jsonWrapP").hidden = !open;
    $("toggleJsonP").textContent = open ? "Hide" : "Show";
  });
  $("toggleJsonB").addEventListener("click", function(){
    var open = $("jsonWrapB").hidden;
    $("jsonWrapB").hidden = !open;
    $("toggleJsonB").textContent = open ? "Hide" : "Show";
  });

  /* ---------- catalogue ---------- */
  /* Prototype stand-in for the availability API: a stable pseudo-random ~70% of
     seats. Real apps pass their own `available` set (D45). */
  function demoAvailable(scheme){
    var out=new Set(), key=scheme.key||"";
    (scheme.decks||[]).forEach(function(d){ (d.columns||[]).forEach(function(c){
      (c.items||[]).forEach(function(it){
        if (it.seat==null) return;
        var s=key+"/"+it.seat, h=0;
        for (var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0;
        if (Math.abs(h)%10>2) out.add(String(it.seat));
      }); }); });
    return out;
  }
  /* the catalogue plays the app: it owns `selected` and re-renders on each tap (D46) */
  var pstate={ scheme:SCHEMES[0].build(), mode:"select", available:null, selected:new Set(),
    showGrid:false, showBack:true,
    onSeatClick:function(id){
      if (pstate.selected.has(id)) pstate.selected["delete"](id); else pstate.selected.add(id);
      drawPreview();
    } };

  var lastGroup=null;
  SCHEMES.forEach(function(s,i){
    if (s.group!==lastGroup){
      var g=document.createElement("div"); g.className="grp"; g.textContent=s.group;
      $("tabs").appendChild(g); lastGroup=s.group;
    }
    var b=document.createElement("button");
    b.setAttribute("aria-pressed", i===0?"true":"false");
    var nm=document.createElement("span"); nm.textContent=s.label;
    var cn=document.createElement("span"); cn.className="cnt";
    cn.textContent=countSeats(s.build())+" seats";
    b.appendChild(nm); b.appendChild(cn);
    b.addEventListener("click", function(){
      pstate.scheme=s.build(); pstate.selected.clear();
      Array.prototype.forEach.call($("tabs").querySelectorAll("button"), function(c){
        c.setAttribute("aria-pressed","false"); });
      b.setAttribute("aria-pressed","true");
      drawPreview();
    });
    $("tabs").appendChild(b);
  });

  function showMsgs(node, scheme){
    node.innerHTML="";
    validate(scheme).forEach(function(m){
      var d=document.createElement("div"); d.className=m.level; d.textContent=m.text;
      node.appendChild(d);
    });
  }

  function drawPreview(){
    pstate.mode=$("viewOnly").checked ? "view" : "select";
    pstate.available=demoAvailable(pstate.scheme);
    if (pstate.mode==="view") pstate.selected.clear();
    pstate.showGrid=$("showGrid").checked;
    pstate.showBack=$("showBack").checked;
    var s=pstate.scheme, deck=(s.decks||[])[0]||{};
    $("title").textContent=(s.key||"—")+" · rev "+(s.rev!=null?s.rev:"?");
    $("meta").innerHTML="<b>"+countSeats(s)+"</b> seats · <b>"+(deck.columns||[]).length
      +"</b> columns · <b>"+(deck.rows||0)+"</b> rows"+(deck.level?" · "+deck.level+" deck":"");
    $("stage").innerHTML="";
    try { $("stage").appendChild(render(s,pstate)); }
    catch(e){ $("stage").textContent="Render failed: "+e.message; }
    showMsgs($("msgsP"), s);
    $("jsonP").value=JSON.stringify(s,null,2);
    $("picked").textContent = pstate.selected.size
      ? "selected: "+Array.from(pstate.selected).join(", ") : "No seats selected.";
  }
  ["viewOnly","showGrid","showBack"].forEach(function(id){
    $(id).addEventListener("change", drawPreview);
  });
  bindJson($("jsonP"), function(parsed){
    pstate.scheme=parsed; pstate.selected.clear(); drawPreview();
  }, $("msgsP"));

  function bindJson(box, apply, msgNode){
    var timer=null;
    box.addEventListener("input", function(){
      clearTimeout(timer);
      timer=setTimeout(function(){
        try { apply(JSON.parse(box.value)); }
        catch(e){
          msgNode.innerHTML="";
          var d=document.createElement("div");
          d.className="e"; d.textContent="JSON parse error: "+e.message;
          msgNode.appendChild(d);
        }
      },320);
    });
  }

  /* ---------- builder ---------- */
  var TOOLS=[
    { label:"Sit ←",     make:function(n,r){ return { seat:n, kind:"sit", facing:"left", row:r }; } },
    { label:"Sit →",     make:function(n,r){ return { seat:n, kind:"sit", facing:"right", row:r }; } },
    { label:"Sit ↑",     make:function(n,r){ return { seat:n, kind:"sit", facing:"top", row:r }; } },
    { label:"Sit ↓",     make:function(n,r){ return { seat:n, kind:"sit", facing:"bottom", row:r }; } },
    { label:"Upper",     make:function(n,r){ return { seat:n, kind:"sleep", berth:"upper", row:r }; } },
    { label:"Middle",    make:function(n,r){ return { seat:n, kind:"sleep", berth:"middle", row:r }; } },
    { label:"Lower",     make:function(n,r){ return { seat:n, kind:"sleep", berth:"lower", row:r }; } },
    { label:"Luxury",    make:function(n,r){ return { seat:n, kind:"luxury", row:r, span:{rows:2} }; } },
    { label:"Inclusive", make:function(n,r){ return { seat:n, kind:"sit", facing:"left", inclusive:true, row:r }; } },
    { label:"Table",     make:function(n,r){ return { type:"table", row:r }; } },
    { label:"½ table ↑", make:function(n,r){ return { type:"half_table", facing:"top", row:r }; } },
    { label:"½ table ↓", make:function(n,r){ return { type:"half_table", facing:"bottom", row:r }; } },
    { label:"Separator", make:function(n,r){ return { type:"separator", row:r, span:{rows:2} }; } }
  ].concat(FACILITIES.map(function(f){
    return { label:FAC_LABEL[f], make:function(n,r){ return { type:f, row:r }; } };
  }));

  /* no row-span control: half-table (D29) and one-cell items such as driver */
  function isFixedSize(it){ return it.type==="half_table" || ONE_CELL_TYPES.indexOf(it.type)!==-1; }
  var bstate={ scheme:{ key:"NEW-1", rev:1, vehicle:"train",
      decks:[{ rows:3, columns:[Col(),Col(),Col(),Col(),Col(),Col()] }] },
    tool:TOOLS[0], toolIndex:0, sel:null, deckIndex:0 };

  /* the deck being edited; a replaced scheme may have fewer decks than before */
  function deck(){
    var ds=bstate.scheme.decks;
    if (!Array.isArray(ds) || !ds.length) ds=bstate.scheme.decks=[{ rows:3, columns:[Col()] }];
    if (bstate.deckIndex>=ds.length) bstate.deckIndex=ds.length-1;
    return ds[bstate.deckIndex];
  }

  /* ---------- scheme bar: vehicle, decks, level ---------- */
  function emptyItems(d){
    return (d.columns||[]).every(function(c){ return !(c.items||[]).length; });
  }
  var removeArmed=null;
  function drawSchemeBar(){
    var s=bstate.scheme, ds=s.decks, cur=deck();
    $("bVehicle").value = VEHICLES.indexOf(s.vehicle)!==-1 ? s.vehicle : "train";
    var tabs=$("bDecks"); tabs.innerHTML="";
    ds.forEach(function(d,i){
      var b=document.createElement("button");
      b.textContent="Deck "+(i+1)+(d.level?" · "+d.level:"");
      b.setAttribute("aria-pressed", i===bstate.deckIndex?"true":"false");
      b.addEventListener("click", function(){
        bstate.deckIndex=i; bstate.sel=null; removeArmed=null; drawBuilder(); });
      tabs.appendChild(b);
    });
    $("bAddDeck").disabled = ds.length>=LEVELS.length;
    $("bLevel").value = cur.level||"";
    var rm=$("bRemoveDeck");
    rm.disabled = ds.length<=1;
    rm.textContent = removeArmed===cur ? "Click again to remove" : "Remove deck";
  }
  $("bVehicle").addEventListener("change", function(){
    bstate.scheme.vehicle=$("bVehicle").value; drawBuilder();
  });
  $("bAddDeck").addEventListener("click", function(){
    var ds=bstate.scheme.decks;
    if (ds.length>=LEVELS.length) return;
    // several decks need distinct levels (D39): fill in whatever is missing
    var used=ds.map(function(d){ return d.level; });
    ds.forEach(function(d){
      if (!d.level){ d.level=LEVELS.filter(function(l){ return used.indexOf(l)===-1; })[0]; used.push(d.level); }
    });
    var free=LEVELS.filter(function(l){ return used.indexOf(l)===-1; })[0];
    ds.push({ level:free, rows:deck().rows, columns:[Col(),Col(),Col(),Col(),Col(),Col()] });
    bstate.deckIndex=ds.length-1; bstate.sel=null; removeArmed=null;
    drawBuilder();
  });
  $("bLevel").addEventListener("change", function(){
    var v=$("bLevel").value, cur=deck();
    // picking the other deck's level swaps the two, so levels stay unique
    bstate.scheme.decks.forEach(function(d){ if (d!==cur && v && d.level===v) d.level=cur.level; });
    if (v) cur.level=v; else delete cur.level;
    bstate.scheme.decks.forEach(function(d){ if (!d.level) delete d.level; });
    drawBuilder();
  });
  $("bRemoveDeck").addEventListener("click", function(){
    var ds=bstate.scheme.decks, cur=deck();
    if (ds.length<=1) return;
    // a deck with items takes a second click - no silent data loss
    if (!emptyItems(cur) && removeArmed!==cur){ removeArmed=cur; drawSchemeBar(); return; }
    ds.splice(bstate.deckIndex,1);
    removeArmed=null; bstate.sel=null;
    drawBuilder();
  });
  function isSeat(it){ return it.seat!=null; }

  TOOLS.forEach(function(t,i){
    var b=document.createElement("button");
    b.setAttribute("draggable","true");
    b.setAttribute("aria-pressed", i===0?"true":"false");
    b.appendChild(previewItem(t.make("12",1), 24));
    var cap=document.createElement("span"); cap.textContent=t.label;
    b.appendChild(cap);
    b.addEventListener("click", function(){
      if (bstate.toolIndex===i) deselectTool(); else selectTool(i);
    });
    b.addEventListener("dragstart", function(e){
      selectTool(i);
      e.dataTransfer.setData("text/plain","tool:"+i);
      e.dataTransfer.effectAllowed="copy";
      var ghost=document.createElement("div");
      ghost.style.position="fixed"; ghost.style.top="-1000px"; ghost.style.left="-1000px";
      ghost.appendChild(previewItem(t.make($("bNext").value.trim()||"1",1), 26));
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 26, 26);
      setTimeout(function(){ ghost.remove(); },0);
    });
    $("palette").appendChild(b);
  });

  function selectTool(i){
    bstate.toolIndex=i; bstate.tool=TOOLS[i];
    Array.prototype.forEach.call($("palette").children, function(c,j){
      c.setAttribute("aria-pressed", j===i?"true":"false"); });
    $("palNote").textContent="Active: "+TOOLS[i].label+" — click a cell to place, or click the tool again to clear.";
  }
  function deselectTool(){
    bstate.toolIndex=-1; bstate.tool=null;
    Array.prototype.forEach.call($("palette").children, function(c){
      c.setAttribute("aria-pressed","false"); });
    $("palNote").textContent="No tool selected. Drag onto the canvas, or select then click a cell.";
  }

  $("bClear").addEventListener("click", function(){
    deck().columns=[Col(),Col(),Col(),Col(),Col(),Col()];
    bstate.sel=null; drawBuilder();
  });
  bindJson($("jsonB"), function(parsed){
    bstate.scheme=parsed; bstate.sel=null; drawBuilder();
  }, $("msgsB"));

  function insertColumnAt(i){ deck().columns.splice(i,0,Col()); drawBuilder(); }
  function deleteColumnAt(i){
    var d=deck();
    if (d.columns.length<=1) return;
    d.columns.splice(i,1);
    if (bstate.sel && bstate.sel.ci===i) bstate.sel=null;
    drawBuilder();
  }
  function insertRowAfter(afterRow){
    var d=deck(); d.rows++;
    d.columns.forEach(function(col){ (col.items||[]).forEach(function(it){
      if ((it.row||1)>afterRow) it.row=(it.row||1)+1; }); });
    drawBuilder();
  }
  function deleteRowAt(row){
    var d=deck();
    if (d.rows<=1) return;
    var occupied=false;
    d.columns.forEach(function(col){ (col.items||[]).forEach(function(it){
      var sp=itemSpan(it), r=it.row||1;
      if (row>=r && row<r+sp.rows) occupied=true; }); });
    if (occupied){ toast("Row "+row+" still has items"); return; }
    d.rows--;
    d.columns.forEach(function(col){ (col.items||[]).forEach(function(it){
      if ((it.row||1)>row) it.row=(it.row||1)-1; }); });
    drawBuilder();
  }
  function itemAt(ci,r){
    var col=deck().columns[ci];
    if (!col) return null;
    var found=null;
    (col.items||[]).forEach(function(it){
      var sp=itemSpan(it), row=it.row||1;
      if (r>=row && r<row+sp.rows) found=it; });
    return found;
  }
  function deleteItem(ci,it){
    var col=deck().columns[ci], idx=col.items.indexOf(it);
    if (idx>-1) col.items.splice(idx,1);
    if (bstate.sel && bstate.sel.item===it) bstate.sel=null;
    drawBuilder();
  }

  var CELL=34, HDR=34, RGAP=6, GUT=22, X0=18+GUT, HANDLE=10;
  function colX(ci){ return X0 + ci*(CELL+8); }
  function rowYc(r){ return HDR + (r-1)*(CELL+RGAP); }
  function cellFromPoint(px,py,d){
    var ci=Math.floor((px-X0)/(CELL+8));
    if (ci<0||ci>=d.columns.length) return null;
    if (px-X0-ci*(CELL+8) > CELL) return null;
    var r=Math.floor((py-HDR)/(CELL+RGAP))+1;
    if (r<1||r>d.rows) return null;
    return { ci:ci, r:r };
  }

  function drawBuilder(){
    var d=deck();
    var gridW=d.columns.length*(CELL+8)-8, gridH=d.rows*(CELL+RGAP)-RGAP;
    var W=X0+gridW+HANDLE+18, H=HDR+gridH+HANDLE+18;
    var svg=el("svg",{ width:W, height:H, viewBox:"0 0 "+W+" "+H });

    function marker(x,y,glyph,color,onClick){
      var g=el("g",{ style:"cursor:pointer" });
      g.appendChild(el("circle",{ cx:x, cy:y, r:7, fill:"#fff", stroke:color }));
      var t=el("text",{ x:x, y:y, "text-anchor":"middle","dominant-baseline":"central",
        "font-size":9, fill:color });
      t.textContent=glyph; g.appendChild(t);
      g.addEventListener("click", onClick);
      svg.appendChild(g);
    }
    marker(X0-8, 10, "+", "var(--sel)", function(){ insertColumnAt(0); });
    d.columns.forEach(function(col,ci){
      var x=colX(ci);
      marker(x+CELL/2, 10, "✕", "var(--err)", function(){ deleteColumnAt(ci); });
      if (ci<d.columns.length-1) marker(x+CELL+4, 10, "+", "var(--sel)", function(){ insertColumnAt(ci+1); });
    });
    for (var r0=1;r0<=d.rows;r0++){
      (function(rr){
        marker(X0-14, rowYc(rr)+CELL/2, "✕", "var(--err)", function(){ deleteRowAt(rr); });
        if (rr<d.rows) marker(X0-14, rowYc(rr)+CELL+RGAP/2, "+", "var(--sel)", function(){ insertRowAfter(rr); });
      })(r0);
    }

    d.columns.forEach(function(col,ci){
      var x=colX(ci);
      for (var rr2=1;rr2<=d.rows;rr2++){
        (function(rr){
          var y=rowYc(rr), it=itemAt(ci,rr);
          if (it && (it.row||1)!==rr) return;
          var sp=it?itemSpan(it):{rows:1};
          var visRows = it ? Math.min(sp.rows, d.rows-rr+1) : 1;
          var cellH=it ? visRows*CELL+(visRows-1)*RGAP : CELL;
          var isSel=!!(bstate.sel && bstate.sel.item===it && it);
          var cellG=el("g",{});
          var rect=el("rect",{ x:x,y:y,width:CELL,height:cellH,rx:5,
            fill: it ? (it.seat!=null ? "var(--navy)" : "var(--fill)") : "#fff",
            stroke: isSel ? "var(--sel)" : "var(--border-firm)",
            "stroke-width": isSel ? 2 : 1,
            "stroke-dasharray": it ? null : "3 3",
            style: it ? "cursor:grab" : "cursor:pointer" });
          cellG.appendChild(rect);
          if (!it){
            rect.addEventListener("click", function(){ cellClick(ci,rr); });
          } else {
            var label = it.seat!=null ? String(it.seat)
              : it.type==="separator" ? "│"
              : it.type==="half_table" ? (it.facing==="bottom"?"▄":"▀")
              : it.type==="table" ? "TBL"
              : (FAC_LABEL[it.type]||it.type||"?");
            var t=el("text",{ x:x+CELL/2, y:y+cellH/2, "text-anchor":"middle",
              "dominant-baseline":"central","font-size":10,"font-weight":600,
              fill: it.seat!=null ? "#fff" : "var(--muted)", style:"pointer-events:none" });
            t.textContent=label; cellG.appendChild(t);

            var cross=el("g",{ opacity:0, style:"cursor:pointer" });
            cross.appendChild(el("circle",{ cx:x+CELL, cy:y, r:7, fill:"#fff", stroke:"var(--err)" }));
            var xt=el("text",{ x:x+CELL, y:y, "text-anchor":"middle","dominant-baseline":"central",
              "font-size":9, fill:"var(--err)" });
            xt.textContent="✕"; cross.appendChild(xt);
            cross.addEventListener("click", function(e){ e.stopPropagation(); deleteItem(ci,it); });
            cellG.addEventListener("mouseenter", function(){ cross.setAttribute("opacity","1"); });
            cellG.addEventListener("mouseleave", function(){ cross.setAttribute("opacity","0"); });
            cellG.appendChild(cross);
            attachMove(rect, ci, rr, it);
            if (isSel && !isSeat(it) && !isFixedSize(it)){
              var handle=el("rect",{ x:x+CELL-6, y:y+cellH-6, width:12, height:12, rx:3,
                fill:"var(--sel)", stroke:"#fff","stroke-width":1.5, style:"cursor:ns-resize" });
              handle.addEventListener("click", function(e){ e.stopPropagation(); });
              attachResize(handle, it);
              cellG.appendChild(handle);
            }
          }
          svg.appendChild(cellG);
        })(rr2);
      }
    });

    function attachMove(rect, ci, r, it){
      rect.addEventListener("pointerdown", function(e){
        e.preventDefault();
        var sx=e.clientX, sy=e.clientY, dragging=false, ghost=null;
        function move(ev){
          var dx=ev.clientX-sx, dy=ev.clientY-sy;
          if (!dragging && Math.sqrt(dx*dx+dy*dy)>6){
            dragging=true;
            ghost=document.createElement("div");
            ghost.style.position="fixed"; ghost.style.pointerEvents="none";
            ghost.style.zIndex="9999"; ghost.style.opacity="0.85";
            ghost.appendChild(previewItem(it,26));
            document.body.appendChild(ghost);
          }
          if (dragging&&ghost){ ghost.style.left=(ev.clientX-20)+"px"; ghost.style.top=(ev.clientY-20)+"px"; }
        }
        function up(ev){
          document.removeEventListener("pointermove",move);
          document.removeEventListener("pointerup",up);
          if (dragging){
            if (ghost) ghost.remove();
            var box=svg.getBoundingClientRect();
            var hit=cellFromPoint(ev.clientX-box.left, ev.clientY-box.top, d);
            if (hit && !(hit.ci===ci && hit.r===r) && !itemAt(hit.ci,hit.r)){
              var oc=d.columns[ci], idx=oc.items.indexOf(it);
              if (idx>-1) oc.items.splice(idx,1);
              it.row=hit.r;
              clampSpanToFit(it, d.rows);
              var nc=d.columns[hit.ci];
              nc.items=nc.items||[]; nc.items.push(it);
              bstate.sel={ ci:hit.ci, item:it };
            }
            drawBuilder();
          } else { bstate.sel={ ci:ci, item:it }; drawBuilder(); }
        }
        document.addEventListener("pointermove",move);
        document.addEventListener("pointerup",up);
      });
    }
    function attachResize(handle, it){
      handle.addEventListener("pointerdown", function(e){
        e.preventDefault(); e.stopPropagation();
        var sy=e.clientY, start=itemSpan(it).rows, row=it.row||1;
        var maxSpan=d.rows-row+1;
        function move(ev){
          var dr=Math.round((ev.clientY-sy)/(CELL+RGAP));
          var target=Math.max(1, Math.min(maxSpan, start+dr));
          if (target===1) delete it.span; else it.span={rows:target};
          drawBuilder();
        }
        function up(){ document.removeEventListener("pointermove",move);
          document.removeEventListener("pointerup",up); }
        document.addEventListener("pointermove",move);
        document.addEventListener("pointerup",up);
      });
    }

    var colHandle=el("rect",{ x:X0+gridW+5, y:HDR-4, width:HANDLE, height:gridH+8, rx:3,
      fill:"var(--fill)", stroke:"var(--border-firm)", style:"cursor:ew-resize" });
    var rowHandle=el("rect",{ x:X0-4, y:HDR+gridH+5, width:gridW+8, height:HANDLE, rx:3,
      fill:"var(--fill)", stroke:"var(--border-firm)", style:"cursor:ns-resize" });
    svg.appendChild(colHandle); svg.appendChild(rowHandle);
    colHandle.addEventListener("pointerdown", function(e){
      e.preventDefault();
      var sx=e.clientX, start=d.columns.length, applied=start;
      function move(ev){
        var target=Math.max(1, start+Math.round((ev.clientX-sx)/(CELL+8)));
        while (d.columns.length<target) d.columns.push(Col());
        while (d.columns.length>target && d.columns.length>1){
          var last=d.columns[d.columns.length-1];
          if ((last.items||[]).length) break;
          d.columns.pop();
        }
        if (d.columns.length!==applied){ applied=d.columns.length; drawBuilder(); }
      }
      function up(){ document.removeEventListener("pointermove",move);
        document.removeEventListener("pointerup",up); }
      document.addEventListener("pointermove",move);
      document.addEventListener("pointerup",up);
    });
    rowHandle.addEventListener("pointerdown", function(e){
      e.preventDefault();
      var sy=e.clientY, start=d.rows, applied=start;
      function move(ev){
        var target=Math.max(1, Math.min(20, start+Math.round((ev.clientY-sy)/(CELL+RGAP))));
        if (target>d.rows) d.rows=target;
        else if (target<d.rows){
          var occupied=false;
          d.columns.forEach(function(col){ (col.items||[]).forEach(function(it){
            if ((it.row||1)+itemSpan(it).rows-1>target) occupied=true; }); });
          if (!occupied) d.rows=target;
        }
        if (d.rows!==applied){ applied=d.rows; drawBuilder(); }
      }
      function up(){ document.removeEventListener("pointermove",move);
        document.removeEventListener("pointerup",up); }
      document.addEventListener("pointermove",move);
      document.addEventListener("pointerup",up);
    });

    var host=$("bCanvas");
    host.innerHTML=""; host.appendChild(svg);
    host.ondragover=function(e){ e.preventDefault(); e.dataTransfer.dropEffect="copy"; };
    host.ondrop=function(e){
      e.preventDefault();
      var data=e.dataTransfer.getData("text/plain");
      if (data.indexOf("tool:")!==0) return;
      var i=parseInt(data.slice(5),10);
      if (!isNaN(i)) selectTool(i);
      var box=svg.getBoundingClientRect();
      var hit=cellFromPoint(e.clientX-box.left, e.clientY-box.top, d);
      if (hit) cellClick(hit.ci, hit.r);
    };

    $("bStage").innerHTML="";
    try { $("bStage").appendChild(render(bstate.scheme,
      { mode:"view", showGrid:false, showBack:true })); }
    catch(e){ $("bStage").textContent="Render failed: "+e.message; }
    if (bwstate.framework==="compose" && bwstate.loaded) sendToCompose();
    var bd=deck();
    $("bMeta").innerHTML="<b>"+countSeats(bstate.scheme)+"</b> seats · <b>"
      +bd.columns.length+"</b> cols · <b>"+bd.rows+"</b> rows"
      +(bstate.scheme.decks.length>1 ? " · deck <b>"+(bstate.deckIndex+1)+"</b>/"+bstate.scheme.decks.length : "");
    drawSchemeBar();
    $("jsonB").value=JSON.stringify(bstate.scheme,null,2);
    showMsgs($("msgsB"), bstate.scheme);
    drawProp();
  }

  function clampSpanToFit(it, deckRows){
    var maxSpan=Math.max(1, deckRows-(it.row||1)+1);
    var current=itemSpan(it).rows;
    if (current>maxSpan){
      if (maxSpan===1) delete it.span; else it.span={ rows:maxSpan };
    }
  }

  function cellClick(ci,r){
    var col=deck().columns[ci];
    if (!col || itemAt(ci,r) || !bstate.tool) return;
    var next=$("bNext").value.trim();
    var it=bstate.tool.make(next, r);
    clampSpanToFit(it, deck().rows);
    col.items=col.items||[]; col.items.push(it);
    if (it.seat!=null){
      var num=parseInt(next,10);
      $("bNext").value = isNaN(num) ? next : String(num+1);
    }
    bstate.sel={ ci:ci, item:it };
    drawBuilder();
  }

  function drawProp(){
    var box=$("prop");
    if (!bstate.sel || mode!=="builder"){
      $("propCard").hidden = true;
      box.className="prop"; box.innerHTML="";
      return;
    }
    $("propCard").hidden = false;
    var it=bstate.sel.item;
    box.className="prop"; box.innerHTML="";
    var nameEl=document.createElement("div");
    nameEl.style.cssText="font-size:14px;font-weight:650;margin-bottom:12px";
    nameEl.textContent=describeItem(it);
    box.appendChild(nameEl);
    function field(label,node){
      var w=document.createElement("div"); w.className="frow";
      var l=document.createElement("span"); l.textContent=label;
      w.appendChild(l); w.appendChild(node); box.appendChild(w);
    }
    if (it.seat!=null){
      var num=document.createElement("input"); num.type="text"; num.value=it.seat;
      num.addEventListener("input", function(){ it.seat=num.value; drawBuilder(); });
      field("number", num);
      var kind=document.createElement("select");
      KINDS.forEach(function(k){ var o=document.createElement("option");
        o.value=k; o.textContent=k; if (it.kind===k) o.selected=true; kind.appendChild(o); });
      kind.addEventListener("change", function(){
        it.kind=kind.value;
        if (it.kind!=="sleep") delete it.berth; else if (!it.berth) it.berth="lower";
        if (it.kind!=="sit") delete it.facing; else if (!it.facing) it.facing="left";
        if (it.kind==="luxury") it.span={rows:2}; else delete it.span;
        clampSpanToFit(it, deck().rows);
        drawBuilder();
      });
      field("kind", kind);
      if (it.kind==="sleep"){
        var bs=document.createElement("select");
        BERTHS.forEach(function(v){ var o=document.createElement("option");
          o.value=v; o.textContent=v; if (it.berth===v) o.selected=true; bs.appendChild(o); });
        bs.addEventListener("change", function(){ it.berth=bs.value; drawBuilder(); });
        field("berth", bs);
      }
      if (it.kind==="sit"){
        var fs=document.createElement("select");
        FACING.forEach(function(v){ var o=document.createElement("option");
          o.value=v; o.textContent=v; if (it.facing===v) o.selected=true; fs.appendChild(o); });
        fs.addEventListener("change", function(){ it.facing=fs.value; drawBuilder(); });
        field("facing", fs);
      }
      var incl=document.createElement("input"); incl.type="checkbox"; incl.checked=!!it.inclusive;
      incl.addEventListener("change", function(){
        if (incl.checked) it.inclusive=true; else delete it.inclusive; drawBuilder(); });
      field("inclusive", incl);
    } else if (FACILITIES.indexOf(it.type)!==-1){
      var f2=document.createElement("select");
      FACILITIES.forEach(function(v){ var o=document.createElement("option");
        o.value=v; o.textContent=v; if (it.type===v) o.selected=true; f2.appendChild(o); });
      f2.addEventListener("change", function(){
        it.type=f2.value; if (it.type!=="chair") delete it.facing; drawBuilder(); });
      field("facility", f2);
      if (it.type==="chair"){
        var cf=document.createElement("select");
        FACING.forEach(function(v){ var o=document.createElement("option");
          o.value=v; o.textContent=v; if ((it.facing||CHAIR_DEFAULT_FACING)===v) o.selected=true; cf.appendChild(o); });
        cf.addEventListener("change", function(){ it.facing=cf.value; drawBuilder(); });
        field("facing", cf);
      }
    } else if (it.type==="half_table"){
      var hf=document.createElement("select");
      ["top","bottom"].forEach(function(v){ var o=document.createElement("option");
        o.value=v; o.textContent=v; if (it.facing===v) o.selected=true; hf.appendChild(o); });
      hf.addEventListener("change", function(){ it.facing=hf.value; drawBuilder(); });
      field("facing", hf);
    }
    if (!isSeat(it) && !isFixedSize(it)){
      var sp=document.createElement("input");
      sp.type="number"; sp.min="1"; sp.max="10"; sp.value=itemSpan(it).rows;
      sp.addEventListener("change", function(){
        var v=Math.max(1, parseInt(sp.value,10)||1);
        if (v===1) delete it.span; else it.span={rows:v};
        drawBuilder();
      });
      field("row span", sp);
    }
    if (!isSeat(it) && !isFixedSize(it)){
      var h=document.createElement("div"); h.className="hint";
      h.style.marginBottom="10px"; h.textContent="Or drag the green handle on the canvas.";
      box.appendChild(h);
    }
    var del=document.createElement("button");
    del.textContent="Delete item"; del.className="btn danger";
    del.addEventListener("click", function(){ deleteItem(bstate.sel.ci, it); });
    box.appendChild(del);
  }

  document.addEventListener("click", function(e){
    if (mode!=="builder" || !bstate.sel) return;
    var t=e.target;
    var inside = t.closest && (t.closest("#bCanvas")||t.closest("#propCard")||t.closest("#palette"));
    if (!inside){ bstate.sel=null; drawBuilder(); }
  });

  function setMode(m){
    mode=m;
    $("mPreview").setAttribute("aria-pressed", m==="catalogue"?"true":"false");
    $("mBuilder").setAttribute("aria-pressed", m==="builder"?"true":"false");
    $("mDocs").setAttribute("aria-pressed", m==="docs"?"true":"false");
    $("previewPane").hidden = m!=="catalogue";
    $("builderPane").hidden = m!=="builder";
    $("docsPane").hidden = m!=="docs";
    $("btnTemplate").disabled = m!=="catalogue";
    if (m==="catalogue") drawPreview();
    else if (m==="builder"){ if (bstate.toolIndex>=0) selectTool(bstate.toolIndex); drawBuilder(); }
    else if (m==="docs" && !$("docsBody").childElementCount){
      renderDocsGuide();
    }
  }
  $("mPreview").addEventListener("click", function(){ setMode("catalogue"); });
  $("mBuilder").addEventListener("click", function(){ setMode("builder"); });
  $("mDocs").addEventListener("click", function(){ setMode("docs"); });

  /* ---------- builder live preview: web vs Compose Multiplatform ---------- */
  function defaultComposeUrl(){
    // Local dev: the Compose module's own dev server. Deployed (GitHub Pages,
    // any real host): a same-origin "compose-preview/" build sits next to this
    // page - see .github/workflows/pages.yml.
    if (location.hostname && location.hostname!=="localhost" && location.hostname!=="127.0.0.1"){
      return new URL("compose-preview/", location.href).href;
    }
    return "http://localhost:8080";
  }
  $("bwUrl").value = defaultComposeUrl();
  var bwstate = { framework:"web", url:$("bwUrl").value, loaded:false };
  function sendToCompose(){
    var frame = $("bwFrame");
    if (!frame.src) return;
    try {
      var msg = JSON.stringify({ type:"schemgen:scheme", payload: bstate.scheme });
      frame.contentWindow.postMessage(msg, "*");
      $("bwStatus").textContent = "Synced "+(bstate.scheme.key||"scheme");
    } catch(e){
      $("bwStatus").textContent = "Could not reach the preview frame: "+e.message;
    }
  }
  function updateBwVisibility(){
    var isCompose = bwstate.framework==="compose";
    $("bStage").hidden = isCompose;
    $("bwCompose").hidden = !isCompose;
    if (isCompose && !bwstate.loaded){
      bwstate.url = $("bwUrl").value.trim() || bwstate.url;
      $("bwFrame").src = bwstate.url;
      bwstate.loaded = true;
      $("bwStatus").textContent = "Loading "+bwstate.url+" ...";
    }
  }
  $("bwFrame").addEventListener("load", function(){ setTimeout(sendToCompose, 300); });
  $("bwFramework").addEventListener("change", function(){
    bwstate.framework = $("bwFramework").value;
    updateBwVisibility();
  });
  $("bwLoad").addEventListener("click", function(){
    bwstate.url = $("bwUrl").value.trim() || bwstate.url;
    bwstate.loaded = true;
    $("bwFrame").src = bwstate.url;
    $("bwStatus").textContent = "Loading "+bwstate.url+" ...";
  });

  setMode("builder");
}

if (typeof document!=="undefined"){
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}
if (typeof module!=="undefined") module.exports={ SCHEMES:SCHEMES, layout:layout,
  validate:validate, render:render, previewItem:previewItem, describeItem:describeItem,
  countSeats:countSeats, T:T, ICONS:ICONS, AUTO:AUTO };
