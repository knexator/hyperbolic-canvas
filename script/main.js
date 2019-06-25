console.log("start")

const mats = require("gl-matrix");
const mink = require("hyperboloid-model");
//const Tiling = require("hyperbolic-tiling");

mats.glMatrix.setMatrixArrayType(Float64Array);

let socket;
let canvas, ctx;
let radius;
let local_tiling = null;
let redraw_timer = null;
let prev_mouse = null;
let view_tile = {id: 0, lastOffset: mats.mat3.create()};
let view_off = mats.mat3.create();
let local_segments = [];
let local_draw_info_temp = [];
//mink.xMove(view_off, 1);
//let last_tiling_time = 0;

$(function () {
  socket = io();
  init();
  $(window).on('resize', function(){
    resizeCanvas();
  });
  $(canvas).on('mousemove', mouseMoved);
  //$(canvas).on('touchmove', touchMoved);
  $(canvas).on('touchend', () => {
    prev_mouse = null;
  });
  $(canvas).on('contextmenu', () => false);
  window.redraw = redraw;  
});

function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();  
  //setInterval(sendSegments, 500);
  setInterval(redraw, 500);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.lineCap = "round";
  radius = Math.min(canvas.width, canvas.height)/2;
  redraw();
  clearTimeout(redraw_timer);
  redraw_timer = setTimeout(redraw, 250);
}

function getTiling(callback) {
  console.log("getting tiling");
  /*let tempMat = mats.mat3.create();
  mats.mat3.mul(tempMat, view_off, view_tile.lastOffset);
  mink.gramSchmidt(tempMat, tempMat);
  let url = "drawTile/" + view_tile.id.toString() + '/' + JSON.stringify(Object.values(tempMat));
  mats.mat3.copy(tempMat, view_off);
  //console.log(url);
  fetch(url) //"drawTile/0/[1,0,0,0,1,0,0,0,1]")
    .then(resp => resp.json())
    .then(jsonData => {
      let {tiles, viewTile, viewOffset} = jsonData;
      local_tiling = tiles;
      view_tile = viewTile;
      mats.mat3.invert(tempMat, tempMat);
      mats.mat3.mul(view_off, tempMat, view_off);
      callback();
    });*/
  let tempMat = mats.mat3.create();
  mats.mat3.mul(tempMat, view_off, view_tile.lastOffset);
  mink.gramSchmidt(tempMat, tempMat);
  //console.log(tempMat);
  //console.log(view_tile.id);
  socket.emit('getTiling', view_tile.id, tempMat, function(error, tiling) {
    if (error) {
      throw new Error("Can't get tiling");
    } else {
      //console.log(tiling);
      let {tiles, viewTile, viewOffset} = tiling;
      local_tiling = tiles;
      //console.log(local_tiling);
      view_tile = viewTile;
      //console.log(view_tile);
      mats.mat3.invert(tempMat, tempMat);
      mats.mat3.mul(view_off, view_off, tempMat);
      callback();
    }
  });
  mats.mat3.copy(tempMat, view_off);
}

function redraw() {
  //console.log('redrawing');
  sendSegments(() => {
    console.log("sent segments");
    getTiling(drawTiling);
  })  
}

function drawTiling() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = "#000000";
  ctx.beginPath();
  ctx.arc(canvas.width/2, canvas.height/2, radius, 0, 2 * Math.PI);
  ctx.stroke();
  let mat = mats.mat3.create();
  /*ctx.font = "30px Arial";
  ctx.textAlign = "center";
  ctx.baseline = "middle";*/
  ctx.strokeStyle = "#FF0000";
  ctx.beginPath();
  local_draw_info_temp.forEach(data => {
    //mats.mat3.mul(mat, view_off, data.offset);
    let p = mats.vec3.fromValues(data.px, data.py, data.pz);
    let q = mats.vec3.fromValues(data.qx, data.qy, data.qz);
    mats.vec3.transformMat3(p, p, data.mat);
    mats.vec3.transformMat3(q, q, data.mat);
    ctx.moveTo(...minkToScreen(p));
    ctx.lineTo(...minkToScreen(q));
  });
  ctx.stroke();
  ctx.strokeStyle = "#0000FF";
  ctx.beginPath();  
  local_tiling.forEach(tile => {
    //console.log(tile.id);
    //console.log(tile.lastDist);
    //let mat = mats.mat3.fromValues(...Object.values(tile.lastOffset));    
    mats.mat3.mul(mat, view_off, tile.lastOffset);
    /*let center = mats.vec3.transformMat3(mats.vec3.create(), mink.origin, mat);
    //console.log(center);
    let [x,y] = mink.toPoincare(center);
    let i = x*radius + canvas.width/2;
    let j = y*radius + canvas.height/2;*/
    //ctx.fillRect(i,j,10,10);    
    //ctx.fillText(tile.id, i, j);
    //console.log(tile);
    /*if (tile.id === 0) {
      console.log(tile.segments);
    }*/
    tile.segments.forEach(seg => {
      //console.log(seg);
      //let center = mats.vec3.transformMat3(mats.vec3.create(), mats.vec3.from, mat);
      let p = mats.vec3.fromValues(seg.px, seg.py, seg.pz);
      let q = mats.vec3.fromValues(seg.qx, seg.qy, seg.qz);
      mats.vec3.transformMat3(p, p, mat);
      mats.vec3.transformMat3(q, q, mat);
      ctx.moveTo(...minkToScreen(p));
      ctx.lineTo(...minkToScreen(q));
    });
  });
  ctx.stroke();
  //console.log("drawn")
}

function mouseMoved(event) {
  /*if (event.timeStamp - last_mouse_move_time < 20) return;
  last_mouse_move_time = event.timeStamp;
  console.log(last_mouse_move_time);*/
  let dx = (event.offsetX-canvas.width/2)/radius;
  let dy = (event.offsetY-canvas.height/2)/radius;
  if (dx*dx+dy*dy > 0.7) {
    prev_mouse = null;
    return;
  }
  
  let cur_mouse = [event.offsetX, event.offsetY];
  if (event.buttons == 4 && prev_mouse) {
    let prev_mink = screenToMink(...prev_mouse);
    let cur_mink = screenToMink(...cur_mouse);
    let delta = mink.translationBetweenPoints(mats.mat3.create(), prev_mink, cur_mink);
    mats.mat3.mul(view_off, delta, view_off);
    mink.gramSchmidt(view_off, view_off);
    local_draw_info_temp.forEach(data => {
      mats.mat3.mul(data.mat, delta, data.mat);
    });
    /*let tempMat = mats.mat3.create();
    mats.mat3.mul(tempMat, view_off, view_tile.lastOffset)
    let center = mats.vec3.transformMat3(mats.vec3.create(), mink.origin, tempMat);
    let dist = mink.dist(center, mink.origin);*/
    //if (dist > 2) {
    //redraw();
    //} else {
    //local_draw_info_temp = [];
    drawTiling();
    //}
    //console.log(delta);
    //delta = hyper.matrixFromPtoQ(prevMouse, curMouse)
    //self.offMat = hyper.gramSchmidt(delta @ self.offMat)
    //console.log('asdf')
    //redraw();
  } else if (event.buttons == 1 && prev_mouse) {
    let prev_mink = screenToMink(...prev_mouse);
    let cur_mink = screenToMink(...cur_mouse);
    let tile = local_tiling[0];
    let mat = mats.mat3.create();
    mats.mat3.mul(mat, view_off, tile.lastOffset);
    mats.mat3.invert(mat, mat);
    mats.vec3.transformMat3(prev_mink, prev_mink, mat);
    mats.vec3.transformMat3(cur_mink, cur_mink, mat);
    //let center = mats.vec3.transformMat3(mats.vec3.create(), mink.origin, mat);
    local_segments.push({tileId: tile.id,
                         px: prev_mink[0], py: prev_mink[1], pz: prev_mink[2],
                         qx: cur_mink[0], qy: cur_mink[1], qz: cur_mink[2]});
    /*ctx.beginPath();
    ctx.moveTo(...prev_mouse);
    ctx.lineTo(...cur_mouse);
    ctx.stroke();*/
    tile.segments.push({px: prev_mink[0], py: prev_mink[1], pz: prev_mink[2],
                        qx: cur_mink[0], qy: cur_mink[1], qz: cur_mink[2]});
    local_draw_info_temp.push({mat: mats.mat3.clone(tile.lastOffset),
                         px: prev_mink[0], py: prev_mink[1], pz: prev_mink[2],
                         qx: cur_mink[0], qy: cur_mink[1], qz: cur_mink[2]})
    drawTiling();
    /*if (local_segments.length > 400) {
      sendSegments();
    }*/
  }
  prev_mouse = [event.offsetX, event.offsetY];
}

function sendSegments(callback) {
  if (local_segments.length > 0) {
    socket.emit('addSegments', local_segments, callback);
    //console.log(local_segments);
    local_segments = [];
  } else if (callback) {
    callback();
  }
  //local_draw_info_temp = [];
}
window.sendSegments = sendSegments;

function screenToMink(i, j) {
  let x = (i-canvas.width/2)/radius;
  let y = (j-canvas.height/2)/radius;
  return mink.fromPoincare(x, y);
}

function minkToScreen(point) {
  let x = point[0]/(1+point[2]);
  let y = point[1]/(1+point[2]);
  let i = (x*radius) + canvas.width/2;
  let j = (y*radius) + canvas.height/2;
  return [i, j];
}

console.log("testing");