/* Small, dependency-free markdown renderer - just enough for
   docs/wagon-scheme-format.md's own subset of markdown (headers, tables, code
   fences, inline code/bold, lists, links, hr). Not a general-purpose parser. */
"use strict";

function mdInline(s){
  s = s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

function mdRender(src){
  var lines = src.replace(/\r\n/g,"\n").split("\n");
  var html = [], i = 0, n = lines.length;
  var listOpen = false;

  function closeList(){ if (listOpen){ html.push("</ul>"); listOpen=false; } }

  while (i < n){
    var line = lines[i];

    if (/^```/.test(line)){
      closeList();
      var code = [];
      i++;
      while (i < n && !/^```/.test(lines[i])){ code.push(lines[i]); i++; }
      i++;
      html.push("<pre><code>"+mdInline(code.join("\n")).replace(/<\/?strong>|<\/?code>/g,"")+"</code></pre>");
      continue;
    }

    if (/^\s*\|/.test(line)){
      closeList();
      var rows = [];
      while (i < n && /^\s*\|/.test(lines[i])){ rows.push(lines[i]); i++; }
      rows = rows.filter(function(r){ return !/^\s*\|[\s:|-]+\|\s*$/.test(r); });
      var tbl = ["<table>"];
      rows.forEach(function(r, ri){
        var cells = r.trim().replace(/^\||\|$/g,"").split("|").map(function(c){ return c.trim(); });
        var tag = ri===0 ? "th" : "td";
        tbl.push("<tr>" + cells.map(function(c){ return "<"+tag+">"+mdInline(c)+"</"+tag+">"; }).join("") + "</tr>");
      });
      tbl.push("</table>");
      html.push(tbl.join(""));
      continue;
    }

    var h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h){
      closeList();
      var lvl = h[1].length;
      html.push("<h"+lvl+">"+mdInline(h[2])+"</h"+lvl+">");
      i++; continue;
    }

    if (/^-{3,}\s*$/.test(line)){
      closeList();
      html.push("<hr>");
      i++; continue;
    }

    var li = line.match(/^\s*-\s+(.*)$/);
    if (li){
      if (!listOpen){ html.push("<ul>"); listOpen=true; }
      html.push("<li>"+mdInline(li[1])+"</li>");
      i++; continue;
    }
    closeList();

    if (line.trim()===""){ i++; continue; }

    var para = [line];
    i++;
    while (i < n && lines[i].trim()!=="" && !/^(#{1,4})\s|^```|^\s*\||^-{3,}\s*$|^\s*-\s/.test(lines[i])){
      para.push(lines[i]); i++;
    }
    html.push("<p>"+mdInline(para.join(" "))+"</p>");
  }
  closeList();
  return html.join("\n");
}
