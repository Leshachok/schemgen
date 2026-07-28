/* Live-rendered reference galleries for the Docs tab - built with render.js's
   own previewItem() (the same tight single-item renderer the Builder uses for
   its palette/drag-ghost previews), so these can never drift out of sync with
   the actual renderer. Hand-written, not generated. */
"use strict";

/** previewItem()'s own preview scheme key is a fixed "preview" (see render.js) -
    mirrored here so the hash search lines up with what it'll actually compute. */
var DOCS_PREVIEW_KEY = "preview";

function docsSwatch(caption, item, size, stateOverride){
  var wrap = document.createElement("div");
  wrap.className = "docs-swatch";
  var stage = document.createElement("div");
  stage.className = "docs-swatch-stage";
  stage.appendChild(previewItem(item, size, stateOverride));
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

/** A seat id guaranteed to hash to "unavailable" (allAvail:false) under
    previewItem()'s fixed scheme key, found at render time rather than
    hardcoded so it stays correct even if format.js's hash() ever changes. */
function findUnavailableSeatId(){
  for (var i=1;i<=40;i++){
    var id=String(i);
    if (!isAvailable(DOCS_PREVIEW_KEY, id, false)) return id;
  }
  return "1";
}

var SWATCH_SIZE = 40;

function buildSeatGallery(){
  var root = document.createElement("div");

  var kindsH = document.createElement("h4"); kindsH.textContent="Kinds";
  root.appendChild(kindsH);
  var kinds = docsGalleryRow();
  kinds.appendChild(docsSwatch("sit", {seat:"1",kind:"sit",facing:"top"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("sleep · lower", {seat:"1",kind:"sleep",berth:"lower"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("sleep · upper", {seat:"1",kind:"sleep",berth:"upper"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("luxury", {seat:"1",kind:"luxury",span:{rows:2}}, SWATCH_SIZE));
  root.appendChild(kinds);

  var statesH = document.createElement("h4"); statesH.textContent="States";
  root.appendChild(statesH);
  var states = docsGalleryRow();
  states.appendChild(docsSwatch("available", {seat:"1",kind:"sit",facing:"top"}, SWATCH_SIZE));
  states.appendChild(docsSwatch("unavailable", {seat:findUnavailableSeatId(),kind:"sit",facing:"top"}, SWATCH_SIZE,
    {allAvail:false}));
  states.appendChild(docsSwatch("selected", {seat:"sel",kind:"sit",facing:"top"}, SWATCH_SIZE,
    {selected:new Set(["sel"]), draw:function(){}}));
  states.appendChild(docsSwatch("inclusive", {seat:"1",kind:"sleep",berth:"lower",inclusive:true}, SWATCH_SIZE));
  states.appendChild(docsSwatch("unknown kind", {seat:"1",kind:"???"}, SWATCH_SIZE));
  root.appendChild(states);

  var sizesH = document.createElement("h4"); sizesH.textContent="Sizes";
  root.appendChild(sizesH);
  var sizes = docsGalleryRow();
  sizes.appendChild(docsSwatch("sit / sleep — 1 row (default)", {seat:"1",kind:"sit",facing:"top"}, SWATCH_SIZE));
  sizes.appendChild(docsSwatch("luxury — 2 rows (default)", {seat:"1",kind:"luxury",span:{rows:2}}, SWATCH_SIZE));
  root.appendChild(sizes);

  return root;
}

function buildFacilityGallery(){
  var root = document.createElement("div");
  var row = docsGalleryRow();
  FACILITIES.forEach(function(type){
    row.appendChild(docsSwatch(FAC_LABEL[type]||type, {type:type}, SWATCH_SIZE));
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
