var fs = require ('fs');
var mysql = require('mysql');
var path = require('path');
var crypto = require('crypto');

function myHash(str){
    return crypto.createHash('md5').update(crypto.createHash('md5').update(str).digest("hex")).digest("hex");
}

var server = require ('http').createServer(function (req, res) {
    //console.log(req.url);
    if(req.url=="/registration"){
    	registration(req,res);
    	return;
    }

    var filePath = '.' + req.url;
    if (filePath == './')
        filePath = './index.html';


    var extname = path.extname(filePath);
    var contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;      
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.wav':
            contentType = 'audio/wav';
            break;
    }

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT'){
                fs.readFile('./404.html', function(error, content) {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                });
            }
            else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                res.end(); 
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

var io = require ('socket.io').listen (server);

server.listen (9000, function () {
  	console.log ('Listen on port 9000');
});

var database = mysql.createConnection({
  	host     : 'localhost',
    user     : 'root',
    password : 'usbw',
    database : 'packman'
});
database.connect();

function registration(req,res){
    var params={};
    req.on('data', function(chunk) {
        var chunk=String(chunk);
        var pom=chunk.split("&");
        for(var i=0;i<pom.length;i++){
            var selector=pom[i].search('=');
            if(selector==-1){continue;}
            params[pom[i].substring(0,selector)]=pom[i].substring(selector+1);
        }
    }).on('end',function(){
        res.writeHead(200, { 'Content-Type':"text/plain"});
        database.query('SELECT count(*) as number FROM users WHERE nickname='+database.escape(params.nickname), function (error, rows, fields) {
            if (error) {
                console.log(error);
                res.end("Internal server error.");
                return;
            };
            if(rows[0].number>0){
                res.end("Nickname is already used.");
                return;
            }
            database.query('INSERT INTO users (nickname,password) VALUES ('+database.escape(params.nickname)+','+database.escape(myHash(params.password))+')', function (error, result) {
                if (error) {
                    console.log(error);
                    res.end("Internal server error.");
                    return;
                };
                res.end("Success.");
            });
        });
    });
}

var currentFreeId=0;
var rooms={};

io.on ('connection', function (socket) {
    var myRoom=null;
    var user=null;
	socket.on('login',function(nickname,password,callback){
        if(nickname=="" || password==""){
            callback("Wrong nickname or password.");
        }
		database.query('SELECT * FROM users WHERE nickname='+database.escape(nickname)+" AND password="+database.escape(myHash(password)), function (error, rows, fields) {
            if (error) {
                console.log(error);
                callback("Internal server error.");
                return;
            };
            if(rows.length<=0){
                callback("Wrong nickname or password.");
                return;
            }
            user={
                nickname:nickname,
                id:rows[0].userID
            };
            callback("Success.");
        });
	});

    socket.on('createRoom',function(roomName,callback){
        if(myRoom){
            callback("You are already in some room.");
            return;
        }
        var roomIDs=Object.keys(rooms);
        for(var i=0;i<roomIDs.length;i++){
            if(rooms[roomIDs[i]].name==roomName){
                callback("Room with this name already exists.");
                return;
            }
        }
        rooms[currentFreeId++]={
            name:roomName,
            pl1:{
                nickname:user.nickname,
                id:user.id,
                socket:socket
            },
            pl2:null,
            game:null
        }
        myRoom=rooms[currentFreeId-1];
        callback("Success.");
    });

    socket.on('getRoomsList',function(callback){
        var roomIDs=Object.keys(rooms);
        var result=[];
        for(var i=0;i<roomIDs.length;i++){
            var id=roomIDs[i];
            if(rooms[id].pl2){continue;}
            result.push({
                id:id,
                name:rooms[id].name,
                oponent:rooms[id].pl1.nickname
            });
        }
        callback(result);
    });
});