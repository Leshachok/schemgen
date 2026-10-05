/* SVG rendering: turns a scheme + item into DOM nodes. */
"use strict";

var NS="http://www.w3.org/2000/svg";
function el(n,a){ var e=document.createElementNS(NS,n);
  for (var k in a) if (a[k]!=null) e.setAttribute(k,a[k]); return e; }

function render(scheme, state){
  var frag=document.createDocumentFragment();
  (scheme.decks||[]).forEach(function(deck){
    var L=layout(deck);
    var svg=el("svg",{ width:L.width, height:L.height,
      viewBox:"0 0 "+L.width+" "+L.height, role:"group",
      "aria-label":(scheme.vehicle==="bus"?"Bus ":"Wagon ")+(scheme.key||"")+(deck.level?", "+deck.level+" deck":"") });
    svg.appendChild(el("rect",{ x:2,y:2,width:L.width-4,height:L.height-4,
      rx:12, fill:"#fff", stroke:"var(--border-firm)" }));
    if (state.showGrid){
      for (var r=1;r<=(deck.rows||1);r++){
        var gy=rowY(deck,r)+T.seat/2;
        svg.appendChild(el("line",{ x1:6,x2:L.width-6,y1:gy,y2:gy,
          stroke:"var(--border-firm)","stroke-dasharray":"2 4" }));
      }
    }
    L.cols.forEach(function(pc){
      (pc.col.items||[]).forEach(function(it){
        var sp=itemSpan(it), row=it.row||1;
        var y=rowY(deck,row);
        var yEnd=rowY(deck, Math.min(row+sp.rows-1, deck.rows||1));
        var h=yEnd+T.seat-y, w=itemWidth(it), x=pc.x + (pc.w-w)/2;
        if (it.seat!=null) drawSeat(svg, scheme, it, x, y, w, h, state);
        else if (it.type==="separator") drawSeparator(svg, x, y, w, h);
        else if (it.type==="half_table") drawHalfTable(svg, x, y, w, h, it.facing);
        else if (it.type==="table") drawBlock(svg, x, y, w, h);
        else if (it.type==="chair") drawChair(svg, x, y, w, h, it.facing);
        else if (it.type) drawFacility(svg, it.type, x, y, w, h);
        else drawBlock(svg, x, y, w, h, "?");
      });
    });
    frag.appendChild(svg);
  });
  return frag;
}

function drawBlock(svg,x,y,w,h,label){
  svg.appendChild(el("rect",{ x:x,y:y,width:w,height:h,rx:4,
    fill:"var(--fill)", stroke:"var(--border-firm)" }));
  if (label){
    var t=el("text",{ x:x+w/2,y:y+h/2,"text-anchor":"middle",
      "dominant-baseline":"central","font-size":9,fill:"var(--muted)" });
    t.textContent=label; svg.appendChild(t);
  }
}
function drawSeparator(svg,x,y,w,h){
  svg.appendChild(el("line",{ x1:x+w/2, x2:x+w/2, y1:y-8, y2:y+h+8,
    stroke:"var(--border-firm)", "stroke-width":1 }));
}
function drawHalfTable(svg,x,y,w,h,facing){
  var hh=h/2;
  var hy = facing==="bottom" ? y+h-hh : y;
  drawBlock(svg, x, hy, w, hh);
}
function drawFacility(svg,type,x,y,w,h){
  drawBlock(svg,x,y,w,h);
  var ic=ICONS[type];
  if (!ic){
    var t=el("text",{ x:x+w/2,y:y+h/2,"text-anchor":"middle",
      "dominant-baseline":"central","font-size":8,fill:"var(--muted)" });
    t.textContent = FAC_LABEL[type] || "?";
    svg.appendChild(t); return;
  }
  var bx=ic.box?ic.box[0]:0, by=ic.box?ic.box[1]:0;
  var bw=ic.box?ic.box[2]:ic.w, bh=ic.box?ic.box[3]:ic.h;
  var pad=3, s=Math.min((w-pad*2)/bw, (h-pad*2)/bh);
  var g=el("g",{ transform:"translate("+(x+(w-bw*s)/2-bx*s)+","+(y+(h-bh*s)/2-by*s)+") scale("+s+")" });
  g.innerHTML = ic.svg;
  svg.appendChild(g);
}

/* A free-standing stool - no facility block. The icon's back arc is on the left
   (facing right at angle 0), so it turns by BACK_ANGLE like a seat back (D47). */
function drawChair(svg,x,y,w,h,facing){
  var ic=ICONS.chair, f=FACING.indexOf(facing)!==-1 ? facing : CHAIR_DEFAULT_FACING;
  var s=Math.min(w/ic.w, h/ic.h), cx=x+w/2, cy=y+h/2;
  var g=el("g",{ transform:"rotate("+BACK_ANGLE[f]+" "+cx+" "+cy+") translate("
    +(cx-ic.w*s/2)+","+(cy-ic.h*s/2)+") scale("+s+")" });
  g.innerHTML = ic.svg;
  svg.appendChild(g);
}

function drawSeat(svg, scheme, it, x, y, w, h, state){
  var id=String(it.seat);
  var known=KINDS.indexOf(it.kind)!==-1;
  var st=seatState(it, state), tappable=seatTappable(it, state);
  var fill="var(--navy)", stroke="none", sw=0, tf="#fff", backFill="var(--navy)";
  if (st==="unknown"){ fill="#E3E4E7"; stroke="#C7CAD1"; sw=1; tf="var(--off-text)"; backFill="#C7CAD1"; }
  else if (st==="selected"){ fill="var(--seat-selected)"; backFill="var(--seat-selected)"; }
  else if (st==="unavailable"){ fill="var(--off)"; stroke="var(--border-firm)"; sw=1; tf="var(--off-text)"; backFill="var(--border-firm)"; }
  else if (it.inclusive){ fill="#fff"; stroke="var(--navy)"; sw=2; tf="var(--navy)"; }

  var refused = state.mode==="select" && !tappable;
  var g=el("g",{ "class":"seat"+(tappable?" tap":"")+(refused?" dis":"") });
  if (state.showBack && it.kind==="sit" && FACING.indexOf(it.facing)!==-1){
    var k=w/BACK.seatSize, cx=x+w/2, cy=y+h/2;
    var tr="rotate("+BACK_ANGLE[it.facing]+" "+cx+" "+cy+") translate("
      +(x-BACK.seatX*k)+","+(y-BACK.seatY*k)+") scale("+k+")";
    g.appendChild(el("path",{ d:BACK.path, fill:backFill, opacity:0.5, transform:tr }));
  }
  if (it.kind==="sleep" && (it.berth==="upper"||it.berth==="lower")){
    var by2 = it.berth==="upper" ? y-T.barGap-T.barH : y+h+T.barGap;
    g.appendChild(el("rect",{ x:x+4,y:by2,width:w-8,height:T.barH,rx:1.5, fill:backFill }));
  }
  g.appendChild(el("rect",{ x:x,y:y,width:w,height:h,rx:4,
    fill:fill, stroke:stroke, "stroke-width":sw }));
  var t=el("text",{ x:x+w/2,y:y+h/2,"text-anchor":"middle","dominant-baseline":"central",
    "font-size":12,"font-weight":600,fill:tf });
  t.textContent = known ? id : "?";
  g.appendChild(t);

  var bits=[id];
  if (it.kind==="sleep") bits.push(it.berth);
  if (it.inclusive) bits.push("inclusive");
  if (st!=="unknown") bits.push(st);
  g.setAttribute("aria-label", bits.join(", "));

  if (tappable && state.onSeatClick){
    g.setAttribute("role","button");
    g.addEventListener("click", function(){ state.onSeatClick(id); });
  }
  svg.appendChild(g);
}

function previewItem(it, size, stateOverride){
  var pad=9, sp=itemSpan(it);
  var w = it.type==="separator" ? T.sepW*2 : size;
  var h = size*sp.rows + (sp.rows-1)*(T.rowPitch-T.seat)*(size/T.seat);
  var svg=el("svg",{ width:w+pad*2, height:h+pad*2, viewBox:"0 0 "+(w+pad*2)+" "+(h+pad*2) });
  var scheme={ key:"preview" }, state={ mode:"view", showBack:true };
  if (stateOverride) for (var k in stateOverride) state[k]=stateOverride[k];
  if (it.seat!=null) drawSeat(svg, scheme, it, pad, pad, w, h, state);
  else if (it.type==="separator") drawSeparator(svg, pad, pad, w, h);
  else if (it.type==="half_table") drawHalfTable(svg, pad, pad, w, h, it.facing);
  else if (it.type==="table") drawBlock(svg, pad, pad, w, h);
  else if (it.type==="chair") drawChair(svg, pad, pad, w, h, it.facing);
  else if (it.type) drawFacility(svg, it.type, pad, pad, w, h);
  else drawBlock(svg, pad, pad, w, h, "?");
  return svg;
}

function describeItem(it){
  if (it.seat!=null){
    var bits=["Seat "+it.seat];
    if (it.kind==="sleep") bits.push((it.berth||"?")+" berth");
    else if (it.kind==="luxury") bits.push("luxury");
    else if (it.kind==="sit") bits.push(it.facing||"?");
    else bits.push("unknown kind \""+it.kind+"\"");
    if (it.inclusive) bits.push("inclusive");
    return bits.join(" · ");
  }
  if (it.type==="separator") return "Separator";
  if (it.type==="table") return "Table";
  if (it.type==="half_table") return "Half-table · facing "+(it.facing||"?");
  if (it.type==="chair") return "Chair · facing "+(it.facing||CHAIR_DEFAULT_FACING);
  if (it.type) return FAC_LABEL[it.type] || ("Unknown type \""+it.type+"\"");
  return "Item with no type";
}

function countSeats(s){
  var n=0;
  (s.decks||[]).forEach(function(d){ (d.columns||[]).forEach(function(c){
    (c.items||[]).forEach(function(i){ if (i.seat!=null) n++; }); }); });
  return n;
}

