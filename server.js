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

//---Databáza-----------------------------------

var database = mysql.createConnection({
  	host     : 'localhost',
    user     : 'root',
    password : 'usbw',
    database : 'packman'
});
database.connect();

database.query("DELETE FROM rooms;", function (error, rows, fields) {
    if (error) {
        console.log(error);
        return;
    };
});

//----------------------------------------------

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
var logedUsers=[];

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
            if(logedUsers.includes(nickname)){
            	callback("You are allready logged.");
            	return;
            }
            logedUsers.push(nickname);
            user={
                nickname:nickname,
                id:rows[0].userID
            };
            callback("Success.");
        });
	});

    socket.on('createRoom',function(roomName,mapID,callback){
    	if(user===null){
    		return;
    	}
    	if(myRoom){
            callback("You are already in some room.");
            return;
        }
        database.query('SELECT count(*) as pocet FROM rooms WHERE name='+database.escape(roomName), function (error, rows, fields) {
            if (error) {
                console.log(error);
                callback("Internal server error.");
                return;
            };
            if(rows[0].pocet>0){
            	callback("Room with this name already exists.");
                return;
            }
            database.query('SELECT count(*) as pocet FROM maps WHERE MapID='+database.escape(mapID), function (error, rows, fields) {
	            if (error) {
	                console.log(error);
	                callback("Internal server error.");
	                return;
	            };
	            if(rows[0].pocet==0){
	            	callback("Map not exists.");
	                return;
	            }
	            database.query('INSERT INTO rooms (name,author,map) VALUES ('+database.escape(roomName)+','+database.escape(user.id)+','+database.escape(mapID)+')', function (error, result) {
	                if (error) {
	                    console.log(error);
	                    res.end("Internal server error.");
	                    return;
	                };
	                myRoom={
	                	roomID:result.insertId,
			            name:roomName,
			            pl1:{
			                nickname:user.nickname,
			                id:user.id,
			                socket:socket
			            },
			            pl2:null,
			            game:null
			        }
	                callback("Success.");
	            });
	        });    
        });
    });

    socket.on('getRoomsList',function(callback){
    	if(user===null){
    		return;
    	}
    	database.query(`SELECT r.RoomID as id, r.Name as name, u.Nickname as oponent, 
    					m.name as map_name, m.image as map_image FROM rooms as r
    					INNER JOIN users as u ON r.author=u.userID
    					INNER JOIN maps as m ON r.map=m.mapID`, function (error, rows, fields) {
            if (error) {
                console.log(error);
                callback("Internal server error.");
                return;
            };
            callback(rows);
        });
    });

    socket.on("getMapsList",function(callback){
    	if(user===null){
    		return;
    	}
    	database.query("SELECT * FROM maps", function (error, rows, fields) {
            if (error) {
                console.log(error);
                callback("Internal server error.");
                return;
            };
            callback(rows);
        });
    });

    socket.on('disconnect',function(){
    	if(user===null){
    		return;
    	}
    	if(myRoom!==null){
	    	database.query("DELETE FROM rooms WHERE RoomID=?",[myRoom.roomID],function(error,result){
	    		if (error) {
	                console.log(error);
	                return;
	            };
	    	});
	    }
    	logedUsers.splice(logedUsers.indexOf(user.nickname),1);
    });
});