/* Canonical format vocabulary + layout math + structural validation.
   This is the file every other renderer (Compose, SwiftUI, ...) must agree with -
   see /shared-fixtures and /docs/wagon-scheme-format.md. */
"use strict";

var KINDS = ["sit","sleep","luxury"];
var BERTHS = ["lower","middle","upper"];
var FACING = ["left","right","top","bottom"];
var LEVELS = ["lower","upper"];
var FACILITIES = ["wc","wc_accessible","luggage","bicycle","inclusive","inclusive_marker",
                  "electrical","kid","stairs_up","stairs_down"];
var STRUCTURAL_TYPES = ["table","half_table","separator"];
var KNOWN_TYPES = FACILITIES.concat(STRUCTURAL_TYPES);
var FAC_LABEL = { wc:"WC", wc_accessible:"WC+", luggage:"Baggage", bicycle:"Bicycle",
  inclusive:"Inclusive", inclusive_marker:"Marker", electrical:"Electric", kid:"Kid",
  stairs_up:"Up", stairs_down:"Down" };

function rowY(deck,row){ return T.padY + (row-1)*T.rowPitch; }
function itemSpan(it){ var s=it.span||{}; return { rows:s.rows||1 }; }
function itemWidth(it){
  return it.type==="separator" ? T.sepW : T.seat;
}
function colWidth(col){
  var items=col.items||[];
  if (!items.length) return T.gapW;
  var w=0;
  items.forEach(function(it){ w=Math.max(w, itemWidth(it)); });
  return w;
}
function layout(deck){
  var x=T.padX, out=[];
  (deck.columns||[]).forEach(function(col,i){
    var w=colWidth(col);
    out.push({ col:col, index:i, x:x, w:w });
    x += w + T.colGap;
  });
  var rows=deck.rows||1;
  return { cols:out, width:Math.max(x-T.colGap+T.padX,140),
           height:rowY(deck,rows)+T.seat+T.padY };
}

/* ---------- validation ---------- */
function validate(scheme){
  var msgs=[];
  if (!scheme || !Array.isArray(scheme.decks) || !scheme.decks.length)
    return [{level:"e", text:"No decks in scheme."}];
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
    var seen={}, cells={}, maxRow=deck.rows||1;
    (deck.columns||[]).forEach(function(col,ci){
      (col.items||[]).forEach(function(it){
        var sp=itemSpan(it), row=it.row||1;
        if (row+sp.rows-1 > maxRow)
          msgs.push({level:"e", text:"col "+ci+": item at row "+row+" spans "+sp.rows+" rows, past rows="+maxRow+"."});
        for (var r=row;r<row+sp.rows;r++){
          var k=ci+":"+r;
          if (cells[k]) msgs.push({level:"e", text:"col "+ci+" row "+r+": two items in one cell."});
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
        }
      });
    });
  });
  if (!msgs.length) msgs.push({level:"ok", text:"No structural problems. "+countSeats(scheme)+" seats."});
  return msgs;
}

function hash(s){ var h=0; for (var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return Math.abs(h); }
function isAvailable(key,id,all){ return all ? true : hash(key+"/"+id)%10 > 2; }

