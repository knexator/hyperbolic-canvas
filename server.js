// server.js
// where your node app starts

var browserify = require('browserify-middleware');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
let server = require('http').createServer(app);
let io = require('socket.io')(server);

let port = process.env.PORT || 3000;

let listener = server.listen(port, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});

// http://expressjs.com/en/starter/static-files.html
app.use('/js', browserify(__dirname + '/script'));
app.use(express.static(__dirname + '/public'));


// init sqlite db
var fs = require('fs');
var dbFile = './.data/sqlite.db';
var exists = fs.existsSync(dbFile);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFile);
db.serialize();
//createDatabase();

function createDatabase() {
  db.serialize(function(){
    db.run(`DROP TABLE IF EXISTS Segments`);
    db.run(`CREATE TABLE IF NOT EXISTS Segments (
            tileId INTEGER,
            px DOUBLE,
            py DOUBLE,
            pz DOUBLE,
            qx DOUBLE,
            qy DOUBLE,
            qz DOUBLE,
            color TEXT,
            weight SMALLINT
    )`, console.log);
    db.run(`DROP TABLE IF EXISTS Tiling`);
    db.run(`CREATE TABLE IF NOT EXISTS Tiling (
            tileId INTEGER,
            connected0 INTEGER,
            connected1 INTEGER,
            connected2 INTEGER,
            connected3 INTEGER,
            connected4 INTEGER,
            connected5 INTEGER,
            connected6 INTEGER,
            connected7 INTEGER,
            connected8 INTEGER,
            connected9 INTEGER,
            connected10 INTEGER,
            connected11 INTEGER
    )`, console.log);
  });
}

const mats = require("gl-matrix");
const mink = require("hyperboloid-model");
const Tiling = require("hyperbolic-tiling");

mats.glMatrix.setMatrixArrayType(Float64Array);

Tiling.prototype.findDistanceBetweenCenters = function(p, q) {
  let curMin = 0;
  let curMax = 4;
  if (p==12 && q==5) {
    return 3.6124183254825164;
  } else {
    throw new Error("update the tiling version");
  }
}

let tiling = new Tiling({p:12, q:5});
tiling.expandTile(0);
tiling.expandTile(1);
//setInterval(saveTiling, 10000);

function saveTiling() {
  //db.parallelize();
  db.run("DELETE FROM Tiling;");
  var stmt = db.prepare(`INSERT INTO Tiling (tileId, 
            connected0,
            connected1,
            connected2,
            connected3,
            connected4,
            connected5,
            connected6,
            connected7,
            connected8,
            connected9,
            connected10,
            connected11) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let i=0; i<tiling.tiles.length; i++) {
    let tile = tiling.tiles[i];
    if (tile) {
      stmt.run(tile.id, ...tile.connected);
    }
  }
  db.run("DELETE FROM Segments");
  var stmt = db.prepare(`INSERT INTO Segments (tileId,
            px, py, pz,
            qx, qy, qz,
            color, weight) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (let i=0; i<tiling.tiles.length; i++) {
    let tile = tiling.tiles[i];
    if (tile && tile.segments && tile.segments.lenght>0) {
      tile.segments.forEach((seg) => {
        stmt.run(seg.tileId, seg.px, seg.py, seg.pz, seg.qx, seg.qy, seg.qz, "#000000", 1);
      });
    }
  }
}



// http://expressjs.com/en/starter/basic-routing.html
/*app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});*/

/*app.get('/drawTile/:tileId/:matrix', function(request, response) {
  let id = request.params.tileId;
  let mat = mats.mat3.fromValues(...JSON.parse(request.params.matrix));
  //console.log(mat);
  if (id && mat && tiling.tiles[id] 
      && mat.every((val) => ((val || val===0) && Math.abs(val) < 30))) {
    //let {tiles, viewTile, viewOffset} = tiling.draw(id, mat, 3, 3.5, true);
    response.json(tiling.draw(id, mat, 3, 4, true));
  }
  //response.sendFile(__dirname + '/views/index.html');
  //response.status(404);
});*/

//let writting = false;
io.on('connection', function(socket){
  socket.on('addSegments', function(segments, callback) {
    let requests = segments.map((seg) => {
        return new Promise((resolve) => {
          //stmt.run(seg.tileId, seg.px, seg.py, seg.pz, seg.qx, seg.qy, seg.qz, resolve);
          tiling.tiles[seg.tileId].segments.push(seg);
          resolve();
        });
    });
    //console.log("requested");
    Promise.all(requests).then(() => {
      //console.log("done");
      callback();
      //setTimeout(callback, 5000);
    });
    /*segments.forEach(seg => {
      tiling.tiles[seg.tileId].segments.push(seg);
    });*/
    //callback();
    //setTimeout(callback, 1500);
    //writting = true;
    /*let stmt = db.prepare(`INSERT INTO Segments (tileId, px, py, pz, qx, qy, qz) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    segments.forEach(seg => {
      stmt.run(seg.tileId, seg.px, seg.py, seg.pz, seg.qx, seg.qy, seg.qz);
    });*/
    /*let requests = segments.map((seg) => {
        return new Promise((resolve) => {
          stmt.run(seg.tileId, seg.px, seg.py, seg.pz, seg.qx, seg.qy, seg.qz, resolve);
        });
    });
    Promise.all(requests).then(() => writting = false);*/
  });
  socket.on('getTiling', function(id, mat, callback) {
    let {tiles, viewTile, viewOffset} = tiling.draw(id, mat, 3, 3.5, true);
    tiles.forEach(tile => {
      if (!tile.segments) tile.segments = [];
    });
    callback(null, {tiles, viewTile, viewOffset});
    
    //if (writting) return;
    //let {tiles, viewTile, viewOffset} = tiling.draw(id, mat, 3, 3.5, true);
    /*let stmt = db.prepare(`SELECT px, py, pz, qx, qy, qz FROM Segments WHERE tileId=?`);
    tiles.forEach(tile => {
      if (!tile.segments || tile.segments.length === 0) {
        tile.segments = [];
      }
      tile.segments = [];
      stmt.all(tile.id, function(err, rows) {
        tile.segments = rows;
      });
    })
    let requests = tiles.map((tile) => {
        return new Promise((resolve) => {
          tile.segments = [];
          stmt.all(tile.id, function(err, rows) {
            tile.segments = rows;
          }, resolve);
        });
    });
    Promise.all(requests).then(() => callback(null, {tiles, viewTile, viewOffset}));*/
    /*setTimeout(function () {
      callback(null, {tiles, viewTile, viewOffset});
    }, 1000);*/
    //let stmt = db.prepare(`INSERT INTO Tiling (tileId,
    // Use a Node style callback (error, value)
    //if (id && mat && tiling.tiles[id] 
    //  && mat.every((val) => ((val || val===0) && Math.abs(val) < 30))) {
      //callback(null, tiling.draw(id, mat, 3, 4, true));
    //} else {
    //  callback(new Error("forbidden view"), null)
    //}
  });
});

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

let connections = [];

server.on('connection', connection => {
    connections.push(connection);
    connection.on('close', () => connections = connections.filter(curr => curr !== connection));
});

function shutDown() {
    console.log('Received kill signal, shutting down gracefully');
    server.close(() => {
        console.log('Closed out remaining connections');
        saveTiling();
        setTimeout(() => process.exit(0), 3500);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        saveTiling();
        setTimeout(() => process.exit(1), 3500);
    }, 10000);

    connections.forEach(curr => curr.end());
    setTimeout(() => connections.forEach(curr => curr.destroy()), 5000);
}
