/* Canonical format vocabulary + layout math + structural validation.
   This is the file every other renderer (Compose, SwiftUI, ...) must agree with -
   see /shared-fixtures and /docs/wagon-scheme-format.md. */
"use strict";

var KINDS = ["sit","folding","sleep","luxury"];
/* kinds drawn as a seat body with a back bracket, turned by `facing` */
var FACING_KINDS = ["sit","folding"];
var BERTHS = ["lower","middle","upper"];
var FACING = ["left","right","top","bottom"];
var LEVELS = ["lower","upper"];
var VEHICLES = ["train","bus"];
/* the elements of the guidelines file "Wagon components" (D50), named after the
   Android sales app's drawables (D47) */
var FACILITIES = ["toilet","invalid_toilet","baggage","bike","handicapped","handicapped_wheelchair",
                  "shield","steps_up","steps_down","wardrobe","cafe","coffee_machine",
                  "kid","driver"];
var STRUCTURAL_TYPES = ["table","small_table","separator"];
var KNOWN_TYPES = FACILITIES.concat(STRUCTURAL_TYPES);
/* drawn as their own art with no facility block behind it */
var BARE_TYPES = ["steps_up","steps_down","handicapped_wheelchair"];
var FAC_LABEL = { toilet:"Toilet", invalid_toilet:"Toilet+", baggage:"Baggage", bike:"Bike",
  handicapped:"Handicapped", handicapped_wheelchair:"Wheelchair", shield:"Shield",
  steps_up:"Steps up", steps_down:"Steps down", wardrobe:"Wardrobe", cafe:"Cafe",
  coffee_machine:"Coffee machine", kid:"Kid", driver:"Driver" };
/* the guidelines' minimum heights in rows (D51): a facility block is 104 px, two
   rows plus its overhang. Everything else may be a single row. */
var MIN_ROWS = { toilet:2, invalid_toilet:2, baggage:2, bike:2, handicapped:2, shield:2,
  wardrobe:2, cafe:2, coffee_machine:2, kid:2 };

function rowY(deck,row){ return T.padY + (row-1)*T.rowPitch; }
/* seats are one column wide (D48); a partition only grows in length (D51) */
function canSpanCols(it){
  return it.seat==null && it.type!=="separator";
}
function minRows(it){ return it.seat==null && MIN_ROWS[it.type] || 1; }
function itemSpan(it){
  var s=it.span||{};
  return { rows:s.rows||1, cols:canSpanCols(it) ? s.cols||1 : 1 };
}
function itemWidth(it){
  return it.seat==null && ITEM_W[it.type] || T.seat;
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
  var x=T.padX, out=[], cols=deck.columns||[], covered={}, occupied={};
  cols.forEach(function(col,i){
    (col.items||[]).forEach(function(it){
      var sp=itemSpan(it), row=it.row||1;
      for (var c=0;c<sp.cols;c++){
        if (c>0) covered[i+c]=1;
        for (var r=row;r<row+sp.rows;r++) occupied[(i+c)+":"+r]=1;
      }
    });
  });
  cols.forEach(function(col,i){
    var w=colWidth(col, covered[i]);
    out.push({ col:col, index:i, x:x, w:w });
    x += w + T.colGap;
  });
  var rows=deck.rows||1;
  return { cols:out, occupied:occupied, width:Math.max(x-T.colGap+T.padX,140),
           height:rowY(deck,rows)+T.seatH+T.padY };
}
/* A facility reaches T.overhang past its first and last row, as the guidelines draw
   it (two rows + 2 x 8 = the 104 px block), but only into a row gap with nothing
   on the other side - two stacked blocks would otherwise overlap (D51). */
function overhangs(L, ci, it){
  if (it.seat!=null || FACILITIES.indexOf(it.type)===-1) return { top:0, bottom:0 };
  var sp=itemSpan(it), row=it.row||1, top=T.overhang, bottom=T.overhang;
  for (var c=ci;c<ci+sp.cols;c++){
    if (L.occupied[c+":"+(row-1)]) top=0;
    if (L.occupied[c+":"+(row+sp.rows)]) bottom=0;
  }
  return { top:top, bottom:bottom };
}
/* where an item placed in column pc lands; rows and columns past the deck's edge
   are clipped. Drawing and hit-testing both use this. */
function itemBox(deck, L, pc, it){
  var sp=itemSpan(it), row=it.row||1, oh=overhangs(L, pc.index, it);
  var y=rowY(deck,row);
  var yEnd=rowY(deck, Math.min(row+sp.rows-1, deck.rows||1));
  var h=yEnd+T.seatH-y+oh.top+oh.bottom;
  y-=oh.top;
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
        if (it.span && it.span.cols!=null && it.span.cols!==1 && !canSpanCols(it))
          msgs.push({level:"w", text:"col "+ci+": "+(it.seat!=null ? "seat "+it.seat : it.type)
            +" is always one column wide — span.cols ignored."});
        if (sp.rows<minRows(it))
          msgs.push({level:"w", text:"col "+ci+": "+it.type+" is at least "+minRows(it)
            +" rows tall in the guidelines — it spans "+sp.rows+"."});
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
          if (it.type==="small_table" && it.facing!=null && it.facing!=="top" && it.facing!=="bottom")
            msgs.push({level:"w", text:"col "+ci+": small_table facing must be top or bottom."});
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

