/* Live-rendered reference galleries for the Docs tab - built with render.js's
   own previewItem() (the same tight single-item renderer the Builder uses for
   its palette/drag-ghost previews), so these can never drift out of sync with
   the actual renderer. Hand-written, not generated. */
"use strict";

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

var SWATCH_SIZE = 40;

function buildSeatGallery(){
  var root = document.createElement("div");

  var kindsH = document.createElement("h4"); kindsH.textContent="Kinds";
  root.appendChild(kindsH);
  var kinds = docsGalleryRow();
  kinds.appendChild(docsSwatch("sit", {seat:"1",kind:"sit",facing:"top"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("folding", {seat:"1",kind:"folding",facing:"top"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("sleep · middle", {seat:"1",kind:"sleep",berth:"middle"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("sleep · lower", {seat:"1",kind:"sleep",berth:"lower"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("sleep · upper", {seat:"1",kind:"sleep",berth:"upper"}, SWATCH_SIZE));
  kinds.appendChild(docsSwatch("luxury", {seat:"1",kind:"luxury",span:{rows:2}}, SWATCH_SIZE));
  root.appendChild(kinds);

  var statesH = document.createElement("h4"); statesH.textContent="States";
  root.appendChild(statesH);
  ["light","dark"].forEach(function(theme){
    var states = docsGalleryRow();
    [{seat:"1",kind:"sit",facing:"top"}, {seat:"1",kind:"folding",facing:"top"},
     {seat:"1",kind:"sleep",berth:"lower"}].forEach(function(it){
      states.appendChild(docsSwatch("available · "+theme, it, SWATCH_SIZE, {theme:theme}));
      states.appendChild(docsSwatch("unavailable", it, SWATCH_SIZE,
        {theme:theme, mode:"select", available:new Set()}));
      states.appendChild(docsSwatch("selected", it, SWATCH_SIZE,
        {theme:theme, mode:"select", available:new Set(["1"]), selected:new Set(["1"])}));
    });
    if (theme==="light") states.appendChild(docsSwatch("unknown kind", {seat:"1",kind:"???"}, SWATCH_SIZE));
    root.appendChild(states);
  });

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
  FACILITIES.concat(["table","small_table","separator"]).forEach(function(type){
    var it={ type:type };
    if (minRows(it)>1) it.span={ rows:minRows(it) };
    if (type==="small_table") it.facing="top";
    row.appendChild(docsSwatch(FAC_LABEL[type]||type.replace("_"," "), it, SWATCH_SIZE));
  });
  root.appendChild(row);
  var dark = docsGalleryRow();
  FACILITIES.concat(["table"]).forEach(function(type){
    var it={ type:type };
    if (minRows(it)>1) it.span={ rows:minRows(it) };
    dark.appendChild(docsSwatch("dark", it, SWATCH_SIZE, {theme:"dark"}));
  });
  root.appendChild(dark);
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
