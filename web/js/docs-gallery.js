/* Live-rendered reference galleries for the Docs tab - built with the same
   render() used by Catalogue/Builder, so these previews can never drift out
   of sync with the actual renderer. Hand-written, not generated. */
"use strict";

function demoScheme(item, rows){
  return { key:"docs-demo", rev:1, class:"demo", hull:"plain",
    decks:[{ id:"d", rows: rows||1, columns:[{ items:[item] }] }] };
}

function docsSwatch(caption, scheme, state){
  var wrap = document.createElement("div");
  wrap.className = "docs-swatch";
  var stage = document.createElement("div");
  stage.className = "docs-swatch-stage";
  stage.appendChild(render(scheme, state));
  wrap.appendChild(stage);
  var label = document.createElement("div");
  label.className = "docs-swatch-label";
  label.textContent = caption;
  wrap.appendChild(label);
  return wrap;
}

function docsGalleryRow(){
  var row = document.createElement("div");
  row.className = "docs-gallery";
  return row;
}

/** A seat id/key pair guaranteed to hash to "unavailable" (allAvail:false),
    found at render time rather than hardcoded so it stays correct even if
    format.js's hash() ever changes. */
function findUnavailableSeatId(){
  for (var i=1;i<=40;i++){
    var id=String(i);
    if (!isAvailable("docs-demo", id, false)) return id;
  }
  return "1";
}

function buildSeatGallery(){
  var root = document.createElement("div");

  var kindsH = document.createElement("h4"); kindsH.textContent="Kinds";
  root.appendChild(kindsH);
  var kinds = docsGalleryRow();
  kinds.appendChild(docsSwatch("sit", demoScheme({seat:"1",kind:"sit",facing:"top",row:1}),
    {selected:null, allAvail:true, showBack:true}));
  kinds.appendChild(docsSwatch("sleep · lower", demoScheme({seat:"1",kind:"sleep",berth:"lower",row:1}),
    {selected:null, allAvail:true, showBack:true}));
  kinds.appendChild(docsSwatch("sleep · upper", demoScheme({seat:"1",kind:"sleep",berth:"upper",row:1}),
    {selected:null, allAvail:true, showBack:true}));
  kinds.appendChild(docsSwatch("luxury", demoScheme({seat:"1",kind:"luxury",row:1},2),
    {selected:null, allAvail:true, showBack:true}));
  root.appendChild(kinds);

  var statesH = document.createElement("h4"); statesH.textContent="States";
  root.appendChild(statesH);
  var states = docsGalleryRow();
  states.appendChild(docsSwatch("available", demoScheme({seat:"1",kind:"sit",facing:"top",row:1}),
    {selected:null, allAvail:true, showBack:true}));
  states.appendChild(docsSwatch("unavailable", demoScheme({seat:findUnavailableSeatId(),kind:"sit",facing:"top",row:1}),
    {selected:null, allAvail:false, showBack:true}));
  states.appendChild(docsSwatch("selected", demoScheme({seat:"sel",kind:"sit",facing:"top",row:1}),
    {selected:new Set(["sel"]), allAvail:true, showBack:true, draw:function(){}}));
  states.appendChild(docsSwatch("inclusive", demoScheme({seat:"1",kind:"sleep",berth:"lower",inclusive:true,row:1}),
    {selected:null, allAvail:true, showBack:true}));
  states.appendChild(docsSwatch("unknown kind", demoScheme({seat:"1",kind:"???",row:1}),
    {selected:null, allAvail:true, showBack:true}));
  root.appendChild(states);

  var sizesH = document.createElement("h4"); sizesH.textContent="Sizes";
  root.appendChild(sizesH);
  var sizes = docsGalleryRow();
  sizes.appendChild(docsSwatch("sit / sleep — 1 row (default)", demoScheme({seat:"1",kind:"sit",facing:"top",row:1},2),
    {selected:null, allAvail:true, showBack:true}));
  sizes.appendChild(docsSwatch("luxury — 2 rows (default)", demoScheme({seat:"1",kind:"luxury",row:1},2),
    {selected:null, allAvail:true, showBack:true}));
  root.appendChild(sizes);

  return root;
}

function buildFacilityGallery(){
  var root = document.createElement("div");
  var row = docsGalleryRow();
  FACILITIES.forEach(function(type){
    row.appendChild(docsSwatch(FAC_LABEL[type]||type, demoScheme({type:type,row:1}),
      {selected:null, allAvail:true, showBack:true}));
  });
  root.appendChild(row);
  return root;
}

/** Inserts `node` right after `headingText`'s heading (and its intro
    paragraph, if the markdown put one directly under the heading). */
function insertGalleryAfterHeading(root, headingText, node){
  var headings = root.querySelectorAll("h2,h3");
  for (var i=0;i<headings.length;i++){
    if (headings[i].textContent.trim()===headingText){
      var anchor = headings[i].nextElementSibling;
      var ref = (anchor && anchor.tagName==="P") ? anchor : headings[i];
      ref.parentNode.insertBefore(node, ref.nextSibling);
      return;
    }
  }
}

function renderDocsGuide(){
  var body = document.getElementById("docsBody");
  body.innerHTML = mdRender(DOCS_GUIDE_MARKDOWN);
  insertGalleryAfterHeading(body, "Seat kinds & states", buildSeatGallery());
  insertGalleryAfterHeading(body, "Facilities", buildFacilityGallery());

  var details = document.createElement("details");
  details.className = "docs-rationale";
  var summary = document.createElement("summary");
  summary.textContent = "Design rationale & roadmap (full spec)";
  details.appendChild(summary);
  var rationaleBody = document.createElement("div");
  rationaleBody.innerHTML = mdRender(DOCS_MARKDOWN);
  details.appendChild(rationaleBody);
  body.appendChild(details);
}
