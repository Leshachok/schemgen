/* SVG rendering: turns a scheme + item into DOM nodes. Colours are the --s-* custom
   properties of the .sch / .sch-dark classes in css/app.css (D34, D50). */
"use strict";

var NS="http://www.w3.org/2000/svg";
function el(n,a){ var e=document.createElementNS(NS,n);
  for (var k in a) if (a[k]!=null) e.setAttribute(k,a[k]); return e; }
function themeClass(state){ return "sch"+(state && state.theme==="dark" ? " sch-dark" : ""); }

function render(scheme, state){
  var frag=document.createDocumentFragment();
  (scheme.decks||[]).forEach(function(deck){
    var L=layout(deck);
    var svg=el("svg",{ width:L.width, height:L.height, "class":themeClass(state),
      viewBox:"0 0 "+L.width+" "+L.height, role:"group",
      "aria-label":(scheme.vehicle==="bus"?"Bus ":"Wagon ")+(scheme.key||"")+(deck.level?", "+deck.level+" deck":"") });
    svg.appendChild(el("rect",{ x:2,y:2,width:L.width-4,height:L.height-4,
      rx:12, fill:"var(--s-body)", stroke:"var(--s-body-line)" }));
    if (state.showGrid){
      for (var r=1;r<=(deck.rows||1);r++){
        var gy=rowY(deck,r)+T.seatH/2;
        svg.appendChild(el("line",{ x1:6,x2:L.width-6,y1:gy,y2:gy,
          stroke:"var(--s-line)","stroke-dasharray":"2 4" }));
      }
    }
    L.cols.forEach(function(pc){
      (pc.col.items||[]).forEach(function(it){
        var b=itemBox(deck, L, pc, it);
        drawItem(svg, scheme, it, b.x, b.y, b.w, b.h, state);
      });
    });
    frag.appendChild(svg);
  });
  return frag;
}

function drawItem(svg, scheme, it, x, y, w, h, state){
  if (it.seat!=null) drawSeat(svg, scheme, it, x, y, w, h, state);
  else if (it.type==="separator") drawSeparator(svg, x, y, w, h);
  else if (it.type==="small_table") drawSmallTable(svg, x, y, w, h, it.facing);
  else if (it.type==="table") drawTable(svg, x, y, w, h);
  else if (it.type) drawFacility(svg, it.type, x, y, w, h);
  else drawBlock(svg, x, y, w, h, "?");
}

function drawBlock(svg,x,y,w,h,label){
  svg.appendChild(el("rect",{ x:x,y:y,width:w,height:h,rx:T.radius, fill:"var(--s-block)" }));
  if (label){
    var t=el("text",{ x:x+w/2,y:y+h/2,"text-anchor":"middle",
      "dominant-baseline":"central","font-size":9,fill:"var(--s-icon)" });
    t.textContent=label; svg.appendChild(t);
  }
}
/* tables carry a 2px outline drawn inside their box, as in the guidelines */
function drawTable(svg,x,y,w,h){
  svg.appendChild(el("rect",{ x:x+1,y:y+1,width:w-2,height:h-2,rx:T.radius,
    fill:"var(--s-block)", stroke:"var(--s-line)", "stroke-width":2 }));
}
function drawSmallTable(svg,x,y,w,h,facing){
  var hh=h/2;
  drawTable(svg, x, facing==="bottom" ? y+h-hh : y, w, hh);
}
/* a partition reaches T.overhang past its rows, like the guidelines' 55 px single-row one */
function drawSeparator(svg,x,y,w,h){
  svg.appendChild(el("rect",{ x:x+w/2-1, y:y-T.overhang, width:2, height:h+T.overhang*2,
    rx:1, fill:"var(--s-line)" }));
}
/* icons are drawn at their own size and never scaled (D51) */
function drawIcon(svg, ic, x, y, w, h, colour){
  var g=el("g",{ transform:"translate("+(x+(w-ic.w)/2)+","+(y+(h-ic.h)/2)+")",
    style:"color:"+colour });
  g.innerHTML = ic.svg;
  svg.appendChild(g);
}
function drawFacility(svg,type,x,y,w,h){
  var ic=ICONS[type], bare=BARE_TYPES.indexOf(type)!==-1;
  if (!bare) drawBlock(svg,x,y,w,h);
  if (!ic){
    if (bare) drawBlock(svg,x,y,w,h);
    var t=el("text",{ x:x+w/2,y:y+h/2,"text-anchor":"middle",
      "dominant-baseline":"central","font-size":8,fill:"var(--s-icon)" });
    t.textContent = FAC_LABEL[type] || "?";
    svg.appendChild(t); return;
  }
  drawIcon(svg, ic, x, y, w, h,
    type==="handicapped_wheelchair" ? "var(--s-marker)" : bare ? "var(--s-line)" : "var(--s-icon)");
}

function drawSeat(svg, scheme, it, x, y, w, h, state){
  var id=String(it.seat);
  var known=KINDS.indexOf(it.kind)!==-1;
  var st=seatState(it, state), tappable=seatTappable(it, state);
  var c = st==="unknown" ? "var(--s-unknown)" : st==="selected" ? "var(--s-sel)"
        : st==="unavailable" ? "var(--s-off)" : "var(--s-avail)";
  var tf = st==="unknown" || st==="unavailable" ? "var(--s-off-text)" : "var(--s-on-text)";
  var folding = it.kind==="folding" && st!=="unknown";

  var refused = state.mode==="select" && !tappable;
  var g=el("g",{ "class":"seat"+(tappable?" tap":"")+(refused?" dis":"") });
  var body={ x:x, y:y, w:w, h:h };
  if (FACING_KINDS.indexOf(it.kind)!==-1){
    body={ x:x+(w-T.square)/2, y:y+(h-T.square)/2, w:T.square, h:T.square };
    if (state.showBack && FACING.indexOf(it.facing)!==-1){
      var k=T.square/BACK.seatSize, cx=body.x+body.w/2, cy=body.y+body.h/2;
      g.appendChild(el("path",{ d:BACK.path, fill:c, transform:"rotate("+BACK_ANGLE[it.facing]
        +" "+cx+" "+cy+") translate("+(body.x-BACK.seatX*k)+","+(body.y-BACK.seatY*k)+") scale("+k+")" }));
    }
  } else if (it.kind==="sleep" && (it.berth==="upper"||it.berth==="lower")){
    var bar=T.barH+T.barGap, upper=it.berth==="upper";
    g.appendChild(el("rect",{ x:x, y:upper ? y : y+h-T.barH, width:w, height:T.barH,
      rx:T.barH/2, fill:c }));
    body={ x:x, y:upper ? y+bar : y, w:w, h:h-bar };
  }
  if (folding){
    g.appendChild(el("rect",{ x:body.x+1,y:body.y+1,width:body.w-2,height:body.h-2,rx:T.radius,
      fill:"var(--s-folding)", stroke:c, "stroke-width":2 }));
    if (st!=="unavailable") tf=c;
  } else {
    g.appendChild(el("rect",{ x:body.x,y:body.y,width:body.w,height:body.h,rx:T.radius, fill:c }));
  }
  var t=el("text",{ x:body.x+body.w/2,y:body.y+body.h/2,"text-anchor":"middle","dominant-baseline":"central",
    "font-size":T.font,"font-weight":700,"font-family":"var(--s-font)",fill:tf });
  t.textContent = known ? id : "?";
  g.appendChild(t);

  var bits=[id];
  if (it.kind==="sleep") bits.push(it.berth);
  if (it.kind==="folding") bits.push("folding");
  if (st!=="unknown") bits.push(st);
  g.setAttribute("aria-label", bits.join(", "));

  if (tappable && state.onSeatClick){
    g.setAttribute("role","button");
    g.addEventListener("click", function(){ state.onSeatClick(id); });
  }
  svg.appendChild(g);
}

/* One item on its own, at its real proportions, scaled so a seat cell is `size` wide.
   Facilities get their overhang on both sides, as nothing is drawn around them. */
function previewItem(it, size, stateOverride){
  var pad=10, sp=itemSpan(it);
  var w = sp.cols>1 ? sp.cols*T.seat+(sp.cols-1)*T.colGap : itemWidth(it);
  var oh = it.seat==null && FACILITIES.indexOf(it.type)!==-1 ? T.overhang : 0;
  var h = T.seatH+(sp.rows-1)*T.rowPitch+oh*2;
  if (it.type==="separator") pad+=T.overhang;
  var k=size/T.seat, vw=w+pad*2, vh=h+pad*2;
  var state={ mode:"view", showBack:true };
  if (stateOverride) for (var key in stateOverride) state[key]=stateOverride[key];
  var svg=el("svg",{ width:vw*k, height:vh*k, viewBox:"0 0 "+vw+" "+vh, "class":themeClass(state) });
  if (state.theme==="dark") svg.appendChild(el("rect",{ width:vw, height:vh, rx:6, fill:"var(--s-body)" }));
  drawItem(svg, { key:"preview" }, it, pad, pad, w, h, state);
  return svg;
}

function describeItem(it){
  if (it.seat!=null){
    var bits=["Seat "+it.seat];
    if (it.kind==="sleep") bits.push((it.berth||"?")+" berth");
    else if (it.kind==="luxury") bits.push("luxury");
    else if (it.kind==="sit") bits.push(it.facing||"?");
    else if (it.kind==="folding") bits.push("folding", it.facing||"?");
    else bits.push("unknown kind \""+it.kind+"\"");
    return bits.join(" · ");
  }
  if (it.type==="separator") return "Separator";
  if (it.type==="table") return "Table";
  if (it.type==="small_table") return "Small table · facing "+(it.facing||"?");
  if (it.type) return FAC_LABEL[it.type] || ("Unknown type \""+it.type+"\"");
  return "Item with no type";
}

function countSeats(s){
  var n=0;
  (s.decks||[]).forEach(function(d){ (d.columns||[]).forEach(function(c){
    (c.items||[]).forEach(function(i){ if (i.seat!=null) n++; }); }); });
  return n;
}
