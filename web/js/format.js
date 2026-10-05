/* Canonical format vocabulary + layout math + structural validation.
   This is the file every other renderer (Compose, SwiftUI, ...) must agree with -
   see /shared-fixtures and /docs/wagon-scheme-format.md. */
"use strict";

var KINDS = ["sit","sleep","luxury"];
var BERTHS = ["lower","middle","upper"];
var FACING = ["left","right","top","bottom"];
var LEVELS = ["lower","upper"];
var VEHICLES = ["train","bus"];
/* facility names follow the Android sales app's drawables (D47) */
var FACILITIES = ["toilet","invalid_toilet","baggage","bike","handicapped","handicapped_wheelchair",
                  "shield","steps_up","steps_down","wardrobe","cafe","coffee_machine","chair",
                  "kid","driver"];
var STRUCTURAL_TYPES = ["table","half_table","separator"];
var KNOWN_TYPES = FACILITIES.concat(STRUCTURAL_TYPES);
var FAC_LABEL = { toilet:"Toilet", invalid_toilet:"Toilet+", baggage:"Baggage", bike:"Bike",
  handicapped:"Handicapped", handicapped_wheelchair:"Wheelchair", shield:"Shield",
  steps_up:"Steps up", steps_down:"Steps down", wardrobe:"Wardrobe", cafe:"Cafe",
  coffee_machine:"Coffee machine", chair:"Chair", kid:"Kid", driver:"Driver" };
/* items that always occupy exactly one cell, whatever span says */
var ONE_CELL_TYPES = ["driver","chair"];
/* chair's facing when omitted - it rotates like a seat back, see BACK_ANGLE (D47) */
var CHAIR_DEFAULT_FACING = "right";

function rowY(deck,row){ return T.padY + (row-1)*T.rowPitch; }
/* only these may be several columns wide (D48): seats, separators, half-tables and
   one-cell items stay one column, whatever span.cols says */
function canSpanCols(it){
  return it.seat==null && it.type!=="separator" && it.type!=="half_table"
    && ONE_CELL_TYPES.indexOf(it.type)===-1;
}
function itemSpan(it){
  if (ONE_CELL_TYPES.indexOf(it.type)!==-1) return { rows:1, cols:1 };
  var s=it.span||{};
  return { rows:s.rows||1, cols:canSpanCols(it) ? s.cols||1 : 1 };
}
function itemWidth(it){
  return it.type==="separator" ? T.sepW : T.seat;
}
/* a column holding nothing of its own but covered by a wide item is as wide as a
   seat, not a gap - otherwise the item would squash it */
function colWidth(col, covered){
  var items=col.items||[];
  if (!items.length) return covered ? T.seat : T.gapW;
  var w=covered ? T.seat : 0;
  items.forEach(function(it){ w=Math.max(w, itemWidth(it)); });
  return w;
}
function layout(deck){
  var x=T.padX, out=[], cols=deck.columns||[], covered={};
  cols.forEach(function(col,i){
    (col.items||[]).forEach(function(it){
      for (var c=1;c<itemSpan(it).cols;c++) covered[i+c]=1; });
  });
  cols.forEach(function(col,i){
    var w=colWidth(col, covered[i]);
    out.push({ col:col, index:i, x:x, w:w });
    x += w + T.colGap;
  });
  var rows=deck.rows||1;
  return { cols:out, width:Math.max(x-T.colGap+T.padX,140),
           height:rowY(deck,rows)+T.seat+T.padY };
}
/* where an item placed in column pc lands; rows and columns past the deck's edge
   are clipped. Drawing and hit-testing both use this. */
function itemBox(deck, L, pc, it){
  var sp=itemSpan(it), row=it.row||1;
  var y=rowY(deck,row);
  var yEnd=rowY(deck, Math.min(row+sp.rows-1, deck.rows||1));
  var h=yEnd+T.seat-y;
  if (sp.cols>1){
    var last=L.cols[Math.min(pc.index+sp.cols-1, L.cols.length-1)];
    return { x:pc.x, y:y, w:last.x+last.w-pc.x, h:h };
  }
  var w=itemWidth(it);
  return { x:pc.x+(pc.w-w)/2, y:y, w:w, h:h };
}

/* ---------- validation ---------- */
function validate(scheme){
  var msgs=[];
  if (!scheme || !Array.isArray(scheme.decks) || !scheme.decks.length)
    return [{level:"e", text:"No decks in scheme."}];
  if (scheme.vehicle!=null && VEHICLES.indexOf(scheme.vehicle)===-1)
    msgs.push({level:"w", text:"unknown vehicle \""+scheme.vehicle+"\" — treated as train."});
  var multi=scheme.decks.length>1, levelsSeen={};
  scheme.decks.forEach(function(deck, di){
    if (deck.level!=null && LEVELS.indexOf(deck.level)===-1)
      msgs.push({level:"w", text:"deck "+di+": unknown level \""+deck.level+"\"."});
    if (multi && deck.level==null)
      msgs.push({level:"e", text:"deck "+di+": level is required when a scheme has several decks."});
    if (deck.level!=null){
      if (levelsSeen[deck.level]) msgs.push({level:"e", text:"two decks with level \""+deck.level+"\"."});
      levelsSeen[deck.level]=1;
    }
    var seen={}, cells={}, maxRow=deck.rows||1, maxCol=(deck.columns||[]).length;
    (deck.columns||[]).forEach(function(col,ci){
      (col.items||[]).forEach(function(it){
        var sp=itemSpan(it), row=it.row||1;
        if (row+sp.rows-1 > maxRow)
          msgs.push({level:"e", text:"col "+ci+": item at row "+row+" spans "+sp.rows+" rows, past rows="+maxRow+"."});
        if (ci+sp.cols > maxCol)
          msgs.push({level:"e", text:"col "+ci+": item at row "+row+" spans "+sp.cols+" columns, past the last column."});
        if (it.span && it.span.cols!=null && it.span.cols!==1 && !canSpanCols(it)
            && ONE_CELL_TYPES.indexOf(it.type)===-1)
          msgs.push({level:"w", text:"col "+ci+": "+(it.seat!=null ? "seat "+it.seat : it.type)
            +" is always one column wide — span.cols ignored."});
        for (var c=ci;c<Math.min(ci+sp.cols,maxCol);c++)
          for (var r=row;r<row+sp.rows;r++){
            var k=c+":"+r;
            if (cells[k]) msgs.push({level:"e", text:"col "+c+" row "+r+": two items in one cell."});
            cells[k]=1;
          }
        if (it.seat!=null){
          var id=String(it.seat);
          if (seen[id]) msgs.push({level:"e", text:"duplicate seat number \""+id+"\"."});
          seen[id]=1;
          if (KINDS.indexOf(it.kind)===-1)
            msgs.push({level:"w", text:"seat "+id+": unknown kind \""+it.kind+"\" — drawn as placeholder."});
          if (it.kind==="sleep" && BERTHS.indexOf(it.berth)===-1)
            msgs.push({level:"e", text:"seat "+id+": kind=sleep needs berth."});
          if (it.kind!=="sleep" && it.berth!=null)
            msgs.push({level:"e", text:"seat "+id+": berth only valid on kind=sleep."});
          if (it.facing!=null && FACING.indexOf(it.facing)===-1)
            msgs.push({level:"w", text:"seat "+id+": unknown facing \""+it.facing+"\"."});
        } else {
          if (it.type==null) msgs.push({level:"w", text:"col "+ci+": item has no type — drawn as placeholder."});
          else if (KNOWN_TYPES.indexOf(it.type)===-1)
            msgs.push({level:"w", text:"unknown type \""+it.type+"\" — drawn as placeholder."});
          if (it.type==="chair" && it.facing!=null && FACING.indexOf(it.facing)===-1)
            msgs.push({level:"w", text:"col "+ci+": chair has unknown facing \""+it.facing+"\"."});
          if (ONE_CELL_TYPES.indexOf(it.type)!==-1 && it.span!=null)
            msgs.push({level:"w", text:"col "+ci+": "+it.type+" is always one cell — span ignored."});
        }
      });
    });
  });
  if (!msgs.length) msgs.push({level:"ok", text:"No structural problems. "+countSeats(scheme)+" seats."});
  return msgs;
}

/* ---------- renderer contract: interaction modes ----------
   Runtime input to every renderer, never part of the scheme (D4, D45):
     mode        "view"   - every known seat looks available, nothing is tappable
                 "select" - only seats in `available` are available and tappable
     available   Set of seat numbers   (select only)
     selected    Set of seat numbers   (select only; owned by the app, D46)
     onSeatClick function(seatNumber)  (select only; the renderer never changes
                 `selected` itself - the app does, then re-renders)            */
var MODES = ["view","select"];

/* "unknown" | "available" | "unavailable" | "selected" - one rule for every renderer */
function seatState(it, opts){
  if (KINDS.indexOf(it.kind)===-1) return "unknown";
  if (!opts || opts.mode!=="select") return "available";
  var id=String(it.seat);
  if (!opts.available || !opts.available.has(id)) return "unavailable";
  return opts.selected && opts.selected.has(id) ? "selected" : "available";
}
function seatTappable(it, opts){
  var st=seatState(it, opts);
  return !!(opts && opts.mode==="select" && (st==="available" || st==="selected"));
}

